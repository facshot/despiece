// Registro público de combinadas sugeridas y cálculo del rendimiento real.

import type { Combinada } from './combinadas';
import { nombreMercado, seCumple, type Mercado, type Partido } from './modelo';

export interface PataRegistrada {
  partidoId: string;
  liga: string;
  partido: string;
  mercado: Mercado;
  etiqueta: string;
  cuota: number;
  prob: number;
  /** Marcador final, por ejemplo `2-1`, o `suspendido`. */
  marcador: string;
  acerto: boolean;
}

export type ResultadoRegistro = 'ganada' | 'perdida' | 'anulada';

export interface Registro {
  id: string;
  /** Día en que se publicó la sugerencia (`AAAA-MM-DD`). */
  fecha: string;
  objetivo: number;
  cuota: number;
  prob: number;
  resultado: ResultadoRegistro;
  patas: PataRegistrada[];
}

/**
 * Convierte una combinada en un registro, una vez conocidos los resultados.
 * Si algún partido se suspendió, la combinada queda anulada y no cuenta para el ROI.
 */
export function registrar(c: Combinada, fecha: string, partidos: Map<string, Partido>, suspendidos = new Set<string>()): Registro {
  const patas = c.selecciones.map((s): PataRegistrada => {
    const base = {
      partidoId: s.partidoId, liga: s.liga, partido: `${s.local} vs ${s.visitante}`,
      mercado: s.mercado, etiqueta: nombreMercado(s.mercado, s), cuota: s.cuota, prob: s.prob,
    };
    if (suspendidos.has(s.partidoId)) return { ...base, marcador: 'suspendido', acerto: false };
    const r = partidos.get(s.partidoId)?.resultado;
    if (!r) throw new Error(`Falta el resultado del partido ${s.partidoId}`);
    return { ...base, marcador: `${r.local}-${r.visitante}`, acerto: seCumple(s.mercado, r) };
  });
  const anulada = c.selecciones.some((s) => suspendidos.has(s.partidoId));
  return {
    id: `${fecha}-x${c.objetivo}`, fecha, objetivo: c.objetivo, cuota: c.cuota, prob: c.prob,
    resultado: anulada ? 'anulada' : patas.every((p) => p.acerto) ? 'ganada' : 'perdida',
    patas,
  };
}

export interface Resumen {
  total: number;
  ganadas: number;
  anuladas: number;
  /** Porcentaje real de aciertos (0 a 1). */
  aciertos: number;
  /** Aciertos que se esperaban según la probabilidad estimada. */
  aciertosEsperados: number;
  /** Apostando 1 unidad a cada combinada (sin contar las anuladas). */
  invertido: number;
  retorno: number;
  /** (retorno − invertido) / invertido. */
  roi: number;
  cuotaMedia: number;
}

export function resumir(todos: Registro[]): Resumen {
  const registros = todos.filter((r) => r.resultado !== 'anulada');
  const total = registros.length;
  const ganadas = registros.filter((r) => r.resultado === 'ganada').length;
  const retorno = registros.reduce((s, r) => s + (r.resultado === 'ganada' ? r.cuota : 0), 0);
  return {
    total,
    ganadas,
    anuladas: todos.length - total,
    aciertos: total ? ganadas / total : 0,
    aciertosEsperados: registros.reduce((s, r) => s + r.prob, 0),
    invertido: total,
    retorno,
    roi: total ? (retorno - total) / total : 0,
    cuotaMedia: total ? registros.reduce((s, r) => s + r.cuota, 0) / total : 0,
  };
}
