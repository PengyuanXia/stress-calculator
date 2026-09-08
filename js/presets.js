/**
 * presets.js - Standard Structural Presets & Default Geometries
 */

export const PRESETS = {
  rect: [
    { name: '16 × 24 cm (b/h = 2/3)', params: { b: 16, h: 24 }, desc: 'Aspect ratio 2:3 (tan β = 4/9 · My/Mz, β = 14.4°)' },
    { name: '20 × 40 cm (Standard)', params: { b: 20, h: 40 }, desc: 'Classic reinforced concrete / timber beam' },
    { name: '15 × 30 cm', params: { b: 15, h: 30 }, desc: 'Residential timber joist / purlin' },
    { name: '25 × 50 cm', params: { b: 25, h: 50 }, desc: 'Heavy RC girder' },
    { name: '30 × 60 cm', params: { b: 30, h: 60 }, desc: 'Bridge / transfer beam' }
  ],
  ibeam: [
    { name: 'Girder 54 × 25 cm', params: { h: 54, tw: 2.0, bft: 25, tft: 2.0, bfb: 25, tfb: 2.0 }, desc: 'Heavy flanged steel girder' },
    { name: 'IPE 20 (20 × 10 cm)', params: { h: 20, tw: 0.56, bft: 10, tft: 0.85, bfb: 10, tfb: 0.85 }, desc: 'Eurocode standard light I-section' },
    { name: 'IPE 30 (30 × 15 cm)', params: { h: 30, tw: 0.71, bft: 15, tft: 1.07, bfb: 15, tfb: 1.07 }, desc: 'Eurocode popular floor beam' },
    { name: 'HEB 20 (20 × 20 cm)', params: { h: 20, tw: 0.9, bft: 20, tft: 1.5, bfb: 20, tfb: 1.5 }, desc: 'Broad flange heavy beam / column' },
    { name: 'HEB 30 (30 × 30 cm)', params: { h: 30, tw: 1.1, bft: 30, tft: 1.9, bfb: 30, tfb: 1.9 }, desc: 'Heavy structural girder' },
    { name: 'HEA 24 (23 × 24 cm)', params: { h: 23, tw: 0.75, bft: 24, tft: 1.2, bfb: 24, tfb: 1.2 }, desc: 'Wide flange medium beam' },
    { name: 'Crane Girder (Asymm. 40 cm)', params: { h: 40, tw: 0.8, bft: 25, tft: 1.6, bfb: 15, tfb: 1.2 }, desc: 'Asymmetric crane runway girder' }
  ],
  tbeam: [
    { name: 'T 15 × 15 × 1.0 cm', params: { h: 15, b: 15, tw: 1.0, tf: 1.0 }, desc: 'Equal T-profile' },
    { name: 'T 20 × 15 × 1.2/1.5 cm', params: { h: 20, b: 15, tw: 1.2, tf: 1.5 }, desc: 'Fabricated T-stiffener' },
    { name: 'RC T-Beam (40×20 flange 60 cm)', params: { h: 40, b: 60, tw: 20, tf: 10 }, desc: 'Monolithic slab-beam effective width' }
  ],
  box: [
    { name: 'RHS 12 × 8 × 0.6 cm', params: { h: 12, b: 8, tft: 0.6, tfb: 0.6, twl: 0.6, twr: 0.6 }, desc: 'Standard cold-formed rectangular hollow' },
    { name: 'RHS 20 × 10 × 0.8 cm', params: { h: 20, b: 10, tft: 0.8, tfb: 0.8, twl: 0.8, twr: 0.8 }, desc: 'Structural hollow section beam' },
    { name: 'SHS 15 × 15 × 0.6 cm', params: { h: 15, b: 15, tft: 0.6, tfb: 0.6, twl: 0.6, twr: 0.6 }, desc: 'Square hollow section' },
    { name: 'Asymm. Box Girder 30 × 18 cm', params: { h: 30, b: 18, tft: 1.4, tfb: 1.0, twl: 1.0, twr: 1.0 }, desc: 'Bridge deck box girder' }
  ],
  circle: [
    { name: 'Solid Bar Ø 20 cm', params: { D: 20 }, desc: 'Heavy shaft / pin' },
    { name: 'Solid Bar Ø 15 cm', params: { D: 15 }, desc: 'Medium shaft' },
    { name: 'Solid Bar Ø 10 cm', params: { D: 10 }, desc: 'Standard mechanical shaft' }
  ]
};
