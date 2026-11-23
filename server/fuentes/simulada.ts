// Fuente SIMULADA: inventa partidos, cuotas y resultados para probar el sistema
// sin un proveedor. Los equipos son reales; todo lo demás es inventado y la web
// muestra el aviso de datos de demostración. No se puede usar en producción.

import { GRUPOS, probabilidadesDesdeGoles, type Mercado } from '../../src/motor/modelo';
import { diaLocal, sumarDias } from '../entorno';
import type { EstadoPartido, Fuente, OfertaCasa, PartidoBruto } from './tipos';

const LIGAS: Record<string, string[]> = {
  'Liga Profesional': ['River Plate', 'Boca Juniors', 'Racing Club', 'Independiente', 'San Lorenzo', 'Estudiantes', 'Vélez Sarsfield', 'Talleres', 'Rosario Central', "Newell's Old Boys", 'Atlético Tucumán', 'Lanús'],
  'Premier League': ['Arsenal', 'Manchester City', 'Liverpool', 'Chelsea', 'Tottenham', 'Newcastle', 'Aston Villa', 'Brighton', 'West Ham', 'Everton'],
  LaLiga: ['Real Madrid', 'Barcelona', 'Atlético de Madrid', 'Athletic Club', 'Real Sociedad', 'Villarreal', 'Real Betis', 'Sevilla', 'Valencia', 'Girona'],
  'Serie A': ['Inter', 'Milan', 'Juventus', 'Napoli', 'Roma', 'Lazio', 'Atalanta', 'Fiorentina', 'Bologna', 'Torino'],
};
const HORAS = ['12:00', '14:30', '16:00', '17:00', '19:15', '21:00', '21:30'];
/** Casas inventadas, cada una con su margen. */
const CASAS_SIM: [string, number][] = [['casa a', 0.06], ['casa b', 0.07], ['casa c', 0.05], ['pinnacle', 0.03]];

function generador(semilla: number) {
  let s = semilla | 0;
  const azar = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => Math.sqrt(-2 * Math.log(1 - azar())) * Math.cos(2 * Math.PI * azar());
  const poisson = (lambda: number) => {
    const l = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do { k++; p *= azar(); } while (p > l);
    return k - 1;
  };
  return { azar, normal, poisson };
}

const semillaDe = (texto: string) => [...texto].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

interface Equipo { nombre: string; liga: string; ataque: number; defensa: number }
const equipos: Equipo[] = (() => {
  const g = generador(20261122);
  return Object.entries(LIGAS).flatMap(([liga, nombres]) =>
    nombres.map((nombre) => ({
      nombre, liga,
      ataque: Math.min(1.6, Math.max(0.6, 1 + 0.2 * g.normal())),
      defensa: Math.min(1.6, Math.max(0.6, 1 + 0.2 * g.normal())),
    })));
})();

/** Partidos simulados de un día. Siempre los mismos para la misma fecha. */
export function partidosDelDia(dia: string): PartidoBruto[] {
  const g = generador(semillaDe(dia));
  const out: PartidoBruto[] = [];
  for (const liga of Object.keys(LIGAS)) {
    if (g.azar() < 0.35) continue;
    const delaLiga = equipos.filter((e) => e.liga === liga).sort(() => g.azar() - 0.5);
    const cuantos = 1 + Math.floor(g.azar() * 3);
    for (let i = 0; i < cuantos * 2; i += 2) {
      const local = delaLiga[i];
      const visita = delaLiga[i + 1];
      const lambdaL = 1.45 * local.ataque * visita.defensa;
      const lambdaV = 1.15 * visita.ataque * local.defensa;
      const pjL = 6 + Math.floor(g.azar() * 10);
      const pjV = 6 + Math.floor(g.azar() * 10);
      // Cada casa estima con su propio error y le suma su margen.
      const ofertas: OfertaCasa[] = CASAS_SIM.map(([casa, margen]) => {
        const pCasa = probabilidadesDesdeGoles(lambdaL * (1 + 0.08 * g.normal()), lambdaV * (1 + 0.08 * g.normal()));
        const cuotas: Partial<Record<Mercado, number>> = {};
        for (const grupo of GRUPOS) for (const m of grupo) cuotas[m] = Math.max(1.01, Math.round((1 / (pCasa[m] * (1 + margen))) * 100) / 100);
        return { casa, cuotas };
      });
      const hora = HORAS[Math.floor(g.azar() * HORAS.length)];
      out.push({
        fuente: 'simulada',
        ref: `${dia}-${out.length + 1}`,
        liga,
        inicio: new Date(`${dia}T${hora}:00-03:00`).toISOString(),
        local: local.nombre,
        visitante: visita.nombre,
        stats: {
          local: { pj: pjL, gf: g.poisson(pjL * 1.45 * local.ataque), gc: g.poisson(pjL * 1.15 * local.defensa) },
          visitante: { pj: pjV, gf: g.poisson(pjV * 1.15 * visita.ataque), gc: g.poisson(pjV * 1.45 * visita.defensa) },
        },
        ofertas,
        sim: { local: lambdaL, visitante: lambdaV },
      });
    }
  }
  return out.sort((a, b) => a.inicio.localeCompare(b.inicio));
}

export const fuenteSimulada: Fuente = {
  id: 'simulada',
  nombre: 'Datos simulados (demostración)',
  demo: true,
  async proximos(dias) {
    const hoy = diaLocal();
    return Array.from({ length: dias }, (_, i) => partidosDelDia(sumarDias(hoy, i))).flat();
  },
  async resultados(partidos) {
    const out = new Map<string, EstadoPartido>();
    for (const p of partidos) {
      if (!p.refs.simulada) continue;
      const terminado = new Date(p.inicio).getTime() + 2 * 3600_000 < Date.now();
      if (!terminado || !p.sim) {
        out.set(p.id, { estado: 'pendiente' });
        continue;
      }
      const g = generador(semillaDe(p.id));
      out.set(p.id, { estado: 'final', resultado: { local: g.poisson(p.sim.local), visitante: g.poisson(p.sim.visitante) } });
    }
    return out;
  },
};
