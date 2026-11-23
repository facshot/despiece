// Fuente real: API-Football (https://www.api-football.com), con plan pago que
// permita uso comercial. Se usa SOLO desde la tarea programada del servidor con
// tu clave (API_FOOTBALL_KEY): los usuarios nunca la llaman ni la ven.
//
// Datos que toma:
//  - /fixtures?date=…         partidos del día
//  - /odds?fixture=…          cuotas de varias casas (se usa la mediana, sin marca de ninguna)
//  - /teams/statistics?…      goles a favor y en contra como local y visitante
//  - /fixtures?ids=…          resultados

import type { Mercado } from '../../src/motor/modelo';
import { leerMeta, guardarMeta } from '../db';
import { diaLocal, sumarDias, ZONA } from '../entorno';
import type { EstadoPartido, Fuente, OfertaCasa, PartidoBruto } from './tipos';

const BASE = 'https://v3.football.api-sports.io';

/** Ligas a analizar. `temporada`: 'anual' (enero a diciembre) o 'europea' (agosto a mayo). */
export const LIGAS_API = [
  { id: 128, nombre: 'Liga Profesional', temporada: 'anual' },
  { id: 39, nombre: 'Premier League', temporada: 'europea' },
  { id: 40, nombre: 'Championship', temporada: 'europea' },
  { id: 140, nombre: 'LaLiga', temporada: 'europea' },
  { id: 135, nombre: 'Serie A', temporada: 'europea' },
  { id: 78, nombre: 'Bundesliga', temporada: 'europea' },
  { id: 61, nombre: 'Ligue 1', temporada: 'europea' },
  { id: 88, nombre: 'Eredivisie', temporada: 'europea' },
  { id: 94, nombre: 'Primeira Liga', temporada: 'europea' },
] as const;

const FINALES = new Set(['FT', 'AET', 'PEN']);
const SUSPENDIDOS = new Set(['PST', 'CANC', 'ABD', 'AWD', 'WO']);

function temporada(tipo: 'anual' | 'europea', dia: string): number {
  const [anio, mes] = dia.split('-').map(Number);
  return tipo === 'anual' ? anio : mes >= 7 ? anio : anio - 1;
}

async function api<T>(ruta: string, params: Record<string, string | number>): Promise<T> {
  const clave = process.env.API_FOOTBALL_KEY;
  if (!clave) throw new Error('Falta API_FOOTBALL_KEY');
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const r = await fetch(`${BASE}${ruta}?${qs}`, { headers: { 'x-apisports-key': clave } });
  if (!r.ok) throw new Error(`API-Football ${ruta} respondió ${r.status}`);
  const datos = (await r.json()) as { response: T; errors?: unknown };
  const errores = datos.errors && (Array.isArray(datos.errors) ? datos.errors.length : Object.keys(datos.errors).length);
  if (errores) throw new Error(`API-Football ${ruta}: ${JSON.stringify(datos.errors)}`);
  return datos.response;
}

interface Fixture {
  fixture: { id: number; date: string; status: { short: string } };
  league: { id: number };
  teams: { home: { id: number; name: string }; away: { id: number; name: string } };
  goals: { home: number | null; away: number | null };
  score: { fulltime: { home: number | null; away: number | null } };
}

interface Odds {
  bookmakers: { name: string; bets: { name: string; values: { value: string; odd: string }[] }[] }[];
}

interface TeamStats {
  fixtures: { played: { home: number; away: number } };
  goals: {
    for: { total: { home: number; away: number } };
    against: { total: { home: number; away: number } };
  };
}

const APUESTAS: Record<string, Record<string, Mercado>> = {
  'Match Winner': { Home: '1', Draw: 'X', Away: '2' },
  'Goals Over/Under': { 'Over 2.5': 'over25', 'Under 2.5': 'under25' },
  'Both Teams Score': { Yes: 'btts_si', No: 'btts_no' },
};

