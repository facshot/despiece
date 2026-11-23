import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { codigoTemporada, fechaFD, ofertasDeFila, partidosDeFixtures, resultadosDeCSV } from '../server/fuentes/footballdata';
import { leerCSV } from '../server/util/csv';

const fixtures = readFileSync(new URL('./datos/fixtures.csv', import.meta.url), 'utf8');
const temporada = readFileSync(new URL('./datos/E0.csv', import.meta.url), 'utf8');

test('Fechas y temporadas de football-data', () => {
  assert.equal(fechaFD('28/11/2026'), '2026-11-28');
  assert.equal(fechaFD('5/1/27'), '2027-01-05');
  assert.equal(fechaFD('mal'), null);
  assert.equal(codigoTemporada('2026-11-23'), '2627');
  assert.equal(codigoTemporada('2027-03-01'), '2627');
  assert.equal(codigoTemporada('2026-07-15'), '2627');
});

test('Ofertas: una por casa, sin Max/Avg ni cuotas de cierre', () => {
  const [fila] = leerCSV(fixtures);
  const ofertas = ofertasDeFila(fila);
  const casas = ofertas.map((o) => o.casa).sort();
  assert.deepEqual(casas, ['bet365', 'betvictor', 'bwin', 'pinnacle', 'william hill']);
  const pin = ofertas.find((o) => o.casa === 'pinnacle')!;
  assert.deepEqual(pin.cuotas, { '1': 1.86, X: 3.9, '2': 4.7, over25: 1.9, under25: 2.02 });
  const cierre = ofertasDeFila(leerCSV(temporada)[0]);
  assert.deepEqual(cierre.map((o) => o.casa), ['bet365']);
  assert.equal(cierre[0].cuotas['1'], 2.5);
});

test('Próximos partidos: filtra por fecha y liga, convierte la hora y arma las estadísticas', () => {
  const res = resultadosDeCSV(temporada);
  const partidos = partidosDeFixtures(fixtures, new Map([['E0', res]]), new Date('2026-11-25T00:00:00Z'), new Date('2026-12-01T00:00:00Z'), '2026-11-24T08:00:00.000Z');
  assert.equal(partidos.length, 2); // excluye el de julio y la liga desconocida
  const mu = partidos[0];
  assert.equal(mu.local, 'Man United');
  assert.equal(mu.inicio, '2026-11-28T15:00:00.000Z');
  assert.equal(mu.liga, 'Premier League');
  assert.equal(mu.tomadas, '2026-11-24T08:00:00.000Z');
  // Man United de local: 2-1, 1-1 y 2-0. Forest de visitante: 0-0, 0-3, 2-1 y 0-2.
  assert.deepEqual(mu.stats!.local, { pj: 3, gf: 5, gc: 2 });
  assert.deepEqual(mu.stats!.visitante, { pj: 4, gf: 2, gc: 6 });
  const atm = partidos[1];
  assert.equal(atm.liga, 'LaLiga');
  assert.equal(atm.ofertas.length, 4); // William Hill vacío no cuenta
  assert.deepEqual(atm.stats!.local, { pj: 0, gf: 0, gc: 0 });
});
