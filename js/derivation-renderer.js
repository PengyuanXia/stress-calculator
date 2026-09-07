/**
 * derivation-renderer.js - KaTeX Analytical Step-by-Step Proofs & Derivations
 * Renders verified civil engineering mathematical formulas with real numbers substituted.
 * Focuses on Normal Stress, Shear Stress, and Principal Stresses / Mohr's Circle.
 */

export class DerivationRenderer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
  }

  render(section, analysis, probePt, lang = 'en') {
    if (!this.container || !section || !analysis) return;

    const isPl = lang === 'pl';
    const forces = analysis.forces;
    const extrema = analysis.extrema;

    const fmtNum = (n, dec = 2) => {
      if (typeof n !== 'number' || isNaN(n)) return '0';
      if (Math.abs(n) >= 1e6 || (Math.abs(n) > 0 && Math.abs(n) < 1e-3)) {
        return n.toExponential(3);
      }
      return n.toFixed(dec);
    };

    let html = `
      <div class="space-y-5 text-sm">
        
        <!-- STEP 1: SECTION GEOMETRY -->
        <div class="step-card p-5 rounded-xl border">
          <h4 class="font-semibold text-indigo-600 dark:text-indigo-400 text-base mb-3 flex items-center gap-2">
            <span class="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 text-xs flex items-center justify-center font-bold">1</span>
            ${isPl ? 'Charakterystyki Geometryczne Przekroju' : 'Cross-Section Geometric Properties'}
          </h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="formula-block" id="math-geom-1"></div>
            <div class="formula-block" id="math-geom-2"></div>
          </div>
        </div>

        <!-- STEP 2: NORMAL STRESS (NAVIER) -->
        <div class="step-card p-5 rounded-xl border">
          <h4 class="font-semibold text-sky-600 dark:text-cyan-400 text-base mb-3 flex items-center gap-2">
            <span class="w-6 h-6 rounded-full bg-sky-500/20 text-sky-600 dark:text-cyan-300 text-xs flex items-center justify-center font-bold">2</span>
            ${isPl ? 'Rozkład Naprężeń Normalnych <i>σ</i>(<i>y, z</i>) (Hipoteza Naviera)' : 'Normal Bending Stress Distribution <i>σ</i>(<i>y, z</i>) (Navier Formula)'}
          </h4>
          <div class="formula-block mb-3" id="math-sigma-formula"></div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="formula-block" id="math-sigma-top"></div>
            <div class="formula-block" id="math-sigma-bot"></div>
          </div>
          <div class="formula-block mt-3" id="math-neutral-axis"></div>
        </div>

        <!-- STEP 3: SHEAR STRESS -->
        <div class="step-card p-5 rounded-xl border">
          <h4 class="font-semibold text-amber-600 dark:text-amber-400 text-base mb-3 flex items-center gap-2">
            <span class="w-6 h-6 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 text-xs flex items-center justify-center font-bold">3</span>
            ${isPl ? 'Rozkład Naprężeń Stycznych <i>τ</i><sub>z</sub>(<i>z</i>) (Jourawski)' : 'Shear Stress Distribution <i>τ</i><sub>z</sub>(<i>z</i>) (Jourawski Formula)'}
          </h4>
          <div class="formula-block mb-3" id="math-tau-formula"></div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="formula-block" id="math-tau-max"></div>
            <div class="formula-block" id="math-tau-junction"></div>
          </div>
        </div>

        <!-- STEP 4: PRINCIPAL STRESSES & MOHR'S CIRCLE -->
        <div class="step-card p-5 rounded-xl border">
          <h4 class="font-semibold text-emerald-600 dark:text-emerald-400 text-base mb-3 flex items-center gap-2">
            <span class="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 text-xs flex items-center justify-center font-bold">4</span>
            ${isPl ? 'Kierunki i Naprężenia Główne oraz Analiza Koła Mohra' : "Principal Stresses & Mohr's Circle at Current Elevation"}
          </h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="formula-block" id="math-mohr-1"></div>
            <div class="formula-block" id="math-mohr-2"></div>
          </div>
        </div>

      </div>
    `;

    this.container.innerHTML = html;

    const renderMath = (id, tex) => {
      const el = document.getElementById(id);
      if (el && window.katex) {
        try {
          window.katex.render(tex, el, { displayMode: true, throwOnError: false });
        } catch (e) {
          console.error(e);
        }
      }
    };

    // 1. Geometry (Converted to cm, cm^2, cm^4)
    const Iy = section.Iz; // Moment of inertia about horizontal y-axis [mm^4]
    const Iz = section.Iy || section.Iz; // Moment of inertia about vertical z-axis [mm^4]
    const area_cm2 = section.area / 100;
    const zBar_cm = section.yBar / 10;
    const Iy_cm4 = Iy / 1e4;
    const Iz_cm4 = Iz / 1e4;

    renderMath('math-geom-1', `
      A = ${fmtNum(area_cm2, 2)} \\text{ cm}^2, \\quad \\bar{z}_{\\text{bot}} = ${fmtNum(zBar_cm, 2)} \\text{ cm}
    `);
    renderMath('math-geom-2', `
      J_y = ${fmtNum(Iy_cm4, 2)} \\text{ cm}^4, \\quad J_z = ${fmtNum(Iz_cm4, 2)} \\text{ cm}^4
    `);

    // 2. Normal Stress (Navier)
    const My_kNm = forces.My_kNm !== undefined ? forces.My_kNm : (forces.M_kNm || 0);
    const Mz_kNm = forces.Mz_kNm || 0;
    const My_Nmm = My_kNm * 1e6;
    const Mz_Nmm = Mz_kNm * 1e6;
    const betaDeg = analysis.neutralAxis?.betaDeg ?? 0;

    renderMath('math-sigma-formula', `
      \\sigma(y, z) = \\frac{M_y}{J_y} z - \\frac{M_z}{J_z} y = \\frac{${fmtNum(My_Nmm, 0)}}{${fmtNum(Iy, 0)}} z - \\frac{${fmtNum(Mz_Nmm, 0)}}{${fmtNum(Iz, 0)}} y \\quad [\\text{MPa}]
    `);

    const topSigma = analysis.evaluateAt(section.yTop).sigma;
    const botSigma = analysis.evaluateAt(section.yBot).sigma;
    const zTop_cm = section.yTop / 10;
    const zBot_cm = -section.yBot / 10;
    renderMath('math-sigma-top', `
      \\sigma_{\\text{top}} (z = -${fmtNum(zTop_cm, 1)} \\text{ cm}) = ${fmtNum(topSigma, 2)} \\text{ MPa} \\; (${topSigma >= 0 ? (isPl ? 'Rozciąganie' : 'Tension') : (isPl ? 'Ściskanie' : 'Compression')})
    `);
    renderMath('math-sigma-bot', `
      \\sigma_{\\text{bot}} (z = +${fmtNum(zBot_cm, 1)} \\text{ cm}) = ${fmtNum(botSigma, 2)} \\text{ MPa} \\; (${botSigma >= 0 ? (isPl ? 'Rozciąganie' : 'Tension') : (isPl ? 'Ściskanie' : 'Compression')})
    `);

    renderMath('math-neutral-axis', `
      \\text{${isPl ? 'Oś Obojętna' : 'Neutral Axis'}} (\\sigma = 0): \\quad \\tan\\beta = \\frac{J_z}{J_y} \\frac{|M_y|}{|M_z|} = \\frac{${fmtNum(Iz, 0)}}{${fmtNum(Iy, 0)}} \\frac{${fmtNum(Math.abs(My_kNm), 1)}}{${fmtNum(Math.abs(Mz_kNm), 1)}} \\implies \\beta = ${fmtNum(betaDeg, 1)}^\\circ
    `);

    // 3. Shear Stress (Jourawski)
    const Vz_N = forces.Vz_N !== undefined ? forces.Vz_N : (forces.V_N || 0);
    renderMath('math-tau-formula', `
      \\tau_z(z) = \\frac{T_z \\cdot S_y(z)}{J_y \\cdot b(z)} = \\frac{${fmtNum(Vz_N, 0)} \\cdot S_y(z)}{${fmtNum(Iy, 0)} \\cdot b(z)} \\quad [\\text{MPa}]
    `);

    const naPt = analysis.evaluateAt(0);
    renderMath('math-tau-max', `
      \\tau_{z,\\max} = \\tau_z(z=0) = \\frac{${fmtNum(Vz_N, 0)} \\cdot ${fmtNum(naPt.Sy, 0)}}{${fmtNum(Iy, 0)} \\cdot ${fmtNum(naPt.width, 1)}} = ${fmtNum(extrema.maxTauY || extrema.maxTau, 2)} \\text{ MPa}
    `);

    if (section.yJunctionTop !== undefined) {
      const tauFlange = analysis.evaluateAt(section.yJunctionTop, 'flange').tau;
      const tauWeb = analysis.evaluateAt(section.yJunctionTop, 'web').tau;
      const ratio = tauFlange > 0 ? tauWeb / tauFlange : 0;
      renderMath('math-tau-junction', `
        \\tau_{\\text{flange}} = ${fmtNum(tauFlange, 2)} \\text{ MPa}, \\quad \\tau_{\\text{web}} = ${fmtNum(tauWeb, 2)} \\text{ MPa} \\quad \\left(\\frac{\\tau_w}{\\tau_f} = ${fmtNum(ratio, 2)}\\right)
      `);
    } else {
      renderMath('math-tau-junction', `
        \\tau(z = z_{\\text{top}}) = 0.00 \\text{ MPa}, \\quad \\tau(z = z_{\\text{bot}}) = 0.00 \\text{ MPa}
      `);
    }

    // 4. Mohr & Principal
    const pSig = probePt ? probePt.sigma : 0;
    const pSig1 = probePt ? probePt.sigma1 : 0;
    const pSig2 = probePt ? probePt.sigma2 : 0;
    const pTauMax = probePt ? probePt.tauMaxInPlane : 0;
    const pTheta = probePt ? probePt.thetaPDeg : 0;

    renderMath('math-mohr-1', `
      \\sigma_{1,2} = \\frac{\\sigma}{2} \\pm \\sqrt{\\left(\\frac{\\sigma}{2}\\right)^2 + \\tau^2} = ${fmtNum(pSig / 2, 2)} \\pm ${fmtNum(pTauMax, 2)} \\implies \\begin{cases} \\sigma_1 = ${fmtNum(pSig1, 2)} \\text{ MPa} \\\\ \\sigma_2 = ${fmtNum(pSig2, 2)} \\text{ MPa} \\end{cases}
    `);

    renderMath('math-mohr-2', `
      \\tau_{\\max} = ${fmtNum(pTauMax, 2)} \\text{ MPa}, \\quad \\theta_p = \\frac{1}{2} \\arctan\\left(\\frac{2\\tau}{\\sigma}\\right) = ${fmtNum(pTheta, 1)}^\\circ
    `);
  }
}