/** Una oferta por casa con los mercados que nos interesan. */
function ofertasDe(odds: Odds | undefined): OfertaCasa[] {
  const out: OfertaCasa[] = [];
  for (const casa of odds?.bookmakers ?? []) {
    const cuotas: Partial<Record<Mercado, number>> = {};
    for (const bet of casa.bets) {
      const mapa = APUESTAS[bet.name];
      if (!mapa) continue;
      for (const v of bet.values) {
        const m = mapa[v.value];
        const odd = Number(v.odd);
        if (m && odd > 1) cuotas[m] = odd;
      }
    }
    if (Object.keys(cuotas).length) out.push({ casa: casa.name.toLowerCase().replace(/\s+/g, ' ').trim(), cuotas });
  }
  return out;
}

/** Estadísticas de un equipo, guardadas un día para no gastar consultas. */
async function estadisticas(liga: number, season: number, equipo: number): Promise<TeamStats> {
  const clave = `af-stats-${liga}-${season}-${equipo}`;
  const cache = await leerMeta<{ dia: string; datos: TeamStats }>(clave);
  if (cache?.dia === diaLocal()) return cache.datos;
  const datos = await api<TeamStats>('/teams/statistics', { league: liga, season, team: equipo });
  await guardarMeta(clave, { dia: diaLocal(), datos });
  return datos;
}

export const fuenteApiFootball: Fuente = {
  id: 'api-football',
  nombre: 'API-Football',
  demo: false,
  async proximos(dias) {
    const ligas = new Map<number, (typeof LIGAS_API)[number]>(LIGAS_API.map((l) => [l.id, l]));
    const out: PartidoBruto[] = [];
    const tomadas = new Date().toISOString();
    for (let i = 0; i < dias; i++) {
      const dia = sumarDias(diaLocal(), i);
      const fixtures = await api<Fixture[]>('/fixtures', { date: dia, timezone: ZONA });
      for (const f of fixtures) {
        const liga = ligas.get(f.league.id);
        if (!liga || f.fixture.status.short !== 'NS') continue;
        const season = temporada(liga.temporada, dia);
        const [odds] = await api<Odds[]>('/odds', { fixture: f.fixture.id });
        const ofertas = ofertasDe(odds);
        if (!ofertas.length) continue;
        const [sl, sv] = await Promise.all([
          estadisticas(liga.id, season, f.teams.home.id),
          estadisticas(liga.id, season, f.teams.away.id),
        ]);
        out.push({
          fuente: 'api-football',
          ref: String(f.fixture.id),
          liga: liga.nombre,
          inicio: new Date(f.fixture.date).toISOString(),
          local: f.teams.home.name,
          visitante: f.teams.away.name,
          stats: {
            local: { pj: sl.fixtures.played.home, gf: sl.goals.for.total.home, gc: sl.goals.against.total.home },
            visitante: { pj: sv.fixtures.played.away, gf: sv.goals.for.total.away, gc: sv.goals.against.total.away },
          },
          ofertas,
          tomadas,
        });
      }
    }
    return out;
  },
  async resultados(partidos) {
    const out = new Map<string, EstadoPartido>();
    const porRef = new Map(partidos.filter((p) => p.refs['api-football']).map((p) => [p.refs['api-football'], p.id]));
    const refs = [...porRef.keys()];
    for (let i = 0; i < refs.length; i += 20) {
      const fixtures = await api<Fixture[]>('/fixtures', { ids: refs.slice(i, i + 20).join('-') });
      for (const f of fixtures) {
        const id = porRef.get(String(f.fixture.id));
        if (!id) continue;
        const s = f.fixture.status.short;
        const ft = f.score.fulltime;
        // Para 1X2 y goles cuenta el resultado de los 90 minutos.
        if (FINALES.has(s) && ft.home !== null && ft.away !== null) out.set(id, { estado: 'final', resultado: { local: ft.home, visitante: ft.away } });
        else if (SUSPENDIDOS.has(s)) out.set(id, { estado: 'suspendido' });
        else out.set(id, { estado: 'pendiente' });
      }
    }
    return out;
  },
};
