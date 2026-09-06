/**
 * section-models.js - Structural Cross-Section Geometry Engine
 * Computes Area, Centroid, Inertia, Section Moduli, static moment S(y), and width b(y)
 * for 5 standard structural beam profiles:
 * 1. Solid Rectangle (b x h)
 * 2. I-Beam with top/bottom flange dimensions (h, tw, bft, tft, bfb, tfb)
 * 3. Asymmetric T-Section (b, h, tf, tw)
 * 4. Hollow Box with independent thicknesses (h, b, tft, tfb, twl, twr)
 * 5. Solid Circle (D)
 */

export class SectionGeometry {
  /**
   * Factory method to create and calculate section models
   * @param {string} shapeType - 'rect' | 'ibeam' | 'tbeam' | 'box' | 'circle'
   * @param {Object} params - Dimensions in mm
   */
  static create(shapeType, params) {
    switch (shapeType) {
      case 'rect':
        return new RectSection(params);
      case 'ibeam':
        return new IBeamSection(params);
      case 'tbeam':
        return new TBeamSection(params);
      case 'box':
        return new BoxSection(params);
      case 'circle':
        return new CircleSection(params);
      default:
        throw new Error(`Unknown shape type: ${shapeType}`);
    }
  }
}

// Base Class
export class BaseSection {
  constructor(type, params) {
    this.type = type;
    this.params = { ...params };
    this.area = 0;           // mm^2
    this.yBar = 0;           // mm from bottom
    this.h = 0;              // mm total height
    this.bMax = 0;           // mm max width
    this.yTop = 0;           // mm from neutral axis (positive)
    this.yBot = 0;           // mm from neutral axis (negative)
    this.Iz = 0;             // mm^4
    this.Iy = 0;             // mm^4 (second moment about vertical centroidal axis)
    this.zMin = 0;           // mm min z (left edge from centerline)
    this.zMax = 0;           // mm max z (right edge from centerline)
    this.WelTop = 0;         // mm^3
    this.WelBot = 0;         // mm^3
    this.criticalYs = [];    // Array of key elevations [mm from NA]
  }

  toFromBottom(yFromNA) {
    return yFromNA + this.yBar;
  }

  fromBottom(yFromBot) {
    return yFromBot - this.yBar;
  }

  clampY(y) {
    return Math.max(this.yBot, Math.min(this.yTop, y));
  }

  clampZ(z) {
    return Math.max(this.zMin, Math.min(this.zMax, z));
  }

  getFlangeShearVy(z, Vy_N, yProbe = null) {
    return 0;
  }
}

/**
 * 1. SOLID RECTANGLE (b x h)
 */
export class RectSection extends BaseSection {
  constructor(params) {
    super('rect', params);
    this.b = Math.max(1, Number(params.b) || 200);
    this.h = Math.max(1, Number(params.h) || 400);

    this.bMax = this.b;
    this.zMin = -this.b / 2;
    this.zMax = this.b / 2;
    this.area = this.b * this.h;
    this.yBar = this.h / 2;
    this.yTop = this.h / 2;
    this.yBot = -this.h / 2;

    this.Iz = (this.b * Math.pow(this.h, 3)) / 12;
    this.Iy = (this.h * Math.pow(this.b, 3)) / 12;
    this.WelTop = this.Iz / this.yTop;
    this.WelBot = this.Iz / Math.abs(this.yBot);

    this.criticalYs = [this.yTop, 0, this.yBot];
  }

  getWidth(y) {
    if (y > this.yTop + 1e-6 || y < this.yBot - 1e-6) return { b: 0, isJunction: false };
    return {
      type: 'continuous',
      b: this.b,
      bWeb: this.b,
      bFlange: this.b,
      isJunction: false
    };
  }

  getStaticMoment(y) {
    const yClamped = this.clampY(y);
    return (this.b / 2) * (Math.pow(this.yTop, 2) - Math.pow(yClamped, 2));
  }

  getZWidth(z) {
    return this.h;
  }

  getZStaticMoment(z) {
    const zClamped = this.clampZ(z);
    return (this.h / 2) * (Math.pow(this.zMax, 2) - Math.pow(zClamped, 2));
  }

  getBoundaryPolygons() {
    const halfB = this.b / 2;
    return {
      outer: [
        { x: -halfB, y: this.yTop },
        { x: halfB, y: this.yTop },
        { x: halfB, y: this.yBot },
        { x: -halfB, y: this.yBot }
      ],
      holes: []
    };
  }

