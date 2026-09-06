/**
 * diagram-renderer.js - Synchronized Multi-Canvas Structural Stress Viewport
 * Renders 3 vertically aligned diagrams sharing exact height scale:
 * 1. Cross Section (geometry, applied forces N, M, V, cut area A*(y), NA, CG)
 * 2. Normal Stress \sigma(y) (tension cyan/blue, compression red, NA)
 * 3. Shear Stress \tau(y) (parabolic distribution, junction jumps)
 *
 * Supports Day Mode (Light) by default and Night Mode (Dark).
 */

export class DiagramRenderer {
  constructor(containers, options = {}) {
    this.canvases = {
      section: containers.section,
      sigma: containers.sigma,
      tauY: containers.tauY || containers.tau,
      tauZ: containers.tauZ
    };

    this.ctxs = {
      section: this.canvases.section ? this.canvases.section.getContext('2d') : null,
      sigma: this.canvases.sigma ? this.canvases.sigma.getContext('2d') : null,
      tauY: this.canvases.tauY ? this.canvases.tauY.getContext('2d') : null,
      tauZ: this.canvases.tauZ ? this.canvases.tauZ.getContext('2d') : null
    };

    this.options = {
      theme: 'light', // 'light' (default) | 'dark'
      padY: 46,
      padX: 28,
      ...options
    };

    this.section = null;
    this.analysis = null;
    this.probeY = 0;
    this.probeZ = 0;
    this.isDragging = false;
    this.isDraggingZ = false;
    this.onProbeChange = null;
    this.onProbeZChange = null;

    this.initEvents();
  }

  setTheme(theme) {
    this.options.theme = theme;
    this.renderAll();
  }

  setProbeY(y) {
    if (!this.section) return;
    this.probeY = this.section.clampY(y);
    this.renderAll();
  }

  setProbeZ(z) {
    if (!this.section) return;
    this.probeZ = this.section.clampZ ? this.section.clampZ(z) : z;
    this.renderTauZCanvas();
  }

  setData(section, analysis, probeY = null, probeZ = null) {
    this.section = section;
    this.analysis = analysis;
    if (probeY !== null) {
      this.probeY = this.section.clampY(probeY);
    } else if (this.probeY < this.section.yBot || this.probeY > this.section.yTop) {
      this.probeY = 0;
    }
    if (probeZ !== null) {
      this.probeZ = this.section.clampZ ? this.section.clampZ(probeZ) : probeZ;
    } else {
      this.probeZ = 0;
    }
    this.resizeCanvases();
    this.renderAll();
  }

  resizeCanvases() {
    const dpr = window.devicePixelRatio || 1;
    Object.keys(this.canvases).forEach(key => {
      const canvas = this.canvases[key];
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(160, Math.floor(rect.width));
      const h = Math.max(160, Math.floor(rect.height));

      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
    });
  }

  initEvents() {
    const canvasListY = [
      this.canvases.section,
      this.canvases.sigma,
      this.canvases.tauY
    ].filter(Boolean);

    const handlePointerY = (e, canvas) => {
      if (!this.section) return;
      const rect = canvas.getBoundingClientRect();
      const clientY = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : null);
      if (clientY === null) return;

      const pxY = (clientY - rect.top) * (canvas.height / rect.height);
      const dpr = window.devicePixelRatio || 1;
      const hCanvas = canvas.height / dpr;
      const padY = this.options.padY;
      const usableH = hCanvas - 2 * padY;

      const normalized = 1 - (pxY / dpr - padY) / usableH;
      const yNew = this.section.yBot + normalized * (this.section.yTop - this.section.yBot);

      this.probeY = this.section.clampY(yNew);
      this.renderAll();

      if (typeof this.onProbeChange === 'function') {
        this.onProbeChange(this.probeY);
      }
    };

    canvasListY.forEach(canvas => {
      canvas.addEventListener('mousedown', (e) => {
        this.isDragging = true;
        handlePointerY(e, canvas);
      });

      canvas.addEventListener('mousemove', (e) => {
        if (this.isDragging) {
          handlePointerY(e, canvas);
        }
      });

      window.addEventListener('mouseup', () => {
        this.isDragging = false;
      });

      canvas.addEventListener('touchstart', (e) => {
        this.isDragging = true;
        handlePointerY(e, canvas);
        e.preventDefault();
      }, { passive: false });

      canvas.addEventListener('touchmove', (e) => {
        if (this.isDragging) {
          handlePointerY(e, canvas);
        }
        e.preventDefault();
      }, { passive: false });

      window.addEventListener('touchend', () => {
        this.isDragging = false;
      });
    });

    if (this.canvases.tauZ) {
      const canvasZ = this.canvases.tauZ;
      const handlePointerZ = (e) => {
        if (!this.section) return;
        const rect = canvasZ.getBoundingClientRect();
        const clientX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : null);
        if (clientX === null) return;

        const dpr = window.devicePixelRatio || 1;
        const pxX = (clientX - rect.left) * (canvasZ.width / rect.width) / dpr;
        const padX = 46;
        const wCanvas = canvasZ.width / dpr;
        const usableW = wCanvas - 2 * padX;

        const zMin = this.section.zMin ?? -this.section.bMax / 2;
        const zMax = this.section.zMax ?? this.section.bMax / 2;
        const normalized = Math.max(0, Math.min(1, (pxX - padX) / usableW));
        const zNew = zMin + normalized * (zMax - zMin);

        this.probeZ = this.section.clampZ ? this.section.clampZ(zNew) : zNew;
        this.renderTauZCanvas();

        if (typeof this.onProbeZChange === 'function') {
          this.onProbeZChange(this.probeZ);
        }
      };

      canvasZ.addEventListener('mousedown', (e) => {
        this.isDraggingZ = true;
        handlePointerZ(e);
      });

      canvasZ.addEventListener('mousemove', (e) => {
        if (this.isDraggingZ) {
          handlePointerZ(e);
        }
      });

      window.addEventListener('mouseup', () => {
        this.isDraggingZ = false;
      });

      canvasZ.addEventListener('touchstart', (e) => {
        this.isDraggingZ = true;
        handlePointerZ(e);
        e.preventDefault();
      }, { passive: false });

      canvasZ.addEventListener('touchmove', (e) => {
        if (this.isDraggingZ) {
          handlePointerZ(e);
        }
        e.preventDefault();
      }, { passive: false });

