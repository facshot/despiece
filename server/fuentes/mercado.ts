// Consolidación del mercado: junta el mismo partido de varias fuentes y calcula,
// con las cuotas de todas las casas:
//  - la cuota de referencia (mediana) y la mejor cuota disponible (máxima);
//  - la probabilidad de consenso: cada casa sin su margen, promediadas.
// Descarta datos sospechosos (márgenes imposibles o cuotas muy desviadas).

import { GRUPOS, type Mercado, type StatsEquipo } from '../../src/motor/modelo';
import { fechaHoraLocal } from '../entorno';
import { mismoEquipo } from '../util/nombres';
import type { OfertaCasa, PartidoBruto, PartidoGuardado } from './tipos';

/** Casas de referencia por su margen bajo: pesan el doble en el consenso. */
const PESO: Record<string, number> = { pinnacle: 2, 'betfair exchange': 2 };
const VENTANA_MS = 3 * 3600_000;
/** Márgenes fuera de este rango indican datos rotos. */
const MARGEN_MIN = 0.98;
const MARGEN_MAX = 1.3;
/** Una casa cuya probabilidad se aleja más que esto de la mediana se descarta. */
const DESVIO_MAX = 0.12;

export function mismoPartido(a: Pick<PartidoBruto, 'inicio' | 'local' | 'visitante'>, b: Pick<PartidoBruto, 'inicio' | 'local' | 'visitante'>): boolean {
  return Math.abs(Date.parse(a.inicio) - Date.parse(b.inicio)) <= VENTANA_MS
    && mismoEquipo(a.local, b.local) && mismoEquipo(a.visitante, b.visitante);
}

const mediana = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const r2 = (x: number) => Math.round(x * 100) / 100;
const r4 = (x: number) => Math.round(x * 10000) / 10000;

export interface ResumenMercado {
  cuotas: Partial<Record<Mercado, number>>;
  cuotasMax: Partial<Record<Mercado, number>>;
  consenso: Partial<Record<Mercado, number>>;
  casas: number;
}

/** Calcula cuotas de referencia, máximas y consenso a partir de las ofertas de varias casas. */
export function resumirMercado(ofertas: OfertaCasa[]): ResumenMercado {
  const out: ResumenMercado = { cuotas: {}, cuotasMax: {}, consenso: {}, casas: 0 };
  const casasUsadas = new Set<string>();
  for (const grupo of GRUPOS) {
    // Probabilidades sin margen de cada casa con el grupo completo y un margen razonable.
    let filas = ofertas
      .filter((o) => grupo.every((m) => (o.cuotas[m] ?? 0) > 1))
      .map((o) => {
        const inv = grupo.map((m) => 1 / o.cuotas[m]!);
        const margen = inv.reduce((a, b) => a + b, 0);
        return { o, margen, p: inv.map((x) => x / margen) };
      })
      .filter((f) => f.margen >= MARGEN_MIN && f.margen <= MARGEN_MAX);
    if (!filas.length) continue;
    if (filas.length >= 3) {
      const med = grupo.map((_, i) => mediana(filas.map((f) => f.p[i])));
      filas = filas.filter((f) => f.p.every((x, i) => Math.abs(x - med[i]) <= DESVIO_MAX));
    }
    const pesoTotal = filas.reduce((s, f) => s + (PESO[f.o.casa] ?? 1), 0);
    grupo.forEach((m, i) => {
      out.consenso[m] = r4(filas.reduce((s, f) => s + f.p[i] * (PESO[f.o.casa] ?? 1), 0) / pesoTotal);
      const cs = filas.map((f) => f.o.cuotas[m]!);
      out.cuotas[m] = r2(mediana(cs));
      out.cuotasMax[m] = r2(Math.max(...cs));
    });
    filas.forEach((f) => casasUsadas.add(f.o.casa));
  }
  out.casas = casasUsadas.size;
  return out;
}

const PREFIJO: Record<string, string> = { 'football-data': 'fd', simulada: 'sim' };
const idDe = (b: PartidoBruto) => `${PREFIJO[b.fuente] ?? b.fuente}-${b.ref}`
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9-]+/g, '-').toLowerCase();

const pjTotal = (s?: { local: StatsEquipo; visitante: StatsEquipo }) => (s ? s.local.pj + s.visitante.pj : -1);

/** Junta los partidos de todas las fuentes en un solo listado sin repetidos. */
export function consolidar(brutos: PartidoBruto[]): PartidoGuardado[] {
  const grupos: PartidoBruto[][] = [];
  // Primero las cuotas más recientes: si dos fuentes traen la misma casa, gana la más fresca.
  for (const b of [...brutos].sort((x, y) => (y.tomadas ?? '').localeCompare(x.tomadas ?? ''))) {
    const g = grupos.find((gr) => mismoPartido(gr[0], b));
    if (g) g.push(b);
    else grupos.push([b]);
  }

  const out: PartidoGuardado[] = [];
  for (const g of grupos) {
    const principal = g[0]; // la fuente con cuotas más recientes
    // Una oferta por casa: la más reciente.
    const porCasa = new Map<string, OfertaCasa>();
    for (const b of g) for (const o of b.ofertas) if (!porCasa.has(o.casa)) porCasa.set(o.casa, o);
    const m = resumirMercado([...porCasa.values()]);
    if (!Object.keys(m.cuotas).length) continue;
    const conStats = [...g].sort((a, b) => pjTotal(b.stats) - pjTotal(a.stats))[0];
    const tomadas = g.map((b) => b.tomadas).filter(Boolean).sort().pop();
    out.push({
      id: idDe(principal),
      liga: principal.liga,
      inicio: principal.inicio,
      fecha: fechaHoraLocal(new Date(principal.inicio)),
      local: principal.local,
      visitante: principal.visitante,
      stats: conStats.stats ?? { local: { pj: 0, gf: 0, gc: 0 }, visitante: { pj: 0, gf: 0, gc: 0 } },
      cuotas: m.cuotas,
      cuotasMax: m.cuotasMax,
      consenso: m.consenso,
      mercado: { casas: m.casas, fuentes: [...new Set(g.map((b) => b.fuente))], ...(tomadas ? { tomadas } : {}) },
      refs: Object.fromEntries(g.map((b) => [b.fuente, b.ref])),
      ...(principal.sim ? { sim: principal.sim } : {}),
    });
  }
  return out.sort((a, b) => a.inicio.localeCompare(b.inicio));
}
