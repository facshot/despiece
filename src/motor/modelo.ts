// Modelo de probabilidades de un partido.
//
// Combina dos fuentes:
//  1. Un modelo de Poisson con los goles a favor y en contra de cada equipo
//     (como local y como visitante), suavizado hacia la media de la liga.
//  2. La probabilidad implícita en las cuotas, sin el margen de la casa.
//
// Todo se calcula en el navegador con los datos incluidos: no hay llamadas a
// ninguna API ni a ningún modelo de IA.

export type Mercado = '1' | 'X' | '2' | 'over25' | 'under25' | 'btts_si' | 'btts_no';

export const MERCADOS: Mercado[] = ['1', 'X', '2', 'over25', 'under25', 'btts_si', 'btts_no'];

/** Mercados que se excluyen entre sí (sus probabilidades suman 1). */
export const GRUPOS: Mercado[][] = [
  ['1', 'X', '2'],
  ['over25', 'under25'],
  ['btts_si', 'btts_no'],
];

export interface StatsEquipo {
  /** Partidos jugados en esa condición (local o visitante). */
  pj: number;
  /** Goles a favor. */
  gf: number;
  /** Goles en contra. */
  gc: number;
}

export interface Partido {
  id: string;
  liga: string;
  /** Fecha y hora local, formato `AAAA-MM-DDTHH:MM`. */
  fecha: string;
  local: string;
  visitante: string;
  /** `local`: rendimiento del local jugando de local; `visitante`: del visitante jugando de visitante. */
  stats: { local: StatsEquipo; visitante: StatsEquipo };
  cuotas: Partial<Record<Mercado, number>>;
  resultado?: { local: number; visitante: number };
}

export interface Seleccion {
  partidoId: string;
  liga: string;
  fecha: string;
  local: string;
  visitante: string;
  mercado: Mercado;
  cuota: number;
  /** Probabilidad estimada (0 a 1). */
  prob: number;
  /** cuota × probabilidad: 1 es neutro, menos de 1 pierde a la larga. */
  valor: number;
}

/** Peso del modelo estadístico frente al mercado en la estimación final. */
export const PESO_MODELO = 0.25;

const PRIOR_PJ = 8;
const MEDIA_LOCAL = 1.45;
const MEDIA_VISITA = 1.15;
const MAX_GOLES = 10;

export function nombreMercado(m: Mercado, p: Pick<Partido, 'local' | 'visitante'>): string {
  switch (m) {
    case '1': return `Gana ${p.local}`;
    case 'X': return 'Empate';
    case '2': return `Gana ${p.visitante}`;
    case 'over25': return 'Más de 2,5 goles';
    case 'under25': return 'Menos de 2,5 goles';
    case 'btts_si': return 'Ambos marcan: sí';
    case 'btts_no': return 'Ambos marcan: no';
  }
}

/** Goles esperados de cada equipo (modelo multiplicativo ataque × defensa). */
export function golesEsperados(p: Partido): { local: number; visitante: number } {
  const L = p.stats.local;
  const V = p.stats.visitante;
  const suav = (goles: number, pj: number, media: number) => (goles + PRIOR_PJ * media) / (pj + PRIOR_PJ);
  const ataqueL = suav(L.gf, L.pj, MEDIA_LOCAL);
  const defensaV = suav(V.gc, V.pj, MEDIA_LOCAL);
  const ataqueV = suav(V.gf, V.pj, MEDIA_VISITA);
  const defensaL = suav(L.gc, L.pj, MEDIA_VISITA);
  return {
    local: (ataqueL * defensaV) / MEDIA_LOCAL,
    visitante: (ataqueV * defensaL) / MEDIA_VISITA,
  };
}

function poisson(lambda: number): number[] {
  const out: number[] = [];
  let p = Math.exp(-lambda);
  for (let k = 0; k <= MAX_GOLES; k++) {
    out.push(p);
    p = (p * lambda) / (k + 1);
  }
  return out;
}

/** Probabilidad de cada mercado dados los goles esperados de cada equipo. */
export function probabilidadesDesdeGoles(lambdaLocal: number, lambdaVisita: number): Record<Mercado, number> {
  const pl = poisson(lambdaLocal);
  const pv = poisson(lambdaVisita);
  const r: Record<Mercado, number> = { '1': 0, X: 0, '2': 0, over25: 0, under25: 0, btts_si: 0, btts_no: 0 };
  let total = 0;
  for (let i = 0; i <= MAX_GOLES; i++) {
    for (let j = 0; j <= MAX_GOLES; j++) {
      const p = pl[i] * pv[j];
      total += p;
      if (i > j) r['1'] += p; else if (i === j) r.X += p; else r['2'] += p;
      if (i + j > 2) r.over25 += p; else r.under25 += p;
      if (i > 0 && j > 0) r.btts_si += p; else r.btts_no += p;
    }
  }
  for (const m of MERCADOS) r[m] /= total;
  return r;
}

export function probabilidadesModelo(p: Partido): Record<Mercado, number> {
  const g = golesEsperados(p);
  return probabilidadesDesdeGoles(g.local, g.visitante);
}

/** Probabilidad implícita en las cuotas, quitando el margen de la casa. */
export function probabilidadesMercado(p: Partido): Partial<Record<Mercado, number>> {
  const r: Partial<Record<Mercado, number>> = {};
  for (const grupo of GRUPOS) {
    const cuotas = grupo.map((m) => p.cuotas[m]);
    if (cuotas.some((c) => !c || c <= 1)) continue;
    const inversas = cuotas.map((c) => 1 / (c as number));
    const suma = inversas.reduce((a, b) => a + b, 0);
    grupo.forEach((m, i) => (r[m] = inversas[i] / suma));
  }
  return r;
}

/** Probabilidad final: mezcla del modelo y del mercado. */
export function probabilidadEstimada(p: Partido): Record<Mercado, number> {
  const modelo = probabilidadesModelo(p);
  const mercado = probabilidadesMercado(p);
  const r = { ...modelo };
  for (const m of MERCADOS) {
    const pm = mercado[m];
    if (pm !== undefined) r[m] = PESO_MODELO * modelo[m] + (1 - PESO_MODELO) * pm;
  }
  return r;
}

/** Todas las selecciones con cuota disponible de un partido. */
export function seleccionesDe(p: Partido): Seleccion[] {
  const prob = probabilidadEstimada(p);
  const out: Seleccion[] = [];
  for (const m of MERCADOS) {
    const cuota = p.cuotas[m];
    if (!cuota || cuota <= 1) continue;
    out.push({
      partidoId: p.id, liga: p.liga, fecha: p.fecha, local: p.local, visitante: p.visitante,
      mercado: m, cuota, prob: prob[m], valor: cuota * prob[m],
    });
  }
  return out;
}

/** ¿Se cumplió la selección con este resultado? */
export function seCumple(m: Mercado, r: { local: number; visitante: number }): boolean {
  switch (m) {
    case '1': return r.local > r.visitante;
    case 'X': return r.local === r.visitante;
    case '2': return r.local < r.visitante;
    case 'over25': return r.local + r.visitante > 2;
    case 'under25': return r.local + r.visitante <= 2;
    case 'btts_si': return r.local > 0 && r.visitante > 0;
    case 'btts_no': return r.local === 0 || r.visitante === 0;
  }
}
