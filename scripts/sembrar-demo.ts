// SOLO DESARROLLO: llena la base local con 60 días de historial SIMULADO para
// ver la web con datos. Nunca correrlo contra la base de producción.
import { buscarCombinadas } from '../src/motor/combinadas';
import { registrar } from '../src/motor/historial';
import { guardarMeta, q } from '../server/db';
import { diaLocal, esProduccion, sumarDias } from '../server/entorno';
import { fuenteSimulada, partidosDelDia } from '../server/fuentes/simulada';
import { actualizarTodo, OBJETIVOS_OFICIALES } from '../server/actualizar';

if (esProduccion() || process.env.DATABASE_URL) {
  console.error('sembrar-demo es solo para la base local (sin DATABASE_URL).');
  process.exit(1);
}

let n = 0;
for (let d = -60; d < 0; d++) {
  const dia = sumarDias(diaLocal(), d);
  const partidos = partidosDelDia(dia);
  const estados = await fuenteSimulada.resultados(partidos);
  for (const p of partidos) {
    const e = estados.get(p.id);
    if (e?.estado === 'final') p.resultado = e.resultado;
  }
  const mapa = new Map(partidos.map((p) => [p.id, p]));
  for (const objetivo of OBJETIVOS_OFICIALES) {
    const [mejor] = buscarCombinadas(partidos.map(({ resultado: _r, ...p }) => p), { objetivo, cantidad: 1 });
    if (!mejor) continue;
    const r = registrar(mejor, dia, mapa);
    await q('INSERT INTO historial (id, fecha, estado, datos) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING', [r.id, dia, r.resultado, JSON.stringify(r)]);
    n++;
  }
}
await guardarMeta('fuente', { nombre: fuenteSimulada.nombre, demo: true, actualizado: new Date().toISOString() });
console.log(`${n} combinadas simuladas en el historial.`);
console.log(await actualizarTodo());
process.exit(0);