  getCutPolygon(y) {
    const yClamped = this.clampY(y);
    if (yClamped >= this.yTop - 1e-6) return [];
    const halfB = this.b / 2;
    return [
      { x: -halfB, y: this.yTop },
      { x: halfB, y: this.yTop },
      { x: halfB, y: yClamped },
      { x: -halfB, y: yClamped }
    ];
  }
}

/**
 * 2. I-BEAM (h, tw, bft, tft, bfb, tfb)
 * Supports full independent top & bottom flange dimensions!
 */
export class IBeamSection extends BaseSection {
  constructor(params) {
    super('ibeam', params);
    this.h = Math.max(10, Number(params.h) || 300);
    this.tw = Math.max(1, Number(params.tw) || 7.1);
    
    // Top flange
    this.bft = Math.max(this.tw + 1, Number(params.bft || params.b) || 150);
    this.tft = Math.max(1, Number(params.tft || params.tf) || 10.7);

    // Bottom flange (defaulting to top flange if not specified)
    this.bfb = Math.max(this.tw + 1, Number(params.bfb || params.bft || params.b) || 150);
    this.tfb = Math.max(1, Number(params.tfb || params.tft || params.tf) || 10.7);

    // Ensure total flange thickness < total height
    if (this.tft + this.tfb >= this.h) {
      const maxTf = (this.h - 5) / 2;
      this.tft = Math.min(this.tft, maxTf);
      this.tfb = Math.min(this.tfb, maxTf);
    }

    this.bMax = Math.max(this.bft, this.bfb);
    this.zMin = -this.bMax / 2;
    this.zMax = this.bMax / 2;
    this.hw = this.h - this.tft - this.tfb; // web height

    // 3 component rectangles from bottom
    const areaBotFlange = this.bfb * this.tfb;
    const yBotFlangeLoc = this.tfb / 2;

    const areaWeb = this.tw * this.hw;
    const yWebLoc = this.tfb + this.hw / 2;

    const areaTopFlange = this.bft * this.tft;
    const yTopFlangeLoc = this.h - this.tft / 2;

    this.area = areaBotFlange + areaWeb + areaTopFlange;
    this.yBar = (areaBotFlange * yBotFlangeLoc + areaWeb * yWebLoc + areaTopFlange * yTopFlangeLoc) / this.area;

    this.yTop = this.h - this.yBar;
    this.yBot = -this.yBar;

    // Junction elevations from NA
    this.yJunctionTop = (this.h - this.tft) - this.yBar;
    this.yJunctionBot = this.tfb - this.yBar;

    // Moment of inertia about neutral axis (Parallel Axis Theorem)
    const IzBotFlange = (this.bfb * Math.pow(this.tfb, 3)) / 12 + areaBotFlange * Math.pow(yBotFlangeLoc - this.yBar, 2);
    const IzWeb = (this.tw * Math.pow(this.hw, 3)) / 12 + areaWeb * Math.pow(yWebLoc - this.yBar, 2);
    const IzTopFlange = (this.bft * Math.pow(this.tft, 3)) / 12 + areaTopFlange * Math.pow(yTopFlangeLoc - this.yBar, 2);

    this.Iz = IzBotFlange + IzWeb + IzTopFlange;
    this.Iy = (this.tft * Math.pow(this.bft, 3)) / 12 + (this.tfb * Math.pow(this.bfb, 3)) / 12 + (this.hw * Math.pow(this.tw, 3)) / 12;
    this.WelTop = this.Iz / this.yTop;
    this.WelBot = this.Iz / Math.abs(this.yBot);

    this.criticalYs = [
      this.yTop,
      this.yJunctionTop,
      0,
      this.yJunctionBot,
      this.yBot
    ].sort((a, b) => b - a);
  }

  getZWidth(z) {
    const absZ = Math.abs(this.clampZ(z));
    let t = 0;
    if (absZ <= this.bft / 2) t += this.tft;
    if (absZ <= this.bfb / 2) t += this.tfb;
    // Inside the web width, the vertical cut plane passes through the full web height hw
    if (absZ <= this.tw / 2) t += this.hw;
    return Math.max(1, t);
  }

