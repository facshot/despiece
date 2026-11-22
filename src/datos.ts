// Los datos son archivos estáticos que se publican junto con la web
// (public/data/*.json). El navegador del usuario solo los descarga: no hay
// llamadas a APIs de cuotas ni a modelos de IA, así que nadie consume tus claves.

import type { DatosHistorial, DatosPartidos } from './motor/historial';

export interface Datos {
  partidos: DatosPartidos;
  historial: DatosHistorial;
  ligas: string[];
}

let cache: Promise<Datos> | null = null;

export function cargarDatos(): Promise<Datos> {
  cache ??= (async () => {
    const [partidos, historial] = await Promise.all([
      fetch('./data/partidos.json').then((r) => r.json() as Promise<DatosPartidos>),
      fetch('./data/historial.json').then((r) => r.json() as Promise<DatosHistorial>),
    ]);
    const ligas = [...new Set([...partidos.partidos.map((p) => p.liga), ...historial.registros.flatMap((r) => r.patas.map((p) => p.liga))])].sort();
    return { partidos, historial, ligas };
  })();
  return cache;
}
