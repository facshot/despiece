import * as THREE from 'three';

/** Ayudantes de modelado procedural. Coordenadas en metros; Y hacia arriba, +Z hacia el frente. */

type V3 = [number, number, number];
type Axis = 'x' | 'y' | 'z';

export function box(size: V3, pos: V3, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  m.position.set(...pos);
  return m;
}

/** Cilindro con su eje alineado a `axis`. */
export function cyl(r: number, h: number, pos: V3, mat: THREE.Material, axis: Axis = 'y', seg = 32, rBottom = r, open = false): THREE.Mesh {
  const g = new THREE.CylinderGeometry(r, rBottom, h, seg, 1, open);
  if (axis === 'x') g.rotateZ(Math.PI / 2);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.position.set(...pos);
  return m;
}

/** Tubo que sigue una polilínea con curvas suaves (radio de curvado `bend`). */
export function pipe(points: V3[], r: number, mat: THREE.Material, bend = 0.03, radial = 10): THREE.Mesh {
  const path = new THREE.CurvePath<THREE.Vector3>();
  const p = points.map((q) => new THREE.Vector3(...q));
  let cursor = p[0].clone();
  for (let i = 1; i < p.length; i++) {
    const isLast = i === p.length - 1;
    if (isLast) {
      path.add(new THREE.LineCurve3(cursor, p[i]));
      break;
    }
    const inDir = p[i].clone().sub(p[i - 1]).normalize();
    const outDir = p[i + 1].clone().sub(p[i]).normalize();
    const lenIn = p[i].distanceTo(cursor);
    const lenOut = p[i + 1].distanceTo(p[i]);
    const b = Math.min(bend, lenIn * 0.5, lenOut * 0.5);
    const a = p[i].clone().addScaledVector(inDir, -b);
    const c = p[i].clone().addScaledVector(outDir, b);
    if (cursor.distanceTo(a) > 1e-5) path.add(new THREE.LineCurve3(cursor, a));
    path.add(new THREE.QuadraticBezierCurve3(a, p[i].clone(), c));
    cursor = c;
  }
  const segs = Math.max(16, Math.round(path.getLength() / 0.01));
  return new THREE.Mesh(new THREE.TubeGeometry(path, segs, r, radial, false), mat);
}

/** Curva en U (media vuelta) que une dos tubos paralelos. `bulge` = hacia dónde sobresale. */
export function uBend(center: V3, radius: number, tubeR: number, bulge: '+x' | '+z' | '-x', mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.TorusGeometry(radius, tubeR, 8, 14, Math.PI), mat);
  m.position.set(...center);
  if (bulge === '+x') m.rotateZ(-Math.PI / 2);
  if (bulge === '-x') m.rotateZ(Math.PI / 2);
  if (bulge === '+z') { m.rotateY(-Math.PI / 2); m.rotateZ(-Math.PI / 2); }
  return m;
}

/** Placas repetidas (aletas, nervios) como InstancedMesh: miles de piezas con un solo draw call. */
export function fins(count: number, size: V3, start: V3, step: V3, mat: THREE.Material): THREE.InstancedMesh {
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(...size), mat, count);
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    m.makeTranslation(start[0] + step[0] * i, start[1] + step[1] * i, start[2] + step[2] * i);
    inst.setMatrixAt(i, m);
  }
  inst.instanceMatrix.needsUpdate = true;
  inst.computeBoundingSphere();
  inst.computeBoundingBox();
  return inst;
}

/** Prisma hexagonal (tuercas flare). */
export function hex(r: number, h: number, pos: V3, mat: THREE.Material, axis: Axis = 'x'): THREE.Mesh {
  return cyl(r, h, pos, mat, axis, 6);
}

export function group(...children: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  children.forEach((c) => g.add(c));
  return g;
}