  getZStaticMoment(z) {
    const absZ = Math.abs(this.clampZ(z));
    let s = 0;
    if (absZ < this.bft / 2) {
      s += (this.tft / 2) * (Math.pow(this.bft / 2, 2) - Math.pow(absZ, 2));
    }
    if (absZ < this.bfb / 2) {
      s += (this.tfb / 2) * (Math.pow(this.bfb / 2, 2) - Math.pow(absZ, 2));
    }
    // Inside web width: add static moment of the web from absZ to tw/2
    if (absZ < this.tw / 2) {
      s += (this.hw / 2) * (Math.pow(this.tw / 2, 2) - Math.pow(absZ, 2));
    }
    return s;
  }

  getFlangeShearVy(z, Vy_N, yProbe = null) {
    if (Math.abs(Vy_N) < 1e-4) return 0;
    const isBot = (yProbe !== null && yProbe < this.yJunctionBot);
    const bf = isBot ? this.bfb : this.bft;
    const yf = isBot ? (this.tfb / 2 - this.yBar) : (this.h - this.tft / 2 - this.yBar);
    const halfB = bf / 2;
    const halfTw = this.tw / 2;
    const absZ = Math.abs(z);
    if (absZ > halfB) return 0;

    // Peak flange shear stress at the web junction edge
    const tauPeak = (Vy_N * yf / this.Iz) * (halfB - halfTw);

    if (z <= -halfTw) {
      // Left flange overhang: linear from 0 at -halfB to +tauPeak at -halfTw
      return (Vy_N * yf / this.Iz) * (halfB + z);
    } else if (z >= halfTw) {
      // Right flange overhang: linear from -tauPeak at +halfTw to 0 at +halfB
      return -(Vy_N * yf / this.Iz) * (halfB - z);
    } else {
      // Across web width [-halfTw, +halfTw]:
      // Diagonal linear transition through zero at centerline z = 0
      return -tauPeak * (z / halfTw);
    }
  }

  getWidth(y) {
    if (y > this.yTop + 1e-6 || y < this.yBot - 1e-6) return { b: 0, isJunction: false };
    const tol = 1e-4;

    // Top junction
    if (Math.abs(y - this.yJunctionTop) < tol) {
      return {
        type: 'step',
        isJunction: true,
        bFlange: this.bft,
        bWeb: this.tw,
        b: this.tw
      };
    }

    // Bottom junction
    if (Math.abs(y - this.yJunctionBot) < tol) {
      return {
        type: 'step',
        isJunction: true,
        bFlange: this.bfb,
        bWeb: this.tw,
        b: this.tw
      };
    }

    if (y > this.yJunctionTop) {
      return { type: 'continuous', isJunction: false, b: this.bft, bFlange: this.bft, bWeb: this.bft };
    }
    if (y < this.yJunctionBot) {
      return { type: 'continuous', isJunction: false, b: this.bfb, bFlange: this.bfb, bWeb: this.bfb };
    }
    return { type: 'continuous', isJunction: false, b: this.tw, bFlange: this.bft, bWeb: this.tw };
  }

  getStaticMoment(y) {
    const yClamped = this.clampY(y);

    if (yClamped >= this.yJunctionTop) {
      // In top flange only
      return (this.bft / 2) * (Math.pow(this.yTop, 2) - Math.pow(yClamped, 2));
    } else if (yClamped >= this.yJunctionBot) {
      // In web: top flange static moment + web portion from y to yJunctionTop
      const sTopFlange = (this.bft / 2) * (Math.pow(this.yTop, 2) - Math.pow(this.yJunctionTop, 2));
      const sWeb = (this.tw / 2) * (Math.pow(this.yJunctionTop, 2) - Math.pow(yClamped, 2));
      return sTopFlange + sWeb;
    } else {
      // In bottom flange: compute area below y
      // S(y) = \int_{yBot}^{y} -\eta b(\eta) d\eta = (bfb / 2) * (y^2 - yBot^2)
      // Taking magnitude:
      return (this.bfb / 2) * (Math.pow(yClamped, 2) - Math.pow(this.yBot, 2)) * -1;
    }
  }

  getBoundaryPolygons() {
    const halfBft = this.bft / 2;
    const halfBfb = this.bfb / 2;
    const halfTw = this.tw / 2;
    const yjTop = this.yJunctionTop;
    const yjBot = this.yJunctionBot;

    return {
      outer: [
        { x: -halfBft, y: this.yTop },
        { x: halfBft, y: this.yTop },
        { x: halfBft, y: yjTop },
        { x: halfTw, y: yjTop },
        { x: halfTw, y: yjBot },
        { x: halfBfb, y: yjBot },
        { x: halfBfb, y: this.yBot },
        { x: -halfBfb, y: this.yBot },
        { x: -halfBfb, y: yjBot },
        { x: -halfTw, y: yjBot },
        { x: -halfTw, y: yjTop },
        { x: -halfBft, y: yjTop }
      ],
      holes: []
    };
  }

