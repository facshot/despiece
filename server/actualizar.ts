// Tarea programada (Vercel Cron o `npm run actualizar`):
//  1. Consulta todas las fuentes activas y consolida partidos y cuotas.
//  2. Califica las combinadas publicadas cuyos partidos ya terminaron.
//  3. Publica las combinadas oficiales del día (quedan congeladas en el historial).
//
// Es lo único que consulta a los proveedores de datos.

import { buscarCombinadas, type Combinada } from '../src/motor/combinadas';
import { registrar } from '../src/motor/historial';
import { guardarMeta, q } from './db';
import { diaLocal, sumarDias } from './entorno';
import { fuentesActivas, proximosConsolidados, resultadosConsolidados, sonDemo } from './fuentes';
import { mismoPartido } from './fuentes/mercado';
import type { EstadoPartido, Fuente, PartidoGuardado } from './fuentes/tipos';

export const DIAS_PROXIMOS = 3;
/** Objetivos de las combinadas oficiales que se registran cada día en el historial. */
export const OBJETIVOS_OFICIALES = [5, 20];
/** Una combinada sin resolver después de estos días se anula. */
const DIAS_MAXIMOS_PENDIENTE = 7;

/**
 * Guarda los partidos. Si uno ya estaba guardado (aunque venga de otra fuente o
 * con otro nombre de equipo), conserva su id y suma las referencias: así el
 * historial nunca apunta a un partido duplicado.
 */
export async function guardarPartidos(partidos: PartidoGuardado[]): Promise<void> {
  if (!partidos.length) return;
  const ahora = new Date().toISOString();
  const desde = new Date(Date.parse(partidos[0].inicio) - 86400_000).toISOString();
  const hasta = new Date(Date.parse(partidos[partidos.length - 1].inicio) + 86400_000).toISOString();
  const existentes = (await q<{ id: string; estado: string; datos: PartidoGuardado }>(
    'SELECT id, estado, datos FROM partidos WHERE inicio >= $1 AND inicio <= $2', [desde, hasta],
  ));
  for (const p of partidos) {
    const previo = existentes.find((e) => e.id === p.id) ?? existentes.find((e) => mismoPartido(e.datos, p));
    if (previo && previo.estado !== 'programado') continue; // ya jugado: no se toca
    const datos: PartidoGuardado = previo
      ? { ...p, id: previo.id, refs: { ...(previo.datos.refs ?? {}), ...p.refs } }
      : p;
    await q(
      `INSERT INTO partidos (id, inicio, liga, estado, datos, actualizado) VALUES ($1, $2, $3, 'programado', $4, $5)
       ON CONFLICT (id) DO UPDATE SET inicio = EXCLUDED.inicio, datos = EXCLUDED.datos, actualizado = EXCLUDED.actualizado
       WHERE partidos.estado = 'programado'`,
      [datos.id, datos.inicio, datos.liga, JSON.stringify(datos), ahora],
    );
  }
}

interface Pendiente { fecha: string; combinada: Combinada }

export async function calificar(fuentes: Fuente[]): Promise<number> {
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
    for (const [id, e] of await resultadosConsolidados(fuentes, porConsultar)) {
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

export interface EstadoFuentes {
  fuentes: { id: string; nombre: string; ok: boolean; partidos: number; error?: string }[];
  demo: boolean;
  partidos: number;
  calificadas: number;
  publicadas: number;
  actualizado: string;
}

export async function actualizarTodo(): Promise<EstadoFuentes> {
  const fuentes = fuentesActivas();
  const { partidos, informe } = await proximosConsolidados(fuentes, DIAS_PROXIMOS);
  if (informe.every((i) => !i.ok)) throw new Error(`Todas las fuentes fallaron: ${informe.map((i) => `${i.fuente}: ${i.error}`).join('; ')}`);
  await guardarPartidos(partidos);
  const calificadas = await calificar(fuentes);
  const publicadas = await publicarDelDia();
  const resumen: EstadoFuentes = {
    fuentes: informe.map(({ fuente, nombre, ok, partidos: n, error }) => ({ id: fuente, nombre, ok, partidos: n, ...(error ? { error } : {}) })),
    demo: sonDemo(fuentes),
    partidos: partidos.length,
    calificadas,
    publicadas,
    actualizado: new Date().toISOString(),
  };
  await guardarMeta('fuente', resumen);
  return resumen;
}
