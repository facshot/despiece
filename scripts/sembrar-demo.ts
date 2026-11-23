// SOLO DESARROLLO: llena la base local con 60 días de historial SIMULADO para
// ver la web con datos. Nunca correrlo contra la base de producción.
process.env.FUENTE_SIMULADA = '1';
export {};

const { buscarCombinadas } = await import('../src/motor/combinadas');
const { registrar } = await import('../src/motor/historial');
const { q } = await import('../server/db');
const { diaLocal, esProduccion, sumarDias } = await import('../server/entorno');
const { fuenteSimulada, partidosDelDia } = await import('../server/fuentes/simulada');
const { consolidar } = await import('../server/fuentes/mercado');
const { actualizarTodo, OBJETIVOS_OFICIALES } = await import('../server/actualizar');

if (esProduccion() || process.env.DATABASE_URL) {
  console.error('sembrar-demo es solo para la base local (sin DATABASE_URL).');
  process.exit(1);
}

let n = 0;
for (let d = -60; d < 0; d++) {
  const dia = sumarDias(diaLocal(), d);
  const partidos = consolidar(partidosDelDia(dia));
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
console.log(`${n} combinadas simuladas en el historial.`);
console.log(await actualizarTodo());
process.exit(0);
