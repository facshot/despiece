// Tarea programada (Vercel Cron o `npm run actualizar`):
//  1. Trae partidos y cuotas de los próximos días.
//  2. Califica las combinadas publicadas cuyos partidos ya terminaron.
//  3. Publica las combinadas oficiales del día (quedan congeladas en el historial).
//
// Es lo único que consulta al proveedor de datos, con tu clave.

import { buscarCombinadas, type Combinada } from '../src/motor/combinadas';
import { registrar } from '../src/motor/historial';
import { guardarMeta, q } from './db';
import { diaLocal, esProduccion, sumarDias } from './entorno';
import { fuenteApiFootball } from './fuentes/apifootball';
import { fuenteSimulada } from './fuentes/simulada';
import type { EstadoPartido, Fuente, PartidoGuardado } from './fuentes/tipos';

export const DIAS_PROXIMOS = 3;
/** Objetivos de las combinadas oficiales que se registran cada día en el historial. */
export const OBJETIVOS_OFICIALES = [5, 20];
/** Una combinada sin resolver después de estos días se anula. */
const DIAS_MAXIMOS_PENDIENTE = 7;

export function fuenteActiva(): Fuente {
  if (process.env.API_FOOTBALL_KEY) return fuenteApiFootball;
  if (esProduccion() && process.env.PERMITIR_DATOS_SIMULADOS !== '1') {
    throw new Error('Falta API_FOOTBALL_KEY: en producción no se usan datos simulados');
  }
  return fuenteSimulada;
}

export async function guardarPartidos(partidos: PartidoGuardado[]): Promise<void> {
  const ahora = new Date().toISOString();
  for (const p of partidos) {
    await q(
      `INSERT INTO partidos (id, inicio, liga, estado, datos, actualizado) VALUES ($1, $2, $3, 'programado', $4, $5)
       ON CONFLICT (id) DO UPDATE SET inicio = EXCLUDED.inicio, datos = EXCLUDED.datos, actualizado = EXCLUDED.actualizado
       WHERE partidos.estado = 'programado'`,
      [p.id, p.inicio, p.liga, JSON.stringify(p), ahora],
    );
  }
}

interface Pendiente { fecha: string; combinada: Combinada }

export async function calificar(fuente: Fuente): Promise<number> {
  const pendientes = await q<{ id: string; fecha: string; datos: Pendiente }>("SELECT id, fecha, datos FROM historial WHERE estado = 'pendiente'");
  if (!pendientes.length) return 0;

  const ids = [...new Set(pendientes.flatMap((h) => h.datos.combinada.selecciones.map((s) => s.partidoId)))];
  const filas = await q<{ id: string; estado: string; datos: PartidoGuardado }>('SELECT id, estado, datos FROM partidos WHERE id = ANY($1)', [ids]);
  const partidos = new Map(filas.map((f) => [f.id, f.datos]));
  const estados = new Map<string, EstadoPartido>();
  for (const f of filas) {
    if (f.estado === 'final' && f.datos.resultado) estados.set(f.id, { estado: 'final', resultado: f.datos.resultado });
    if (f.estado === 'suspendido') estados.set(f.id, { estado: 'suspendido' });
  }

  const porConsultar = filas.filter((f) => f.estado === 'programado' && new Date(f.datos.inicio) < new Date()).map((f) => f.datos);
  if (porConsultar.length) {
    const nuevos = await fuente.resultados(porConsultar);
    for (const [id, e] of nuevos) {
      if (e.estado === 'pendiente') continue;
      estados.set(id, e);
      const p = partidos.get(id)!;
      if (e.estado === 'final') p.resultado = e.resultado;
      await q('UPDATE partidos SET estado = $2, datos = $3, actualizado = $4 WHERE id = $1', [id, e.estado, JSON.stringify(p), new Date().toISOString()]);
    }
  }

  let calificadas = 0;
  for (const h of pendientes) {
    const sels = h.datos.combinada.selecciones;
    const suspendidos = new Set(sels.filter((s) => estados.get(s.partidoId)?.estado === 'suspendido').map((s) => s.partidoId));
    const todosResueltos = sels.every((s) => estados.has(s.partidoId));
    const vencida = sumarDias(h.fecha, DIAS_MAXIMOS_PENDIENTE) < diaLocal();
    if (!todosResueltos && !suspendidos.size && !vencida) continue;
    if (!todosResueltos) for (const s of sels) if (!estados.has(s.partidoId)) suspendidos.add(s.partidoId);
    const registro = registrar(h.datos.combinada, h.fecha, partidos, suspendidos);
    await q('UPDATE historial SET estado = $2, datos = $3 WHERE id = $1', [h.id, registro.resultado, JSON.stringify(registro)]);
    calificadas++;
  }
  return calificadas;
}

export async function publicarDelDia(): Promise<number> {
  const dia = diaLocal();
  const ya = await q('SELECT id FROM historial WHERE fecha = $1', [dia]);
  if (ya.length) return 0;
  const ahora = new Date();
  const hasta = new Date(ahora.getTime() + 36 * 3600_000);
  const filas = await q<{ datos: PartidoGuardado }>(
    "SELECT datos FROM partidos WHERE estado = 'programado' AND inicio > $1 AND inicio < $2",
    [ahora.toISOString(), hasta.toISOString()],
  );
  const partidos = filas.map((f) => f.datos);
  let n = 0;
  for (const objetivo of OBJETIVOS_OFICIALES) {
    const [mejor] = buscarCombinadas(partidos, { objetivo, cantidad: 1 });
    if (!mejor) continue;
    const pendiente: Pendiente = { fecha: dia, combinada: mejor };
    await q("INSERT INTO historial (id, fecha, estado, datos) VALUES ($1, $2, 'pendiente', $3) ON CONFLICT (id) DO NOTHING", [`${dia}-x${objetivo}`, dia, JSON.stringify(pendiente)]);
    n++;
  }
  return n;
}

export async function actualizarTodo(): Promise<Record<string, unknown>> {
  const fuente = fuenteActiva();
  const partidos = await fuente.proximos(DIAS_PROXIMOS);
  await guardarPartidos(partidos);
  const calificadas = await calificar(fuente);
  const publicadas = await publicarDelDia();
  const resumen = { fuente: fuente.nombre, demo: fuente.demo, partidos: partidos.length, calificadas, publicadas, actualizado: new Date().toISOString() };
  await guardarMeta('fuente', resumen);
  return resumen;
}
