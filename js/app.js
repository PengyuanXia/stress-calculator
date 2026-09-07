/**
 * app.js - Master Controller for Beam Stress Distribution Calculator
 * Coordinates Section Models, Stress Engine, 3-Canvas Viewport,
 * Mohr Visualizer, KaTeX Derivations, Presets, Sharing, Day/Night Theme, and i18n.
 */

import { SectionGeometry } from './section-models.js';
import { StressEngine } from './stress-engine.js';
import { DiagramRenderer } from './diagram-renderer.js';
import { MohrRenderer } from './mohr-renderer.js';
import { DerivationRenderer } from './derivation-renderer.js';
import { PRESETS } from './presets.js';
import { TRANSLATIONS } from './i18n.js';
import { ShareManager } from './share.js';

class StressCalculatorApp {
  constructor() {
    this.state = {
      shapeType: 'ibeam',
      params: { ...PRESETS.ibeam[0].params },
      moments: { My: 50, Mz: 0 },
      shears: { Vz: 50, Vy: 0 },
      probeY: 0,
      probeZ: 0,
      lang: 'en',
      theme: 'light', // Day mode default
      convention: 'sagging_positive'
    };

    this.section = null;
    this.analysis = null;
    this.diagramRenderer = null;
    this.mohrRenderer = null;
    this.derivationRenderer = null;
    this.shareManager = null;

    this.init();
  }

  async init() {
    this.shareManager = new ShareManager(this);
    this.derivationRenderer = new DerivationRenderer('derivationsContainer');

    // Check URL hash for shared model
    const hash = window.location.hash;
    if (hash && hash.startsWith('#')) {
      const restored = await this.shareManager.decodeModel(hash.slice(1));
      if (restored) {
        this.state.shapeType = restored.shapeType;
        this.state.params = restored.params;
        if (restored.loading) {
          this.state.loading = restored.loading;
        } else if (restored.forces) {
          const V = Math.abs(restored.forces.V ?? 75);
          const M = Math.abs(restored.forces.M ?? 45);
          const F = Math.max(1, V);
          const L = Math.max(0.1, M / F);
          this.state.loading = { F, alpha: 0, L };
        }
        if (typeof restored.probeY === 'number') this.state.probeY = restored.probeY;
        if (typeof restored.probeZ === 'number') this.state.probeZ = restored.probeZ;
        if (restored.lang) this.state.lang = restored.lang;
      }
    }

    // Check URL query parameters (e.g. ?shape=rect&b=16&h=24&My=450&Mz=-779)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('shape')) {
      const s = urlParams.get('shape');
      this.state.shapeType = s;
      const presets = PRESETS[s];
      if (presets && presets[0]) {
        this.state.params = { ...presets[0].params };
      }
    }
    ['b', 'h', 'tw', 'tf', 'bft', 'tft', 'bfb', 'tfb', 'twl', 'twr', 'D'].forEach(p => {
      if (urlParams.has(p)) {
        this.state.params = this.state.params || {};
        let val = parseFloat(urlParams.get(p));
        // If legacy URL provided in mm (> 70), convert to cm:
        if (val > 70) val = val / 10;
        this.state.params[p] = val;
      }
    });
    if (urlParams.has('My')) {
      this.state.moments.My = parseFloat(urlParams.get('My'));
    }
    if (urlParams.has('Mz')) {
      this.state.moments.Mz = parseFloat(urlParams.get('Mz'));
    }
    if (urlParams.has('Tz') || urlParams.has('Vz')) {
      this.state.shears.Vz = parseFloat(urlParams.get('Tz') || urlParams.get('Vz'));
    }
    if (urlParams.has('Ty') || urlParams.has('Vy')) {
      this.state.shears.Vy = parseFloat(urlParams.get('Ty') || urlParams.get('Vy'));
    }
    if (urlParams.has('elemMode')) {
      this.state.elemMode = urlParams.get('elemMode');
    }

