// Fuente GRATUITA y sin clave: football-data.co.uk.
//
// - fixtures.csv: próximos partidos de las ligas principales con cuotas de varias
//   casas (1X2 y más/menos 2,5 goles). Se actualiza unas dos veces por semana.
// - mmz4281/{temporada}/{división}.csv: resultados de la temporada, que sirven
//   para las estadísticas del modelo y para calificar el historial.
//
// Antes de vender: confirmar con football-data.co.uk las condiciones de uso
// comercial y mantener la atribución visible en la web.

import { leerCSV } from '../util/csv';
import { horaLocalAUTC } from '../util/zona';
import type { Mercado, StatsEquipo } from '../../src/motor/modelo';
import type { EstadoPartido, Fuente, OfertaCasa, PartidoBruto, PartidoGuardado } from './tipos';

const BASE = 'https://www.football-data.co.uk';
/** Los horarios de football-data están en hora del Reino Unido. */
const ZONA_FUENTE = 'Europe/London';

export const DIVISIONES: Record<string, string> = {
  E0: 'Premier League',
  E1: 'Championship',
  SP1: 'LaLiga',
  I1: 'Serie A',
  D1: 'Bundesliga',
  F1: 'Ligue 1',
  N1: 'Eredivisie',
  P1: 'Primeira Liga',
};

/** Prefijos de columnas → casa. Max y Avg son resúmenes, no casas, y se ignoran. */
const CASAS: Record<string, string> = {
  B365: 'bet365', BW: 'bwin', IW: 'interwetten', PS: 'pinnacle', P: 'pinnacle', WH: 'william hill',
  VC: 'betvictor', '1XB': '1xbet', BF: 'betfair', BFE: 'betfair exchange', LB: 'ladbrokes', BV: 'betvictor',
  CL: 'coral', BMGM: 'betmgm', BFD: 'betfred',
};
const RESUMENES = new Set(['Max', 'Avg', 'BbMx', 'BbAv', 'Bb']);

// ---- Lectura de archivos (exportado para las pruebas) ----