  getCutPolygon(y) {
    const yClamped = this.clampY(y);
    if (yClamped >= this.yTop - 1e-6) return [];

    const halfBft = this.bft / 2;
    const halfBfb = this.bfb / 2;
    const halfTw = this.tw / 2;
    const yjTop = this.yJunctionTop;
    const yjBot = this.yJunctionBot;

    if (yClamped >= yjTop) {
      return [
        { x: -halfBft, y: this.yTop },
        { x: halfBft, y: this.yTop },
        { x: halfBft, y: yClamped },
        { x: -halfBft, y: yClamped }
      ];
    } else if (yClamped >= yjBot) {
      return [
        { x: -halfBft, y: this.yTop },
        { x: halfBft, y: this.yTop },
        { x: halfBft, y: yjTop },
        { x: halfTw, y: yjTop },
        { x: halfTw, y: yClamped },
        { x: -halfTw, y: yClamped },
        { x: -halfTw, y: yjTop },
        { x: -halfBft, y: yjTop }
      ];
    } else {
      return [
        { x: -halfBft, y: this.yTop },
        { x: halfBft, y: this.yTop },
        { x: halfBft, y: yjTop },
        { x: halfTw, y: yjTop },
        { x: halfTw, y: yjBot },
        { x: halfBfb, y: yjBot },
        { x: halfBfb, y: yClamped },
        { x: -halfBfb, y: yClamped },
        { x: -halfBfb, y: yjBot },
        { x: -halfTw, y: yjBot },
        { x: -halfTw, y: yjTop },
        { x: -halfBft, y: yjTop }
      ];
    }
  }
}

/**
 * 3. ASYMMETRIC T-SECTION (b, h, tf, tw) - Flange on Top
 */
export class TBeamSection extends BaseSection {
  constructor(params) {
    super('tbeam', params);
    this.h = Math.max(10, Number(params.h) || 200);
    this.b = Math.max(10, Number(params.b) || 150);
    this.tw = Math.min(this.b - 1, Math.max(1, Number(params.tw) || 12));
    this.tf = Math.min(this.h - 1, Math.max(1, Number(params.tf) || 15));

    this.bMax = this.b;
    this.zMin = -this.b / 2;
    this.zMax = this.b / 2;
    this.hw = this.h - this.tf;

    const areaFlange = this.b * this.tf;
    const yFlangeLocal = this.h - this.tf / 2;

    const areaWeb = this.tw * this.hw;
    const yWebLocal = this.hw / 2;

    this.area = areaFlange + areaWeb;
    this.yBar = (areaFlange * yFlangeLocal + areaWeb * yWebLocal) / this.area;

    this.yTop = this.h - this.yBar;
    this.yBot = -this.yBar;

    this.yJunction = this.hw - this.yBar;

    const IzFlange = (this.b * Math.pow(this.tf, 3)) / 12 + areaFlange * Math.pow(yFlangeLocal - this.yBar, 2);
    const IzWeb = (this.tw * Math.pow(this.hw, 3)) / 12 + areaWeb * Math.pow(yWebLocal - this.yBar, 2);
    this.Iz = IzFlange + IzWeb;
    this.Iy = (this.tf * Math.pow(this.b, 3)) / 12 + (this.hw * Math.pow(this.tw, 3)) / 12;

    this.WelTop = this.Iz / this.yTop;
    this.WelBot = this.Iz / Math.abs(this.yBot);

    this.criticalYs = [
      this.yTop,
      this.yJunction,
      0,
      this.yBot
    ].sort((a, b) => b - a);
  }

  getZWidth(z) {
    const absZ = Math.abs(this.clampZ(z));
    let t = this.tf;
    // Across the web region, add web height (h - tf)
    if (absZ <= this.tw / 2) t += (this.h - this.tf);
    return Math.max(1, t);
  }

  getZStaticMoment(z) {
    const absZ = Math.abs(this.clampZ(z));
    let s = (this.tf / 2) * (Math.pow(this.b / 2, 2) - Math.pow(absZ, 2));
    if (absZ < this.tw / 2) {
      s += ((this.h - this.tf) / 2) * (Math.pow(this.tw / 2, 2) - Math.pow(absZ, 2));
    }
    return s;
  }

