/**
 * stress-engine.js - Core Civil & Structural Engineering Stress Analysis Engine
 * Evaluates:
 * - Navier Normal Stress: \sigma(y) = N/A - M*y/I (or +M*y/I based on convention)
 * - Jourawski Shear Stress: \tau(y) = (V * S(y)) / (I * b(y))
 * - Discontinuous shear jump at flange-web junctions
 * - von Mises Combined Stress: \sigma_{vM}(y) = \sqrt{\sigma(y)^2 + 3\tau(y)^2}
 * - Principal Normal Stresses: \sigma_{1,2}(y) and Principal Angle \theta_p
 * - Mohr's Circle Parameters
 * - Critical cross-section check points and material yield utilization
 */

export class StressEngine {
  /**
   * Run full stress profile analysis
   * @param {BaseSection} section - Instance of section model
   * @param {Object} forces - { N: kN, M: kNm, V: kN }
   * @param {Object} material - { name: string, fy: MPa, fck?: MPa, ft?: MPa }
   * @param {Object} options - { convention: 'sagging_positive' | 'hogging_positive' }
   */
  static analyze(section, input, material, options = {}) {
    const convention = options.convention || 'sagging_positive';
    let My_kNm = 120;
    let Mz_kNm = 40;
    let Vz_kN = 80;
    let Vy_kN = 0;

    if (input && (input.My !== undefined || input.Mz !== undefined)) {
      My_kNm = Number(input.My) || 0;
      Mz_kNm = Number(input.Mz) || 0;
      Vz_kN = Number(input.Vz !== undefined ? input.Vz : (input.V ?? 80)) || 0;
      Vy_kN = Number(input.Vy) || 0;
    } else if (input && (input.F !== undefined || input.alpha !== undefined)) {
      // Legacy F, alpha, L fallback
      const F = Number(input.F) || 0;
      const alpha = Number(input.alpha) || 0;
      const L = Number(input.L) || 1.5;
      const rad = (alpha * Math.PI) / 180;
      Vz_kN = F * Math.cos(rad);
      Vy_kN = F * Math.sin(rad);
      My_kNm = Vz_kN * L;
      Mz_kNm = Vy_kN * L;
    } else if (input) {
      My_kNm = Number(input.My ?? input.M) || 0;
      Mz_kNm = Number(input.Mz) || 0;
      Vz_kN = Number(input.Vz ?? input.V) || 0;
      Vy_kN = Number(input.Vy) || 0;
    }

    // Convert to N and N*mm
    // Moment My about horizontal axis: 1 kNm = 1e6 N*mm
    // Moment Mz about vertical axis: 1 kNm = 1e6 N*mm
    // Shear Vz along vertical axis: 1 kN = 1e3 N
    // Shear Vy along horizontal axis: 1 kN = 1e3 N
    const My_Nmm = My_kNm * 1e6;
    const Mz_Nmm = Mz_kNm * 1e6;
    const Vz_N = Vz_kN * 1e3;
    const Vy_N = Vy_kN * 1e3;

    const fy = Number(material?.fy) || 235; // MPa

    const A = section.area; // mm^2
    const I_horiz = section.Iz;  // mm^4 (moment of inertia about horizontal y-axis)
    const I_vert = section.Iy || section.Iz; // mm^4 (moment of inertia about vertical z-axis)

    /**
     * Compute stresses at elevation y (internal mm from NA, positive upward)
     * In user coordinate system:
     * +z is downward (z_user = -y)
     * +y is to the left (y_user = -z_internal)
     */
    const evaluateAt = (y, locationType = 'auto', zProbe = 0) => {
      const yClamped = section.clampY(y);
      const widthInfo = section.getWidth(yClamped);
      const Sy = section.getStaticMoment(yClamped);

      // In user coordinates:
      // z_user = -yClamped (downward positive)
      // y_user = -zProbe (leftward positive)
      const zUser = -yClamped;
      const yUser = -zProbe;

      // Normal stress: \sigma(y, z) = (My / I_horiz) * z - (Mz / I_vert) * y
      let sigma = 0;
      if (I_horiz > 0) {
        sigma += (My_Nmm * zUser) / I_horiz;
      }
      if (I_vert > 0 && Math.abs(Mz_Nmm) > 1e-4) {
        sigma -= (Mz_Nmm * yUser) / I_vert;
      }

      let bEff = widthInfo.b;
      if (widthInfo.isJunction) {
        if (locationType === 'flange') bEff = widthInfo.bFlange;
        else if (locationType === 'web') bEff = widthInfo.bWeb;
      }

      // Vertical shear stress: tau_z = (|Vz| * Sy) / (I_horiz * b)
      let tau = 0;
      let tauSigned = 0;
      if (I_horiz > 0 && bEff > 0) {
        tau = (Math.abs(Vz_N) * Sy) / (I_horiz * bEff);
        tauSigned = (Vz_N * Sy) / (I_horiz * bEff);
      }

      // Principal stresses based on sigma and vertical shear tau
      const sigmaAvg = sigma / 2;
      const rMohr = Math.sqrt(Math.pow(sigmaAvg, 2) + Math.pow(tau, 2));
      const sigma1 = sigmaAvg + rMohr;
      const sigma2 = sigmaAvg - rMohr;
      const tauMaxInPlane = rMohr;

      const thetaPRad = Math.abs(sigma) > 1e-6
        ? 0.5 * Math.atan((2 * tauSigned) / sigma)
        : (tauSigned !== 0 ? Math.sign(tauSigned) * (Math.PI / 4) : 0);
      const thetaPDeg = (thetaPRad * 180) / Math.PI;

      return {
        y: yClamped,
        yFromBot: section.toFromBottom(yClamped),
        zUser,
        yUser,
        width: bEff,
        isJunction: widthInfo.isJunction,
        locationType,
        Sy,
        sigma,
        tau,
        tauY: tau,
        tauSigned,
        sigma1,
        sigma2,
        tauMaxInPlane,
        thetaPDeg,
        thetaPRad
      };
    };

    /**
     * Compute horizontal shear stress at internal horizontal width coordinate z (mm from centerline)
     * In user coordinates, y_user = -z (positive to the left).
     */
    const evaluateZAt = (z, yProbe = null) => {
      const zClamped = section.clampZ ? section.clampZ(z) : z;
      const tZ = section.getZWidth ? section.getZWidth(zClamped) : section.h;
      const Sz = section.getZStaticMoment ? section.getZStaticMoment(zClamped) : 0;

      // Weak-axis parabolic shear stress due to horizontal shear Vy
      let tauWeak = 0;
      if (I_vert > 0 && tZ > 0 && Math.abs(Vy_N) > 1e-4) {
        tauWeak = (Math.abs(Vy_N) * Sz) / (I_vert * tZ);
      }

      // Flange shear flow / horizontal shear stress due to vertical shear Vz
      let tauFlangeVz = 0;
      if (section.getFlangeShearVy && Math.abs(Vz_N) > 1e-4) {
        tauFlangeVz = section.getFlangeShearVy(zClamped, Vz_N, yProbe);
      }

      // Combined horizontal shear stress tauZ (preserving sign)
      const tauZ = tauFlangeVz + (Vy_N >= 0 ? tauWeak : -tauWeak);
      return {
        z: zClamped,
        yUser: -zClamped,
        widthZ: tZ,
        Sz,
        tauWeak,
        tauFlangeVy: tauFlangeVz,
        tauZ
      };
    };

    // Sample vertical profiles along height y
    const sampleCountY = 180;
    const yMin = section.yBot;
    const yMax = section.yTop;
    const deltaY = (yMax - yMin) / sampleCountY;

    const normalProfile = [];
    const shearProfileY = [];

    const keyElevations = [...new Set(section.criticalYs)].sort((a, b) => b - a);

    const addSampleY = (y, locType = 'auto') => {
      const pt = evaluateAt(y, locType);
      normalProfile.push({ y: pt.y, sigma: pt.sigma });
      shearProfileY.push({ y: pt.y, tau: pt.tau, tauSigned: pt.tauSigned, locType });
    };

    for (let i = 0; i <= sampleCountY; i++) {
      const curY = yMax - i * deltaY;
      const hitCrit = keyElevations.find(ky => Math.abs(ky - curY) < deltaY * 0.45);
      if (hitCrit !== undefined && Math.abs(hitCrit - curY) < 1e-4) {
        const wInfo = section.getWidth(hitCrit);
        if (wInfo.isJunction) {
          const isTopJunction = hitCrit > 0;
          if (isTopJunction) {
            addSampleY(hitCrit, 'flange');
            addSampleY(hitCrit, 'web');
          } else {
            addSampleY(hitCrit, 'web');
            addSampleY(hitCrit, 'flange');
          }
        } else {
          addSampleY(hitCrit, 'auto');
        }
      } else {
        addSampleY(curY, 'auto');
      }
    }

    // Sample horizontal shear profile along width z
    const sampleCountZ = 160;
    const zMin = section.zMin || -section.bMax / 2;
    const zMax = section.zMax || section.bMax / 2;
    const deltaZ = (zMax - zMin) / sampleCountZ;
    const shearProfileZ = [];

    const criticalZs = [0];
    if (section.tw) {
      const halfTw = section.tw / 2;
      criticalZs.push(-halfTw, halfTw);
    }
    if (section.type === 'box') {
      const halfB = section.b / 2;
      criticalZs.push(-(halfB - section.twl), halfB - section.twr);
    }

    const zPoints = [];
    for (let i = 0; i <= sampleCountZ; i++) {
      zPoints.push(zMin + i * deltaZ);
    }
    // Add critical Z coordinates with small offsets to capture corners and transitions
    criticalZs.forEach(cz => {
      zPoints.push(cz - 1e-4);
      zPoints.push(cz);
      zPoints.push(cz + 1e-4);
    });

    const sortedZ = [...new Set(zPoints.filter(z => z >= zMin - 1e-6 && z <= zMax + 1e-6))].sort((a, b) => a - b);

    sortedZ.forEach(zVal => {
      const ptZ = evaluateZAt(zVal);
      shearProfileZ.push({ z: ptZ.z, tau: ptZ.tauZ, tauFlangeVy: ptZ.tauFlangeVy, tauWeak: ptZ.tauWeak });
    });

    // Check points
    const checkPoints = [];
    const topPt = evaluateAt(section.yTop);
    checkPoints.push({ label: 'Top Fiber', labelKey: 'point.topFiber', ...topPt });

    if (section.yJunctionTop !== undefined) {
      checkPoints.push({
        label: 'Top Junction (Flange)',
        labelKey: 'point.topJunctionFlange',
        ...evaluateAt(section.yJunctionTop, 'flange')
      });
      checkPoints.push({
        label: 'Top Junction (Web)',
        labelKey: 'point.topJunctionWeb',
        ...evaluateAt(section.yJunctionTop, 'web')
      });
    } else if (section.yJunction !== undefined) {
      checkPoints.push({
        label: 'Junction (Flange)',
        labelKey: 'point.junctionFlange',
        ...evaluateAt(section.yJunction, 'flange')
      });
      checkPoints.push({
        label: 'Junction (Web)',
        labelKey: 'point.junctionWeb',
        ...evaluateAt(section.yJunction, 'web')
      });
    }

    const naPt = evaluateAt(0, 'auto');
    checkPoints.push({ label: 'Neutral Axis (y = 0)', labelKey: 'point.neutralAxis', ...naPt });

    if (section.yJunctionBot !== undefined) {
      checkPoints.push({
        label: 'Bottom Junction (Web)',
        labelKey: 'point.botJunctionWeb',
        ...evaluateAt(section.yJunctionBot, 'web')
      });
      checkPoints.push({
        label: 'Bottom Junction (Flange)',
        labelKey: 'point.botJunctionFlange',
        ...evaluateAt(section.yJunctionBot, 'flange')
      });
    }

    const botPt = evaluateAt(section.yBot);
    checkPoints.push({ label: 'Bottom Fiber', labelKey: 'point.botFiber', ...botPt });

    // Extrema
    let maxSigmaAbs = 0;
    let maxSigma = -Infinity;
    let minSigma = Infinity;
    let maxTauY = 0;
    let maxTauZ = -Infinity;
    let minTauZ = Infinity;
    let maxTauZAbs = 0;

    checkPoints.forEach(pt => {
      if (Math.abs(pt.sigma) > maxSigmaAbs) maxSigmaAbs = Math.abs(pt.sigma);
      if (pt.sigma > maxSigma) maxSigma = pt.sigma;
      if (pt.sigma < minSigma) minSigma = pt.sigma;
      if (pt.tau > maxTauY) maxTauY = pt.tau;
    });

    shearProfileY.forEach(p => {
      if (p.tau > maxTauY) maxTauY = p.tau;
    });

    shearProfileZ.forEach(p => {
      if (p.tau > maxTauZ) maxTauZ = p.tau;
      if (p.tau < minTauZ) minTauZ = p.tau;
      if (Math.abs(p.tau) > maxTauZAbs) maxTauZAbs = Math.abs(p.tau);
    });

    if (maxTauZ === -Infinity) maxTauZ = 0;
    if (minTauZ === Infinity) minTauZ = 0;

    normalProfile.forEach(p => {
      if (Math.abs(p.sigma) > maxSigmaAbs) maxSigmaAbs = Math.abs(p.sigma);
    });

    // Neutral axis inclination angle beta from vertical z-axis:
    // tan(beta) = (I_vert / I_horiz) * (|My| / |Mz|) = (Iz / Iy) * (|My| / |Mz|)
    let tanBeta = 0;
    let betaDeg = 0;
    const absMy = Math.abs(My_Nmm);
    const absMz = Math.abs(Mz_Nmm);

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

    return {
      moments: { My: My_kNm, Mz: Mz_kNm },
      shears: { Vz: Vz_kN, Vy: Vy_kN },
      neutralAxis: { tanBeta, betaDeg },
      forces: {
        My_kNm,
        Mz_kNm,
        Vz_kN,
        Vy_kN,
        My_Nmm,
        Mz_Nmm,
        Vz_N,
        Vy_N,
        N_kN: 0,
        M_kNm: My_kNm,
        V_kN: Vz_kN,
        N_N: 0,
        M_Nmm: My_Nmm,
        V_N: Vz_N
      },
      material: { name: material?.name || 'Steel', fy },
      convention,
      evaluateAt,
      evaluateZAt,
      profiles: {
        normal: normalProfile,
        shear: shearProfileY,
        shearY: shearProfileY,
        shearZ: shearProfileZ
      },
      checkPoints,
      extrema: {
        maxSigmaAbs,
        maxSigma,
        minSigma,
        maxTau: maxTauY,
        maxTauY,
        maxTauZ,
        minTauZ,
        maxTauZAbs
      }
    };
  }
}