/** `23/11/2026` o `23/11/26` → `2026-11-23`. */
export function fechaFD(f: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(f.trim());
  if (!m) return null;
  const anio = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return `${anio}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

/** Ofertas por casa a partir de las columnas de cuotas de una fila. */
export function ofertasDeFila(fila: Record<string, string>): OfertaCasa[] {
  const porCasa = new Map<string, Partial<Record<Mercado, number>>>();
  const poner = (prefijo: string, m: Mercado, valor: string | undefined) => {
    if (RESUMENES.has(prefijo)) return;
    // Cuotas de cierre (B365CH, PSCH, PC>2.5...): no sirven para partidos por jugarse.
    const base = prefijo.slice(0, -1);
    if (!(prefijo in CASAS) && prefijo.endsWith('C') && (base in CASAS || RESUMENES.has(base))) return;
    const casa = CASAS[prefijo] ?? prefijo.toLowerCase();
    const v = Number(valor);
    if (!(v > 1)) return;
    porCasa.set(casa, { ...(porCasa.get(casa) ?? {}), [m]: v });
  };
  for (const col of Object.keys(fila)) {
    let m: RegExpExecArray | null;
    if ((m = /^(.+)H$/.exec(col)) && `${m[1]}D` in fila && `${m[1]}A` in fila && !/^(FT|HT)$/.test(m[1])) {
      poner(m[1], '1', fila[col]);
      poner(m[1], 'X', fila[`${m[1]}D`]);
      poner(m[1], '2', fila[`${m[1]}A`]);
    } else if ((m = /^(.+)>2\.5$/.exec(col))) {
      poner(m[1], 'over25', fila[col]);
      poner(m[1], 'under25', fila[`${m[1]}<2.5`]);
    }
  }
  return [...porCasa].map(([casa, cuotas]) => ({ casa, cuotas }));
}

export interface ResultadoFD { dia: string; local: string; visitante: string; gl: number; gv: number }

export function resultadosDeCSV(texto: string): ResultadoFD[] {
  const out: ResultadoFD[] = [];
  for (const f of leerCSV(texto)) {
    const dia = fechaFD(f.Date ?? '');
    const gl = Number(f.FTHG);
    const gv = Number(f.FTAG);
    if (!dia || !f.HomeTeam || !f.AwayTeam || f.FTHG === '' || f.FTAG === '' || Number.isNaN(gl) || Number.isNaN(gv)) continue;
    out.push({ dia, local: f.HomeTeam, visitante: f.AwayTeam, gl, gv });
  }
  return out;
}

/** Goles a favor y en contra de un equipo jugando de local o de visitante. */
export function statsDe(resultados: ResultadoFD[], equipo: string, condicion: 'local' | 'visitante'): StatsEquipo {
  const s: StatsEquipo = { pj: 0, gf: 0, gc: 0 };
  for (const r of resultados) {
    if (condicion === 'local' && r.local === equipo) { s.pj++; s.gf += r.gl; s.gc += r.gv; }
    if (condicion === 'visitante' && r.visitante === equipo) { s.pj++; s.gf += r.gv; s.gc += r.gl; }
  }
  return s;
}

export function partidosDeFixtures(texto: string, resultadosPorDiv: Map<string, ResultadoFD[]>, desde: Date, hasta: Date, tomadas?: string): PartidoBruto[] {
  const out: PartidoBruto[] = [];
  for (const f of leerCSV(texto)) {
    const liga = DIVISIONES[f.Div];
    const dia = fechaFD(f.Date ?? '');
    if (!liga || !dia || !f.HomeTeam || !f.AwayTeam) continue;
    const inicio = horaLocalAUTC(dia, f.Time || '15:00', ZONA_FUENTE);
    const t = Date.parse(inicio);
    if (t < desde.getTime() || t > hasta.getTime()) continue;
    const ofertas = ofertasDeFila(f);
    if (!ofertas.length) continue;
    const res = resultadosPorDiv.get(f.Div) ?? [];
    out.push({
      fuente: 'football-data',
      ref: `${f.Div}|${dia}|${f.HomeTeam}|${f.AwayTeam}`,
      liga,
      inicio,
      local: f.HomeTeam,
      visitante: f.AwayTeam,
      stats: { local: statsDe(res, f.HomeTeam, 'local'), visitante: statsDe(res, f.AwayTeam, 'visitante') },
      ofertas,
      ...(tomadas ? { tomadas } : {}),
    });
  }
  return out;
}

/** Código de temporada de football-data: agosto 2026 a mayo 2027 → `2627`. */
export function codigoTemporada(dia: string): string {
  const [y, m] = dia.split('-').map(Number);
  const inicio = m >= 7 ? y : y - 1;
  return `${String(inicio % 100).padStart(2, '0')}${String((inicio + 1) % 100).padStart(2, '0')}`;
}

// ---- Descargas (con caché corta para no pedir dos veces el mismo archivo) ----

const cache = new Map<string, { hasta: number; datos: Promise<{ texto: string; modificado?: string }> }>();

function descargar(ruta: string): Promise<{ texto: string; modificado?: string }> {
  const c = cache.get(ruta);
  if (c && c.hasta > Date.now()) return c.datos;
  const datos = (async () => {
    const r = await fetch(`${BASE}${ruta}`, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; analisis-estadistico/1.0)' }, signal: AbortSignal.timeout(20_000) });
    if (!r.ok) throw new Error(`football-data ${ruta} respondió ${r.status}`);
    const modificado = r.headers.get('last-modified');
    return { texto: await r.text(), ...(modificado ? { modificado: new Date(modificado).toISOString() } : {}) };
  })();
  cache.set(ruta, { hasta: Date.now() + 10 * 60_000, datos });
  datos.catch(() => cache.delete(ruta));
  return datos;
}

async function resultadosDivision(div: string, dia: string): Promise<ResultadoFD[]> {
  try {
    return resultadosDeCSV((await descargar(`/mmz4281/${codigoTemporada(dia)}/${div}.csv`)).texto);
  } catch {
    return []; // sin resultados de temporada el modelo usa la media de la liga
  }
}

export const fuenteFootballData: Fuente = {
  id: 'football-data',
  nombre: 'football-data.co.uk',
  demo: false,
  async proximos(dias) {
    const { texto, modificado } = await descargar('/fixtures.csv');
    const divs = new Set(leerCSV(texto).map((f) => f.Div).filter((d) => d in DIVISIONES));
    const hoy = new Date().toISOString().slice(0, 10);
    const porDiv = new Map(await Promise.all([...divs].map(async (d) => [d, await resultadosDivision(d, hoy)] as const)));
    const desde = new Date();
    return partidosDeFixtures(texto, porDiv, desde, new Date(desde.getTime() + dias * 86400_000), modificado);
  },
  async resultados(partidos: PartidoGuardado[]) {
    const out = new Map<string, EstadoPartido>();
    const porDiv = new Map<string, ResultadoFD[]>();
    for (const p of partidos) {
      const ref = p.refs['football-data'];
      if (!ref) continue;
      const [div, dia, local, visitante] = ref.split('|');
      if (!porDiv.has(div)) porDiv.set(div, await resultadosDivision(div, dia));
      const r = porDiv.get(div)!.find((x) => x.dia === dia && x.local === local && x.visitante === visitante);
      out.set(p.id, r ? { estado: 'final', resultado: { local: r.gl, visitante: r.gv } } : { estado: 'pendiente' });
    }
    return out;
  },
};
