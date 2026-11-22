// Entrega de combinadas según el plan. Todo se calcula en el servidor con los
// partidos guardados: el navegador recibe solo las combinadas que le tocan.

import { plan } from '../src/config';
import { buscarCombinadas, combinadasDelDia, type Combinada } from '../src/motor/combinadas';
import { q } from './db';
import { diaLocal } from './entorno';
import type { PartidoGuardado } from './fuentes/tipos';
import type { FilaUsuario } from './usuarios';

const HORAS_ADELANTE = 72;

/** Partidos que todavía no empezaron, sin datos internos. */
export async function partidosDisponibles(): Promise<PartidoGuardado[]> {
  const ahora = new Date();
  const hasta = new Date(ahora.getTime() + HORAS_ADELANTE * 3600_000);
  const filas = await q<{ datos: PartidoGuardado }>(
    "SELECT datos FROM partidos WHERE estado = 'programado' AND inicio > $1 AND inicio < $2 ORDER BY inicio",
    [ahora.toISOString(), hasta.toISOString()],
  );
  return filas.map(({ datos: { sim: _sim, ...p } }) => p);
}

export async function ligasDisponibles(): Promise<string[]> {
  const filas = await q<{ liga: string }>('SELECT DISTINCT liga FROM partidos ORDER BY liga');
  return filas.map((f) => f.liga);
}

/**
 * Combinadas del día para este usuario.
 * En los planes con cupo, las que ya se entregaron hoy quedan fijas: cambiar los
 * filtros no da combinadas extra.
 */
export async function combinadasPara(u: FilaUsuario): Promise<{ combinadas: Combinada[]; cupo: number | null; masEnPlanesSuperiores: number }> {
  const p = plan(u.plan);
  const partidos = await partidosDisponibles();
  const ligas = p.filtrosLiga ? u.ligas : undefined;
  const todas = combinadasDelDia(partidos, ligas);

  if (p.combinadasPorDia === Infinity) return { combinadas: todas, cupo: null, masEnPlanesSuperiores: 0 };

  const dia = diaLocal();
  const entregadas = await q<{ combinada_id: string; datos: Combinada }>(
    'SELECT combinada_id, datos FROM entregas WHERE usuario_id = $1 AND dia = $2 ORDER BY orden',
    [u.id, dia],
  );
  const lista = entregadas.map((e) => e.datos);
  const ids = new Set(entregadas.map((e) => e.combinada_id));
  for (const c of todas) {
    if (lista.length >= p.combinadasPorDia) break;
    if (ids.has(c.id)) continue;
    await q(
      'INSERT INTO entregas (usuario_id, dia, combinada_id, orden, datos) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
      [u.id, dia, c.id, lista.length, JSON.stringify(c)],
    );
    lista.push(c);
    ids.add(c.id);
  }
  return { combinadas: lista, cupo: p.combinadasPorDia, masEnPlanesSuperiores: Math.max(0, todas.length - lista.length) };
}

export async function aMedida(u: FilaUsuario, objetivo: number, maxPatas: number): Promise<Combinada[]> {
  return buscarCombinadas(await partidosDisponibles(), { objetivo, maxPatas, cantidad: 3, ligas: u.ligas });
}

export async function alertasPara(u: FilaUsuario): Promise<Combinada[]> {
  if (!plan(u.plan).alertas || !u.alertas.activas) return [];
  const lista = buscarCombinadas(await partidosDisponibles(), { objetivo: u.alertas.objetivo, cantidad: 5, ligas: u.ligas });
  return lista.filter((c) => c.prob >= u.alertas.probMin);
}
