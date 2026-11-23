// Búsqueda de combinadas: elige una selección por partido de modo que la cuota
// total quede cerca del objetivo (por ejemplo x20) con la mejor relación entre
// probabilidad estimada y cuota.

import { seleccionesDe, type Partido, type Seleccion } from './modelo';

export interface Combinada {
  id: string;
  objetivo: number;
  selecciones: Seleccion[];
  cuota: number;
  /** Cuota total tomando la mejor cuota de cada selección. */
  cuotaMax: number;
  /** Probabilidad de acertar todas las selecciones (se suponen independientes). */
  prob: number;
  /** cuota × probabilidad. Menos de 1 significa que, a la larga, se pierde. */
  valor: number;
}

export interface OpcionesBusqueda {
  objetivo: number;
  /** Cuántas combinadas distintas devolver. */
  cantidad?: number;
  /** Ligas permitidas; vacío o sin definir = todas. */
  ligas?: string[];
  maxPatas?: number;
  /** Margen alrededor del objetivo: 0,25 acepta de objetivo/1,25 a objetivo×1,25. */
  tolerancia?: number;
}

const ANCHO_HAZ = 300;
const POR_PARTIDO = 3;

interface Estado {
  idx: number;
  sels: Seleccion[];
  cuota: number;
  prob: number;
}

export function buscarCombinadas(partidos: Partido[], o: OpcionesBusqueda): Combinada[] {
  const { objetivo, cantidad = 3, ligas, maxPatas = 7, tolerancia = 0.25 } = o;
  const min = objetivo / (1 + tolerancia);
  const max = objetivo * (1 + tolerancia);

  const lista = partidos.filter((p) => !p.resultado && (!ligas?.length || ligas.includes(p.liga)));
  const candidatos = lista
    .map((p) =>
      seleccionesDe(p)
        .filter((s) => s.cuota >= 1.15 && s.cuota <= 8 && s.prob >= 0.15)
        .sort((a, b) => b.valor - a.valor)
        .slice(0, POR_PARTIDO),
    )
    .filter((c) => c.length > 0);

  const encontradas: Estado[] = [];
  let frontera: Estado[] = [{ idx: -1, sels: [], cuota: 1, prob: 1 }];
  for (let paso = 0; paso < maxPatas && frontera.length; paso++) {
    const siguiente: Estado[] = [];
    for (const e of frontera) {
      for (let i = e.idx + 1; i < candidatos.length; i++) {
        for (const s of candidatos[i]) {
          const cuota = e.cuota * s.cuota;
          if (cuota > max) continue;
          const n: Estado = { idx: i, sels: [...e.sels, s], cuota, prob: e.prob * s.prob };
          if (cuota >= min) encontradas.push(n);
          else siguiente.push(n);
        }
      }
    }
    siguiente.sort((a, b) => b.prob * b.cuota - a.prob * a.cuota);
    frontera = siguiente.slice(0, ANCHO_HAZ);
  }

  encontradas.sort((a, b) => b.prob * b.cuota - a.prob * a.cuota || b.prob - a.prob);

  // Evita sugerir casi la misma combinada varias veces.
  const elegidas: Estado[] = [];
  for (const e of encontradas) {
    if (elegidas.length >= cantidad) break;
    const ids = new Set(e.sels.map((s) => s.partidoId));
    const repetida = elegidas.some((x) => {
      const comunes = x.sels.filter((s) => ids.has(s.partidoId)).length;
      return comunes > Math.min(x.sels.length, e.sels.length) / 2;
    });
    if (!repetida) elegidas.push(e);
  }

  return elegidas.map((e) => ({
    id: e.sels.map((s) => `${s.partidoId}:${s.mercado}`).join('|'),
    objetivo,
    selecciones: e.sels,
    cuota: e.cuota,
    cuotaMax: e.sels.reduce((x, s) => x * (s.cuotaMax ?? s.cuota), 1),
    prob: e.prob,
    valor: e.cuota * e.prob,
  }));
}

/** Objetivos que se calculan para las combinadas del día. */
export const OBJETIVOS_DEL_DIA = [3, 5, 10, 20];

/** Lista ordenada de combinadas sugeridas para los partidos disponibles. */
export function combinadasDelDia(partidos: Partido[], ligas?: string[]): Combinada[] {
  const todas = OBJETIVOS_DEL_DIA.flatMap((objetivo) => buscarCombinadas(partidos, { objetivo, cantidad: 3, ligas }));
  // Intercala objetivos: primero la mejor de cada objetivo, después las segundas, etc.
  const porRonda = (c: Combinada) => todas.filter((x) => x.objetivo === c.objetivo).indexOf(c);
  return todas.sort((a, b) => porRonda(a) - porRonda(b) || b.valor - a.valor);
}
