import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { BuildContext, MaterialDef, ModelDef, PartDef, RenderProps } from './types';

export type ViewMode = 'solid' | 'xray' | 'blueprint';

export interface PartRuntime {
  def: PartDef;
  index: number;
  object: THREE.Object3D;
  base: THREE.Vector3;
  offset: THREE.Vector3;
  /** Centro de la pieza en coordenadas locales del objeto. */
  center: THREE.Vector3;
  meshes: THREE.Mesh[];
  label: CSS2DObject;
  start: number;
}

type Events = {
  select: (p: PartRuntime | null) => void;
  hover: (p: PartRuntime | null) => void;
  explode: (t: number) => void;
};

const STAGGER_WINDOW = 0.38; // fracción del recorrido que dura el movimiento de cada pieza
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * Motor genérico de vista explosionada. No sabe nada de aires acondicionados:
 * recibe un ModelDef y una biblioteca de materiales.
 */
export class Viewer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly parts: PartRuntime[] = [];
  private baseBoxes: THREE.Box3[] = [];
  private labels: CSS2DRenderer;
  private root = new THREE.Group();
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private clock = new THREE.Clock();
  private listeners: { [K in keyof Events]: Events[K][] } = { select: [], hover: [], explode: [] };

  // Explosión: el valor real sigue al objetivo con un resorte críticamente amortiguado.
  explode = 0;
  private explodeVel = 0;
  private explodeTarget = 0;
  private ramp: { from: number; to: number; dur: number; t: number } | null = null;
  private maxOrder = 0;

  mode: ViewMode = 'solid';
  selected: PartRuntime | null = null;
  hovered: PartRuntime | null = null;
  isolated = false;
  running = true;
  labelsOn = true;
  private camTween: { p0: THREE.Vector3; p1: THREE.Vector3; t0: THREE.Vector3; t1: THREE.Vector3; t: number } | null = null;

  private ghostMat = new THREE.MeshBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: 0.07, depthWrite: false });
  private wireMat = new THREE.MeshBasicMaterial({ color: 0x4fd1ff, wireframe: true, transparent: true, opacity: 0.22, depthWrite: false });

  constructor(private container: HTMLElement, readonly model: ModelDef, readonly materials: Record<string, MaterialDef>) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.labels = new CSS2DRenderer();
    this.labels.domElement.className = 'label-layer';
    container.appendChild(this.labels.domElement);

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.01, 50);
    this.camera.position.set(...model.camera.position);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(...model.camera.target);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 0.3;
    this.controls.maxDistance = 6;
    this.controls.autoRotateSpeed = 0.8;

    this.setupScene();
    this.scene.add(this.root);
    this.bindPointer();
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
  }

  on<K extends keyof Events>(ev: K, fn: Events[K]) { this.listeners[ev].push(fn); }
  private emit<K extends keyof Events>(ev: K, ...args: Parameters<Events[K]>) {
    (this.listeners[ev] as ((...a: Parameters<Events[K]>) => void)[]).forEach((fn) => fn(...args));
  }

  private setupScene() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(1.5, 3, 1.8);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const s = key.shadow.camera as THREE.OrthographicCamera;
    s.left = -1.6; s.right = 1.6; s.top = 1.6; s.bottom = -1.6; s.near = 0.5; s.far = 8;
    key.shadow.bias = -0.0004;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x6fc8ff, 0.8);
    rim.position.set(-2, 1.2, -2);
    this.scene.add(rim, new THREE.HemisphereLight(0xbfdfff, 0x0b1016, 0.35));

    const y = this.model.floorY;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(4, 64), new THREE.ShadowMaterial({ opacity: 0.35 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = y;
    floor.receiveShadow = true;
    const grid = new THREE.GridHelper(6, 60, 0x1f4b63, 0x10242f);
    grid.position.y = y + 0.001;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.55;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.98, 1.0, 128), new THREE.MeshBasicMaterial({ color: 0x4fd1ff, transparent: true, opacity: 0.25 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = y + 0.002;
    this.scene.add(floor, grid, ring);
  }

  /** Crea las piezas (procedurales o desde .glb). */
  async load() {
    const ctx: BuildContext = {
      mat: (id, override) => this.makeMaterial(id, override),
      paint: (color, metalness = 0, roughness = 0.6) =>
        new THREE.MeshPhysicalMaterial({ color, metalness, roughness }),
    };

    let gltfScene: THREE.Object3D | null = null;
    if (this.model.gltf) gltfScene = (await new GLTFLoader().loadAsync(this.model.gltf)).scene;
    gltfScene?.updateMatrixWorld(true);

    this.maxOrder = Math.max(...this.model.parts.map((p) => p.order));
    this.model.parts.forEach((def, index) => {
      let object: THREE.Object3D | undefined;
      if (def.node && gltfScene) {
        const node = gltfScene.getObjectByName(def.node);
        if (node) { this.root.attach(node); object = node; }
        else console.warn(`[viewer] nodo "${def.node}" no encontrado en ${this.model.gltf}`);
      } else if (def.build) {
        object = def.build(ctx);
        this.root.add(object);
      }
      if (!object) return;

      const meshes: THREE.Mesh[] = [];
      object.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.castShadow = true;
        m.receiveShadow = true;
        m.userData.partIndex = this.parts.length;
        m.userData.solid = m.material;
        meshes.push(m);
      });
      // Asegurar que cada pieza tenga materiales propios (para resaltar sin afectar a otras).
      meshes.forEach((m) => {
        if (Array.isArray(m.material)) return;
        m.material = (m.material as THREE.Material).clone();
        m.userData.solid = m.material;
      });

      object.updateMatrixWorld(true);
      const baseBox = new THREE.Box3().setFromObject(object);
      this.baseBoxes.push(baseBox);
      const center = baseBox.getCenter(new THREE.Vector3());
      object.worldToLocal(center);

      const el = document.createElement('button');
      el.className = 'tag';
      el.textContent = String(this.parts.length + 1).padStart(2, '0');
      el.title = def.name;
      const label = new CSS2DObject(el);
      label.position.copy(center);
      object.add(label);

      const rt: PartRuntime = {
        def, index: this.parts.length, object, meshes, label, center,
        base: object.position.clone(),
        offset: new THREE.Vector3(...def.explode),
        start: (def.order / (this.maxOrder || 1)) * (1 - STAGGER_WINDOW),
      };
      el.addEventListener('click', (e) => { e.stopPropagation(); this.select(rt); });
      el.addEventListener('pointerenter', () => this.setHover(rt));
      el.addEventListener('pointerleave', () => this.setHover(null));
      this.parts.push(rt);
    });
    this.applyMode();
    // En pantallas angostas (celular vertical) encuadrar el modelo completo desde el inicio.
    if (this.camera.aspect < 1.1) { this.fit(0); this.camTween!.t = 1; this.camera.position.copy(this.camTween!.p1); this.controls.target.copy(this.camTween!.t1); this.camTween = null; }
    this.renderer.setAnimationLoop(() => this.frame());
  }

  private makeMaterial(id: string, override?: Partial<RenderProps>) {
    const def = this.materials[id];
    if (!def) throw new Error(`Material "${id}" no existe en la biblioteca`);
    const r = { ...def.render, ...override };
    return new THREE.MeshPhysicalMaterial({
      color: r.color, metalness: r.metalness, roughness: r.roughness,
      clearcoat: r.clearcoat ?? 0, clearcoatRoughness: r.clearcoatRoughness ?? 0.3,
      transparent: r.opacity !== undefined && r.opacity < 1, opacity: r.opacity ?? 1,
    });
  }

  // ───────────── Explosión ─────────────
  /** Progreso [0..1] de cada pieza según su orden de desarme. */
  partProgress(p: PartRuntime, t = this.explode) {
    return ease(clamp01((t - p.start) / STAGGER_WINDOW));
  }
  setExplode(t: number, animate = true) {
    this.ramp = null;
    this.explodeTarget = clamp01(t);
    if (!animate) { this.explode = this.explodeTarget; this.explodeVel = 0; }
  }
  /** Animación lineal del objetivo: desarme secuencial pieza por pieza. */
  playExplode(to: number, seconds = 4) {
    this.ramp = { from: this.explodeTarget, to: clamp01(to), dur: seconds * Math.abs(to - this.explodeTarget), t: 0 };
    if (!this.isolated) this.fit(to);
  }
  get stepCount() { return this.maxOrder + 1; }
  /** Etapa actual de desarme (0 = armado). */
  get currentStep() {
    for (let s = this.stepCount; s > 0; s--) if (this.explodeTarget >= this.stepTarget(s) - 1e-3) return s;
    return 0;
  }
  stepTarget(step: number) {
    if (step <= 0) return 0;
    const order = step - 1;
    return Math.min(1, (order / (this.maxOrder || 1)) * (1 - STAGGER_WINDOW) + STAGGER_WINDOW);
  }
  step(dir: 1 | -1) {
    const next = Math.max(0, Math.min(this.stepCount, this.currentStep + dir));
    this.playExplode(this.stepTarget(next), 2.5);
  }

  // ───────────── Selección / modos ─────────────
  select(p: PartRuntime | null) {
    if (this.selected === p) return;
    this.selected = p;
    if (!p && this.isolated) this.isolated = false;
    this.applyMode();
    this.emit('select', p);
  }
  private setHover(p: PartRuntime | null) {
    if (this.hovered === p) return;
    this.hovered = p;
    this.renderer.domElement.style.cursor = p ? 'pointer' : 'grab';
    this.applyMode();
    this.emit('hover', p);
  }
  setMode(mode: ViewMode) { this.mode = mode; this.applyMode(); }
  setIsolate(on: boolean) { this.isolated = on && !!this.selected; this.applyMode(); }

  private applyMode() {
    for (const p of this.parts) {
      const isSel = p === this.selected;
      const isHov = p === this.hovered;
      p.object.visible = !this.isolated || isSel;
      for (const m of p.meshes) {
        const solid = m.userData.solid as THREE.MeshPhysicalMaterial;
        let mat: THREE.Material = solid;
        if (!isSel && !isHov) {
          if (this.mode === 'blueprint') mat = this.wireMat;
          else if (this.mode === 'xray') mat = this.ghostMat;
        }
        m.material = mat;
        m.castShadow = mat === solid;
        if (solid.emissive) {
          solid.emissive.setHex(isSel ? 0x2fb8ff : isHov ? 0x4fd1ff : 0x000000);
          solid.emissiveIntensity = isSel ? 0.22 : isHov ? 0.14 : 0;
        }
      }
      (p.label.element as HTMLElement).classList.toggle('active', isSel);
    }
    this.ghostMat.opacity = this.selected ? 0.06 : 0.14;
  }

  /** Caja que ocupan las piezas visibles para un nivel de explosión dado (sin moverlas). */
  boundsAt(t: number) {
    const box = new THREE.Box3();
    this.parts.forEach((p, i) => {
      if (!p.object.visible) return;
      box.union(this.baseBoxes[i].clone().translate(p.offset.clone().multiplyScalar(this.partProgress(p, t))));
    });
    return box;
  }
  /** Encuadra todo el conjunto tal como quedará en el nivel de explosión `t`. */
  fit(t = this.explodeTarget) { this.tweenTo(this.boundsAt(t).getBoundingSphere(new THREE.Sphere()), 0.95); }

  focus(p: PartRuntime | null = this.selected) {
    if (!p) return this.fit();
    this.tweenTo(new THREE.Box3().setFromObject(p.object).getBoundingSphere(new THREE.Sphere()), 1.3);
  }
  private tweenTo(sphere: THREE.Sphere, margin: number, dir = this.camera.position.clone().sub(this.controls.target).normalize()) {
    const vHalf = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const half = Math.min(vHalf, Math.atan(Math.tan(vHalf) * this.camera.aspect));
    const dist = Math.max(0.35, (sphere.radius / Math.sin(half)) * margin);
    this.camTween = {
      p0: this.camera.position.clone(), p1: sphere.center.clone().addScaledVector(dir, dist),
      t0: this.controls.target.clone(), t1: sphere.center.clone(), t: 0,
    };
  }
  /** Vuelve al ángulo inicial; si está desarmado, encuadra todo el conjunto separado. */
  resetCamera() {
    if (this.explodeTarget > 0.05) {
      const dir = new THREE.Vector3(...this.model.camera.position).sub(new THREE.Vector3(...this.model.camera.target)).normalize();
      return this.tweenTo(this.boundsAt(this.explodeTarget).getBoundingSphere(new THREE.Sphere()), 0.95, dir);
    }
    this.camTween = {
      p0: this.camera.position.clone(), p1: new THREE.Vector3(...this.model.camera.position),
      t0: this.controls.target.clone(), t1: new THREE.Vector3(...this.model.camera.target), t: 0,
    };
  }

  // ───────────── Interacción ─────────────
  private bindPointer() {
    const el = this.renderer.domElement;
    let down: { x: number; y: number } | null = null;
    el.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
    el.addEventListener('pointermove', (e) => this.setHover(this.pick(e)));
    el.addEventListener('pointerleave', () => this.setHover(null));
    el.addEventListener('pointerup', (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved < 5) this.select(this.pick(e));
    });
  }
  private pick(e: PointerEvent): PartRuntime | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const targets = this.parts.filter((p) => p.object.visible).flatMap((p) => p.meshes);
    const hit = this.raycaster.intersectObjects(targets, false)[0];
    return hit ? this.parts[hit.object.userData.partIndex] ?? null : null;
  }

  private resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.ramp) {
      this.ramp.t += dt;
      const k = this.ramp.dur > 0 ? clamp01(this.ramp.t / this.ramp.dur) : 1;
      this.explodeTarget = this.ramp.from + (this.ramp.to - this.ramp.from) * k;
      if (k >= 1) this.ramp = null;
    }
    // Resorte críticamente amortiguado: x'' = ω²(objetivo − x) − 2ω·x'
    const w = 10;
    this.explodeVel += (w * w * (this.explodeTarget - this.explode) - 2 * w * this.explodeVel) * dt;
    this.explode += this.explodeVel * dt;
    if (Math.abs(this.explodeTarget - this.explode) < 1e-4 && Math.abs(this.explodeVel) < 1e-4) {
      this.explode = this.explodeTarget; this.explodeVel = 0;
    }

    for (const p of this.parts) {
      const k = this.partProgress(p);
      p.object.position.copy(p.base).addScaledVector(p.offset, k);
      const tick = p.object.userData.tick as ((dt: number, running: boolean) => void) | undefined;
      tick?.(dt, this.running);
      const el = p.label.element as HTMLElement;
      const show = this.labelsOn && p.object.visible && (k > 0.6 || p === this.selected);
      el.style.opacity = show ? '1' : '0';
      el.style.pointerEvents = show ? 'auto' : 'none';
    }
    this.emit('explode', this.explode);

    if (this.camTween) {
      const c = this.camTween;
      c.t = Math.min(1, c.t + dt / 0.7);
      const k = ease(c.t);
      this.camera.position.lerpVectors(c.p0, c.p1, k);
      this.controls.target.lerpVectors(c.t0, c.t1, k);
      if (c.t >= 1) this.camTween = null;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  }
}