  getFlangeShearVy(z, Vy_N, yProbe = null) {
    if (Math.abs(Vy_N) < 1e-4) return 0;
    const halfB = this.b / 2;
    const halfTw = this.tw / 2;
    const absZ = Math.abs(z);
    if (absZ > halfB) return 0;
    const yf = (this.h - this.tf / 2) - this.yBar;
    const tauPeak = (Vy_N * yf / this.Iz) * (halfB - halfTw);

    if (z <= -halfTw) {
      return (Vy_N * yf / this.Iz) * (halfB + z);
    } else if (z >= halfTw) {
      return -(Vy_N * yf / this.Iz) * (halfB - z);
    } else {
      return -tauPeak * (z / halfTw);
    }
  }

  getWidth(y) {
    if (y > this.yTop + 1e-6 || y < this.yBot - 1e-6) return { b: 0, isJunction: false };
    const tol = 1e-4;

    if (Math.abs(y - this.yJunction) < tol) {
      return {
        type: 'step',
        isJunction: true,
        bFlange: this.b,
        bWeb: this.tw,
        b: this.tw
      };
    }
    if (y > this.yJunction) {
      return { type: 'continuous', isJunction: false, b: this.b, bFlange: this.b, bWeb: this.b };
    }
    return { type: 'continuous', isJunction: false, b: this.tw, bFlange: this.b, bWeb: this.tw };
  }

  getStaticMoment(y) {
    const yClamped = this.clampY(y);

    if (yClamped >= this.yJunction) {
      return (this.b / 2) * (Math.pow(this.yTop, 2) - Math.pow(yClamped, 2));
    } else {
      const sFlange = (this.b / 2) * (Math.pow(this.yTop, 2) - Math.pow(this.yJunction, 2));
      const sWeb = (this.tw / 2) * (Math.pow(this.yJunction, 2) - Math.pow(yClamped, 2));
      return sFlange + sWeb;
    }
  }

  getBoundaryPolygons() {
    const halfB = this.b / 2;
    const halfTw = this.tw / 2;
    const yj = this.yJunction;

    return {
      outer: [
        { x: -halfB, y: this.yTop },
        { x: halfB, y: this.yTop },
        { x: halfB, y: yj },
        { x: halfTw, y: yj },
        { x: halfTw, y: this.yBot },
        { x: -halfTw, y: this.yBot },
        { x: -halfTw, y: yj },
        { x: -halfB, y: yj }
      ],
      holes: []
    };
  }

  getCutPolygon(y) {
    const yClamped = this.clampY(y);
    if (yClamped >= this.yTop - 1e-6) return [];

    const halfB = this.b / 2;
    const halfTw = this.tw / 2;
    const yj = this.yJunction;

    if (yClamped >= yj) {
      return [
        { x: -halfB, y: this.yTop },
        { x: halfB, y: this.yTop },
        { x: halfB, y: yClamped },
        { x: -halfB, y: yClamped }
      ];
    } else {
      return [
        { x: -halfB, y: this.yTop },
        { x: halfB, y: this.yTop },
        { x: halfB, y: yj },
        { x: halfTw, y: yj },
        { x: halfTw, y: yClamped },
        { x: -halfTw, y: yClamped },
        { x: -halfTw, y: yj },
        { x: -halfB, y: yj }
      ];
    }
  }
}

/**
 * 4. HOLLOW BOX / RHS (h, b, tft, tfb, twl, twr)
 * Supports independent top/bottom flange thicknesses & left/right web thicknesses!
 */