      window.addEventListener('touchend', () => {
        this.isDraggingZ = false;
      });
    }
  }

  yToPx(y, hCanvas) {
    const padY = this.options.padY;
    const usableH = hCanvas - 2 * padY;
    const norm = (y - this.section.yBot) / (this.section.yTop - this.section.yBot);
    return hCanvas - padY - norm * usableH;
  }

  renderAll() {
    if (!this.section || !this.analysis) return;
    this.renderSectionCanvas();
    this.renderSigmaCanvas();
    this.renderTauYCanvas();
    this.renderTauZCanvas();
  }

  renderTauCanvas() {
    this.renderTauYCanvas();
  }

  // ==========================================
  // 1. CROSS SECTION CANVAS + FORCES DISPLAY
  // ==========================================
  renderSectionCanvas() {
    const canvas = this.canvases.section;
    const ctx = this.ctxs.section;
    if (!canvas || !ctx) return;

    const isDark = this.options.theme === 'dark';
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // Canvas background
    ctx.fillStyle = isDark ? '#090d16' : '#ffffff';
    ctx.fillRect(0, 0, w, h);
    this.drawCanvasGrid(ctx, w, h);

    const padY = this.options.padY;
    const padX = this.options.padX;
    const usableH = h - 2 * padY;
    const usableW = w - 2 * padX;

    const scaleY = usableH / this.section.h;
    const maxScaleX = (usableW * 0.58) / Math.max(1, this.section.bMax);
    const scale = Math.min(scaleY, maxScaleX);

    const cx = w / 2;
    const cyNA = this.yToPx(0, h);

    const mmToCanvas = (x, y) => ({
      x: cx + x * scale,
      y: cyNA - y * scale
    });

    const polys = this.section.getBoundaryPolygons();

    // 1. Outer boundary
    ctx.beginPath();
    polys.outer.forEach((pt, i) => {
      const p = mmToCanvas(pt.x, pt.y);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();

    if (polys.holes && polys.holes.length > 0) {
      polys.holes.forEach(hole => {
        hole.forEach((pt, i) => {
          const p = mmToCanvas(pt.x, pt.y);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
      });
    }

    // Fill section
    ctx.fillStyle = isDark ? 'rgba(99, 102, 241, 0.22)' : 'rgba(99, 102, 241, 0.12)';
    ctx.fill('evenodd');

    ctx.strokeStyle = isDark ? '#818cf8' : '#4f46e5';
    ctx.lineWidth = 2.0;
    ctx.stroke();

    // 2. Cut Area A*(y)
    const cutPolys = this.section.getCutPolygon(this.probeY);
    if (cutPolys) {
      ctx.save();
      if (Array.isArray(cutPolys) && cutPolys.length > 0) {
        ctx.beginPath();
        if (cutPolys[0].outer) {
          cutPolys.forEach(shape => {
            shape.outer.forEach((pt, i) => {
              const p = mmToCanvas(pt.x, pt.y);
              if (i === 0) ctx.moveTo(p.x, p.y);
              else ctx.lineTo(p.x, p.y);
            });
            ctx.closePath();
            if (shape.holes) {
              shape.holes.forEach(hole => {
                hole.forEach((pt, i) => {
                  const p = mmToCanvas(pt.x, pt.y);
                  if (i === 0) ctx.moveTo(p.x, p.y);
                  else ctx.lineTo(p.x, p.y);
                });
                ctx.closePath();
              });
            }
          });
        } else {
          cutPolys.forEach((pt, i) => {
            const p = mmToCanvas(pt.x, pt.y);
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          });
          ctx.closePath();
        }

        ctx.fillStyle = isDark ? 'rgba(245, 158, 11, 0.32)' : 'rgba(245, 158, 11, 0.25)';
        ctx.fill('evenodd');

        ctx.clip('evenodd');
        ctx.strokeStyle = isDark ? 'rgba(251, 191, 36, 0.45)' : 'rgba(217, 119, 6, 0.4)';
        ctx.lineWidth = 1.2;
        const probePy = this.yToPx(this.probeY, h);
        for (let yy = probePy; yy >= padY; yy -= 8) {
          ctx.beginPath();
          ctx.moveTo(0, yy + (w / 2));
          ctx.lineTo(w, yy - (w / 2));
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    const beamRight = cx + (this.section.bMax / 2) * scale;
    const rightDimX = w - 18;

    // 3. Probe Guideline (drawn before badges/text so line goes behind)
    this.drawProbeLine(ctx, w, h, this.probeY, '#f59e0b', 0, rightDimX - 8);

    // 4. Centroidal Axes & Dynamic Rotated Neutral Axis (N-A)
    const forces = this.analysis.forces || {};
    const moments = this.analysis.moments || {};
    const My = moments.My ?? forces.My_kNm ?? 120;
    const Mz = moments.Mz ?? forces.Mz_kNm ?? 40;
    const I_horiz = Math.max(1, this.section.Iz);
    const I_vert = Math.max(1, this.section.Iy || this.section.Iz);

    // Neutral axis inclination:
    // Angle beta from vertical z-axis: tan(beta) = (I_vert / I_horiz) * (|My| / |Mz|) = (Iz / Iy) * (|My| / |Mz|)
    const absMy = Math.abs(My);
    const absMz = Math.abs(Mz);
    let tanBeta = 0;
    let betaDeg = 0;

    if (absMz < 1e-4) {
      // Pure My: neutral axis is horizontal (beta = 90° from vertical z-axis)
      tanBeta = Infinity;
      betaDeg = 90;
    } else if (absMy < 1e-4) {
      // Pure Mz: neutral axis is vertical (beta = 0° from vertical z-axis)
      tanBeta = 0;
      betaDeg = 0;
    } else {
      tanBeta = (absMy * I_vert) / (absMz * I_horiz);
      betaDeg = (Math.atan(tanBeta) * 180) / Math.PI;
    }

    // Unit direction vector along neutral axis on screen:
    // When My and Mz have opposite signs (e.g. My > 0, Mz < 0), slope on screen is positive (top-left to bottom-right).
    // When My and Mz have same signs, slope on screen is negative (bottom-left to top-right).
    let uX = 1;
    let uY = 0;
    if (absMz < 1e-4) {
      // Pure My: horizontal line on screen
      uX = 1;
      uY = 0;
    } else if (absMy < 1e-4) {
      // Pure Mz: vertical line on screen
      uX = 0;
      uY = 1;
    } else {
      const betaRad = (betaDeg * Math.PI) / 180;
      const slopeSign = (My * Mz < 0) ? 1 : -1;
      // In screen coords, angle beta from vertical means horizontal displacement is sin(beta) and vertical is cos(beta)
      uX = Math.sin(betaRad);
      uY = slopeSign * Math.cos(betaRad);
    }

    const isRotated = absMz > 0.05 && absMy > 0.05;

    ctx.save();

    // If rotated, draw faint reference axes
    if (isRotated) {
      ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(36, cyNA);
      ctx.lineTo(Math.min(rightDimX - 10, beamRight + 12), cyNA);
      ctx.stroke();
    }

    // Rotated Neutral Axis line
    const rLine = Math.max(w, h) * 0.65;
    const p1x = cx - uX * rLine;
    const p1y = cyNA - uY * rLine;
    const p2x = cx + uX * rLine;
    const p2y = cyNA + uY * rLine;

    ctx.strokeStyle = isDark ? '#38bdf8' : '#0284c7';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(p1x, p1y);
    ctx.lineTo(p2x, p2y);
    ctx.stroke();

    // Crisp N-A Badge
    const badgeText = isRotated ? `N-A (β=${betaDeg.toFixed(1)}°)` : 'N-A';
    ctx.font = 'bold 10px monospace';
    const textWidth = ctx.measureText(badgeText).width;
    const naW = textWidth + 12;
    const naH = 18;

    let badgeX, badgeY;
    if (!isRotated) {
      badgeX = 8;
      badgeY = cyNA - naH / 2;
    } else {
      const tBadge = 0.72;
      // Choose upper-half end of line for optimal breathing room
      const side = (uY >= 0) ? -1 : 1;
      badgeX = (cx + side * uX * rLine * tBadge) - naW / 2;
      badgeY = (cyNA + side * uY * rLine * tBadge) - naH / 2;
      badgeX = Math.max(8, Math.min(w - naW - 8, badgeX));
      badgeY = Math.max(8, Math.min(h - naH - 8, badgeY));
    }

    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, naW, naH, 4);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, badgeX + naW / 2, badgeY + naH / 2);

    this.drawCGSymbol(ctx, cx, cyNA);
    ctx.restore();

    // 5. Draw Applied Moments (My and Mz with Double Arrows: +z down, +y left)
    this.drawAppliedMoments(ctx, w, h, cx, cyNA, scale);

    // 6. Draw Dimensions (clean outer margin layout on top)
    this.drawSectionDimensions(ctx, w, h, scale, cx, cyNA);

    ctx.restore();
  }

  drawDoubleArrow(ctx, fromX, fromY, toX, toY, headLength = 9, headSpacing = 8) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const len = Math.hypot(dx, dy);
    if (len < 1e-3) return;
    const uX = dx / len;
    const uY = dy / len;

    // Draw main shaft
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    // Two arrowheads in series (textbook moment vector symbol)
    for (let i = 0; i < 2; i++) {
      const tipX = toX - uX * (i * headSpacing);
      const tipY = toY - uY * (i * headSpacing);
      const angle = Math.atan2(dy, dx);

      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX - headLength * Math.cos(angle - Math.PI / 6), tipY - headLength * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(tipX - headLength * Math.cos(angle + Math.PI / 6), tipY - headLength * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    }
  }

  drawAppliedMoments(ctx, w, h, cx, cyNA, scale) {
    const isDark = this.options.theme === 'dark';
    const forces = this.analysis.forces || {};
    const moments = this.analysis.moments || {};
    const My = moments.My ?? forces.My_kNm ?? 120;
    const Mz = moments.Mz ?? forces.Mz_kNm ?? 40;

    const mColor = isDark ? '#fbbf24' : '#d97706';
    const sec = this.section;
    const beamRight = cx + (sec.bMax / 2) * scale;
    const rightDimX = w - 18;

    // 1. Draw Global Coordinate Axes (+z downward, +y to the left)
    ctx.save();
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.28)' : 'rgba(15, 23, 42, 0.28)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([]);

    const zTop = 16;
    const zBot = h - 16;
    ctx.beginPath();
    ctx.moveTo(cx, zTop);
    ctx.lineTo(cx, zBot);
    ctx.stroke();

    // Arrow pointing downward at +z
    this.drawArrow(ctx, cx, zBot - 8, cx, zBot, 6);
    ctx.font = 'bold 10px "Outfit", "Segoe UI", system-ui, -apple-system, sans-serif';
    ctx.fillStyle = isDark ? '#f8fafc' : '#000000';
    ctx.textAlign = 'right';
    ctx.fillText('+z (↓)', cx - 8, zBot - 2);
    ctx.textAlign = 'left';
    ctx.fillText('-z (↑)', cx + 8, zTop + 10);

    // Horizontal y-axis (+y to the left)
    // Keep -y cleanly terminated before right dimension line
    const yLeft = 14;
    const yRight = Math.min(rightDimX - 10, beamRight + 12);
    ctx.beginPath();
    ctx.moveTo(yRight, cyNA);
    ctx.lineTo(yLeft, cyNA);
    ctx.stroke();

    // Arrow pointing left at +y
    this.drawArrow(ctx, yLeft + 8, cyNA, yLeft, cyNA, 6);
    ctx.fillStyle = isDark ? '#f8fafc' : '#000000';
    ctx.textAlign = 'left';
    ctx.fillText('+y (←)', yLeft + 4, cyNA + 12);
    ctx.textAlign = 'right';
    ctx.fillText('-y (→)', yRight - 4, cyNA + 12);
    ctx.restore();

    // 2. Draw Moment Vector Mz (Double Arrow on vertical z-axis: +z is downward)
    if (Math.abs(Mz) > 0.05) {
      const lenZ = Math.min(80, Math.max(42, 32 + Math.abs(Mz) * 0.4));
      // +Mz is downward (+z), -Mz is upward (-z)
      const dirZ = Mz >= 0 ? 1 : -1;
      const endZ = cyNA + dirZ * lenZ;

      ctx.save();
      ctx.strokeStyle = mColor;
      ctx.fillStyle = mColor;
      ctx.lineWidth = 2.8;
      this.drawDoubleArrow(ctx, cx, cyNA, cx, endZ, 9, 8);

      // Badge for Mz (academic format with subscript z)
      const valTextZ = ` = ${Mz >= 0 ? '+' : ''}${Mz.toFixed(1)} kNm`;
      ctx.font = 'bold 11px "Outfit", "Segoe UI", system-ui, -apple-system, sans-serif';
      const wValZ = ctx.measureText(valTextZ).width;
      ctx.font = 'italic bold 11px "Outfit", "Segoe UI", system-ui, -apple-system, sans-serif';
      const wMZ = ctx.measureText('M').width;
      ctx.font = 'bold 9px "Outfit", "Segoe UI", system-ui, -apple-system, sans-serif';
      const wSubZ = ctx.measureText('z').width;
      const bW = wMZ + wSubZ + wValZ + 14;
      const bH = 20;
      let bX = cx + 10;
      const midZ = (cyNA + endZ) / 2;
      let bY = midZ - bH / 2;

      // Strictly prevent Mz badge from reaching the vertical dimension line
      const maxMzRight = rightDimX - 10;
      if (bX + bW > maxMzRight) {
        bX = maxMzRight - bW;
      }
      bX = Math.max(8, bX);
      bY = Math.max(8, Math.min(h - bH - 8, bY));

      ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.96)';
      ctx.strokeStyle = mColor;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(bX, bY, bW, bH, 4);
      ctx.fill();
      ctx.stroke();

      const textStartX_Z = bX + (bW - (wMZ + wSubZ + wValZ)) / 2;
      const textCenterY_Z = bY + bH / 2;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isDark ? '#f8fafc' : '#000000';
      ctx.font = 'italic bold 11px "Outfit", "Segoe UI", system-ui, -apple-system, sans-serif';
      ctx.fillText('M', textStartX_Z, textCenterY_Z);
      ctx.font = 'bold 9px "Outfit", "Segoe UI", system-ui, -apple-system, sans-serif';
      ctx.fillText('z', textStartX_Z + wMZ, textCenterY_Z + 2.5);
      ctx.font = 'bold 11px "Outfit", "Segoe UI", system-ui, -apple-system, sans-serif';
      ctx.fillText(valTextZ, textStartX_Z + wMZ + wSubZ, textCenterY_Z);
      ctx.restore();
    }

    // 3. Draw Moment Vector My (Double Arrow on horizontal y-axis: +y is to the left)
    if (Math.abs(My) > 0.05) {
      const lenY = Math.min(80, Math.max(42, 32 + Math.abs(My) * 0.4));
      // +My is to the left (+y), -My is to the right (-y)
      const dirY = My >= 0 ? -1 : 1;
      const endY = cx + dirY * lenY;

      ctx.save();
      ctx.strokeStyle = mColor;
      ctx.fillStyle = mColor;
      ctx.lineWidth = 2.8;
      this.drawDoubleArrow(ctx, cx, cyNA, endY, cyNA, 9, 8);

      // Badge for My (academic format with subscript y)
      const valTextY = ` = ${My >= 0 ? '+' : ''}${My.toFixed(1)} kNm`;
      ctx.font = 'bold 11px "Outfit", "Segoe UI", system-ui, -apple-system, sans-serif';
      const wValY = ctx.measureText(valTextY).width;
      ctx.font = 'italic bold 11px "Outfit", "Segoe UI", system-ui, -apple-system, sans-serif';
      const wMY = ctx.measureText('M').width;
      ctx.font = 'bold 9px "Outfit", "Segoe UI", system-ui, -apple-system, sans-serif';
      const wSubY = ctx.measureText('y').width;
      const bW = wMY + wSubY + wValY + 14;
      const bH = 20;

      // Center horizontally on arrow shaft:
      const midX = (cx + endY) / 2;
      let bX = midX - bW / 2;
      let bY = cyNA - bH - 6;

      // Safe clamp to keep badge 100% inside canvas:
      bX = Math.max(8, Math.min(w - bW - 8, bX));
      bY = Math.max(8, Math.min(h - bH - 8, bY));

      ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.96)';
      ctx.strokeStyle = mColor;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(bX, bY, bW, bH, 4);
      ctx.fill();
      ctx.stroke();

      const textStartX_Y = bX + (bW - (wMY + wSubY + wValY)) / 2;
      const textCenterY_Y = bY + bH / 2;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isDark ? '#f8fafc' : '#000000';
      ctx.font = 'italic bold 11px "Outfit", "Segoe UI", system-ui, -apple-system, sans-serif';
      ctx.fillText('M', textStartX_Y, textCenterY_Y);
      ctx.font = 'bold 9px "Outfit", "Segoe UI", system-ui, -apple-system, sans-serif';
      ctx.fillText('y', textStartX_Y + wMY, textCenterY_Y + 2.5);
      ctx.font = 'bold 11px "Outfit", "Segoe UI", system-ui, -apple-system, sans-serif';
      ctx.fillText(valTextY, textStartX_Y + wMY + wSubY, textCenterY_Y);
      ctx.restore();
    }
  }

  // ==========================================
  // 2. NORMAL STRESS \sigma(y) CANVAS
  // ==========================================
  renderSigmaCanvas() {
    const canvas = this.canvases.sigma;
    const ctx = this.ctxs.sigma;
    if (!canvas || !ctx) return;

    const isDark = this.options.theme === 'dark';
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = isDark ? '#090d16' : '#ffffff';
    ctx.fillRect(0, 0, w, h);
    this.drawCanvasGrid(ctx, w, h);

    const padY = this.options.padY;
    const cx = w / 2;
    const profile = this.analysis.profiles.normal;
    const maxSigma = Math.max(1, this.analysis.extrema.maxSigmaAbs);
    const usableW = (w / 2) - 36;

    const sigmaToX = (sigma) => cx + (sigma / maxSigma) * usableW;

    // Zero-axis vertical line
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx, padY);
    ctx.lineTo(cx, h - padY);
    ctx.stroke();

    ctx.fillStyle = isDark ? '#f8fafc' : '#000000';
    ctx.font = 'bold 12px "Outfit", "Segoe UI", system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('σ = 0', cx, h - padY + 20);

    if (profile.length > 1) {
      // Tension side (+, right)
      ctx.beginPath();
      ctx.moveTo(cx, this.yToPx(profile[0].y, h));
      profile.forEach(pt => {
        const py = this.yToPx(pt.y, h);
        const px = pt.sigma >= 0 ? sigmaToX(pt.sigma) : cx;
        ctx.lineTo(px, py);
      });
      ctx.lineTo(cx, this.yToPx(profile[profile.length - 1].y, h));
      ctx.closePath();
      ctx.fillStyle = isDark ? 'rgba(56, 189, 248, 0.22)' : 'rgba(14, 165, 233, 0.18)';
      ctx.fill();

      // Compression side (-, left)
      ctx.beginPath();
      ctx.moveTo(cx, this.yToPx(profile[0].y, h));
      profile.forEach(pt => {
        const py = this.yToPx(pt.y, h);
        const px = pt.sigma < 0 ? sigmaToX(pt.sigma) : cx;
        ctx.lineTo(px, py);
      });
      ctx.lineTo(cx, this.yToPx(profile[profile.length - 1].y, h));
      ctx.closePath();
      ctx.fillStyle = isDark ? 'rgba(244, 63, 94, 0.22)' : 'rgba(225, 29, 72, 0.18)';
      ctx.fill();

      // Boundary outline curve
      ctx.beginPath();
      profile.forEach((pt, i) => {
        const py = this.yToPx(pt.y, h);
        const px = sigmaToX(pt.sigma);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.strokeStyle = isDark ? '#38bdf8' : '#0284c7';
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }

    // Extreme fiber labels
    const topPt = profile[0];
    const botPt = profile[profile.length - 1];
    if (topPt) {
      this.drawStressBadge(ctx, sigmaToX(topPt.sigma), this.yToPx(topPt.y, h), topPt.sigma, 'top');
    }
    if (botPt) {
      this.drawStressBadge(ctx, sigmaToX(botPt.sigma), this.yToPx(botPt.y, h), botPt.sigma, 'bot');
    }

    // Neutral axis line
    const cyNA = this.yToPx(0, h);
    ctx.save();
    ctx.strokeStyle = isDark ? 'rgba(56, 189, 248, 0.4)' : 'rgba(2, 132, 199, 0.35)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(10, cyNA);
    ctx.lineTo(w - 10, cyNA);
    ctx.stroke();
    ctx.restore();

    // Probe readout point
    const currentSigma = this.analysis.evaluateAt(this.probeY).sigma;
    const probePy = this.yToPx(this.probeY, h);
    const probePx = sigmaToX(currentSigma);

    this.drawProbeLine(ctx, w, h, this.probeY, isDark ? '#38bdf8' : '#0284c7');

    ctx.fillStyle = isDark ? '#38bdf8' : '#0284c7';
    ctx.beginPath();
    ctx.arc(probePx, probePy, 5.5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = isDark ? '#ffffff' : '#0f172a';
    ctx.lineWidth = 2;
    ctx.stroke();

    const sigPrefix = currentSigma >= 0 ? '+' : '';
    this.drawCallout(ctx, probePx, probePy, `σ = ${sigPrefix}${currentSigma.toFixed(2)}`, isDark ? '#38bdf8' : '#0284c7');

    ctx.restore();
  }

  // ==========================================
  // 3. VERTICAL SHEAR STRESS \tau_y(y) CANVAS
  // ==========================================
  renderTauYCanvas() {
    const canvas = this.canvases.tauY || this.canvases.tau;
    const ctx = this.ctxs.tauY || this.ctxs.tau;
    if (!canvas || !ctx) return;

    const isDark = this.options.theme === 'dark';
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = isDark ? '#090d16' : '#ffffff';
    ctx.fillRect(0, 0, w, h);
    this.drawCanvasGrid(ctx, w, h);

    const padY = this.options.padY;
    const forces = this.analysis.forces || {};
    const Vz_N = forces.Vz_N !== undefined ? forces.Vz_N : (forces.V_N || 0);
    const isNegative = Vz_N < 0;
    const maxTau = Math.max(0.1, this.analysis.extrema.maxTauY ?? this.analysis.extrema.maxTau);

    // If Tz >= 0: baseline on the left (baseX = 42), lobes extend to the right (+)
    // If Tz < 0: baseline on the right (baseX = w - 42), lobes extend to the left (-)
    const padSide = 42;
    const usableW = w - padSide - 28;
    const baseX = isNegative ? w - padSide : padSide;

    const tauToX = (tauSigned) => {
      const mag = Math.abs(tauSigned);
      const frac = Math.min(1, mag / maxTau);
      return isNegative ? baseX - frac * usableW : baseX + frac * usableW;
    };

    // Baseline \tau_z = 0
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(baseX, padY);
    ctx.lineTo(baseX, h - padY);
    ctx.stroke();

    ctx.fillStyle = isDark ? '#f8fafc' : '#000000';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('τ_z = 0', baseX, h - padY + 20);

    const profile = this.analysis.profiles.shearY || this.analysis.profiles.shear;

    if (profile && profile.length > 1) {
      ctx.beginPath();
      ctx.moveTo(baseX, this.yToPx(profile[0].y, h));
      profile.forEach(pt => {
        const py = this.yToPx(pt.y, h);
        const px = tauToX(pt.tauSigned ?? (isNegative ? -pt.tau : pt.tau));
        ctx.lineTo(px, py);
      });
      ctx.lineTo(baseX, this.yToPx(profile[profile.length - 1].y, h));
      ctx.closePath();

      const tauGrad = ctx.createLinearGradient(baseX, 0, isNegative ? padSide : w, 0);
      if (!isNegative) {
        tauGrad.addColorStop(0, isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.08)');
        tauGrad.addColorStop(1, isDark ? 'rgba(245, 158, 11, 0.38)' : 'rgba(245, 158, 11, 0.28)');
      } else {
        tauGrad.addColorStop(0, isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.08)');
        tauGrad.addColorStop(1, isDark ? 'rgba(244, 63, 94, 0.35)' : 'rgba(225, 29, 72, 0.24)');
      }
      ctx.fillStyle = tauGrad;
      ctx.fill();

      // Shear curve
      ctx.beginPath();
      profile.forEach((pt, i) => {
        const py = this.yToPx(pt.y, h);
        const px = tauToX(pt.tauSigned ?? (isNegative ? -pt.tau : pt.tau));
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.strokeStyle = isNegative ? (isDark ? '#f43f5e' : '#e11d48') : (isDark ? '#f59e0b' : '#d97706');
      ctx.lineWidth = 2.4;
      ctx.stroke();
    }

    // Critical junction points
    const checkPts = this.analysis.checkPoints;
    if (checkPts) {
      checkPts.forEach(cp => {
        if (cp.isJunction && cp.locationType === 'web') {
          const py = this.yToPx(cp.y, h);
          const px = tauToX(cp.tauSigned ?? (isNegative ? -cp.tau : cp.tau));
          ctx.fillStyle = isNegative ? (isDark ? '#fb7185' : '#e11d48') : (isDark ? '#fbbf24' : '#d97706');
          ctx.beginPath();
          ctx.arc(px, py, 4.5, 0, 2 * Math.PI);
          ctx.fill();
        }
      });
    }

    // Peak Tau label
    const cyNA = this.yToPx(0, h);
    ctx.fillStyle = isDark ? '#f8fafc' : '#000000';
    ctx.font = 'bold 12px "Outfit", "Segoe UI", system-ui, -apple-system, sans-serif';
    ctx.textAlign = isNegative ? 'left' : 'right';
    const peakLabel = isNegative ? `τ_z,min = -${maxTau.toFixed(2)}` : `τ_z,max = +${maxTau.toFixed(2)}`;
    ctx.fillText(peakLabel, isNegative ? 12 : w - 12, padY - 10);

    ctx.save();
    ctx.strokeStyle = isDark ? 'rgba(245, 158, 11, 0.35)' : 'rgba(217, 119, 6, 0.3)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(10, cyNA);
    ctx.lineTo(w - 10, cyNA);
    ctx.stroke();
    ctx.restore();

    // Probe readout
    const curEval = this.analysis.evaluateAt(this.probeY);
    const probePy = this.yToPx(this.probeY, h);
    const curTauSigned = curEval.tauSigned ?? (isNegative ? -curEval.tau : curEval.tau);
    const probePx = tauToX(curTauSigned);

    this.drawProbeLine(ctx, w, h, this.probeY, isNegative ? (isDark ? '#f43f5e' : '#e11d48') : (isDark ? '#f59e0b' : '#d97706'));

    ctx.fillStyle = isNegative ? (isDark ? '#f43f5e' : '#e11d48') : (isDark ? '#f59e0b' : '#d97706');
    ctx.beginPath();
    ctx.arc(probePx, probePy, 5.5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = isDark ? '#ffffff' : '#0f172a';
    ctx.lineWidth = 2;
    ctx.stroke();

    const tauSignStr = curTauSigned >= 0 ? '+' : '';
    this.drawCallout(ctx, probePx, probePy, `τ_z = ${tauSignStr}${curTauSigned.toFixed(2)}`, isNegative ? (isDark ? '#f43f5e' : '#e11d48') : (isDark ? '#f59e0b' : '#d97706'));

    ctx.restore();
  }

  // ==========================================
  // 4. HORIZONTAL SHEAR STRESS \tau_z(z) CANVAS
  // ==========================================
  renderTauZCanvas() {
    const canvas = this.canvases.tauZ;
    const ctx = this.ctxs.tauZ;
    if (!canvas || !ctx) return;

    const isDark = this.options.theme === 'dark';
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = isDark ? '#090d16' : '#ffffff';
    ctx.fillRect(0, 0, w, h);
    this.drawCanvasGrid(ctx, w, h);

    const padX = 46;
    const padY = this.options.padY;
    const usableW = w - 2 * padX;

    const zMin = this.section.zMin ?? -this.section.bMax / 2;
    const zMax = this.section.zMax ?? this.section.bMax / 2;
    const zRange = Math.max(1, zMax - zMin);
    const zToPx = (z) => padX + ((z - zMin) / zRange) * usableW;

    const profileZ = this.analysis.profiles.shearZ || [];
    const minTauZ = this.analysis.extrema?.minTauZ ?? 0;
    const maxTauZ = this.analysis.extrema?.maxTauZ ?? 0;
    const maxAbsTau = Math.max(0.05, this.analysis.extrema?.maxTauZAbs || Math.max(Math.abs(maxTauZ), Math.abs(minTauZ)));
    const hasStress = maxAbsTau > 0.02;
    const hasSignChange = minTauZ < -0.05 && maxTauZ > 0.05;

    // Determine baseline position
    // If sign change exists (e.g. I-beam / T-beam flange shear flow under Vy), center baseline at h/2
    const baseY = hasSignChange ? padY + (h - 2 * padY) / 2 : h - padY - 8;
    const usableH = hasSignChange ? (h - 2 * padY) / 2 - 12 : (h - 2 * padY - 12);

    const tauToPy = (tau) => {
      if (hasSignChange) {
        return baseY - (tau / maxAbsTau) * usableH;
      } else {
        return baseY - (Math.max(0, tau) / maxAbsTau) * usableH;
      }
    };

    // Baseline \tau_z = 0
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.22)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padX - 12, baseY);
    ctx.lineTo(w - padX + 12, baseY);
    ctx.stroke();

    // Baseline ticks & labels
    // Baseline ticks & labels
    ctx.fillStyle = isDark ? '#f8fafc' : '#000000';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';

    const cx = zToPx(0);
    // Center tick (z = 0)
    ctx.beginPath();
    ctx.moveTo(cx, baseY - 4);
    ctx.lineTo(cx, baseY + 6);
    ctx.stroke();
    ctx.fillText('z = 0', cx, baseY + 18);

    // Left tick (z = zMin)
    const pxLeft = zToPx(zMin);
    ctx.beginPath();
    ctx.moveTo(pxLeft, baseY - 4);
    ctx.lineTo(pxLeft, baseY + 6);
    ctx.stroke();
    ctx.fillText(`-${(this.section.bMax / 2).toFixed(0)}`, pxLeft, baseY + 18);

    // Right tick (z = zMax)
    const pxRight = zToPx(zMax);
    ctx.beginPath();
    ctx.moveTo(pxRight, baseY - 4);
    ctx.lineTo(pxRight, baseY + 6);
    ctx.stroke();
    ctx.fillText(`+${(this.section.bMax / 2).toFixed(0)} mm`, pxRight, baseY + 18);

    if (profileZ.length > 1 && hasStress) {
      if (hasSignChange) {
        // Butterfly / antisymmetric shear flow with sign change at web
        // 1. Positive lobe (z < 0, flowing towards web)
        const leftPts = profileZ.filter(p => p.z <= 1e-4);
        if (leftPts.length > 1) {
          ctx.beginPath();
          ctx.moveTo(zToPx(leftPts[0].z), baseY);
          leftPts.forEach(pt => ctx.lineTo(zToPx(pt.z), tauToPy(pt.tau)));
          ctx.lineTo(zToPx(leftPts[leftPts.length - 1].z), baseY);
          ctx.closePath();

          const gradPos = ctx.createLinearGradient(0, baseY, 0, padY);
          gradPos.addColorStop(0, isDark ? 'rgba(245, 158, 11, 0.08)' : 'rgba(245, 158, 11, 0.05)');
          gradPos.addColorStop(1, isDark ? 'rgba(245, 158, 11, 0.38)' : 'rgba(245, 158, 11, 0.28)');
          ctx.fillStyle = gradPos;
          ctx.fill();
        }

        // 2. Negative lobe (z > 0, flowing towards web in opposite direction)
        const rightPts = profileZ.filter(p => p.z >= -1e-4);
        if (rightPts.length > 1) {
          ctx.beginPath();
          ctx.moveTo(zToPx(rightPts[0].z), baseY);
          rightPts.forEach(pt => ctx.lineTo(zToPx(pt.z), tauToPy(pt.tau)));
          ctx.lineTo(zToPx(rightPts[rightPts.length - 1].z), baseY);
          ctx.closePath();

          const gradNeg = ctx.createLinearGradient(0, baseY, 0, h - padY);
          gradNeg.addColorStop(0, isDark ? 'rgba(244, 63, 94, 0.08)' : 'rgba(244, 63, 94, 0.05)');
          gradNeg.addColorStop(1, isDark ? 'rgba(244, 63, 94, 0.38)' : 'rgba(244, 63, 94, 0.28)');
          ctx.fillStyle = gradNeg;
          ctx.fill();
        }

        // 3. Shear curve
        ctx.beginPath();
        profileZ.forEach((pt, i) => {
          const px = zToPx(pt.z);
          const py = tauToPy(pt.tau);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.strokeStyle = isDark ? '#f59e0b' : '#d97706';
        ctx.lineWidth = 2.4;
        ctx.stroke();

        // 4. Web junction vertical guide & peak markers
        let ptMax = profileZ[0];
        let ptMin = profileZ[0];
        profileZ.forEach(pt => {
          if (pt.tau > ptMax.tau) ptMax = pt;
          if (pt.tau < ptMin.tau) ptMin = pt;
        });

        const pxPeakPos = zToPx(ptMax.z);
        const pxPeakNeg = zToPx(ptMin.z);
        const pyTopStep = tauToPy(ptMax.tau);
        const pyBotStep = tauToPy(ptMin.tau);

        ctx.save();
        ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(pxPeakPos, baseY);
        ctx.lineTo(pxPeakPos, pyTopStep);
        ctx.moveTo(pxPeakNeg, baseY);
        ctx.lineTo(pxPeakNeg, pyBotStep);
        ctx.stroke();
        ctx.restore();

        // Marker for positive peak
        ctx.fillStyle = isDark ? '#fbbf24' : '#d97706';
        ctx.beginPath();
        ctx.arc(pxPeakPos, pyTopStep, 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = isDark ? '#ffffff' : '#0f172a';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Marker for negative peak
        ctx.fillStyle = isDark ? '#fb7185' : '#e11d48';
        ctx.beginPath();
        ctx.arc(pxPeakNeg, pyBotStep, 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = isDark ? '#ffffff' : '#0f172a';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Peak labels
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = isDark ? '#f8fafc' : '#000000';
        const alignPos = ptMax.z < 0 ? 'right' : 'left';
        ctx.textAlign = alignPos;
        ctx.fillText(`+${ptMax.tau.toFixed(2)} (Web Edge)`, pxPeakPos + (alignPos === 'right' ? -8 : 8), pyTopStep - 6);

        ctx.fillStyle = isDark ? '#f8fafc' : '#000000';
        const alignNeg = ptMin.z < 0 ? 'right' : 'left';
        ctx.textAlign = alignNeg;
        ctx.fillText(`${ptMin.tau.toFixed(2)} (Web Edge)`, pxPeakNeg + (alignNeg === 'right' ? -8 : 8), pyBotStep + 16);

        // Center junction text
        ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
        ctx.font = '10px Outfit, sans-serif';
        ctx.textAlign = 'center';
        const centerMsg = this.section.type === 'box' ? 'Web Corners: Max shear at web inner edges' : 'Web Junction (Flow turns 90° into web)';
        ctx.fillText(centerMsg, cx, baseY - 6);

      } else {
        // Unidirectional / weak-axis parabolic shear
        ctx.beginPath();
        ctx.moveTo(zToPx(profileZ[0].z), baseY);
        profileZ.forEach(pt => ctx.lineTo(zToPx(pt.z), tauToPy(pt.tau)));
        ctx.lineTo(zToPx(profileZ[profileZ.length - 1].z), baseY);
        ctx.closePath();

        const tauGrad = ctx.createLinearGradient(0, baseY, 0, padY);
        tauGrad.addColorStop(0, isDark ? 'rgba(245, 158, 11, 0.10)' : 'rgba(245, 158, 11, 0.06)');
        tauGrad.addColorStop(1, isDark ? 'rgba(245, 158, 11, 0.38)' : 'rgba(245, 158, 11, 0.26)');
        ctx.fillStyle = tauGrad;
        ctx.fill();

        ctx.beginPath();
        profileZ.forEach((pt, i) => {
          const px = zToPx(pt.z);
          const py = tauToPy(pt.tau);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.strokeStyle = isDark ? '#f59e0b' : '#d97706';
        ctx.lineWidth = 2.4;
        ctx.stroke();

        const peakPy = tauToPy(maxTauZ);
        ctx.fillStyle = isDark ? '#fbbf24' : '#d97706';
        ctx.beginPath();
        ctx.arc(cx, peakPy, 5.5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = isDark ? '#ffffff' : '#0f172a';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = isDark ? '#f8fafc' : '#000000';
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`τ_z,ₘₐₓ = ${maxTauZ.toFixed(2)}`, cx, peakPy - 12);
      }

      // Probe readout along z
      const curZ = this.probeZ ?? 0;
      const evalZ = this.analysis.evaluateZAt ? this.analysis.evaluateZAt(curZ, this.probeY) : { tauZ: 0 };
      const probePx = zToPx(curZ);
      const probePy = tauToPy(evalZ.tauZ);

      // Vertical probe line
      ctx.save();
      ctx.strokeStyle = isDark ? '#fbbf24' : '#d97706';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(probePx, padY);
      ctx.lineTo(probePx, h - padY);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = isDark ? '#fbbf24' : '#d97706';
      ctx.beginPath();
      ctx.arc(probePx, probePy, 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = isDark ? '#ffffff' : '#0f172a';
      ctx.lineWidth = 2;
      ctx.stroke();

      const valSign = evalZ.tauZ >= 0 ? '+' : '';
      this.drawCallout(ctx, probePx, probePy, `τ_z = ${valSign}${evalZ.tauZ.toFixed(2)}`, isDark ? '#fbbf24' : '#d97706');
    } else {
      // Zero stress message
      ctx.fillStyle = isDark ? '#f8fafc' : '#000000';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('τ_z = 0.00 MPa', w / 2, h / 2 - 8);
      ctx.font = '12px Outfit, sans-serif';
      ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
      ctx.fillText('Apply load F > 0 kN to visualize shear distribution', w / 2, h / 2 + 16);
    }

    ctx.restore();
  }

  // ==========================================
  // DRAWING HELPERS
  // ==========================================

  drawCanvasGrid(ctx, w, h) {
    const isDark = this.options.theme === 'dark';
    ctx.save();
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)';
    ctx.lineWidth = 1;
    const gridStep = 24;
    for (let x = 0; x < w; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawProbeLine(ctx, w, h, yVal, color, xStart = 0, xEnd = w) {
    const py = this.yToPx(yVal, h);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 3]);
    ctx.beginPath();
    ctx.moveTo(xStart, py);
    ctx.lineTo(xEnd, py);
    ctx.stroke();
    ctx.restore();
  }

  drawCGSymbol(ctx, cx, cy) {
    const isDark = this.options.theme === 'dark';
    const r = 8;
    const color = isDark ? '#38bdf8' : '#0284c7';
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, 0, Math.PI / 2);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, Math.PI, (3 * Math.PI) / 2);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  drawStressBadge(ctx, px, py, val, position) {
    const isDark = this.options.theme === 'dark';
    const isTens = val >= 0;
    const text = `${isTens ? '+' : ''}${val.toFixed(2)}`;
    const color = isTens ? (isDark ? '#38bdf8' : '#0284c7') : (isDark ? '#f43f5e' : '#e11d48');

    ctx.save();
    ctx.font = 'bold 12px "Outfit", "Segoe UI", system-ui, -apple-system, sans-serif';
    const txtWidth = ctx.measureText(text).width;
    const badgeW = txtWidth + 14;
    const badgeH = 22;
    let badgeX = px - badgeW / 2;
    let badgeY = position === 'top' ? py - badgeH - 4 : py + 4;

    const canvasW = ctx.canvas.width / (window.devicePixelRatio || 1);
    const canvasH = ctx.canvas.height / (window.devicePixelRatio || 1);
    badgeX = Math.max(8, Math.min(canvasW - badgeW - 8, badgeX));
    badgeY = Math.max(6, Math.min(canvasH - badgeH - 6, badgeY));

    ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.88)' : 'rgba(255, 255, 255, 0.95)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isDark ? '#f8fafc' : '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, badgeX + badgeW / 2, badgeY + badgeH / 2);
    ctx.restore();
  }

  drawCallout(ctx, px, py, text, color) {
    const isDark = this.options.theme === 'dark';
    ctx.save();
    ctx.font = 'bold 12px "Outfit", "Segoe UI", system-ui, -apple-system, sans-serif';
    const metrics = ctx.measureText(text);
    const boxW = metrics.width + 16;
    const boxH = 24;

    let boxX = px + 12;
    let boxY = py - boxH / 2;

    const canvasW = ctx.canvas.width / (window.devicePixelRatio || 1);
    const canvasH = ctx.canvas.height / (window.devicePixelRatio || 1);
    if (boxX + boxW > canvasW - 8) {
      boxX = px - boxW - 12;
    }
    boxX = Math.max(8, Math.min(canvasW - boxW - 8, boxX));
    boxY = Math.max(6, Math.min(canvasH - boxH - 6, boxY));

    ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.96)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isDark ? '#f8fafc' : '#000000';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, boxX + 8, boxY + boxH / 2);
    ctx.restore();
  }

  drawSectionDimensions(ctx, w, h, scale, cx, cyNA) {
    const isDark = this.options.theme === 'dark';
    const sec = this.section;
    ctx.save();
    ctx.font = 'bold 11px "Outfit", "Segoe UI", system-ui, -apple-system, sans-serif';

    const beamRight = cx + (sec.bMax / 2) * scale;
    const beamLeft = cx - (sec.bMax / 2) * scale;
    // Move vertical dimension sign to near the right edge as requested
    const rightX = w - 18;
    const topY = cyNA - sec.yTop * scale;
    const botY = cyNA - sec.yBot * scale;

    // Witness extension lines for height (subtle dashed lines)
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(beamRight + 3, topY);
    ctx.lineTo(rightX + 4, topY);
    ctx.moveTo(beamRight + 3, botY);
    ctx.lineTo(rightX + 4, botY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Total height dimension line near right edge
    ctx.strokeStyle = isDark ? '#94a3b8' : '#64748b';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(rightX, topY);
    ctx.lineTo(rightX, botY);
    ctx.stroke();
    this.drawArrow(ctx, rightX, topY + 12, rightX, topY, 5);
    this.drawArrow(ctx, rightX, botY - 12, rightX, botY, 5);

    // Height text rotated on right edge with clean solid background pill
    ctx.save();
    const hCenterY = (topY + botY) / 2;
    ctx.translate(rightX, hCenterY);
    ctx.rotate(Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 11px "Outfit", "Segoe UI", system-ui, -apple-system, sans-serif';
    const hCm = sec.h / 10;
    const hText = `h = ${Number.isInteger(hCm) ? hCm : hCm.toFixed(1)} cm`;
    const hMetrics = ctx.measureText(hText);
    ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.96)' : 'rgba(255, 255, 255, 0.96)';
    ctx.fillRect(-hMetrics.width / 2 - 5, -9, hMetrics.width + 10, 18);
    ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.35)' : 'rgba(203, 213, 225, 0.75)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-hMetrics.width / 2 - 5, -9, hMetrics.width + 10, 18);
    ctx.fillStyle = isDark ? '#f8fafc' : '#000000';
    ctx.fillText(hText, 0, 0);
    ctx.restore();

    // Width arrow & extension lines
    const botDimY = botY + 16;

    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.15)';
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(beamLeft, botY + 2);
    ctx.lineTo(beamLeft, botDimY + 4);
    ctx.moveTo(beamRight, botY + 2);
    ctx.lineTo(beamRight, botDimY + 4);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = isDark ? '#94a3b8' : '#64748b';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(beamLeft, botDimY);
    ctx.lineTo(beamRight, botDimY);
    ctx.stroke();
    this.drawArrow(ctx, beamLeft + 12, botDimY, beamLeft, botDimY, 5);
    this.drawArrow(ctx, beamRight - 12, botDimY, beamRight, botDimY, 5);

    ctx.font = 'bold 11px "Outfit", "Segoe UI", system-ui, -apple-system, sans-serif';
    const bCm = sec.bMax / 10;
    const bText = `b = ${Number.isInteger(bCm) ? bCm : bCm.toFixed(1)} cm`;
    const bMetrics = ctx.measureText(bText);
    ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.96)' : 'rgba(255, 255, 255, 0.96)';
    ctx.fillRect(cx - bMetrics.width / 2 - 5, botDimY + 2, bMetrics.width + 10, 18);
    ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.35)' : 'rgba(203, 213, 225, 0.75)';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - bMetrics.width / 2 - 5, botDimY + 2, bMetrics.width + 10, 18);
    ctx.fillStyle = isDark ? '#f8fafc' : '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bText, cx, botDimY + 11);

    ctx.restore();
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
