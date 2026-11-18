import * as THREE from 'three';
import type { ModelDef, PartDef } from '../../engine/types';
import { box, cyl, pipe, uBend, fins, hex, group } from '../../engine/geometry';

/**
 * Unidad condensadora (exterior) de un split inverter 3.500 W / 12.000 BTU/h con R32.
 * Gabinete 800 × 550 × 300 mm. Origen en el centro de la base; +Z = frente, Y = arriba.
 * Todas las cotas en metros.
 */

const FAN: [number, number] = [-0.13, 0.285]; // centro del ventilador (x, y)
const TUBE_Y = Array.from({ length: 14 }, (_, i) => 0.075 + i * 0.033);
const ROWS = [
  { zb: -0.135, xs: -0.385 },
  { zb: -0.115, xs: -0.365 },
];

const parts: PartDef[] = [
  // ───────────────────────────── CARCASA ─────────────────────────────
  {
    id: 'tapa-superior',
    name: 'Tapa superior',
    group: 'Carcasa',
    materials: [{ id: 'acero-galv-pintado' }],
    description: 'Cubierta estampada que cierra el gabinete por arriba. Protege de lluvia, granizo y radiación UV.',
    function: 'Estanqueidad y protección mecánica del interior.',
    specs: [
      { label: 'Dimensiones', value: '810 × 310 mm' },
      { label: 'Espesor de chapa', value: '0,6 mm' },
      { label: 'Masa', value: '≈ 1,3 kg' },
      { label: 'Fijación', value: '6 tornillos ST4.2 autorroscantes' },
    ],
    explode: [0, 0.75, 0],
    order: 0,
    build: ({ mat }) => {
      const m = mat('acero-galv-pintado');
      return group(
        box([0.81, 0.012, 0.31], [0, 0.548, 0], m),
        box([0.81, 0.03, 0.004], [0, 0.53, 0.153], m),
        box([0.81, 0.03, 0.004], [0, 0.53, -0.153], m),
      );
    },
  },
  {
    id: 'panel-frontal',
    name: 'Panel frontal',
    group: 'Carcasa',
    materials: [{ id: 'acero-galv-pintado' }],
    description: 'Frente del gabinete con la abertura de descarga de aire del ventilador y la placa de identificación.',
    function: 'Guía el aire caliente hacia afuera y da rigidez estructural al conjunto.',
    specs: [
      { label: 'Dimensiones', value: '800 × 510 mm' },
      { label: 'Abertura de descarga', value: 'Ø 400 mm con anillo de embudo' },
      { label: 'Espesor de chapa', value: '0,6 mm' },
      { label: 'Masa', value: '≈ 1,5 kg' },
    ],
    explode: [0, 0, 0.55],
    order: 1,
    build: ({ mat, paint }) => {
      const m = mat('acero-galv-pintado');
      const s = new THREE.Shape();
      s.moveTo(-0.4, 0.03); s.lineTo(0.4, 0.03); s.lineTo(0.4, 0.54); s.lineTo(-0.4, 0.54); s.closePath();
      const hole = new THREE.Path();
      hole.absarc(FAN[0], FAN[1], 0.2, 0, Math.PI * 2, true);
      s.holes.push(hole);
      const panel = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.006, bevelEnabled: false, curveSegments: 64 }), m);
      panel.position.z = 0.144;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.006, 10, 72), m);
      ring.position.set(FAN[0], FAN[1], 0.15);
      const funnel = cyl(0.2, 0.05, [FAN[0], FAN[1], 0.12], m, 'z', 72, 0.21, true);
      (funnel.material as THREE.Material).side = THREE.DoubleSide;
      return group(panel, ring, funnel, box([0.12, 0.05, 0.002], [0.27, 0.1, 0.151], paint(0x2a2f36, 0.2, 0.4)));
    },
  },
  {
    id: 'rejilla',
    name: 'Rejilla del ventilador',
    group: 'Carcasa',
    materials: [{ id: 'asa' }],
    description: 'Rejilla inyectada de anillos concéntricos y radios que impide el contacto con la hélice en movimiento.',
    function: 'Protección de seguridad (prueba del dedo IEC 60335-2-40) con mínima pérdida de caudal.',
    specs: [
      { label: 'Diámetro', value: 'Ø 420 mm' },
      { label: 'Anillos / radios', value: '5 / 8' },
      { label: 'Área libre', value: '≈ 85 %' },
      { label: 'Masa', value: '≈ 0,35 kg' },
    ],
    explode: [0, 0, 0.85],
    order: 1,
    build: ({ mat }) => {
      const m = mat('asa');
      const g = new THREE.Group();
      for (const r of [0.05, 0.09, 0.13, 0.17, 0.205]) {
        const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0024, 6, 72), m);
        t.position.set(FAN[0], FAN[1], 0.158);
        g.add(t);
      }
      for (let i = 0; i < 4; i++) {
        const b = box([0.41, 0.005, 0.004], [FAN[0], FAN[1], 0.158], m);
        b.rotation.z = (i * Math.PI) / 4;
        g.add(b);
      }
      g.add(cyl(0.035, 0.005, [FAN[0], FAN[1], 0.158], m, 'z'));
      return g;
    },
  },
  {
    id: 'panel-lateral',
    name: 'Panel lateral y trasero derecho',
    group: 'Carcasa',
    materials: [{ id: 'acero-galv-pintado' }],
    description: 'Pieza en "L" que cierra la cámara del compresor. Incluye la manija de transporte y la tapa de servicio de las válvulas.',
    function: 'Cerramiento acústico de la cámara del compresor y acceso a conexiones.',
    specs: [
      { label: 'Desarrollo', value: '300 + 260 × 510 mm' },
      { label: 'Espesor de chapa', value: '0,6 mm' },
      { label: 'Tapa de servicio', value: '140 × 100 mm, 2 tornillos' },
      { label: 'Masa', value: '≈ 1,6 kg' },
    ],
    explode: [0.5, 0, 0],
    order: 1,
    build: ({ mat, paint }) => {
      const m = mat('acero-galv-pintado');
      return group(
        box([0.006, 0.51, 0.3], [0.403, 0.285, 0], m),
        box([0.26, 0.51, 0.006], [0.27, 0.285, -0.147], m),
        box([0.012, 0.025, 0.11], [0.412, 0.45, 0], paint(0x2a2f36, 0.1, 0.6)),
        box([0.004, 0.14, 0.1], [0.408, 0.14, 0.1], mat('acero-galv-pintado', { color: 0xd3d6d1 })),
      );
    },
  },
  {
    id: 'bandeja-base',
    name: 'Bandeja base',
    group: 'Carcasa',
    materials: [{ id: 'acero-galvanizado' }],
    description: 'Chasis inferior donde se atornillan compresor, motor, intercambiador y gabinete. Lleva patas y orificios de drenaje.',
    function: 'Soporte estructural y evacuación del agua de deshielo en modo calor.',
    specs: [
      { label: 'Dimensiones', value: '800 × 300 mm' },
      { label: 'Espesor de chapa', value: '1,0 mm' },
      { label: 'Drenaje', value: 'Ø 25 mm + 2 auxiliares' },
      { label: 'Anclaje', value: '4 agujeros oblongos, M10' },
      { label: 'Masa', value: '≈ 2,8 kg' },
    ],
    explode: [0, -0.3, 0],
    order: 8,
    build: ({ mat, paint }) => {
      const m = mat('acero-galvanizado');
      return group(
        box([0.8, 0.012, 0.3], [0, 0.024, 0], m),
        box([0.8, 0.02, 0.004], [0, 0.04, 0.148], m),
        box([0.8, 0.02, 0.004], [0, 0.04, -0.148], m),
        box([0.07, 0.018, 0.34], [-0.27, 0.009, 0], m),
        box([0.07, 0.018, 0.34], [0.27, 0.009, 0], m),
        cyl(0.012, 0.02, [-0.2, 0.012, 0], paint(0x111214, 0, 0.9)),
      );
    },
  },
  {
    id: 'panel-separador',
    name: 'Panel separador',
    group: 'Carcasa',
    materials: [{ id: 'acero-galvanizado' }],
    description: 'Tabique vertical que divide la cámara de ventilación de la cámara del compresor.',
    function: 'Evita que el aire recircule por el compresor y aísla acústicamente.',
    specs: [
      { label: 'Dimensiones', value: '500 × 270 mm' },
      { label: 'Espesor de chapa', value: '0,6 mm' },
      { label: 'Masa', value: '≈ 0,7 kg' },
    ],
    explode: [0, 0.12, 0.5],
    order: 3,
    build: ({ mat }) => box([0.004, 0.5, 0.27], [0.14, 0.285, 0], mat('acero-galvanizado')),
  },

  // ─────────────────────────── VENTILACIÓN ───────────────────────────
  {
    id: 'helice',
    name: 'Hélice axial',
    group: 'Ventilación',
    materials: [{ id: 'san-gf20' }],
    description: 'Hélice de 3 palas con perfil de ala curvado. Aspira aire a través del condensador y lo expulsa por el frente.',
    function: 'Mover el caudal de aire que retira el calor del refrigerante.',
    specs: [
      { label: 'Diámetro', value: 'Ø 390 mm' },
      { label: 'Palas', value: '3 · ángulo de ataque ≈ 24°' },
      { label: 'Velocidad', value: '450–900 rpm' },
      { label: 'Caudal', value: '≈ 1.900 m³/h' },
      { label: 'Balanceo', value: 'G 6.3 (ISO 21940-11)' },
      { label: 'Masa', value: '≈ 0,35 kg' },
    ],
    explode: [0, 0, 0.42],
    order: 2,
    build: ({ mat }) => {
      const m = mat('san-gf20');
      const root = new THREE.Group();
      const pivot = new THREE.Group();
      pivot.position.set(FAN[0], FAN[1], 0.09);
      root.add(pivot);
      pivot.add(cyl(0.045, 0.07, [0, 0, 0], m, 'z'));
      pivot.add(cyl(0.02, 0.03, [0, 0, 0.05], m, 'z', 32, 0.045));
      const s = new THREE.Shape();
      s.moveTo(0.035, -0.03);
      s.quadraticCurveTo(0.12, -0.095, 0.19, -0.045);
      s.quadraticCurveTo(0.205, 0.03, 0.17, 0.075);
      s.quadraticCurveTo(0.09, 0.065, 0.035, 0.03);
      s.closePath();
      const bladeGeo = new THREE.ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: true, bevelSize: 0.0015, bevelThickness: 0.001, bevelSegments: 2 });
      bladeGeo.translate(0, 0, -0.002);
      for (let i = 0; i < 3; i++) {
        const holder = new THREE.Group();
        const blade = new THREE.Mesh(bladeGeo, m);
        blade.rotation.x = 0.42;
        holder.add(blade);
        holder.rotation.z = (i * Math.PI * 2) / 3;
        pivot.add(holder);
      }
      root.userData.tick = (dt: number, running: boolean) => { if (running) pivot.rotation.z -= dt * 11; };
      return root;
    },
  },
  {
    id: 'motor-ventilador',
    name: 'Motor del ventilador',
    group: 'Ventilación',
    materials: [{ id: 'acero-silicio', role: 'Estator' }, { id: 'cobre-c12200', role: 'Bobinado' }],
    description: 'Motor sin escobillas (BLDC) de rotor exterior controlado por la placa inverter. Encapsulado en resina.',
    function: 'Accionar la hélice con velocidad variable según la carga térmica.',
    specs: [
      { label: 'Tipo', value: 'BLDC 310 V DC, 8 polos' },
      { label: 'Potencia de salida', value: '30 W' },
      { label: 'Velocidad', value: '300–950 rpm' },
      { label: 'Aislación', value: 'Clase E (120 °C)' },
      { label: 'Rodamientos', value: '2 × 608ZZ' },
      { label: 'Eje', value: 'Ø 8 mm acero inoxidable' },
      { label: 'Masa', value: '≈ 1,2 kg' },
    ],
    explode: [0, 0, 0.26],
    order: 3,
    build: ({ mat, paint }) => {
      const shell = paint(0x3b4148, 0.6, 0.45);
      const g = group(
        cyl(0.055, 0.07, [FAN[0], FAN[1], 0.025], shell, 'z', 40),
        cyl(0.056, 0.01, [FAN[0], FAN[1], 0.025], mat('cobre-c12200'), 'z', 40),
        cyl(0.004, 0.05, [FAN[0], FAN[1], 0.075], paint(0xb8bec4, 1, 0.25), 'z'),
        pipe([[FAN[0] + 0.05, FAN[1] - 0.03, 0.01], [0.05, FAN[1] - 0.05, 0.0], [0.13, 0.42, 0.0]], 0.003, paint(0x1a1a1a, 0, 0.7), 0.04),
      );
      return g;
    },
  },
  {
    id: 'soporte-motor',
    name: 'Soporte del motor',
    group: 'Ventilación',
    materials: [{ id: 'acero-galvanizado' }],
    description: 'Dos montantes de chapa plegada atornillados a la base y a la tapa, con placa portamotor.',
    function: 'Mantener el motor centrado en el embudo y absorber el empuje axial de la hélice.',
    specs: [
      { label: 'Espesor de chapa', value: '1,2 mm' },
      { label: 'Fijación del motor', value: '3 bulones M5 + bujes de goma' },
      { label: 'Masa', value: '≈ 0,6 kg' },
    ],
    explode: [0, 0, 0.1],
    order: 4,
    build: ({ mat }) => {
      const m = mat('acero-galvanizado');
      return group(
        box([0.03, 0.5, 0.004], [FAN[0] - 0.075, 0.285, -0.012], m),
        box([0.03, 0.5, 0.004], [FAN[0] + 0.075, 0.285, -0.012], m),
        box([0.18, 0.09, 0.004], [FAN[0], FAN[1], -0.012], m),
      );
    },
  },

  // ─────────────────────── CIRCUITO REFRIGERANTE ───────────────────────
  {
    id: 'aletas-condensador',
    name: 'Aletas del condensador',
    group: 'Circuito refrigerante',
    materials: [{ id: 'aluminio-8011', role: 'Aletas' }, { id: 'acero-galvanizado', role: 'Placas extremas' }],
    description: 'Paquete de aletas tipo persiana en forma de "L" (cara trasera + lateral izquierda) atravesado por los tubos de cobre.',
    function: 'Ampliar la superficie de intercambio: el refrigerante cede calor al aire que las atraviesa.',
    specs: [
      { label: 'Configuración', value: 'L, 2 filas, 14 tubos/fila' },
      { label: 'Paso de aleta', value: '1,4 mm (18 FPI)' },
      { label: 'Espesor de aleta', value: '0,10 mm' },
      { label: 'Área frontal', value: '≈ 0,33 m²' },
      { label: 'Superficie de intercambio', value: '≈ 13 m²' },
      { label: 'Masa', value: '≈ 2,5 kg' },
    ],
    explode: [-0.45, 0, -0.55],
    order: 7,
    build: ({ mat }) => {
      const al = mat('aluminio-8011');
      const st = mat('acero-galvanizado');
      return group(
        fins(76, [0.0007, 0.48, 0.042], [-0.352, 0.29, -0.125], [0.006, 0, 0], al),
        fins(34, [0.042, 0.48, 0.0007], [-0.375, 0.29, -0.102], [0, 0, 0.006], al),
        box([0.004, 0.5, 0.05], [0.105, 0.29, -0.125], st),
        box([0.05, 0.5, 0.004], [-0.375, 0.29, 0.105], st),
      );
    },
  },
  {
    id: 'tubos-condensador',
    name: 'Tubos del condensador',
    group: 'Circuito refrigerante',
    materials: [{ id: 'cobre-c12200' }],
    description: 'Serpentín de tubo de cobre ranurado interiormente, expandido dentro de las aletas y unido con curvas en "U" soldadas.',
    function: 'Conducir el R32 a alta presión mientras condensa de gas a líquido.',
    specs: [
      { label: 'Tubo', value: 'Ø 7,0 × 0,25 mm, ranurado interno' },
      { label: 'Longitud total', value: '≈ 20 m' },
      { label: 'Circuitos', value: '2 en paralelo' },
      { label: 'Presión máx. de trabajo', value: '4,15 MPa (R32)' },
      { label: 'Prueba de estanqueidad', value: 'Helio, < 3 g/año' },
      { label: 'Masa', value: '≈ 1,1 kg' },
    ],
    explode: [-0.8, 0.05, -0.9],
    order: 7,
    build: ({ mat }) => {
      const cu = mat('cobre-c12200');
      const g = new THREE.Group();
      for (const { zb, xs } of ROWS) {
        TUBE_Y.forEach((y) => g.add(pipe([[0.115, y, zb], [xs, y, zb], [xs, y, 0.115]], 0.0035, cu, 0.035, 8)));
        for (let i = 0; i < TUBE_Y.length - 1; i += 2) g.add(uBend([0.115, (TUBE_Y[i] + TUBE_Y[i + 1]) / 2, zb], 0.0165, 0.0035, '+x', cu));
        for (let i = 1; i < TUBE_Y.length - 1; i += 2) g.add(uBend([xs, (TUBE_Y[i] + TUBE_Y[i + 1]) / 2, 0.115], 0.0165, 0.0035, '+z', cu));
      }
      return g;
    },
  },
  {
    id: 'compresor',
    name: 'Compresor rotativo inverter',
    group: 'Circuito refrigerante',
    materials: [{ id: 'acero-carbono', role: 'Casco hermético' }, { id: 'acero-silicio', role: 'Estator del motor' }, { id: 'cobre-c12200', role: 'Bobinado' }],
    description: 'Compresor hermético de pistón rodante con motor BLDC interno. Es el corazón del equipo: eleva presión y temperatura del refrigerante.',
    function: 'Comprimir el R32 gaseoso de ≈ 1 MPa a ≈ 3 MPa para que pueda condensar a temperatura ambiente.',
    specs: [
      { label: 'Tipo', value: 'Rotativo, 1 cilindro, BLDC' },
      { label: 'Desplazamiento', value: '10,2 cm³/rev' },
      { label: 'Rango de velocidad', value: '15–120 rps' },
      { label: 'Potencia nominal', value: '≈ 1,0 kW' },
      { label: 'COP (ASHRAE)', value: '≈ 3,4 W/W' },
      { label: 'Aceite', value: 'PVE/POE, 350 ml' },
      { label: 'Presión de diseño', value: '4,15 MPa' },
      { label: 'Masa', value: '≈ 9,5 kg' },
    ],
    explode: [0.32, 0.18, -0.05],
    order: 6,
    build: ({ mat, paint }) => {
      const shell = mat('acero-carbono');
      const cx = 0.27, cz = -0.02;
      const dome = (y: number) => {
        const d = new THREE.Mesh(new THREE.SphereGeometry(0.065, 40, 16), shell);
        d.scale.y = 0.35;
        d.position.set(cx, y, cz);
        return d;
      };
      const g = group(
        cyl(0.065, 0.2, [cx, 0.17, cz], shell, 'y', 48),
        dome(0.27), dome(0.07),
        box([0.05, 0.035, 0.03], [cx, 0.24, cz + 0.072], paint(0x202326, 0, 0.7)),
        cyl(0.0048, 0.03, [cx, 0.3, cz], mat('cobre-c12200')),
      );
      for (const a of [Math.PI / 6, (5 * Math.PI) / 6, (3 * Math.PI) / 2]) {
        const tab = box([0.06, 0.004, 0.03], [cx + Math.cos(a) * 0.075, 0.06, cz + Math.sin(a) * 0.075], shell);
        tab.rotation.y = -a;
        g.add(tab);
      }
      return g;
    },
  },
  {
    id: 'manta-acustica',
    name: 'Manta acústica del compresor',
    group: 'Circuito refrigerante',
    materials: [{ id: 'fieltro-acustico' }],
    description: 'Funda multicapa con cierre de velcro que envuelve el compresor.',
    function: 'Reducir el ruido de compresión transmitido al exterior.',
    specs: [
      { label: 'Espesor', value: '12 mm' },
      { label: 'Atenuación', value: '3–5 dB(A)' },
      { label: 'Masa', value: '≈ 0,6 kg' },
    ],
    explode: [0, 0.62, 0],
    order: 4,
    build: ({ mat }) => {
      const m = mat('fieltro-acustico');
      m.side = THREE.DoubleSide;
      return group(cyl(0.078, 0.22, [0.27, 0.17, -0.02], m, 'y', 48, 0.078, true), cyl(0.078, 0.012, [0.27, 0.286, -0.02], m, 'y', 48));
    },
  },
  {
    id: 'amortiguadores',
    name: 'Amortiguadores antivibratorios',
    group: 'Circuito refrigerante',
    materials: [{ id: 'epdm' }],
    description: 'Tres bujes de caucho entre las patas del compresor y la bandeja base.',
    function: 'Aislar las vibraciones del compresor para que no se transmitan al gabinete ni a la pared.',
    specs: [
      { label: 'Cantidad', value: '3' },
      { label: 'Dureza', value: '60 Shore A' },
      { label: 'Carga por buje', value: '≈ 35 N' },
      { label: 'Masa', value: '≈ 0,03 kg c/u' },
    ],
    explode: [0.32, 0.02, -0.05],
    order: 7,
    build: ({ mat }) => {
      const m = mat('epdm');
      const g = new THREE.Group();
      for (const a of [Math.PI / 6, (5 * Math.PI) / 6, (3 * Math.PI) / 2]) {
        g.add(cyl(0.012, 0.024, [0.27 + Math.cos(a) * 0.085, 0.045, -0.02 + Math.sin(a) * 0.085], m, 'y', 20));
      }
      return g;
    },
  },
  {
    id: 'acumulador',
    name: 'Acumulador de succión',
    group: 'Circuito refrigerante',
    materials: [{ id: 'acero-carbono' }, { id: 'cobre-c12200', role: 'Tubos' }],
    description: 'Recipiente a presión en la entrada del compresor con tubo en "J" y orificio de retorno de aceite.',
    function: 'Retener el refrigerante líquido para que sólo ingrese gas al compresor (evita el golpe de líquido).',
    specs: [
      { label: 'Volumen', value: '0,6 L' },
      { label: 'Diámetro', value: 'Ø 56 mm' },
      { label: 'Presión de diseño', value: '2,5 MPa (lado de baja)' },
      { label: 'Masa', value: '≈ 0,5 kg' },
    ],
    explode: [0.55, 0.2, 0.15],
    order: 6,
    build: ({ mat }) => {
      const sh = mat('acero-carbono');
      const cu = mat('cobre-c12200');
      const cx = 0.355, cz = 0.07;
      const dome = (y: number) => {
        const d = new THREE.Mesh(new THREE.SphereGeometry(0.028, 24, 12), sh);
        d.scale.y = 0.4;
        d.position.set(cx, y, cz);
        return d;
      };
      return group(
        cyl(0.028, 0.15, [cx, 0.18, cz], sh, 'y', 32), dome(0.255), dome(0.105),
        pipe([[cx, 0.1, cz], [cx, 0.085, cz], [0.31, 0.085, 0.01]], 0.0048, cu, 0.015),
        pipe([[cx, 0.26, cz], [cx, 0.33, cz], [0.25, 0.33, 0.03], [0.25, 0.375, 0.03]], 0.0048, cu, 0.03),
      );
    },
  },
  {
    id: 'valvula-4-vias',
    name: 'Válvula inversora de 4 vías',
    group: 'Circuito refrigerante',
    materials: [{ id: 'cobre-c12200', role: 'Cuerpo y conexiones' }, { id: 'laton-cw617n', role: 'Válvula piloto' }],
    description: 'Válvula de corredera accionada por una válvula piloto con solenoide.',
    function: 'Invertir el sentido del refrigerante para pasar de modo frío a modo calor (bomba de calor).',
    specs: [
      { label: 'Accionamiento', value: 'Piloto + solenoide 220–240 V AC' },
      { label: 'Consumo de la bobina', value: '≈ 4,5 W' },
      { label: 'ΔP mínima de conmutación', value: '0,15 MPa' },
      { label: 'Capacidad', value: 'Hasta 5 kW' },
      { label: 'Masa', value: '≈ 0,45 kg' },
    ],
    explode: [0, 0.45, -0.25],
    order: 5,
    build: ({ mat, paint }) => {
      const cu = mat('cobre-c12200');
      const g = group(
        cyl(0.014, 0.09, [0.25, 0.4, 0.03], cu, 'x', 32),
        cyl(0.0042, 0.07, [0.25, 0.42, 0.052], mat('laton-cw617n'), 'x', 16),
        box([0.03, 0.035, 0.026], [0.31, 0.42, 0.052], paint(0x18191b, 0, 0.6)),
        cyl(0.0048, 0.03, [0.25, 0.425, 0.03], cu),
      );
      for (const x of [0.225, 0.25, 0.275]) g.add(cyl(0.0048, 0.03, [x, 0.375, 0.03], cu));
      return g;
    },
  },
  {
    id: 'tuberias',
    name: 'Tuberías de interconexión',
    group: 'Circuito refrigerante',
    materials: [{ id: 'cobre-c12200' }],
    description: 'Caños curvados que unen compresor, válvula de 4 vías, condensador y válvula de servicio de gas.',
    function: 'Línea de descarga (gas caliente ≈ 80–110 °C) y línea de gas hacia la unidad interior.',
    specs: [
      { label: 'Descarga', value: '3/8" (9,52 × 0,8 mm)' },
      { label: 'Temp. de descarga', value: 'Hasta 110 °C' },
      { label: 'Uniones', value: 'Soldadura fuerte con varilla Ag 5 %' },
      { label: 'Masa', value: '≈ 0,4 kg' },
    ],
    explode: [0.05, 0.3, -0.2],
    order: 5,
    build: ({ mat }) => {
      const cu = mat('cobre-c12200');
      return group(
        pipe([[0.27, 0.315, -0.02], [0.27, 0.34, -0.02], [0.19, 0.34, -0.06], [0.19, 0.46, -0.06], [0.25, 0.46, 0.03], [0.25, 0.44, 0.03]], 0.0048, cu, 0.03),
        pipe([[0.225, 0.36, 0.03], [0.225, 0.33, 0.03], [0.16, 0.33, -0.12], [0.11, 0.33, -0.125]], 0.0048, cu, 0.03),
        pipe([[0.275, 0.36, 0.03], [0.275, 0.33, 0.03], [0.392, 0.33, 0.03], [0.392, 0.16, 0.03], [0.392, 0.16, 0.112]], 0.0048, cu, 0.025),
      );
    },
  },
  {
    id: 'valvula-expansion',
    name: 'Válvula de expansión electrónica',
    group: 'Circuito refrigerante',
    materials: [{ id: 'laton-cw617n', role: 'Cuerpo' }, { id: 'cobre-c12200', role: 'Conexiones' }],
    description: 'Válvula de aguja movida por un motor paso a paso; la placa ajusta su apertura en tiempo real.',
    function: 'Expandir el refrigerante (baja su presión y temperatura) dosificando el caudal exacto.',
    specs: [
      { label: 'Accionamiento', value: 'Paso a paso 12 V DC' },
      { label: 'Resolución', value: '0–480 pulsos' },
      { label: 'Orificio', value: 'Ø 1,65 mm' },
      { label: 'Línea de líquido', value: '1/4" (6,35 × 0,6 mm)' },
      { label: 'Masa', value: '≈ 0,15 kg' },
    ],
    explode: [-0.05, 0.35, -0.4],
    order: 5,
    build: ({ mat, paint }) => {
      const cu = mat('cobre-c12200');
      return group(
        cyl(0.011, 0.04, [0.165, 0.2, -0.11], mat('laton-cw617n'), 'y', 24),
        cyl(0.016, 0.035, [0.165, 0.24, -0.11], paint(0x18191b, 0, 0.6), 'y', 24),
        pipe([[0.165, 0.18, -0.11], [0.165, 0.1, -0.13], [0.392, 0.1, -0.13], [0.392, 0.1, 0.112]], 0.0032, cu, 0.025),
        pipe([[0.154, 0.205, -0.11], [0.11, 0.205, -0.125]], 0.0032, cu),
      );
    },
  },
  {
    id: 'valvulas-servicio',
    name: 'Válvulas de servicio',
    group: 'Circuito refrigerante',
    materials: [{ id: 'laton-cw617n' }],
    description: 'Dos llaves de paso forjadas (líquido y gas) donde se conectan los caños hacia la unidad interior.',
    function: 'Aislar la carga de refrigerante durante la instalación y permitir vacío y carga por el puerto Schrader.',
    specs: [
      { label: 'Línea de líquido', value: '1/4" flare SAE 45°' },
      { label: 'Línea de gas', value: '3/8" flare SAE 45°' },
      { label: 'Puerto de servicio', value: 'Schrader 5/16" (R32)' },
      { label: 'Torque tuerca 3/8"', value: '33–42 N·m' },
      { label: 'Masa', value: '≈ 0,2 kg c/u' },
    ],
    explode: [0.42, 0, 0.1],
    order: 5,
    build: ({ mat }) => {
      const b = mat('laton-cw617n');
      const g = new THREE.Group();
      for (const y of [0.1, 0.16]) {
        g.add(box([0.03, 0.03, 0.028], [0.39, y, 0.125], b));
        g.add(hex(0.011, 0.016, [0.414, y, 0.125], b));
        g.add(cyl(0.008, 0.012, [0.428, y, 0.125], b, 'x', 20));
      }
      g.add(cyl(0.005, 0.02, [0.39, 0.185, 0.125], b, 'y', 16));
      return g;
    },
  },

  // ─────────────────────── ELÉCTRICO Y CONTROL ───────────────────────
  {
    id: 'placa-control',
    name: 'Placa de control inverter',
    group: 'Eléctrico y control',
    materials: [{ id: 'fr4', role: 'Sustrato' }, { id: 'cobre-c12200', role: 'Pistas' }],
    description: 'Circuito impreso con microcontrolador, módulo de potencia IPM, corrección de factor de potencia y filtros EMI.',
    function: 'Convertir 220 V AC en una frecuencia variable para el compresor y el motor, y gestionar sensores y protecciones.',
    specs: [
      { label: 'Alimentación', value: '220–240 V · 50 Hz' },
      { label: 'Dimensiones', value: '170 × 130 mm' },
      { label: 'Laminado', value: '2 capas, 1,6 mm, Cu 1 oz' },
      { label: 'Bus DC', value: '≈ 310 V' },
      { label: 'Comunicación', value: 'Serie con unidad interior' },
      { label: 'Masa', value: '≈ 0,4 kg' },
    ],
    explode: [0, 0.5, 0.35],
    order: 2,
    build: ({ mat, paint }) => {
      const al = mat('aluminio-6063');
      const g = group(
        box([0.17, 0.002, 0.13], [0.27, 0.495, 0.07], mat('fr4')),
        cyl(0.011, 0.03, [0.215, 0.511, 0.035], al, 'y', 20),
        cyl(0.011, 0.03, [0.242, 0.511, 0.035], al, 'y', 20),
        box([0.022, 0.017, 0.016], [0.3, 0.505, 0.03], paint(0x1d4fa8, 0, 0.5)),
        box([0.065, 0.016, 0.016], [0.29, 0.504, 0.122], paint(0x9aa0a6, 0, 0.6)),
        box([0.018, 0.003, 0.018], [0.25, 0.4975, 0.09], paint(0x111111, 0, 0.4)),
        box([0.03, 0.025, 0.025], [0.33, 0.508, 0.06], paint(0x22262a, 0.2, 0.5)),
      );
      const toroid = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.006, 10, 24), mat('cobre-c12200'));
      toroid.rotation.x = Math.PI / 2;
      toroid.position.set(0.215, 0.502, 0.1);
      g.add(toroid);
      return g;
    },
  },
  {
    id: 'disipador',
    name: 'Disipador del IPM',
    group: 'Eléctrico y control',
    materials: [{ id: 'aluminio-6063' }],
    description: 'Perfil extruido de aletas en contacto con el módulo de potencia mediante pasta térmica.',
    function: 'Evacuar ≈ 40–60 W de pérdidas de conmutación de los transistores IGBT/MOSFET.',
    specs: [
      { label: 'Resistencia térmica', value: '≈ 0,8 K/W (con flujo de aire)' },
      { label: 'Aletas', value: '10' },
      { label: 'Interfaz', value: 'Pasta de silicona 3 W/(m·K)' },
      { label: 'Masa', value: '≈ 0,25 kg' },
    ],
    explode: [0, 0.3, 0.45],
    order: 2,
    build: ({ mat }) => {
      const m = mat('aluminio-6063');
      return group(box([0.08, 0.004, 0.06], [0.3, 0.491, 0.08], m), fins(10, [0.0022, 0.035, 0.06], [0.264, 0.471, 0.08], [0.008, 0, 0], m));
    },
  },
  {
    id: 'reactor-pfc',
    name: 'Reactor PFC',
    group: 'Eléctrico y control',
    materials: [{ id: 'acero-silicio', role: 'Núcleo' }, { id: 'cobre-c12200', role: 'Bobinado' }],
    description: 'Inductor de núcleo laminado del circuito de corrección de factor de potencia.',
    function: 'Suavizar la corriente tomada de la red y reducir armónicos (cumplir IEC 61000-3-2).',
    specs: [
      { label: 'Inductancia', value: '≈ 5 mH' },
      { label: 'Corriente nominal', value: '12 A' },
      { label: 'Clase de aislación', value: 'H (180 °C)' },
      { label: 'Masa', value: '≈ 1,2 kg' },
    ],
    explode: [0.12, 0.1, 0.45],
    order: 3,
    build: ({ mat }) => {
      const cu = mat('cobre-c12200');
      return group(
        box([0.06, 0.05, 0.03], [0.18, 0.12, 0.1], mat('acero-silicio')),
        cyl(0.017, 0.042, [0.165, 0.12, 0.1], cu, 'z', 24),
        cyl(0.017, 0.042, [0.195, 0.12, 0.1], cu, 'z', 24),
        box([0.08, 0.004, 0.04], [0.18, 0.093, 0.1], mat('acero-galvanizado')),
      );
    },
  },
];

export const airConditioner: ModelDef = {
  id: 'split-exterior-3500w',
  name: 'Unidad exterior split inverter',
  subtitle: '3.500 W · 12.000 BTU/h · R32 · bomba de calor',
  summary: [
    { label: 'Capacidad frío', value: '3.500 W' },
    { label: 'Refrigerante', value: 'R32 · 0,55 kg' },
    { label: 'Gabinete', value: '800 × 550 × 300 mm' },
    { label: 'Masa total', value: '≈ 28 kg' },
    { label: 'Ruido', value: '50 dB(A)' },
  ],
  groups: ['Carcasa', 'Ventilación', 'Circuito refrigerante', 'Eléctrico y control'],
  camera: { position: [1.25, 0.85, 1.35], target: [0, 0.28, 0] },
  floorY: -0.34,
  parts,
};