export class BoxSection extends BaseSection {
  constructor(params) {
    super('box', params);
    this.h = Math.max(10, Number(params.h || params.H) || 200);
    this.b = Math.max(10, Number(params.b || params.B) || 120);

    // Flange thicknesses
    this.tft = Math.max(1, Number(params.tft || params.tf) || 8);
    this.tfb = Math.max(1, Number(params.tfb || params.tft || params.tf) || 8);

    // Web thicknesses
    this.twl = Math.max(1, Number(params.twl || params.tw) || 8);
    this.twr = Math.max(1, Number(params.twr || params.twl || params.tw) || 8);

    // Validation checks
    if (this.tft + this.tfb >= this.h) {
      const maxTf = (this.h - 4) / 2;
      this.tft = Math.min(this.tft, maxTf);
      this.tfb = Math.min(this.tfb, maxTf);
    }
    if (this.twl + this.twr >= this.b) {
      const maxTw = (this.b - 4) / 2;
      this.twl = Math.min(this.twl, maxTw);
      this.twr = Math.min(this.twr, maxTw);
    }

    this.bMax = this.b;
    this.zMin = -this.b / 2;
    this.zMax = this.b / 2;
    this.bi = this.b - this.twl - this.twr; // inner hole width
    this.hi = this.h - this.tft - this.tfb; // inner hole height
    this.twTotal = this.twl + this.twr;     // total shear resisting web width

    // Areas and centroid
    const areaOuter = this.b * this.h;
    const yOuterLoc = this.h / 2;

    const areaHole = this.bi * this.hi;
    const yHoleLoc = this.tfb + this.hi / 2;

    this.area = areaOuter - areaHole;
    this.yBar = (areaOuter * yOuterLoc - areaHole * yHoleLoc) / this.area;

    this.yTop = this.h - this.yBar;
    this.yBot = -this.yBar;

    this.yJunctionTop = (this.h - this.tft) - this.yBar;
    this.yJunctionBot = this.tfb - this.yBar;

    // Hole center relative to NA
    this.yHoleCenter = yHoleLoc - this.yBar;
    // Hole horizontal center relative to mid-width
    this.xHoleCenter = -this.b / 2 + this.twl + this.bi / 2;

    // Moment of inertia: Outer rect minus inner hole
    const IzOuter = (this.b * Math.pow(this.h, 3)) / 12 + areaOuter * Math.pow(yOuterLoc - this.yBar, 2);
    const IzHole = (this.bi * Math.pow(this.hi, 3)) / 12 + areaHole * Math.pow(yHoleLoc - this.yBar, 2);
    this.Iz = IzOuter - IzHole;

    const IyOuter = (this.h * Math.pow(this.b, 3)) / 12;
    const IyHole = (this.hi * Math.pow(this.bi, 3)) / 12 + areaHole * Math.pow(this.xHoleCenter, 2);
    this.Iy = Math.max(1, IyOuter - IyHole);

    this.WelTop = this.Iz / this.yTop;
    this.WelBot = this.Iz / Math.abs(this.yBot);

    this.criticalYs = [
      this.yTop,
      this.yJunctionTop,
      0,
      this.yJunctionBot,
      this.yBot
    ].sort((a, b) => b - a);
  }

  getZWidth(z) {
    const zClamped = this.clampZ(z);
    const halfB = this.b / 2;
    const isLeftWeb = (zClamped <= -halfB + this.twl);
    const isRightWeb = (zClamped >= halfB - this.twr);
    if (isLeftWeb || isRightWeb) {
      return this.h;
    }
    return Math.max(1, this.tft + this.tfb);
  }

  getZStaticMoment(z) {
    const zClamped = this.clampZ(z);
    const halfB = this.b / 2;
    const zRightWebEdge = halfB - this.twr;
    const zLeftWebEdge = -(halfB - this.twl);

    if (zClamped >= 0) {
      if (zClamped >= zRightWebEdge) {
        // Inside right web wall: solid height h from zClamped to halfB
        return (this.h / 2) * (Math.pow(halfB, 2) - Math.pow(zClamped, 2));
      } else {
        // In flange / hole region: entire right web wall + flanges from z to zRightWebEdge
        const sWeb = (this.h / 2) * (Math.pow(halfB, 2) - Math.pow(zRightWebEdge, 2));
        const sFlanges = ((this.tft + this.tfb) / 2) * (Math.pow(zRightWebEdge, 2) - Math.pow(zClamped, 2));
        return sWeb + sFlanges;
      }
    } else {
      if (zClamped <= zLeftWebEdge) {
        // Inside left web wall: solid height h from -halfB to zClamped
        return (this.h / 2) * (Math.pow(halfB, 2) - Math.pow(zClamped, 2));
      } else {
        // In flange / hole region: entire left web wall + flanges from z to zLeftWebEdge
        const sWeb = (this.h / 2) * (Math.pow(halfB, 2) - Math.pow(Math.abs(zLeftWebEdge), 2));
        const sFlanges = ((this.tft + this.tfb) / 2) * (Math.pow(Math.abs(zLeftWebEdge), 2) - Math.pow(zClamped, 2));
        return sWeb + sFlanges;
      }
    }
  }

