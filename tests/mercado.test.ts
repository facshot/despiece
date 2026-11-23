import assert from 'node:assert/strict';
import { test } from 'node:test';
import { consolidar, resumirMercado } from '../server/fuentes/mercado';
import type { PartidoBruto } from '../server/fuentes/tipos';

const sumar = (o: Record<string, number | undefined>, ks: string[]) => ks.reduce((s, k) => s + (o[k] ?? 0), 0);

test('Consenso: saca el margen de cada casa y las probabilidades suman 1', () => {
  const m = resumirMercado([
    { casa: 'a', cuotas: { '1': 1.9, X: 3.5, '2': 4.2, over25: 1.9, under25: 1.9 } },
    { casa: 'b', cuotas: { '1': 2.0, X: 3.4, '2': 4.0 } },
    { casa: 'pinnacle', cuotas: { '1': 1.95, X: 3.6, '2': 4.3 } },
  ]);
  assert.equal(m.casas, 3);
  assert.ok(Math.abs(sumar(m.consenso, ['1', 'X', '2']) - 1) < 0.001);
  assert.ok(Math.abs(sumar(m.consenso, ['over25', 'under25']) - 1) < 0.001);
  assert.equal(m.cuotas['1'], 1.95); // mediana
  assert.equal(m.cuotasMax['1'], 2.0);
  assert.equal(m.consenso.over25, 0.5);
});

test('Consenso: descarta una casa con datos rotos o muy desviados', () => {
  const normales = ['a', 'b', 'c'].map((casa) => ({ casa, cuotas: { '1': 2.0, X: 3.4, '2': 3.8 } }));
  const m = resumirMercado([...normales, { casa: 'rota', cuotas: { '1': 6.0, X: 3.4, '2': 1.4 } }, { casa: 'imposible', cuotas: { '1': 3, X: 4, '2': 5 } }]);
  assert.equal(m.casas, 3);
  assert.equal(m.cuotasMax['1'], 2.0);
});

const bruto = (b: Partial<PartidoBruto>): PartidoBruto => ({
  fuente: 'football-data', ref: 'r', liga: 'Premier League', inicio: '2026-11-28T15:00:00.000Z',
  local: 'Man United', visitante: "Nott'm Forest", ofertas: [], ...b,
});

test('Consolidar: junta el mismo partido de dos fuentes sin duplicar casas', () => {
  const partidos = consolidar([
    bruto({ ofertas: [{ casa: 'bet365', cuotas: { '1': 1.8, X: 3.8, '2': 4.5 } }, { casa: 'pinnacle', cuotas: { '1': 1.86, X: 3.9, '2': 4.7 } }], tomadas: '2026-11-25T10:00:00.000Z' }),
    bruto({
      fuente: 'otra-fuente', ref: '999', inicio: '2026-11-28T15:30:00.000Z', local: 'Manchester United', visitante: 'Nottingham Forest',
      stats: { local: { pj: 6, gf: 10, gc: 5 }, visitante: { pj: 6, gf: 6, gc: 9 } },
      ofertas: [{ casa: 'bet365', cuotas: { '1': 1.75, X: 3.9, '2': 4.6, btts_si: 1.8, btts_no: 2.0 } }, { casa: '1xbet', cuotas: { '1': 1.82, X: 3.85, '2': 4.8 } }],
      tomadas: '2026-11-27T10:00:00.000Z',
    }),
    bruto({ ref: 'otro', local: 'Arsenal', visitante: 'Chelsea', ofertas: [{ casa: 'bet365', cuotas: { '1': 2, X: 3.5, '2': 3.6 } }] }),
  ]);
  assert.equal(partidos.length, 2);
  const p = partidos.find((x) => x.refs['otra-fuente'])!;
  assert.equal(p.id, 'otra-fuente-999');
  assert.deepEqual(Object.keys(p.refs).sort(), ['football-data', 'otra-fuente']);
  assert.equal(p.local, 'Manchester United'); // nombre de la fuente principal
  assert.equal(p.mercado!.casas, 3); // bet365 (una sola vez), pinnacle, 1xbet
  assert.equal(p.cuotas['1'], 1.82); // bet365 de la fuente más fresca, no la de football-data
  assert.ok(p.cuotas.btts_si);
  assert.equal(p.stats.local.pj, 6);
  assert.equal(p.mercado!.tomadas, '2026-11-27T10:00:00.000Z');
});

test('Consolidar: no junta partidos del mismo cruce en días distintos', () => {
  const o = [{ casa: 'x', cuotas: { '1': 2, X: 3.5, '2': 3.6 } }];
  const partidos = consolidar([bruto({ ofertas: o }), bruto({ ref: 'v', inicio: '2027-02-10T15:00:00.000Z', ofertas: o })]);
  assert.equal(partidos.length, 2);
});
