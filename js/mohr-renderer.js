/**
 * mohr-renderer.js - 2D Infinitesimal Stress Element and Mohr's Circle Visualizer
 * Shows live state of stress at current elevation probe y:
 * - Square element with normal stress arrows (\sigma_x) and shear arrows (\tau_{xy})
 * - Complete Mohr's circle with center C, radius R, principal stresses \sigma_1, \sigma_2,
 *   max shear \tau_{max}, and 2\theta_p angle sector.
 *
 * Supports Day Mode (Light) by default.
 */

export class MohrRenderer {
  constructor(elementCanvas, circleCanvas, options = {}) {
    this.elemCanvas = elementCanvas;
    this.circCanvas = circleCanvas;
    this.elemCtx = elementCanvas ? elementCanvas.getContext('2d') : null;
    this.circCtx = circleCanvas ? circleCanvas.getContext('2d') : null;
    this.elementMode = options.elementMode || 'standard'; // 'standard' | 'principal'
    this.lastStressPt = null;
    this.lastAnalysis = null;
    this.options = {
      theme: 'light', // 'light' (default) | 'dark'
      ...options
    };
  }

  setTheme(theme) {
    this.options.theme = theme;
  }

  setElementMode(mode) {
    this.elementMode = mode;
    if (this.lastStressPt) {
      this.renderStressElement(this.lastStressPt, this.lastAnalysis);
    }
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    [this.elemCanvas, this.circCanvas].forEach(c => {
      if (!c) return;
      const rect = c.getBoundingClientRect();
      const w = Math.max(140, Math.floor(rect.width));
      const h = Math.max(180, Math.floor(rect.height));
      if (c.width !== Math.floor(w * dpr) || c.height !== Math.floor(h * dpr)) {
        c.width = Math.floor(w * dpr);
        c.height = Math.floor(h * dpr);
      }
    });
  }

  render(stressPt, analysis = null) {
    if (!stressPt) return;
    this.lastStressPt = stressPt;
    if (analysis) this.lastAnalysis = analysis;
    this.resize();
    this.renderStressElement(stressPt, analysis || this.lastAnalysis);
    this.renderMohrsCircle(stressPt, analysis || this.lastAnalysis);
  }

  // ==========================================
  // 1. 2D INFINITESIMAL STRESS ELEMENT
  // ==========================================
  renderStressElement(pt, analysis = null) {
    const canvas = this.elemCanvas;
    const ctx = this.elemCtx;
    if (!canvas || !ctx) return;

    const isDark = this.options.theme === 'dark';
    const isPrincipal = this.elementMode === 'principal';
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = isDark ? '#090d16' : '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // Reserved bottom area for labels (68px)
    const bottomH = 68;
    const cx = w / 2;
    const cy = (h - bottomH) / 2 + 5;

    // Enlarged element size
    const availDim = Math.min(w - 70, h - bottomH - 30);
    // When rotated at 45 deg, diagonal factor is sqrt(2) ~ 1.414
    const size = isPrincipal ? Math.max(80, availDim * 0.62) : Math.max(90, availDim * 0.70);
    const half = size / 2;

    const sigma = pt.sigma ?? 0;
    const tau = pt.tauSigned ?? 0;
    const sigma1 = pt.sigma1 ?? 0;
    const sigma2 = pt.sigma2 ?? 0;
    const thetaPRad = pt.thetaPRad ?? 0;
    const thetaPDeg = pt.thetaPDeg ?? 0;

    if (isPrincipal) {
      // ==========================================
      // PRINCIPAL STRESS STATE
      // ==========================================

      // 1. Subtle reference coordinate axes (horizontal & vertical)
      ctx.save();
      ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.28)' : 'rgba(148, 163, 184, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);

      const axisSpan = half + 36;
      ctx.beginPath();
      ctx.moveTo(cx - axisSpan, cy);
      ctx.lineTo(cx + axisSpan, cy);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx, cy - axisSpan);
      ctx.lineTo(cx, cy + axisSpan);
      ctx.stroke();
      ctx.restore();