  getFlangeShearVy(z, Vy_N, yProbe = null) {
    if (Math.abs(Vy_N) < 1e-4) return 0;
    const isBot = (yProbe !== null && yProbe < this.yJunctionBot);
    const yf = isBot ? (this.tfb / 2 - this.yBar) : (this.h - this.tft / 2 - this.yBar);
    const halfB = this.b / 2;
    const absZ = Math.abs(z);
    if (absZ > halfB) return 0;

    const zRightWebEdge = halfB - this.twr;
    const zLeftWebEdge = -(halfB - this.twl);

    // Peak horizontal shear stress occurs at the inner edge of each web (flange-web corner)
    const tauPeakRight = (Vy_N * yf / this.Iz) * zRightWebEdge;
    const tauPeakLeft = (Vy_N * yf / this.Iz) * zLeftWebEdge;

    if (z >= 0) {
      if (z <= zRightWebEdge) {
        // In flange: linear increase from 0 at centerline z = 0 to maximum at web edge
        return (Vy_N * yf / this.Iz) * z;
      } else {
        // Across right web wall: flow turns down into web, dropping linearly to 0 at outer edge of part
        const frac = (halfB - z) / Math.max(1e-4, this.twr);
        return tauPeakRight * Math.max(0, frac);
      }
    } else {
      if (z >= zLeftWebEdge) {
        // In flange: linear increase from 0 at centerline z = 0 to negative peak at left web edge
        return (Vy_N * yf / this.Iz) * z;
      } else {
        // Across left web wall: flow turns down into web, dropping linearly to 0 at outer edge of part
        const frac = (halfB + z) / Math.max(1e-4, this.twl);
        return tauPeakLeft * Math.max(0, frac);
      }
    }
  }

  getWidth(y) {
    if (y > this.yTop + 1e-6 || y < this.yBot - 1e-6) return { b: 0, isJunction: false };
    const tol = 1e-4;

    if (Math.abs(y - this.yJunctionTop) < tol) {
      return {
        type: 'step',
        isJunction: true,
        bFlange: this.b,
        bWeb: this.twTotal,
        b: this.twTotal
      };
    }

    if (Math.abs(y - this.yJunctionBot) < tol) {
      return {
        type: 'step',
        isJunction: true,
        bFlange: this.b,
        bWeb: this.twTotal,
        b: this.twTotal
      };
    }

    if (y > this.yJunctionTop || y < this.yJunctionBot) {
      return { type: 'continuous', isJunction: false, b: this.b, bFlange: this.b, bWeb: this.b };
    }
    return { type: 'continuous', isJunction: false, b: this.twTotal, bFlange: this.b, bWeb: this.twTotal };
  }

  getStaticMoment(y) {
    const yClamped = this.clampY(y);

    if (yClamped >= this.yJunctionTop) {
      return (this.b / 2) * (Math.pow(this.yTop, 2) - Math.pow(yClamped, 2));
    } else if (yClamped >= this.yJunctionBot) {
      const sTopFlange = (this.b / 2) * (Math.pow(this.yTop, 2) - Math.pow(this.yJunctionTop, 2));
      const sWebs = (this.twTotal / 2) * (Math.pow(this.yJunctionTop, 2) - Math.pow(yClamped, 2));
      return sTopFlange + sWebs;
    } else {
      // Bottom flange portion
      return (this.b / 2) * (Math.pow(yClamped, 2) - Math.pow(this.yBot, 2)) * -1;
    }
  }

  getBoundaryPolygons() {
    const halfB = this.b / 2;
    const halfBi = this.bi / 2;
    const halfHi = this.hi / 2;
    const xh = this.xHoleCenter;
    const yh = this.yHoleCenter;

    return {
      outer: [
        { x: -halfB, y: this.yTop },
        { x: halfB, y: this.yTop },
        { x: halfB, y: this.yBot },
        { x: -halfB, y: this.yBot }
      ],
      holes: [
        [
          { x: xh - halfBi, y: yh + halfHi },
          { x: xh + halfBi, y: yh + halfHi },
          { x: xh + halfBi, y: yh - halfHi },
          { x: xh - halfBi, y: yh - halfHi }
        ]
      ]
    };
  }

