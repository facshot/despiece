import type { MaterialDef } from '../engine/types';

/**
 * Biblioteca de materiales reutilizable.
 * Valores típicos de referencia a temperatura ambiente (20 °C) tomados de normas y fichas
 * técnicas usuales; cada fabricante puede variar. Sumá materiales nuevos acá y referencialos
 * desde cualquier modelo por su `id`.
 */
export const MATERIALS: Record<string, MaterialDef> = {
  'acero-galv-pintado': {
    id: 'acero-galv-pintado',
    name: 'Acero galvanizado prepintado DX51D+Z',
    family: 'Metal',
    standard: 'EN 10346 / EN 10169 (equiv. JIS G3302 SGCC)',
    description:
      'Chapa de acero de bajo carbono con recubrimiento de zinc por inmersión en caliente y pintura poliéster horneada. Estándar en gabinetes de equipos exteriores por su relación costo/resistencia a la corrosión.',
    props: {
      density: 7850, youngModulus: 210, tensileStrength: [270, 500], elongation: 22,
      thermalConductivity: 50, specificHeat: 460, thermalExpansion: 12,
      meltingPoint: [1450, 1510], maxServiceTemp: 120, electricalResistivity: '1,4 × 10⁻⁷',
    },
    extra: {
      'Recubrimiento de zinc': 'Z100–Z275 g/m² (ambas caras)',
      'Pintura': 'Poliéster 20–25 µm + primer 5 µm',
      'Niebla salina (ISO 9227)': '≥ 500 h',
      'Reciclable': 'Sí — 100 % (chatarra ferrosa)',
    },
    render: { color: 0xe4e6e2, metalness: 0.05, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.4 },
  },
  'acero-galvanizado': {
    id: 'acero-galvanizado',
    name: 'Acero galvanizado DX51D+Z (sin pintar)',
    family: 'Metal',
    standard: 'EN 10346',
    description: 'Chapa galvanizada para piezas estructurales internas: bandejas, soportes y separadores.',
    props: {
      density: 7850, youngModulus: 210, tensileStrength: [270, 500], elongation: 22,
      thermalConductivity: 50, specificHeat: 460, thermalExpansion: 12, meltingPoint: [1450, 1510],
      electricalResistivity: '1,4 × 10⁻⁷',
    },
    extra: { 'Recubrimiento de zinc': 'Z120–Z275 g/m²', 'Reciclable': 'Sí — 100 %' },
    render: { color: 0xaab2b8, metalness: 0.9, roughness: 0.4 },
  },
  'acero-carbono': {
    id: 'acero-carbono',
    name: 'Acero al carbono SPHC (embutido, pintado)',
    family: 'Metal',
    standard: 'JIS G3131 SPHC',
    description:
      'Acero laminado en caliente apto para embutido profundo. Forma el casco hermético del compresor, que debe soportar la presión de descarga del refrigerante.',
    props: {
      density: 7850, youngModulus: 205, tensileStrength: [270, 410], yieldStrength: [205, 250], elongation: 30,
      thermalConductivity: 51, specificHeat: 486, thermalExpansion: 11.7, meltingPoint: [1480, 1520],
      electricalResistivity: '1,6 × 10⁻⁷',
    },
    extra: { 'Espesor casco': '≈ 3,2 mm', 'Acabado': 'Pintura epoxi negra', 'Unión': 'Soldadura por arco / proyección' },
    render: { color: 0x1c1f23, metalness: 0.35, roughness: 0.5, clearcoat: 0.2 },
  },
  'acero-silicio': {
    id: 'acero-silicio',
    name: 'Acero eléctrico al silicio M470-50A',
    family: 'Metal',
    standard: 'EN 10106 (grano no orientado)',
    description:
      'Laminaciones de acero con ≈ 2,5 % de silicio aisladas entre sí. Concentran el flujo magnético en estatores y reactores minimizando las pérdidas por corrientes parásitas.',
    props: {
      density: 7700, youngModulus: 200, tensileStrength: [450, 520], yieldStrength: [305, 340],
      thermalConductivity: 28, specificHeat: 490, thermalExpansion: 12, meltingPoint: [1450, 1500],
      electricalResistivity: '4,2 × 10⁻⁷',
    },
    extra: {
      'Pérdidas magnéticas': '≤ 4,70 W/kg @ 1,5 T – 50 Hz',
      'Polarización J5000': '≈ 1,64 T',
      'Espesor de lámina': '0,50 mm',
      'Aislación': 'Barniz inorgánico EC-5',
    },
    render: { color: 0x5b6168, metalness: 0.85, roughness: 0.38 },
  },
  'cobre-c12200': {
    id: 'cobre-c12200',
    name: 'Cobre desoxidado DHP C12200',
    family: 'Metal',
    standard: 'ASTM B280 / EN 12735-1 (Cu-DHP CW024A)',
    description:
      'Cobre de alta pureza (≥ 99,9 % Cu) desoxidado con fósforo, recocido. Es el material del circuito de refrigerante y de los bobinados por su conductividad térmica y eléctrica, ductilidad para curvar y facilidad para soldar con plata.',
    props: {
      density: 8940, youngModulus: 115, tensileStrength: [220, 250], yieldStrength: [60, 100], elongation: 40,
      hardness: '40–50 HV (recocido)', thermalConductivity: 339, specificHeat: 385, thermalExpansion: 17,
      meltingPoint: 1083, electricalResistivity: '2,03 × 10⁻⁸',
    },
    extra: {
      'Conductividad eléctrica': '≈ 85 % IACS',
      'Soldadura': 'Brazing Ag 5–15 % (≈ 700–800 °C)',
      'Compatibilidad': 'R32, R410A, aceites POE/PVE',
      'Reciclable': 'Sí — sin pérdida de propiedades',
    },
    render: { color: 0xc77b4a, metalness: 1, roughness: 0.28 },
  },
  'aluminio-8011': {
    id: 'aluminio-8011',
    name: 'Aluminio AA8011-H24 hidrofílico',
    family: 'Metal',
    standard: 'EN 573-3 / EN 546 (foil de aletas)',
    description:
      'Foil de aluminio de 0,10 mm con recubrimiento hidrofílico (azulado). Forma las aletas del intercambiador: multiplica la superficie de intercambio y hace que el agua condensada escurra en película en vez de formar gotas.',
    props: {
      density: 2710, youngModulus: 69, tensileStrength: [125, 165], yieldStrength: [110, 140], elongation: 3,
      thermalConductivity: 220, specificHeat: 900, thermalExpansion: 23.6, meltingPoint: [645, 655],
      electricalResistivity: '3,0 × 10⁻⁸',
    },
    extra: {
      'Recubrimiento': 'Hidrofílico + anticorrosivo (ángulo de contacto < 10°)',
      'Espesor': '0,095–0,115 mm',
      'Unión al tubo': 'Expansión mecánica del tubo (sin soldadura)',
    },
    render: { color: 0xa9c6db, metalness: 0.8, roughness: 0.32 },
  },
  'aluminio-6063': {
    id: 'aluminio-6063',
    name: 'Aluminio 6063-T5 extruido',
    family: 'Metal',
    standard: 'EN 755-2 / ASTM B221',
    description: 'Aleación Al-Mg-Si de extrusión. Ideal para disipadores: buena conductividad y perfiles de aletas finas.',
    props: {
      density: 2690, youngModulus: 68.9, tensileStrength: 186, yieldStrength: 145, elongation: 12,
      hardness: '60 HB', thermalConductivity: 209, specificHeat: 900, thermalExpansion: 23.4,
      meltingPoint: [615, 655], electricalResistivity: '3,2 × 10⁻⁸',
    },
    extra: { 'Acabado': 'Natural o anodizado', 'Reciclable': 'Sí — ahorra ≈ 95 % de energía vs. primario' },
    render: { color: 0xc8ccd0, metalness: 0.95, roughness: 0.3 },
  },
  'laton-cw617n': {
    id: 'laton-cw617n',
    name: 'Latón forjado CW617N (CuZn40Pb2)',
    family: 'Metal',
    standard: 'EN 12165',
    description:
      'Latón con plomo apto para estampado en caliente y mecanizado. Se usa en válvulas y conexiones flare por su maquinabilidad y estanqueidad.',
    props: {
      density: 8440, youngModulus: 96, tensileStrength: [360, 440], yieldStrength: [160, 200], elongation: 15,
      hardness: '90–110 HB', thermalConductivity: 113, specificHeat: 377, thermalExpansion: 20.9,
      meltingPoint: [880, 890], electricalResistivity: '6,2 × 10⁻⁸',
    },
    extra: { 'Composición': 'Cu 57–59 %, Pb 1,6–2,5 %, Zn resto', 'Conexión': 'Flare SAE 45°' },
    render: { color: 0xd2a84b, metalness: 1, roughness: 0.3 },
  },
  asa: {
    id: 'asa',
    name: 'ASA (acrilonitrilo-estireno-acrilato)',
    family: 'Polímero',
    standard: 'ISO 19064 · UL94 HB',
    description: 'Termoplástico similar al ABS pero estable a los rayos UV: no se amarillenta ni se vuelve frágil a la intemperie.',
    props: {
      density: 1070, youngModulus: 2.3, tensileStrength: 45, elongation: 25,
      thermalConductivity: 0.17, specificHeat: 1300, thermalExpansion: 90,
      glassTransition: 105, maxServiceTemp: 85, electricalResistivity: '1 × 10¹³',
    },
    extra: { 'Proceso': 'Inyección', 'Temp. Vicat': '95–105 °C', 'Resistencia UV': 'Alta (ISO 4892-2)' },
    render: { color: 0xd6d8d3, metalness: 0, roughness: 0.62 },
  },
  'san-gf20': {
    id: 'san-gf20',
    name: 'SAN + 20 % fibra de vidrio',
    family: 'Compuesto',
    standard: 'ISO 4894',
    description:
      'Estireno-acrilonitrilo reforzado con fibra de vidrio corta. Rígido y estable dimensionalmente: la hélice no se deforma con la fuerza centrífuga ni con el calor del sol.',
    props: {
      density: 1220, youngModulus: 6.8, tensileStrength: [85, 100], elongation: 2,
      thermalConductivity: 0.22, specificHeat: 1200, thermalExpansion: 35,
      glassTransition: 108, maxServiceTemp: 90,
    },
    extra: { 'HDT @1,8 MPa': '≈ 100 °C', 'Proceso': 'Inyección + balanceo' },
    render: { color: 0x30353b, metalness: 0, roughness: 0.52 },
  },
  fr4: {
    id: 'fr4',
    name: 'Laminado FR-4 (epoxi + fibra de vidrio)',
    family: 'Compuesto',
    standard: 'IPC-4101/21 · UL94 V-0',
    description: 'Sustrato de circuito impreso: tejido de vidrio E impregnado en resina epoxi ignífuga, con pistas de cobre.',
    props: {
      density: 1850, youngModulus: 24, tensileStrength: 310, thermalConductivity: 0.3, specificHeat: 1100,
      thermalExpansion: 14, glassTransition: [130, 140], maxServiceTemp: 130,
    },
    extra: {
      'Constante dieléctrica': '4,4–4,7 @ 1 MHz',
      'Rigidez dieléctrica': '≈ 20 kV/mm',
      'CTE eje Z': '≈ 60 µm/(m·K) bajo Tg',
      'Cobre': '35 µm (1 oz)',
    },
    render: { color: 0x1f6b3a, metalness: 0, roughness: 0.45, clearcoat: 0.6 },
  },
  epdm: {
    id: 'epdm',
    name: 'Caucho EPDM',
    family: 'Elastómero',
    standard: 'ASTM D2000 BA/CA',
    description: 'Elastómero etileno-propileno-dieno. Resiste ozono, intemperie y aceite POE; absorbe vibraciones.',
    props: {
      density: 1150, tensileStrength: [7, 15], elongation: [300, 500], hardness: '60 ± 5 Shore A',
      thermalConductivity: 0.25, specificHeat: 2000, thermalExpansion: 160, maxServiceTemp: [-40, 120],
    },
    extra: { 'Deformación remanente': '≤ 25 % (70 h @ 100 °C)' },
    render: { color: 0x141518, metalness: 0, roughness: 0.92 },
  },
  'fieltro-acustico': {
    id: 'fieltro-acustico',
    name: 'Fieltro PET + barrera viscoelástica',
    family: 'Fibra',
    description: 'Manta multicapa: fieltro de poliéster que absorbe y una lámina pesada que bloquea el ruido del compresor.',
    props: { density: 220, thermalConductivity: 0.04, specificHeat: 1300, maxServiceTemp: 110 },
    extra: {
      'Masa superficial': '≈ 3 kg/m²',
      'Espesor': '10–15 mm',
      'Atenuación típica': '3–5 dB(A)',
      'Reacción al fuego': 'UL94 HF-1',
    },
    render: { color: 0x4a463c, metalness: 0, roughness: 1 },
  },
};
