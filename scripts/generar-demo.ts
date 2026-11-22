// Genera datos SIMULADOS de demostración en public/data/.
//
//   npm run datos:demo
//
// Los equipos y las ligas son reales, pero las estadísticas, las cuotas y los
// resultados son inventados por este script. La web muestra un aviso de
// "datos de demostración" mientras `demo` sea true. Para vender el producto
// hay que reemplazar estos archivos por datos de un proveedor de cuotas con
// licencia comercial (ver README).
//
// El historial se arma pasando cada día simulado por el MISMO motor que usa la
// web, y se guarda congelado: si el motor cambia, el historial no se reescribe.

import { writeFileSync, mkdirSync } from 'node:fs';
import { buscarCombinadas } from '../src/motor/combinadas.ts';
import { registrar, type DatosHistorial, type DatosPartidos, type Registro } from '../src/motor/historial.ts';
import { probabilidadesDesdeGoles, GRUPOS, type Mercado, type Partido } from '../src/motor/modelo.ts';

const LIGAS: Record<string, string[]> = {
  'Liga Profesional': ['River Plate', 'Boca Juniors', 'Racing Club', 'Independiente', 'San Lorenzo', 'Estudiantes', 'Vélez Sarsfield', 'Talleres', 'Rosario Central', "Newell's Old Boys", 'Atlético Tucumán', 'Lanús'],
  'Premier League': ['Arsenal', 'Manchester City', 'Liverpool', 'Chelsea', 'Tottenham', 'Newcastle', 'Aston Villa', 'Brighton', 'West Ham', 'Everton'],
  LaLiga: ['Real Madrid', 'Barcelona', 'Atlético de Madrid', 'Athletic Club', 'Real Sociedad', 'Villarreal', 'Real Betis', 'Sevilla', 'Valencia', 'Girona'],
  'Serie A': ['Inter', 'Milan', 'Juventus', 'Napoli', 'Roma', 'Lazio', 'Atalanta', 'Fiorentina', 'Bologna', 'Torino'],
};

const DIAS_HISTORIAL = 60;
const DIAS_PROXIMOS = 3;
const OBJETIVOS_HISTORIAL = [5, 20];
const MARGEN_CASA = 0.06;

// Generador pseudoaleatorio con semilla: el mismo comando da los mismos datos.
let semilla = 20261122;
function azar(): number {
  semilla |= 0;
  semilla = (semilla + 0x6d2b79f5) | 0;
  let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const normal = () => Math.sqrt(-2 * Math.log(1 - azar())) * Math.cos(2 * Math.PI * azar());
function poisson(lambda: number): number {
  const l = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do { k++; p *= azar(); } while (p > l);
  return k - 1;
}
const mezclar = <T>(a: T[]) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

interface Equipo { nombre: string; liga: string; ataque: number; defensa: number }
const equipos: Equipo[] = Object.entries(LIGAS).flatMap(([liga, nombres]) =>
  nombres.map((nombre) => ({
    nombre, liga,
    ataque: Math.min(1.6, Math.max(0.6, 1 + 0.2 * normal())),
    defensa: Math.min(1.6, Math.max(0.6, 1 + 0.2 * normal())),
  })),
);

const fechaISO = (d: Date) => d.toISOString().slice(0, 10);
const HORAS = ['12:00', '14:30', '16:00', '17:00', '19:15', '21:00', '21:30'];

function crearPartido(local: Equipo, visita: Equipo, dia: Date, n: number, conResultado: boolean): Partido {
  const lambdaL = 1.45 * local.ataque * visita.defensa;
  const lambdaV = 1.15 * visita.ataque * local.defensa;

  // Estadísticas de temporada (ruidosas): lo que vería un analista.
  const pjL = 6 + Math.floor(azar() * 10);
  const pjV = 6 + Math.floor(azar() * 10);
  const stats = {
    local: { pj: pjL, gf: poisson(pjL * 1.45 * local.ataque), gc: poisson(pjL * 1.15 * local.defensa) },
    visitante: { pj: pjV, gf: poisson(pjV * 1.15 * visita.ataque), gc: poisson(pjV * 1.45 * visita.defensa) },
  };

  // La casa estima con su propio error y le suma su margen.
  const pCasa = probabilidadesDesdeGoles(lambdaL * (1 + 0.1 * normal()), lambdaV * (1 + 0.1 * normal()));
  const cuotas: Partial<Record<Mercado, number>> = {};
  for (const grupo of GRUPOS) {
    for (const m of grupo) {
      const c = 1 / (pCasa[m] * (1 + MARGEN_CASA));
      cuotas[m] = Math.max(1.01, Math.round(c * 100) / 100);
    }
  }

  const p: Partido = {
    id: `${fechaISO(dia)}-${n}`,
    liga: local.liga,
    fecha: `${fechaISO(dia)}T${HORAS[Math.floor(azar() * HORAS.length)]}`,
    local: local.nombre,
    visitante: visita.nombre,
    stats,
    cuotas,
  };
  if (conResultado) p.resultado = { local: poisson(lambdaL), visitante: poisson(lambdaV) };
  return p;
}

function partidosDelDia(dia: Date, conResultado: boolean): Partido[] {
  const out: Partido[] = [];
  for (const liga of Object.keys(LIGAS)) {
    if (azar() < 0.35) continue; // no todas las ligas juegan todos los días
    const delaLiga = mezclar(equipos.filter((e) => e.liga === liga));
    const cuantos = 1 + Math.floor(azar() * 3);
    for (let i = 0; i < cuantos * 2; i += 2) {
      out.push(crearPartido(delaLiga[i], delaLiga[i + 1], dia, out.length + 1, conResultado));
    }
  }
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

const hoy = new Date();
hoy.setUTCHours(12, 0, 0, 0);
const dia = (offset: number) => new Date(hoy.getTime() + offset * 86400000);

const registros: Registro[] = [];
for (let d = -DIAS_HISTORIAL; d < 0; d++) {
  const fecha = dia(d);
  const partidos = partidosDelDia(fecha, true);
  const sinResultado = partidos.map(({ resultado: _r, ...p }) => p);
  const mapa = new Map(partidos.map((p) => [p.id, p]));
  for (const objetivo of OBJETIVOS_HISTORIAL) {
    const [mejor] = buscarCombinadas(sinResultado, { objetivo, cantidad: 1 });
    if (mejor) registros.push(registrar(mejor, fechaISO(fecha), mapa));
  }
}

const proximos: Partido[] = [];
for (let d = 0; d < DIAS_PROXIMOS; d++) proximos.push(...partidosDelDia(dia(d), false));

const generado = new Date().toISOString();
const fuente = 'Datos simulados por scripts/generar-demo.ts';
const datosPartidos: DatosPartidos = { generado, demo: true, fuente, partidos: proximos };
const datosHistorial: DatosHistorial = { generado, demo: true, fuente, registros: registros.reverse() };

mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/partidos.json', JSON.stringify(datosPartidos));
writeFileSync('public/data/historial.json', JSON.stringify(datosHistorial));
const ganadas = registros.filter((r) => r.resultado === 'ganada').length;
console.log(`${proximos.length} partidos próximos, ${registros.length} combinadas en el historial (${ganadas} ganadas).`);