  getCutPolygon(y) {
    const yClamped = this.clampY(y);
    if (yClamped >= this.yTop - 1e-6) return [];

    const halfB = this.b / 2;
    const halfBi = this.bi / 2;
    const halfHi = this.hi / 2;
    const xh = this.xHoleCenter;
    const yh = this.yHoleCenter;

    if (yClamped >= this.yJunctionTop) {
      return [{
        outer: [
          { x: -halfB, y: this.yTop },
          { x: halfB, y: this.yTop },
          { x: halfB, y: yClamped },
          { x: -halfB, y: yClamped }
        ],
        holes: []
      }];
    } else if (yClamped >= this.yJunctionBot) {
      return [{
        outer: [
          { x: -halfB, y: this.yTop },
          { x: halfB, y: this.yTop },
          { x: halfB, y: yClamped },
          { x: -halfB, y: yClamped }
        ],
        holes: [
          [
            { x: xh - halfBi, y: yh + halfHi },
            { x: xh + halfBi, y: yh + halfHi },
            { x: xh + halfBi, y: yClamped },
            { x: xh - halfBi, y: yClamped }
          ]
        ]
      }];
    } else {
      return [{
        outer: [
          { x: -halfB, y: this.yTop },
          { x: halfB, y: this.yTop },
          { x: halfB, y: yClamped },
          { x: -halfB, y: yClamped }
        ],
        holes: [
          [
            { x: xh - halfBi, y: yh + halfHi },
            { x: xh + halfBi, y: yh + halfHi },
            { x: xh + halfBi, y: yh - halfHi },
            { x: xh - halfBi, y: yh - halfHi }
          ]
        ]
      }];
    }
  }
}

/**
 * 5. SOLID CIRCLE (D)
 */
export class CircleSection extends BaseSection {
  constructor(params) {
    super('circle', params);
    this.D = Math.max(1, Number(params.D || params.d || params.h) || 200);
    this.R = this.D / 2;

    this.h = this.D;
    this.b = this.D;
    this.bMax = this.D;
    this.zMin = -this.R;
    this.zMax = this.R;

    this.area = Math.PI * Math.pow(this.R, 2);
    this.yBar = this.R;
    this.yTop = this.R;
    this.yBot = -this.R;

    this.Iz = (Math.PI * Math.pow(this.D, 4)) / 64;
    this.Iy = (Math.PI * Math.pow(this.D, 4)) / 64;
    this.WelTop = this.Iz / this.yTop;
    this.WelBot = this.Iz / Math.abs(this.yBot);

    this.criticalYs = [this.yTop, 0, this.yBot];
  }

  getWidth(y) {
    const absY = Math.abs(this.clampY(y));
    if (absY >= this.R) return { b: 0, isJunction: false };
    const chord = 2 * Math.sqrt(Math.max(0, Math.pow(this.R, 2) - Math.pow(absY, 2)));
    return {
      type: 'continuous',
      isJunction: false,
      b: chord,
      bFlange: chord,
      bWeb: chord
    };
  }

  getStaticMoment(y) {
    const absY = Math.abs(this.clampY(y));
    if (absY >= this.R) return 0;
    return (2 / 3) * Math.pow(Math.max(0, Math.pow(this.R, 2) - Math.pow(absY, 2)), 1.5);
  }

  getZWidth(z) {
    const absZ = Math.abs(this.clampZ(z));
    if (absZ >= this.R) return 0.1;
    return 2 * Math.sqrt(Math.max(0, Math.pow(this.R, 2) - Math.pow(absZ, 2)));
  }

  getZStaticMoment(z) {
    const absZ = Math.abs(this.clampZ(z));
    if (absZ >= this.R) return 0;
    return (2 / 3) * Math.pow(Math.max(0, Math.pow(this.R, 2) - Math.pow(absZ, 2)), 1.5);
  }

  getBoundaryPolygons(segments = 72) {
    const outer = [];
    for (let i = 0; i < segments; i++) {
      const angle = (2 * Math.PI * i) / segments;
      outer.push({
        x: this.R * Math.cos(angle),
        y: this.R * Math.sin(angle)
      });
    }
    return { outer, holes: [] };
  }

  getCutPolygon(y, segments = 36) {
    const yClamped = this.clampY(y);
    if (yClamped >= this.yTop - 1e-6) return [];
    if (yClamped <= this.yBot + 1e-6) return this.getBoundaryPolygons(segments * 2).outer;

    const angleStart = Math.asin(Math.max(-1, Math.min(1, yClamped / this.R)));
    const angleEnd = Math.PI - angleStart;

    const pts = [];
    pts.push({ x: this.R * Math.cos(angleStart), y: yClamped });

    const step = (angleEnd - angleStart) / segments;
    for (let i = 1; i < segments; i++) {
      const a = angleStart + i * step;
      pts.push({ x: this.R * Math.cos(a), y: this.R * Math.sin(a) });
    }

    pts.push({ x: this.R * Math.cos(angleEnd), y: yClamped });

    return pts;
  }
}
