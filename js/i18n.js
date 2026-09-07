/**
 * i18n.js - Bilingual English / Polish Localization Dictionary
 */

export const TRANSLATIONS = {
  en: {
    // App Header
    appTitle: 'Beam Stress Distribution Calculator',
    appSubtitle: 'Cross-sectional Normal Stress, Shear Stress & Mohr\'s Circle Analysis',
    backToHub: '← Back to Hub',
    btnShare: 'Share Model',
    btnExport: 'Export PNG',
    btnPrint: 'Print Report',
    kofiBtn: 'Buy me a coffee',
    kofiTitle: 'Buy me a coffee on Ko-fi',
    contactBtn: 'Contact',
    contactModalTitle: 'Contact & Feedback',
    contactAuthorSub: 'Doctoral Researcher • Warsaw University of Technology (PW)',
    contactEmailTitle: 'University Email',
    contactGithubTitle: 'GitHub Profile & Issues',
    contactGithubSub: 'Bug reports & feature requests',
    contactKofiTitle: 'Buy Me a Coffee',
    contactKofiSub: 'Support project development',
    copyBtn: '📋 Copy',
    copiedBtn: '✓ Copied!',
    toastEmailCopied: '📋 Email copied to clipboard!',
    themeDay: '☀️ Day',
    themeNight: '🌙 Night',
    langToggle: 'PL',
    footerCreator: 'Created by <strong>Pengyuan Xia</strong>',

    // Shapes
    shape_rect: 'Solid Rectangle',
    shape_ibeam: 'I-Beam (General)',
    shape_tbeam: 'T-Section',
    shape_box: 'Hollow Box / RHS',
    shape_circle: 'Solid Circle',

    // Section Parameters
    sectionGeometry: 'Section Geometry',
    presetsDropdown: 'Load Standard Preset...',
    dim_b: 'Width [cm]',
    dim_h: 'Height [cm]',
    dim_tw: 'Web thickness [cm]',
    dim_tf: 'Flange thickness [cm]',
    dim_bft: 'Top flange width [cm]',
    dim_tft: 'Top flange thickness [cm]',
    dim_bfb: 'Bottom flange width [cm]',
    dim_tfb: 'Bottom flange thickness [cm]',
    dim_B: 'Outer width [cm]',
    dim_H: 'Outer height [cm]',
    dim_twl: 'Left web thickness [cm]',
    dim_twr: 'Right web thickness [cm]',
    dim_D: 'Diameter [cm]',

    // Applied Bending Moments & Shears
    appliedMoments: 'Applied Moments & Shear Forces',
    coordSystemTitle: 'Coordinate System Convention',
    coordSystemDesc: '+z is downward (↓) | +y is to the left (←). Moments represented by double arrows (⇊, ⇇) along coordinate axes.',
    moment_My: 'Moment <i>M</i><sub>y</sub> (about y-axis) [kNm]',
    moment_Mz: 'Moment <i>M</i><sub>z</sub> (about z-axis) [kNm]',
    momentMyHint: 'Vector along y-axis: +My (←) produces tension at bottom (+z) and compression at top (-z).',
    momentMzHint: 'Vector along z-axis: +Mz (↓) produces tension on right (-y) and compression on left (+y).',
    shearForcesTitle: 'Transverse Shear Forces (for τ-diagrams)',
    resultingForces: 'Resulting Forces & Moments',

    // Interactive Hint
    diagramInteractHint: 'Click or drag directly across any diagram (Section, Normal Stress, or Shear Stress) to move the inspection line to any height z or width y.',

    // Diagram Headers
    diagram_section: 'Cross-Section',
    diagram_sigma: 'Normal Stress',
    diagram_tau: 'Shear Stress',
    diagram_tauY: 'Vertical Shear Stress',
    diagram_tauZ: 'Horizontal Shear Stress',

    // Diagram Details
    tensionFiber: 'Tension Fiber (+)',
    compressionFiber: 'Compression Fiber (-)',
    neutralAxis: 'Neutral Axis (N-A)',
    centroid: 'Centroid (C.G.)',

    // Probe Readout Card
    probeElevFromNA: 'Elevation <span class="font-serif italic">z</span> (from N-A, ↓):',
    probeElevFromBot: 'Height from bottom (<span class="font-serif italic">y</span>):',
    probeWidth: 'Effective Width <span class="font-serif italic">b</span>(<i>z</i>):',
    probeSy: 'Static Moment <span class="font-serif italic">S</span><sub class="font-sans">y</sub>(<i>z</i>):',
    probeSigma: 'Normal Stress <span class="font-serif italic">σ</span>(<i>z</i>):',
    probeTau: 'Shear Stress <span class="font-serif italic">τ</span>(<i>z</i>):',
    probeTauY: 'Vert Shear <span class="font-serif italic">τ</span><sub class="font-sans">z</sub>(<i>z</i>):',
    probeTauZ: 'Horiz Shear <span class="font-serif italic">τ</span><sub class="font-sans">y,max</sub>:',
    probeP1: 'Principal Stress <span class="font-serif italic font-semibold">σ</span>₁:',
    probeP2: 'Principal Stress <span class="font-serif italic font-semibold">σ</span>₂:',
    probeTheta: 'Principal Angle <span class="font-serif italic font-semibold">θ</span><sub class="font-sans">p</sub>:',
    heightOfInterest: 'Height of Interest (<span class="font-serif italic">z</span>)',
    probeJumpTop: 'Top',
    probeJumpNA: 'N-A (z = 0)',
    probeJumpBot: 'Bottom',

    // Mohr & Element
    elementTitle: 'Stress State',
    elementSubtitle: 'Stress state at current elevation z',
    elementModeStd: 'Standard',
    elementModePrin: 'Principal',
    mohrTitle: "Mohr's Circle of Stress",
    mohrSubtitle: 'In-plane principal stresses & maximum shear',

    // Step-by-Step Derivations
    derivationsTitle: 'Analytical Calculations & Step-by-Step Proofs',
    derivStep1: 'Step 1: Section Geometric Properties',
    derivStep2: 'Step 2: Normal Bending Stress Distribution <i>σ</i>(<i>y</i>)',
    derivStep3: 'Step 3: Shear Stress Distribution <i>τ</i>(<i>y</i>)',
    derivStep4: "Step 4: Principal Stresses & Mohr's Circle at Probe Slice",

    // Share Modal
    shareModalTitle: 'Share Beam Stress Model',
    shareModalDesc: 'Anyone with this link or QR code can instantly inspect your cross-section stresses.',
    copyLinkBtn: 'Copy Link',
    downloadQrBtn: 'Download QR PNG',
    copiedToast: 'Link copied to clipboard!',
    closeModal: 'Close',

    // Check points
    'point.topFiber': 'Top Fiber',
    'point.topJunctionFlange': 'Top Junction (Flange)',
    'point.topJunctionWeb': 'Top Junction (Web)',
    'point.junctionFlange': 'Junction (Flange)',
    'point.junctionWeb': 'Junction (Web)',
    'point.neutralAxis': 'Neutral Axis (y = 0)',
    'point.botJunctionWeb': 'Bottom Junction (Web)',
    'point.botJunctionFlange': 'Bottom Junction (Flange)',
    'point.botFiber': 'Bottom Fiber'
  },

  pl: {
    // App Header
    appTitle: 'Kalkulator Rozkładu Naprężeń w Belce',
    appSubtitle: 'Analiza Naprężeń Normalnych, Ścinających i Koła Mohra',
    backToHub: '← Wróć do Hubu',
    btnShare: 'Udostępnij Model',
    btnExport: 'Eksportuj PNG',
    btnPrint: 'Drukuj Raport',
    kofiBtn: 'Postaw mi kawę',
    kofiTitle: 'Postaw mi kawę na Ko-fi',
    contactBtn: 'Kontakt',
    contactModalTitle: 'Kontakt i Opinie',
    contactAuthorSub: 'Doktorant • Politechnika Warszawska (PW)',
    contactEmailTitle: 'E-mail uczelniany',
    contactGithubTitle: 'Profil GitHub i Zgłoszenia',
    contactGithubSub: 'Zgłoszenia błędów i propozycje funkcji',
    contactKofiTitle: 'Postaw kawę',
    contactKofiSub: 'Wesprzyj rozwój projektu',
    copyBtn: '📋 Kopiuj',
    copiedBtn: '✓ Skopiowano!',
    toastEmailCopied: '📋 Adres e-mail skopiowany do schowka!',
    themeDay: '☀️ Jasny',
    themeNight: '🌙 Ciemny',
    langToggle: 'EN',
    footerCreator: 'Twórca: <strong>Pengyuan Xia</strong>',

    // Shapes
    shape_rect: 'Prostokąt Pełny',
    shape_ibeam: 'Dwuteownik (Dowolny)',
    shape_tbeam: 'Teownik Niesymetryczny',
    shape_box: 'Profil Zamknięty / Skrzynkowy',
    shape_circle: 'Koło Pełne',

    // Section Parameters
    sectionGeometry: 'Geometria Przekroju',
    presetsDropdown: 'Wybierz Profil Standardowy...',
    dim_b: 'Szerokość [cm]',
    dim_h: 'Wysokość [cm]',
    dim_tw: 'Grubość środnika [cm]',
    dim_tf: 'Grubość pasa [cm]',
    dim_bft: 'Szerokość pasa górnego [cm]',
    dim_tft: 'Grubość pasa górnego [cm]',
    dim_bfb: 'Szerokość pasa dolnego [cm]',
    dim_tfb: 'Grubość pasa dolnego [cm]',
    dim_B: 'Szerokość całkowita [cm]',
    dim_H: 'Wysokość całkowita [cm]',
    dim_twl: 'Grubość lewego środnika [cm]',
    dim_twr: 'Grubość prawego środnika [cm]',
    dim_D: 'Średnica [cm]',

    // Applied Bending Moments & Shears
    appliedMoments: 'Momenty i Siły Tnące',
    coordSystemTitle: 'Układ Współrzędnych',
    coordSystemDesc: '+z w dół (↓) | +y w lewo (←). Momenty oznaczone podwójnymi strzałkami (⇊, ⇇) wzdłuż osi układu.',
    moment_My: 'Moment <i>M</i><sub>y</sub> (względem osi y) [kNm]',
    moment_Mz: 'Moment <i>M</i><sub>z</sub> (względem osi z) [kNm]',
    momentMyHint: 'Wektor wzdłuż osi y: +My (←) powoduje rozciąganie na dole (+z) i ściskanie na górze (-z).',
    momentMzHint: 'Wektor wzdłuż osi z: +Mz (↓) powoduje rozciąganie po prawej (-y) i ściskanie po lewej (+y).',
    shearForcesTitle: 'Poprzeczne Siły Tnące (do wykresów τ)',
    resultingForces: 'Wynikowe Siły Tnące i Momenty',

    // Interactive Hint
    diagramInteractHint: 'Kliknij lub przeciągnij kursor po wykresach (Przekrój, Naprężenia Normalne lub Styczne), aby badać wysokość z lub szerokość y.',

    // Diagram Headers
    diagram_section: 'Przekrój Poprzeczny',
    diagram_sigma: 'Naprężenia Normalne',
    diagram_tau: 'Naprężenia Styczne',
    diagram_tauY: 'Pionowe Naprężenia Styczne',
    diagram_tauZ: 'Poziome Naprężenia Styczne',

    // Diagram Details
    tensionFiber: 'Strefa Rozciągana (+)',
    compressionFiber: 'Strefa Ściskana (-)',
    neutralAxis: 'Oś Obojętna (N-A)',
    centroid: 'Środek Ciężkości (C.G.)',

    // Probe Readout Card
    probeElevFromNA: 'Współrzędna <span class="font-serif italic">z</span> (od osi N-A, ↓):',
    probeElevFromBot: 'Wysokość od dołu (<span class="font-serif italic">y</span>):',
    probeWidth: 'Szerokość Efektywna <span class="font-serif italic">b</span>(<i>z</i>):',
    probeSy: 'Moment Statyczny <span class="font-serif italic">S</span><sub class="font-sans">y</sub>(<i>z</i>):',
    probeSigma: 'Naprężenie Normalne <span class="font-serif italic">σ</span>(<i>z</i>):',
    probeTau: 'Naprężenie Styczne <span class="font-serif italic">τ</span>(<i>z</i>):',
    probeTauY: 'Ścinanie Pionowe <span class="font-serif italic">τ</span><sub class="font-sans">z</sub>(<i>z</i>):',
    probeTauZ: 'Maks. Ścinanie Poziome <span class="font-serif italic">τ</span><sub class="font-sans">y,max</sub>:',
    probeP1: 'Naprężenie Główne <span class="font-serif italic font-semibold">σ</span>₁:',
    probeP2: 'Naprężenie Główne <span class="font-serif italic font-semibold">σ</span>₂:',
    probeTheta: 'Kąt Kierunków Głównych <span class="font-serif italic font-semibold">θ</span><sub class="font-sans">p</sub>:',
    heightOfInterest: 'Badana Wysokość (<span class="font-serif italic">z</span>)',
    probeJumpTop: 'Góra',
    probeJumpNA: 'Oś Ob. (z = 0)',
    probeJumpBot: 'Dół',

    // Mohr & Element
    elementTitle: 'Stan Naprężenia',
    elementSubtitle: 'Stan naprężenia na badanej wysokości z',
    elementModeStd: 'Standard',
    elementModePrin: 'Główne',
    mohrTitle: 'Koło Naprężeń Mohra',
    mohrSubtitle: 'Płaski stan naprężenia: naprężenia główne i maksymalne ścinanie',

    // Step-by-Step Derivations
    derivationsTitle: 'Wyprowadzenia Analityczne Krok po Kroku',
    derivStep1: 'Krok 1: Charakterystyki Geometryczne Przekroju',
    derivStep2: 'Krok 2: Rozkład Naprężeń Normalnych <i>σ</i>(<i>y</i>) (Navier)',
    derivStep3: 'Krok 3: Rozkład Naprężeń Stycznych <i>τ</i>(<i>y</i>)',
    derivStep4: 'Krok 4: Naprężenia Główne i Analiza Koła Mohra',

    // Share Modal
    shareModalTitle: 'Udostępnij Model Naprężeń',
    shareModalDesc: 'Każdy posiadający ten link lub kod QR może natychmiast sprawdzić stan naprężeń w przekroju.',
    copyLinkBtn: 'Kopiuj Link',
    downloadQrBtn: 'Pobierz Kod QR (PNG)',
    copiedToast: 'Link skopiowany do schowka!',
    closeModal: 'Zamknij',

    // Check points
    'point.topFiber': 'Włókna Górne',
    'point.topJunctionFlange': 'Styk Górny (Pas)',
    'point.topJunctionWeb': 'Styk Górny (Środnik)',
    'point.junctionFlange': 'Styk Pasa i Środnika (Pas)',
    'point.junctionWeb': 'Styk Pasa i Środnika (Środnik)',
    'point.neutralAxis': 'Oś Obojętna (y = 0)',
    'point.botJunctionWeb': 'Styk Dolny (Środnik)',
    'point.botJunctionFlange': 'Styk Dolny (Pas)',
    'point.botFiber': 'Włókna Dolne'
  }
};
