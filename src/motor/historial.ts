// Registro público de combinadas sugeridas y cálculo del rendimiento real.

import type { Combinada } from './combinadas.ts';
import { nombreMercado, seCumple, type Mercado, type Partido } from './modelo.ts';

export interface PataRegistrada {
  partidoId: string;
  liga: string;
  partido: string;
  mercado: Mercado;
  etiqueta: string;
  cuota: number;
  prob: number;
  /** Marcador final, por ejemplo `2-1`. */
  marcador: string;
  acerto: boolean;
}

export interface Registro {
  id: string;
  /** Día en que se publicó la sugerencia (`AAAA-MM-DD`). */
  fecha: string;
  objetivo: number;
  cuota: number;
  prob: number;
  resultado: 'ganada' | 'perdida';
  patas: PataRegistrada[];
}

export interface DatosPartidos {
  generado: string;
  demo: boolean;
  fuente: string;
  partidos: Partido[];
}

export interface DatosHistorial {
  generado: string;
  demo: boolean;
  fuente: string;
  registros: Registro[];
}

/** Convierte una combinada en un registro, una vez conocidos los resultados. */
export function registrar(c: Combinada, fecha: string, partidos: Map<string, Partido>): Registro {
  const patas = c.selecciones.map((s): PataRegistrada => {
    const p = partidos.get(s.partidoId);
    const r = p?.resultado;
    if (!r) throw new Error(`Falta el resultado del partido ${s.partidoId}`);
    return {
      partidoId: s.partidoId, liga: s.liga, partido: `${s.local} vs ${s.visitante}`,
      mercado: s.mercado, etiqueta: nombreMercado(s.mercado, s), cuota: s.cuota, prob: s.prob,
      marcador: `${r.local}-${r.visitante}`, acerto: seCumple(s.mercado, r),
    };
  });
  return {
    id: `${fecha}-x${c.objetivo}`, fecha, objetivo: c.objetivo, cuota: c.cuota, prob: c.prob,
    resultado: patas.every((p) => p.acerto) ? 'ganada' : 'perdida', patas,
  };
}

export interface Resumen {
  total: number;
  ganadas: number;
  /** Porcentaje real de aciertos (0 a 1). */
  aciertos: number;
  /** Aciertos que se esperaban según la probabilidad estimada. */
  aciertosEsperados: number;
  /** Apostando 1 unidad a cada combinada. */
  invertido: number;
  retorno: number;
  /** (retorno − invertido) / invertido. */
  roi: number;
  cuotaMedia: number;
}

export function resumir(registros: Registro[]): Resumen {
  const total = registros.length;
  const ganadas = registros.filter((r) => r.resultado === 'ganada').length;
  const retorno = registros.reduce((s, r) => s + (r.resultado === 'ganada' ? r.cuota : 0), 0);
  return {
    total,
    ganadas,
    aciertos: total ? ganadas / total : 0,
    aciertosEsperados: registros.reduce((s, r) => s + r.prob, 0),
    invertido: total,
    retorno,
    roi: total ? (retorno - total) / total : 0,
    cuotaMedia: total ? registros.reduce((s, r) => s + r.cuota, 0) / total : 0,
  };
}