    this.applyTheme(this.state.theme);
    this.initRenderers();
    this.initUI();
    this.updateLanguage(this.state.lang);
    this.recalculate();

    if (urlParams.has('printPreview')) {
      document.body.classList.add('print-preview');
      this.updatePrintSummary();
      setTimeout(() => this.render(), 100);
    }

    window.addEventListener('resize', () => {
      if (this.diagramRenderer) this.diagramRenderer.resizeCanvases();
      if (this.mohrRenderer) this.mohrRenderer.resize();
      this.render();
    });
  }

  t(key) {
    const dict = TRANSLATIONS[this.state.lang] || TRANSLATIONS.en;
    return dict[key] || TRANSLATIONS.en[key] || key;
  }

  applyTheme(theme) {
    this.state.theme = theme;
    if (theme === 'dark') {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }

    if (this.diagramRenderer) this.diagramRenderer.setTheme(theme);
    if (this.mohrRenderer) this.mohrRenderer.setTheme(theme);
  }

  initRenderers() {
    this.diagramRenderer = new DiagramRenderer({
      section: document.getElementById('canvasSection'),
      sigma: document.getElementById('canvasSigma'),
      tauY: document.getElementById('canvasTauY'),
      tauZ: document.getElementById('canvasTauZ')
    }, { theme: this.state.theme });

    this.diagramRenderer.onProbeChange = (y) => {
      this.state.probeY = y;
      this.updateReadout();
      this.renderSecondary();
    };

    this.diagramRenderer.onProbeZChange = (z) => {
      this.state.probeZ = z;
      this.updateReadout();
    };

    this.mohrRenderer = new MohrRenderer(
      document.getElementById('canvasElement'),
      document.getElementById('canvasMohr'),
      { theme: this.state.theme }
    );
  }

  initUI() {
    // 1. Shape Selection Buttons
    const shapeButtons = document.querySelectorAll('.shape-btn');
    shapeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const shape = btn.dataset.shape;
        if (shape && shape !== this.state.shapeType) {
          this.setShape(shape);
        }
      });
    });

    // 3. Preset Select
    const presetSelect = document.getElementById('presetSelect');
    if (presetSelect) {
      presetSelect.addEventListener('change', (e) => {
        const idx = parseInt(e.target.value, 10);
        const presets = PRESETS[this.state.shapeType];
        if (presets && presets[idx]) {
          this.state.params = { ...presets[idx].params };
          this.rebuildParamInputs();
          this.recalculate();
        }
      });
    }

    // 4. Applied Bending Moments & Shear Forces Inputs (Academic 2x2 Grid)
    const inpMy = document.getElementById('inpMomentMy');
    const inpMz = document.getElementById('inpMomentMz');
    const inpVz = document.getElementById('inpShearVz');
    const inpVy = document.getElementById('inpShearVy');

    const updateMy = (val) => {
      this.state.moments.My = val;
      if (inpMy && document.activeElement !== inpMy) inpMy.value = val;
      this.recalculate();
    };

    const updateMz = (val) => {
      this.state.moments.Mz = val;
      if (inpMz && document.activeElement !== inpMz) inpMz.value = val;
      this.recalculate();
    };

    if (inpMy) {
      inpMy.addEventListener('input', () => {
        const v = parseFloat(inpMy.value);
        this.state.moments.My = isNaN(v) ? 0 : v;
        this.recalculate();
      });
    }

    if (inpMz) {
      inpMz.addEventListener('input', () => {
        const v = parseFloat(inpMz.value);
        this.state.moments.Mz = isNaN(v) ? 0 : v;
        this.recalculate();
      });
    }

    if (inpVz) {
      inpVz.addEventListener('input', () => {
        const v = parseFloat(inpVz.value);
        this.state.shears.Vz = isNaN(v) ? 0 : v;
        this.recalculate();
      });
    }

    if (inpVy) {
      inpVy.addEventListener('input', () => {
        const v = parseFloat(inpVy.value);
        this.state.shears.Vy = isNaN(v) ? 0 : v;
        this.recalculate();
      });
    }

    // 5. Language Toggle
    const btnLang = document.getElementById('btnLangToggle');
    if (btnLang) {
      btnLang.addEventListener('click', () => {
        this.state.lang = this.state.lang === 'en' ? 'pl' : 'en';
        this.updateLanguage(this.state.lang);
        this.recalculate();
      });
    }

    // 5b. Contact Creator Button & Modal
    const btnContact = document.getElementById('btnContact');
    const modalContact = document.getElementById('modalContact');
    const btnCloseContact = document.getElementById('btnCloseContactModal');
    const btnCloseContactFooter = document.getElementById('btnCloseContactModalFooter');
    const btnCopyEmail = document.getElementById('btnCopyEmail');

    const btnFooterContact = document.getElementById('btnFooterContact');

    if (btnContact) {
      btnContact.addEventListener('click', () => this.openContactModal());
    }

    if (btnFooterContact) {
      btnFooterContact.addEventListener('click', () => this.openContactModal());
    }

    if (btnCloseContact) {
      btnCloseContact.addEventListener('click', () => this.closeContactModal());
    }

    if (btnCloseContactFooter) {
      btnCloseContactFooter.addEventListener('click', () => this.closeContactModal());
    }

    if (modalContact) {
      modalContact.addEventListener('click', (e) => {
        if (e.target === modalContact) this.closeContactModal();
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalContact && modalContact.classList.contains('open')) {
        this.closeContactModal();
      }
    });

    if (btnCopyEmail) {
      btnCopyEmail.addEventListener('click', () => this.copyEmailToClipboard());
    }

    // 6. Share Button
    const btnShare = document.getElementById('btnShare');
    if (btnShare) {
      btnShare.addEventListener('click', () => {
        this.shareManager.open(this.state);
      });
    }

    // 7. Export PNG Button
    const btnExport = document.getElementById('btnExportPNG');
    if (btnExport) {
      btnExport.addEventListener('click', () => this.exportCompositePNG());
    }

    // 8. Print Report Button
    const btnPrint = document.getElementById('btnPrintReport');
    if (btnPrint) {
      btnPrint.addEventListener('click', () => {
        this.updatePrintSummary();
        window.print();
      });
    }

    window.addEventListener('beforeprint', () => {
      this.updatePrintSummary();
    });

    // 9. Stress Element Mode Toggle (Standard vs Principal)
    const btnElemStd = document.getElementById('btnElemModeStd');
    const btnElemPrin = document.getElementById('btnElemModePrin');
    if (btnElemStd && btnElemPrin) {
      const setElemMode = (mode) => {
        const isStd = mode === 'standard';
        btnElemStd.className = isStd
          ? 'px-2 py-0.5 rounded-md text-[11px] font-mono transition-all bg-white dark:bg-slate-700 text-sky-600 dark:text-cyan-400 font-bold shadow-xs cursor-pointer'
          : 'px-2 py-0.5 rounded-md text-[11px] font-mono transition-all text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer';
        btnElemPrin.className = !isStd
          ? 'px-2 py-0.5 rounded-md text-[11px] font-mono transition-all bg-white dark:bg-slate-700 text-sky-600 dark:text-cyan-400 font-bold shadow-xs cursor-pointer'
          : 'px-2 py-0.5 rounded-md text-[11px] font-mono transition-all text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer';
        if (this.mohrRenderer) {
          this.mohrRenderer.setElementMode(mode);
        }
      };

      btnElemStd.addEventListener('click', () => setElemMode('standard'));
      btnElemPrin.addEventListener('click', () => setElemMode('principal'));

      if (this.state.elemMode) {
        setElemMode(this.state.elemMode);
      }
    }

    // 10. Height of Interest (z) Controls (Manual numeric input, slider, preset buttons)
    const inpProbeZ = document.getElementById('inpProbeZ');
    const sliderProbeZ = document.getElementById('sliderProbeZ');
    const btnProbeTop = document.getElementById('btnProbeTop');
    const btnProbeNA = document.getElementById('btnProbeNA');
    const btnProbeBot = document.getElementById('btnProbeBot');

    const setProbeZ = (zCm) => {
      if (!this.section) return;
      // Convert z [cm] (downward positive) to internal y [mm] (upward positive)
      const yInternal = - (zCm * 10);
      const clampedY = Math.max(this.section.yBot, Math.min(this.section.yTop, yInternal));
      this.state.probeY = clampedY;
      this.diagramRenderer.setData(this.section, this.analysis, this.state.probeY, this.state.probeZ);
      this.updateReadout();
      this.renderSecondary();
    };

    if (inpProbeZ) {
      inpProbeZ.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) setProbeZ(val);
      });
    }

    if (sliderProbeZ) {
      sliderProbeZ.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) setProbeZ(val);
      });
    }

    if (btnProbeTop) {
      btnProbeTop.addEventListener('click', () => {
        if (this.section) setProbeZ(- (this.section.yTop / 10));
      });
    }

    if (btnProbeNA) {
      btnProbeNA.addEventListener('click', () => {
        setProbeZ(0);
      });
    }

    if (btnProbeBot) {
      btnProbeBot.addEventListener('click', () => {
        if (this.section) setProbeZ(- (this.section.yBot / 10));
      });
    }

    // Sync initial moment inputs and readouts with state
    if (inpMy) inpMy.value = this.state.moments.My;
    if (inpMz) inpMz.value = this.state.moments.Mz;
    if (inpVz) inpVz.value = this.state.shears.Vz;
    if (inpVy) inpVy.value = this.state.shears.Vy;

    document.querySelectorAll('.shape-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.shape === this.state.shapeType);
    });

    this.rebuildParamInputs();
    this.populatePresetsDropdown();
  }

  setShape(shapeType) {
    this.state.shapeType = shapeType;

    const presets = PRESETS[shapeType];
    if (presets && presets[0]) {
      this.state.params = { ...presets[0].params };
    }

    document.querySelectorAll('.shape-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.shape === shapeType);
    });

    this.populatePresetsDropdown();
    this.rebuildParamInputs();
    this.recalculate();
  }

  populatePresetsDropdown() {
    const sel = document.getElementById('presetSelect');
    if (!sel) return;
    const list = PRESETS[this.state.shapeType] || [];
    sel.innerHTML = `<option value="" disabled selected>${this.t('presetsDropdown')}</option>` +
      list.map((p, idx) => `<option value="${idx}">${p.name}</option>`).join('');
  }

  rebuildParamInputs() {
    const container = document.getElementById('paramInputsContainer');
    if (!container) return;

    const shape = this.state.shapeType;
    let fields = [];

    switch (shape) {
      case 'rect':
        fields = [
          { key: 'b', label: this.t('dim_b'), min: 1, max: 300, step: 0.5 },
          { key: 'h', label: this.t('dim_h'), min: 1, max: 400, step: 0.5 }
        ];
        break;

      case 'ibeam':
        fields = [
          { key: 'h', label: this.t('dim_h'), min: 2, max: 300, step: 0.5 },
          { key: 'tw', label: this.t('dim_tw'), min: 0.1, max: 30, step: 0.05 },
          { key: 'bft', label: this.t('dim_bft'), min: 1, max: 200, step: 0.5 },
          { key: 'tft', label: this.t('dim_tft'), min: 0.1, max: 30, step: 0.05 },
          { key: 'bfb', label: this.t('dim_bfb'), min: 1, max: 200, step: 0.5 },
          { key: 'tfb', label: this.t('dim_tfb'), min: 0.1, max: 30, step: 0.05 }
        ];
        break;

      case 'tbeam':
        fields = [
          { key: 'h', label: this.t('dim_h'), min: 2, max: 300, step: 0.5 },
          { key: 'b', label: this.t('dim_b'), min: 2, max: 200, step: 0.5 },
          { key: 'tf', label: this.t('dim_tf'), min: 0.1, max: 30, step: 0.05 },
          { key: 'tw', label: this.t('dim_tw'), min: 0.1, max: 30, step: 0.05 }
        ];
        break;

      case 'box':
        fields = [
          { key: 'h', label: this.t('dim_H'), min: 2, max: 300, step: 0.5 },
          { key: 'b', label: this.t('dim_B'), min: 2, max: 200, step: 0.5 },
          { key: 'tft', label: this.t('dim_tft'), min: 0.1, max: 30, step: 0.05 },
          { key: 'tfb', label: this.t('dim_tfb'), min: 0.1, max: 30, step: 0.05 },
          { key: 'twl', label: this.t('dim_twl'), min: 0.1, max: 30, step: 0.05 },
          { key: 'twr', label: this.t('dim_twr'), min: 0.1, max: 30, step: 0.05 }
        ];
        break;

      case 'circle':
        fields = [
          { key: 'D', label: this.t('dim_D'), min: 1, max: 300, step: 0.5 }
        ];
        break;
    }

    container.innerHTML = fields.map(f => {
      const val = this.state.params[f.key] ?? f.min;
      return `
        <div>
          <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">${f.label}</label>
          <input type="number" id="inp_${f.key}" data-param="${f.key}" value="${val}" min="${f.min}" max="${f.max}" step="any" class="w-full bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700/80 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white font-mono focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all">
        </div>
      `;
    }).join('');

    fields.forEach(f => {
      const input = document.getElementById(`inp_${f.key}`);
      if (input) {
        input.addEventListener('input', (e) => {
          let val = parseFloat(e.target.value);
          if (isNaN(val) || val <= 0) val = 0.1;
          this.state.params[f.key] = val;
          this.recalculate();
        });
      }
    });
  }

  recalculate() {
    try {
      const mmParams = {};
      for (const k in this.state.params) {
        mmParams[k] = this.state.params[k] * 10;
      }
      this.section = SectionGeometry.create(this.state.shapeType, mmParams);
      this.analysis = StressEngine.analyze(this.section, {
        My: this.state.moments.My,
        Mz: this.state.moments.Mz,
        Vz: this.state.shears.Vz,
        Vy: this.state.shears.Vy
      }, { name: 'Elastic', fy: 235 }, {
        convention: this.state.convention
      });

      if (this.state.probeY < this.section.yBot || this.state.probeY > this.section.yTop) {
        this.state.probeY = 0;
      }

      this.diagramRenderer.setData(this.section, this.analysis, this.state.probeY, this.state.probeZ);
      this.updateReadout();
      this.renderSecondary();
    } catch (err) {
      console.error('Recalculate error:', err);
    }
  }

  render() {
    if (this.diagramRenderer) this.diagramRenderer.renderAll();
    this.renderSecondary();
  }

  renderSecondary() {
    if (!this.analysis) return;
    const probePt = this.analysis.evaluateAt(this.state.probeY);
    if (this.mohrRenderer) this.mohrRenderer.render(probePt, this.analysis);
    if (this.derivationRenderer) this.derivationRenderer.render(this.section, this.analysis, probePt, this.state.lang);
  }

  updateReadout() {
    if (!this.analysis || !this.section) return;
    const pt = this.analysis.evaluateAt(this.state.probeY);

    const setTxt = (id, txt) => {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
    };

    const zDisplay = pt.zUser ?? (-pt.y);
    const zCm = zDisplay / 10;
    const yBotCm = pt.yFromBot / 10;
    const bCm = pt.width / 10;
    const SyCm3 = pt.Sy / 1e3;

    setTxt('readout_yNA', `${zCm >= 0 ? '+' : ''}${zCm.toFixed(1)} cm`);
    setTxt('readout_yNA_badge', `${zCm >= 0 ? '+' : ''}${zCm.toFixed(1)} cm`);
    setTxt('readout_yBot', `${yBotCm.toFixed(1)} cm`);
    setTxt('readout_b', `${bCm.toFixed(1)} cm`);
    setTxt('readout_Sy', `${SyCm3.toFixed(1)} cm³`);

    // Normal stress
    const elSigma = document.getElementById('readout_sigma');
    if (elSigma) {
      elSigma.textContent = `${pt.sigma >= 0 ? '+' : ''}${pt.sigma.toFixed(2)} MPa`;
      elSigma.className = `font-mono font-bold text-base sm:text-lg ${pt.sigma >= 0 ? 'text-sky-600 dark:text-cyan-400' : 'text-rose-600 dark:text-rose-400'}`;
    }

    // Vertical shear stress
    const elTau = document.getElementById('readout_tau');
    if (elTau) {
      const tauVal = pt.tauSigned !== undefined ? pt.tauSigned : pt.tau;
      const tauSign = tauVal >= 0 ? '+' : '';
      elTau.textContent = `${tauSign}${tauVal.toFixed(2)} MPa`;
      elTau.className = `font-mono font-bold text-base sm:text-lg ${tauVal < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`;
    }

    // Peak horizontal shear stress
    const elTauZ = document.getElementById('readout_tauZ');
    if (elTauZ) {
      const peakTauZ = this.analysis.extrema.maxTauZAbs || this.analysis.extrema.maxTauZ || 0;
      elTauZ.textContent = `${peakTauZ.toFixed(2)} MPa`;
    }

    // Update Resulting Force Chips in sidebar
    const f = this.analysis.forces;
    if (f) {
      setTxt('chip_My', `${(f.My_kNm || 0).toFixed(1)} kNm`);
      setTxt('chip_Mz', `${(f.Mz_kNm || 0).toFixed(1)} kNm`);
      setTxt('chip_Vz', `${(f.Vz_kN || 0).toFixed(1)} kN`);
      setTxt('chip_Vy', `${(f.Vy_kN || 0).toFixed(1)} kN`);
      setTxt('labelMyReadout', `${this.state.moments.My >= 0 ? '+' : ''}${this.state.moments.My.toFixed(1)} kNm`);
      setTxt('labelMzReadout', `${this.state.moments.Mz >= 0 ? '+' : ''}${this.state.moments.Mz.toFixed(1)} kNm`);
    }

    // Principal stresses
    setTxt('readout_p1', `${pt.sigma1 >= 0 ? '+' : ''}${pt.sigma1.toFixed(2)} MPa`);
    setTxt('readout_p2', `${pt.sigma2 >= 0 ? '+' : ''}${pt.sigma2.toFixed(2)} MPa`);
    setTxt('readout_theta', `${pt.thetaPDeg.toFixed(1)}°`);

    // Height of Interest sidebar controls sync
    const inpProbeZ = document.getElementById('inpProbeZ');
    if (inpProbeZ && document.activeElement !== inpProbeZ) {
      inpProbeZ.value = zCm.toFixed(1);
    }

    const sliderProbeZ = document.getElementById('sliderProbeZ');
    if (sliderProbeZ && this.section) {
      const zTopCm = - (this.section.yTop / 10);
      const zBotCm = - (this.section.yBot / 10);
      sliderProbeZ.min = zTopCm.toFixed(1);
      sliderProbeZ.max = zBotCm.toFixed(1);
      if (document.activeElement !== sliderProbeZ) {
        sliderProbeZ.value = zCm.toFixed(1);
      }
      const labelZMin = document.getElementById('label_zMin');
      const labelZMax = document.getElementById('label_zMax');
      if (labelZMin) labelZMin.textContent = `Top: ${zTopCm.toFixed(1)} cm`;
      if (labelZMax) labelZMax.textContent = `Bot: +${zBotCm.toFixed(1)} cm`;
    }

    this.updatePrintSummary();
  }

  updatePrintSummary() {
    const isPl = this.state.lang === 'pl';
    const dateEl = document.getElementById('printReportDate');
    if (dateEl) {
      dateEl.innerHTML = `<strong>${isPl ? 'Data:' : 'Date:'}</strong> ${new Date().toLocaleDateString(isPl ? 'pl-PL' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
    }

    const geomEl = document.getElementById('printSummaryGeom');
    if (geomEl && this.section) {
      const s = this.section;
      const Iy_cm4 = (s.Iz / 1e4).toFixed(1);
      const Iz_cm4 = ((s.Iy || s.Iz) / 1e4).toFixed(1);
      const A_cm2 = (s.area / 100).toFixed(1);
      const zBot_cm = (s.yBar / 10).toFixed(1);
      const shapeName = this.t(`shape_${this.state.shapeType}`);
      geomEl.innerHTML = `
        <div>• <strong>${isPl ? 'Przekrój:' : 'Section Profile:'}</strong> ${shapeName}</div>
        <div>• <strong>${isPl ? 'Wymiary:' : 'Dimensions:'}</strong> ${this.formatSectionParams(this.state.params)}</div>
        <div>• <strong>${isPl ? 'Pole & Śr. ciężkości:' : 'Area & Centroid:'}</strong> <i>A</i> = ${A_cm2} cm², <i>z̄</i><sub>bot</sub> = ${zBot_cm} cm</div>
        <div>• <strong>${isPl ? 'Momenty bezwładności:' : 'Moments of Inertia:'}</strong> <i>J</i><sub>y</sub> = ${Iy_cm4} cm⁴, <i>J</i><sub>z</sub> = ${Iz_cm4} cm⁴</div>
      `;
    }

    const forcesEl = document.getElementById('printSummaryForces');
    if (forcesEl && this.analysis) {
      const f = this.analysis.forces || {};
      const sh = this.analysis.shears || {};
      const mo = this.analysis.moments || {};
      const My = mo.My ?? f.My_kNm ?? 50;
      const Mz = mo.Mz ?? f.Mz_kNm ?? 0;
      const Tz = sh.Vz ?? f.Vz_kN ?? 50;
      const Ty = sh.Vy ?? f.Vy_kN ?? 0;
      const beta = this.analysis.neutralAxis?.betaDeg ?? 90;
      forcesEl.innerHTML = `
        <div>• <strong>${isPl ? 'Momenty gnące:' : 'Bending Moments:'}</strong> <i>M</i><sub>y</sub> = ${My >= 0 ? '+' : ''}${My.toFixed(1)} kNm, <i>M</i><sub>z</sub> = ${Mz >= 0 ? '+' : ''}${Mz.toFixed(1)} kNm</div>
        <div>• <strong>${isPl ? 'Siły tnące:' : 'Shear Forces:'}</strong> <i>T</i><sub>z</sub> = ${Tz >= 0 ? '+' : ''}${Tz.toFixed(1)} kN, <i>T</i><sub>y</sub> = ${Ty >= 0 ? '+' : ''}${Ty.toFixed(1)} kN</div>
        <div>• <strong>${isPl ? 'Oś obojętna (N-A):' : 'Neutral Axis (N-A):'}</strong> <i>β</i> = ${beta.toFixed(1)}°</div>
        <div>• <strong>${isPl ? 'Badana wysokość:' : 'Inspected Elevation:'}</strong> <i>z</i> = ${(this.state.probeY / 10).toFixed(1)} cm</div>
      `;
    }
  }

  formatSectionParams(params) {
    if (!params) return '';
    return Object.entries(params).map(([k, v]) => `<i>${k}</i> = ${v} cm`).join(', ');
  }

  updateLanguage(lang) {
    this.state.lang = lang;
    const btn = document.getElementById('btnLangToggle');
    if (btn) btn.textContent = this.t('langToggle');

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        const val = this.t(key);
        if (val.includes('<')) {
          el.innerHTML = val;
        } else {
          el.textContent = val;
        }
      }
    });

    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (key) {
        el.setAttribute('title', this.t(key));
      }
    });

    const btnKofi = document.getElementById('btnKofi');
    if (btnKofi) btnKofi.setAttribute('title', this.t('kofiTitle'));

    const btnContact = document.getElementById('btnContact');
    if (btnContact) btnContact.setAttribute('title', this.t('contactModalTitle'));

    this.populatePresetsDropdown();
    this.rebuildParamInputs();
  }

  openContactModal() {
    const modal = document.getElementById('modalContact');
    if (modal) modal.classList.add('open');
  }

  closeContactModal() {
    const modal = document.getElementById('modalContact');
    if (modal) modal.classList.remove('open');
  }

  copyEmailToClipboard() {
    const email = 'pengyuan.xia.dokt@pw.edu.pl';
    const btnText = document.getElementById('btnCopyEmailText');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(email).then(() => {
        this.showToast(this.t('toastEmailCopied') || '📋 Email copied to clipboard!');
        if (btnText) {
          btnText.textContent = this.t('copiedBtn') || '✓ Copied!';
          setTimeout(() => {
            if (btnText) btnText.textContent = this.t('copyBtn') || '📋 Copy';
          }, 2200);
        }
      }).catch(() => {
        this.showToast(email);
      });
    } else {
      this.showToast(email);
    }
  }

  showToast(msg) {
    if (this.shareManager) {
      this.shareManager.showToast(msg);
    } else {
      const toast = document.getElementById('appToast');
      if (toast) {
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2400);
      }
    }
  }

  exportCompositePNG() {
    try {
      const cSec = document.getElementById('canvasSection');
      const cSig = document.getElementById('canvasSigma');
      const cTauY = document.getElementById('canvasTauY');
      const cTauZ = document.getElementById('canvasTauZ');
      const cElem = document.getElementById('canvasElement');
      const cMohr = document.getElementById('canvasMohr');

      if (!cSec || !cSig || !cTauY) return;

      const compCanvas = document.createElement('canvas');
      const colW = Math.max(cSec.width, cSig.width);
      const rowH = Math.max(cSec.height, cSig.height);
      const subH = cElem ? cElem.height : 0;

      const totalW = colW * 2 + 40;
      const totalH = rowH * 2 + subH + 120;
      compCanvas.width = totalW;
      compCanvas.height = totalH;

      const ctx = compCanvas.getContext('2d');
      const isDark = this.state.theme === 'dark';
      ctx.fillStyle = isDark ? '#070a11' : '#ffffff';
      ctx.fillRect(0, 0, compCanvas.width, compCanvas.height);

      ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText('StructLab.tech - Beam Stress Distribution Analysis', 24, 42);

      const ld = this.state.loading || {};
      const subtitle = `Shape: ${this.state.shapeType.toUpperCase()} | Load F = ${ld.F} kN (α = ${ld.alpha}°), Lever Arm L = ${ld.L} m`;
      ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
      ctx.font = '14px monospace';
      ctx.fillText(subtitle, 24, 66);

      // Draw 2x2 grid of 4 main diagrams
      const topY = 85;
      ctx.drawImage(cSec, 15, topY, colW, rowH);
      ctx.drawImage(cSig, 25 + colW, topY, colW, rowH);
      ctx.drawImage(cTauY, 15, topY + rowH + 15, colW, rowH);
      if (cTauZ) {
        ctx.drawImage(cTauZ, 25 + colW, topY + rowH + 15, colW, rowH);
      }

      // Bottom sub-panels: Stress Element & Mohr's Circle
      if (cElem && cMohr) {
        const subY = topY + rowH * 2 + 30;
        ctx.drawImage(cElem, 20, subY);
        ctx.drawImage(cMohr, 20 + cElem.width + 20, subY);
      }

      const link = document.createElement('a');
      link.download = `StructLab_Stress_Analysis_${this.state.shapeType}.png`;
      link.href = compCanvas.toDataURL('image/png');
      link.click();
      this.shareManager.showToast('Diagram exported as PNG!');
    } catch (e) {
      console.error('Export PNG failed:', e);
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new StressCalculatorApp();
});
