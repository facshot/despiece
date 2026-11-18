import type * as THREE from 'three';

/** Valor simple o rango [mín, máx]. */
export type Range = number | [number, number];

/**
 * Propiedades físicas de un material. Todas son opcionales: se muestran sólo las que existan.
 * Unidades fijas para poder comparar materiales entre sí.
 */
export interface MaterialProps {
  density?: Range;              // kg/m³
  youngModulus?: Range;         // GPa
  tensileStrength?: Range;      // MPa (resistencia a la tracción, Rm)
  yieldStrength?: Range;        // MPa (límite elástico, Rp0,2)
  elongation?: Range;           // % (alargamiento a la rotura)
  hardness?: string;            // HB / HV / Shore
  thermalConductivity?: Range;  // W/(m·K)
  specificHeat?: Range;         // J/(kg·K)
  thermalExpansion?: Range;     // µm/(m·K)
  meltingPoint?: Range;         // °C
  glassTransition?: Range;      // °C (polímeros)
  maxServiceTemp?: Range;       // °C
  electricalResistivity?: string; // Ω·m (texto para notación científica)
}

/** Parámetros de render físicamente basado (PBR) para Three.js MeshPhysicalMaterial. */
export interface RenderProps {
  color: number;
  metalness: number;
  roughness: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  opacity?: number;
}

export interface MaterialDef {
  id: string;
  name: string;
  family: 'Metal' | 'Polímero' | 'Elastómero' | 'Compuesto' | 'Fibra';
  standard?: string;
  description: string;
  props: MaterialProps;
  /** Datos adicionales libres (recubrimiento, norma, reciclabilidad, etc.). */
  extra?: Record<string, string>;
  render: RenderProps;
}

export interface Spec { label: string; value: string }

export interface BuildContext {
  /** Material PBR a partir de la biblioteca (siempre devuelve una instancia nueva). */
  mat: (id: string, override?: Partial<RenderProps>) => THREE.MeshPhysicalMaterial;
  /** Material genérico para detalles sin ficha propia (tornillos, plásticos de componentes...). */
  paint: (color: number, metalness?: number, roughness?: number) => THREE.MeshPhysicalMaterial;
}

export interface PartDef {
  id: string;
  name: string;
  /** Sistema/subconjunto al que pertenece (agrupa la lista lateral). */
  group: string;
  /** Materiales de la pieza; el primero es el principal. */
  materials: { id: string; role?: string }[];
  description: string;
  function?: string;
  specs: Spec[];
  /** Desplazamiento en la vista explosionada (unidades de escena = metros). */
  explode: [number, number, number];
  /** Orden de desarme: 0 sale primero. Piezas con el mismo orden salen juntas. */
  order: number;
  /** Geometría procedural… */
  build?: (ctx: BuildContext) => THREE.Object3D;
  /** …o nombre del nodo dentro del .glb del modelo (ver ModelDef.gltf). */
  node?: string;
}

export interface ModelDef {
  id: string;
  name: string;
  subtitle: string;
  summary: Spec[];
  /** Orden de los grupos en la lista lateral. */
  groups: string[];
  camera: { position: [number, number, number]; target: [number, number, number] };
  floorY: number;
  /** Opcional: ruta a un .glb exportado de CAD/Blender. Las piezas con `node` se toman de ahí. */
  gltf?: string;
  parts: PartDef[];
}