      // 2. Principal Angle arc theta_p
      if (Math.abs(thetaPDeg) > 0.5) {
        ctx.save();
        const arcR = Math.min(38, Math.max(22, half * 0.65));
        ctx.strokeStyle = isDark ? '#c084fc' : '#9333ea';
        ctx.fillStyle = isDark ? 'rgba(192, 132, 252, 0.2)' : 'rgba(147, 51, 234, 0.12)';
        ctx.lineWidth = 1.6;

        // Counter-clockwise from positive x-axis (note: Canvas Y is downward, so CCW is negative in canvas coords)
        const startAng = 0;
        const endAng = -thetaPRad;
        const counterClockwise = thetaPRad > 0;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, arcR, startAng, endAng, counterClockwise);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        const midAng = -thetaPRad / 2;
        const arcLabelR = arcR + 13;
        this.drawMathText(ctx, 'θ_p', cx + arcLabelR * Math.cos(midAng), cy + arcLabelR * Math.sin(midAng), { align: 'center', baseSize: 12 });
        ctx.restore();
      }

      // 3. Rotated Element in Principal Frame
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-thetaPRad); // Rotates counter-clockwise in math sense

      // Square Box
      ctx.fillStyle = isDark ? 'rgba(30, 41, 59, 0.85)' : '#f8fafc';
      ctx.strokeStyle = isDark ? '#38bdf8' : '#0284c7';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.rect(-half, -half, size, size);
      ctx.fill();
      ctx.stroke();

      // Face markers '1' and '2'
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = isDark ? '#f8fafc' : '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('1', half - 11, 0);
      ctx.fillText('2', 0, -half + 11);

      // Principal stress 1 arrows on face 1 (x' = +half and -half)
      const maxPRef = Math.max(analysis?.extrema?.maxSigmaAbs ?? 0, Math.abs(sigma1), Math.abs(sigma2), 10);
      const isTens1 = sigma1 >= 0;
      const col1 = isTens1 ? (isDark ? '#38bdf8' : '#0284c7') : (isDark ? '#f43f5e' : '#e11d48');
      const p1Ratio = Math.min(1, Math.abs(sigma1) / maxPRef);
      const arrowLen1 = Math.min(38, Math.max(8, 8 + p1Ratio * 28));

      if (Math.abs(sigma1) > 0.05) {
        ctx.save();
        ctx.strokeStyle = col1;
        ctx.fillStyle = col1;
        ctx.lineWidth = 2.2;

        if (isTens1) {
          this.drawArrow(ctx, half, 0, half + arrowLen1, 0, 6);
          this.drawArrow(ctx, -half, 0, -half - arrowLen1, 0, 6);
        } else {
          this.drawArrow(ctx, half + arrowLen1, 0, half, 0, 6);
          this.drawArrow(ctx, -half - arrowLen1, 0, -half, 0, 6);
        }
        ctx.restore();
      }

      // Principal stress 2 arrows on face 2 (y' = -half and +half)
      const isTens2 = sigma2 >= 0;
      const col2 = isTens2 ? (isDark ? '#38bdf8' : '#0284c7') : (isDark ? '#f43f5e' : '#e11d48');
      const p2Ratio = Math.min(1, Math.abs(sigma2) / maxPRef);
      const arrowLen2 = Math.min(38, Math.max(8, 8 + p2Ratio * 28));

      if (Math.abs(sigma2) > 0.05) {
        ctx.save();
        ctx.strokeStyle = col2;
        ctx.fillStyle = col2;
        ctx.lineWidth = 2.2;

        if (isTens2) {
          this.drawArrow(ctx, 0, -half, 0, -half - arrowLen2, 6);
          this.drawArrow(ctx, 0, half, 0, half + arrowLen2, 6);
        } else {
          this.drawArrow(ctx, 0, -half - arrowLen2, 0, -half, 6);
          this.drawArrow(ctx, 0, half + arrowLen2, 0, half, 6);
        }
        ctx.restore();
      }

      // Center Tag
      ctx.fillStyle = isDark ? '#f8fafc' : '#000000';
      ctx.font = '600 12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText("dy'·dz'", 0, 0);

      ctx.restore(); // Return to regular coordinate frame

      // 4. Summary labels below element for Principal Mode
      this.drawMathText(ctx, `σ_1 = ${sigma1 >= 0 ? '+' : ''}${sigma1.toFixed(1)} MPa`, cx, h - 46, { align: 'center', baseSize: 13 });
      this.drawMathText(ctx, `σ_2 = ${sigma2.toFixed(1)} MPa`, cx, h - 27, { align: 'center', baseSize: 13 });
      this.drawMathText(ctx, `θ_p = ${thetaPDeg >= 0 ? '+' : ''}${thetaPDeg.toFixed(1)}°`, cx, h - 8, { align: 'center', baseSize: 13 });

    } else {
      // ==========================================
      // STANDARD STRESS STATE
      // ==========================================

      // Draw square element
      ctx.fillStyle = isDark ? 'rgba(30, 41, 59, 0.7)' : '#f1f5f9';
      ctx.strokeStyle = isDark ? '#94a3b8' : '#64748b';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.rect(cx - half, cy - half, size, size);
      ctx.fill();
      ctx.stroke();

      const isTens = sigma >= 0;
      const sigmaColor = isTens ? (isDark ? '#38bdf8' : '#0284c7') : (isDark ? '#f43f5e' : '#e11d48');
      const tauColor = tau < 0 ? (isDark ? '#f43f5e' : '#e11d48') : (isDark ? '#f59e0b' : '#d97706');

      const maxSigRef = Math.max(analysis?.extrema?.maxSigmaAbs ?? 0, Math.abs(sigma), 10);
      const sigRatio = Math.min(1, Math.abs(sigma) / maxSigRef);
      const arrowLen = Math.min(38, Math.max(8, 8 + sigRatio * 28));

      // Normal Stress arrows
      if (Math.abs(sigma) > 0.05) {
        ctx.save();
        ctx.strokeStyle = sigmaColor;
        ctx.fillStyle = sigmaColor;
        ctx.lineWidth = 2.2;

        if (isTens) {
          this.drawArrow(ctx, cx + half, cy, cx + half + arrowLen, cy, 6);
          this.drawArrow(ctx, cx - half, cy, cx - half - arrowLen, cy, 6);
        } else {
          this.drawArrow(ctx, cx + half + arrowLen, cy, cx + half, cy, 6);
          this.drawArrow(ctx, cx - half - arrowLen, cy, cx - half, cy, 6);
        }
        ctx.restore();
      }

      // Shear Stress arrows on 4 faces (dynamically extending / shortening with tau)
      const maxTauRef = Math.max(analysis?.extrema?.maxTauY ?? 0, analysis?.extrema?.maxTauZAbs ?? 0, Math.abs(tau), 1);
      const tauRatio = Math.min(1, Math.abs(tau) / maxTauRef);
      const maxTauLen = size * 0.78;
      const minTauLen = 10;
      const tauLen = minTauLen + tauRatio * (maxTauLen - minTauLen);

      if (Math.abs(tau) > 0.05) {
        ctx.save();
        ctx.strokeStyle = tauColor;
        ctx.fillStyle = tauColor;
        ctx.lineWidth = 2.0;
        const tauArrowMargin = 7;

        if (tau > 0) {
          this.drawArrow(ctx, cx + half + tauArrowMargin, cy + tauLen / 2, cx + half + tauArrowMargin, cy - tauLen / 2, 5);
          this.drawArrow(ctx, cx - tauLen / 2, cy - half - tauArrowMargin, cx + tauLen / 2, cy - half - tauArrowMargin, 5);
          this.drawArrow(ctx, cx - half - tauArrowMargin, cy - tauLen / 2, cx - half - tauArrowMargin, cy + tauLen / 2, 5);
          this.drawArrow(ctx, cx + tauLen / 2, cy + half + tauArrowMargin, cx - tauLen / 2, cy + half + tauArrowMargin, 5);
        } else {
          this.drawArrow(ctx, cx + half + tauArrowMargin, cy - tauLen / 2, cx + half + tauArrowMargin, cy + tauLen / 2, 5);
          this.drawArrow(ctx, cx + tauLen / 2, cy - half - tauArrowMargin, cx - tauLen / 2, cy - half - tauArrowMargin, 5);
          this.drawArrow(ctx, cx - half - tauArrowMargin, cy + tauLen / 2, cx - half - tauArrowMargin, cy - tauLen / 2, 5);
          this.drawArrow(ctx, cx - tauLen / 2, cy + half + tauArrowMargin, cx + tauLen / 2, cy + half + tauArrowMargin, 5);
        }
        ctx.restore();
      }

      // Element Center Tag
      ctx.fillStyle = isDark ? '#f8fafc' : '#000000';
      ctx.font = '600 12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('dy·dz', cx, cy);

      // Summary labels below element
      this.drawMathText(ctx, `σ(z) = ${sigma >= 0 ? '+' : ''}${sigma.toFixed(1)} MPa`, cx, h - 46, { align: 'center', baseSize: 13 });
      this.drawMathText(ctx, `τ_z = ${tau >= 0 ? '+' : ''}${tau.toFixed(1)} MPa`, cx, h - 27, { align: 'center', baseSize: 13 });
      this.drawMathText(ctx, `θ_p = ${thetaPDeg >= 0 ? '+' : ''}${thetaPDeg.toFixed(1)}°`, cx, h - 8, { align: 'center', baseSize: 13 });
    }

    ctx.restore();
  }

  // ==========================================
  // 2. MOHR'S CIRCLE CANVAS
  // ==========================================
  renderMohrsCircle(pt, analysis = null) {
    const canvas = this.circCanvas;
    const ctx = this.circCtx;
    if (!canvas || !ctx) return;

    const isDark = this.options.theme === 'dark';
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = isDark ? '#090d16' : '#ffffff';
    ctx.fillRect(0, 0, w, h);

    const sigma = pt.sigma ?? 0;
    const tau = pt.tauSigned ?? 0;
    const sigmaAvg = sigma / 2;
    const R = Math.max(0.0001, pt.tauMaxInPlane ?? 0);
    const sigma1 = pt.sigma1 ?? 0;
    const sigma2 = pt.sigma2 ?? 0;

    // Use global maximum stress envelope across the whole cross-section for consistent scaling
    const globalMax = Math.max(
      analysis?.extrema?.maxSigmaAbs ?? 0,
      analysis?.extrema?.maxTauY ?? 0,
      analysis?.extrema?.maxTauZAbs ?? 0,
      Math.abs(sigma1),
      Math.abs(sigma2),
      Math.abs(sigmaAvg) + R,
      R,
      0.05
    );

    const padX = 24;
    const padY = 22;
    const usableHalfW = (w / 2) - padX;
    const usableHalfH = (h / 2) - padY;
    const scale = Math.min(usableHalfW / (globalMax * 1.18), usableHalfH / (globalMax * 1.18));

    const cx = w / 2;
    const cy = h / 2;

    const toPx = (sig, t) => ({
      x: cx + sig * scale,
      y: cy - t * scale
    });

    // 1. Axes
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 1.2;

    // Horizontal \sigma axis
    ctx.beginPath();
    ctx.moveTo(10, cy);
    ctx.lineTo(w - 10, cy);
    ctx.stroke();
    this.drawArrow(ctx, w - 20, cy, w - 8, cy, 5);

    // Vertical \tau axis
    ctx.beginPath();
    ctx.moveTo(cx, h - 10);
    ctx.lineTo(cx, 10);
    ctx.stroke();
    this.drawArrow(ctx, cx, 20, cx, 8, 5);

    // Axis labels (academic italic math symbols without unit inside viewport)
    this.drawMathText(ctx, 'σ', w - 10, cy - 8, { align: 'right', baseSize: 13 });
    this.drawMathText(ctx, 'τ', cx + 7, 16, { align: 'left', baseSize: 13 });

    // 2. Circle
    const centerPx = toPx(sigmaAvg, 0);
    const rPx = R * scale;

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerPx.x, centerPx.y, rPx, 0, 2 * Math.PI);
    ctx.fillStyle = isDark ? 'rgba(99, 102, 241, 0.14)' : 'rgba(99, 102, 241, 0.08)';
    ctx.fill();
    ctx.strokeStyle = isDark ? '#818cf8' : '#4f46e5';
    ctx.lineWidth = 2.0;
    ctx.stroke();
    ctx.restore();

    // 3. Center point C
    ctx.fillStyle = isDark ? '#818cf8' : '#4f46e5';
    ctx.beginPath();
    ctx.arc(centerPx.x, centerPx.y, 3.5, 0, 2 * Math.PI);
    ctx.fill();

    // 4. State points X and Y
    const ptX = toPx(sigma, -tau);
    const ptY = toPx(0, tau);

    ctx.save();
    ctx.strokeStyle = isDark ? 'rgba(251, 191, 36, 0.7)' : 'rgba(217, 119, 6, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(ptX.x, ptX.y);
    ctx.lineTo(ptY.x, ptY.y);
    ctx.stroke();
    ctx.restore();

    // Point X
    const xColor = isDark ? '#38bdf8' : '#0284c7';
    ctx.fillStyle = xColor;
    ctx.beginPath();
    ctx.arc(ptX.x, ptX.y, 4.5, 0, 2 * Math.PI);
    ctx.fill();

    // Point Y
    ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
    ctx.beginPath();
    ctx.arc(ptY.x, ptY.y, 4, 0, 2 * Math.PI);
    ctx.fill();

    // 5. Principal Stress Points \sigma_1 and \sigma_2
    const p1 = toPx(sigma1, 0);
    const p2 = toPx(sigma2, 0);

    ctx.fillStyle = isDark ? '#34d399' : '#059669';
    ctx.beginPath();
    ctx.arc(p1.x, p1.y, 4.5, 0, 2 * Math.PI);
    ctx.fill();

    ctx.fillStyle = isDark ? '#f43f5e' : '#dc2626';
    ctx.beginPath();
    ctx.arc(p2.x, p2.y, 4.5, 0, 2 * Math.PI);
    ctx.fill();

    if (Math.abs(p1.x - p2.x) < 56) {
      this.drawMathText(ctx, `σ_1 = ${sigma1.toFixed(1)}`, p1.x + 4, p1.y + 14, { align: 'left', baseSize: 11 });
      this.drawMathText(ctx, `σ_2 = ${sigma2.toFixed(1)}`, p2.x - 4, p2.y + 26, { align: 'right', baseSize: 11 });
    } else {
      this.drawMathText(ctx, `σ_1 = ${sigma1.toFixed(1)}`, p1.x, p1.y + 16, { align: 'center', baseSize: 12 });
      this.drawMathText(ctx, `σ_2 = ${sigma2.toFixed(1)}`, p2.x, p2.y + 16, { align: 'center', baseSize: 12 });
    }

    // Max Shear Label on top
    const pTauMax = toPx(sigmaAvg, R);
    this.drawMathText(ctx, `τ_max = ${R.toFixed(1)}`, pTauMax.x, Math.max(14, pTauMax.y - 8), { align: 'center', baseSize: 12 });

    ctx.restore();
  }

  parseMathTokens(str) {
    let s = String(str)
      .replace(/₁/g, '_1')
      .replace(/₂/g, '_2')
      .replace(/ₚ/g, '_p')
      .replace(/ₘₐₓ/g, '_max')
      .replace(/ₘᵢₙ/g, '_min');

    const tokens = [];
    const m = s.match(/^([στθMyz])(?:_([a-zA-Z0-9,]+)|\(([a-zA-Z0-9,]+)\))?(.*)$/);
    if (m) {
      const [, variable, sub, arg, rest] = m;
      tokens.push({ t: variable, type: 'math' });
      if (sub) tokens.push({ t: sub, type: 'sub' });
      if (arg) tokens.push({ t: `(${arg})`, type: 'arg' });
      if (rest) tokens.push({ t: rest, type: 'text' });
    } else {
      tokens.push({ t: s, type: 'text' });
    }
    return tokens;
  }

  drawMathText(ctx, str, x, y, options = {}) {
    const isDark = this.options.theme === 'dark';
    const baseSize = options.baseSize || 12;
    const subSize = options.subSize || Math.round(baseSize * 0.72);
    const argSize = options.argSize || Math.round(baseSize * 0.88);
    const align = options.align || 'left';
    const color = options.color || (isDark ? '#f8fafc' : '#000000');
    const subDy = options.subDy !== undefined ? options.subDy : Math.max(2, baseSize * 0.26);

    const tokens = this.parseMathTokens(str);

    const mathFont = `italic 700 ${baseSize + 1}px "KaTeX_Math", "Cambria Math", "Times New Roman", serif`;
    const subFont = `700 ${subSize}px "KaTeX_Main", "Outfit", "Segoe UI", system-ui, sans-serif`;
    const argFont = `italic 700 ${argSize}px "KaTeX_Math", "Cambria Math", "Times New Roman", serif`;
    const textFont = `700 ${baseSize}px "Outfit", "Segoe UI", system-ui, sans-serif`;

    ctx.save();
    const measured = tokens.map(tok => {
      let font = textFont;
      let dy = 0;
      if (tok.type === 'math') {
        font = mathFont;
      } else if (tok.type === 'sub') {
        font = subFont;
        dy = subDy;
      } else if (tok.type === 'arg') {
        font = argFont;
      }
      ctx.font = font;
      const w = ctx.measureText(tok.t).width;
      return { ...tok, font, dy, w };
    });

    const totalW = measured.reduce((acc, it) => acc + it.w, 0);

    let startX = x;
    if (align === 'center') {
      startX = x - totalW / 2;
    } else if (align === 'right') {
      startX = x - totalW;
    }

    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    measured.forEach(it => {
      ctx.font = it.font;
      ctx.fillText(it.t, startX, y + it.dy);
      startX += it.w;
    });

    ctx.restore();
    return totalW;
  }

  drawArrow(ctx, fromX, fromY, toX, toY, headLength = 6) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const angle = Math.atan2(dy, dx);

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }
}
