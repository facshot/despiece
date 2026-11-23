// Orquestador de fuentes: consulta todas las activas, tolera que alguna falle,
// y junta todo en un mercado consolidado.

import { esProduccion } from '../entorno';
import { fuenteFootballData } from './footballdata';
import { consolidar } from './mercado';
import { fuenteSimulada } from './simulada';
import type { EstadoPartido, Fuente, PartidoBruto, PartidoGuardado } from './tipos';

/**
 * Fuentes activas:
 *  - football-data.co.uk: siempre (gratis, sin clave), salvo DESACTIVAR_FOOTBALL_DATA=1.
 *  - Simulada: solo con FUENTE_SIMULADA=1 y nunca en producción.
 */
export function fuentesActivas(): Fuente[] {
  if (process.env.FUENTE_SIMULADA === '1') {
    if (esProduccion()) throw new Error('FUENTE_SIMULADA no se puede usar en producción');
    return [fuenteSimulada];
  }
  const fuentes: Fuente[] = [];
  if (process.env.DESACTIVAR_FOOTBALL_DATA !== '1') fuentes.push(fuenteFootballData);
  if (!fuentes.length) throw new Error('No hay ninguna fuente de datos activa');
  return fuentes;
}

export interface InformeFuente { fuente: string; nombre: string; ok: boolean; partidos: number; error?: string }

export async function proximosConsolidados(fuentes: Fuente[], dias: number): Promise<{ partidos: PartidoGuardado[]; informe: InformeFuente[] }> {
  const resultados = await Promise.allSettled(fuentes.map((f) => f.proximos(dias)));
  const brutos: PartidoBruto[] = [];
  const informe = resultados.map((r, i): InformeFuente => {
    const f = fuentes[i];
    if (r.status === 'fulfilled') {
      brutos.push(...r.value);
      return { fuente: f.id, nombre: f.nombre, ok: true, partidos: r.value.length };
    }
    console.error(`Fuente ${f.id} falló:`, r.reason);
    return { fuente: f.id, nombre: f.nombre, ok: false, partidos: 0, error: String(r.reason?.message ?? r.reason) };
  });
  return { partidos: consolidar(brutos), informe };
}

/** Pide el resultado a cada fuente que conoce el partido. Un resultado final de cualquiera alcanza. */
export async function resultadosConsolidados(fuentes: Fuente[], partidos: PartidoGuardado[]): Promise<Map<string, EstadoPartido>> {
  const out = new Map<string, EstadoPartido>();
  const respuestas = await Promise.allSettled(fuentes.map((f) => f.resultados(partidos.filter((p) => p.refs?.[f.id]))));
  for (const r of respuestas) {
    if (r.status !== 'fulfilled') {
      console.error('Resultados: una fuente falló:', r.reason);
      continue;
    }
    for (const [id, e] of r.value) {
      const actual = out.get(id);
      if (e.estado === 'final' || !actual || (actual.estado === 'pendiente' && e.estado === 'suspendido')) out.set(id, e);
    }
  }
  return out;
}

export const sonDemo = (fuentes: Fuente[]) => fuentes.every((f) => f.demo);
