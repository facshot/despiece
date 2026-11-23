import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buscarCombinadas } from '../src/motor/combinadas';
import { probabilidadesMercado, type Partido } from '../src/motor/modelo';
import { resumir, type Registro } from '../src/motor/historial';

const partido = (i: number): Partido => ({
  id: `p${i}`, liga: 'L', fecha: '2026-12-01T15:00', local: `L${i}`, visitante: `V${i}`,
  stats: { local: { pj: 8, gf: 12, gc: 8 }, visitante: { pj: 8, gf: 9, gc: 11 } },
  cuotas: { '1': 1.9 + i * 0.1, X: 3.5, '2': 4.0, over25: 1.9, under25: 1.95, btts_si: 1.85, btts_no: 1.95 },
});

test('Combinadas: llegan cerca del objetivo, una selección por partido y probabilidad = producto', () => {
  const partidos = Array.from({ length: 10 }, (_, i) => partido(i));
  for (const objetivo of [3, 5, 10, 20]) {
    const [c] = buscarCombinadas(partidos, { objetivo, cantidad: 1 });
    assert.ok(c, `hay combinada x${objetivo}`);
    assert.ok(c.cuota >= objetivo / 1.25 && c.cuota <= objetivo * 1.25);
    assert.equal(new Set(c.selecciones.map((s) => s.partidoId)).size, c.selecciones.length);
    const producto = c.selecciones.reduce((x, s) => x * s.prob, 1);
    assert.ok(Math.abs(producto - c.prob) < 1e-9);
  }
});

test('Mercado: usa el consenso de las casas cuando está disponible', () => {
  const p = { ...partido(0), consenso: { '1': 0.5, X: 0.3, '2': 0.2 } };
  assert.equal(probabilidadesMercado(p)['1'], 0.5);
});

test('Historial: las anuladas no cuentan para el ROI', () => {
  const r = (resultado: Registro['resultado'], cuota: number): Registro => ({ id: '', fecha: '', objetivo: 5, cuota, prob: 0.2, resultado, patas: [] });
  const s = resumir([r('ganada', 5), r('perdida', 5), r('perdida', 5), r('anulada', 5)]);
  assert.equal(s.total, 3);
  assert.equal(s.anuladas, 1);
  assert.ok(Math.abs(s.roi - (5 - 3) / 3) < 1e-9);
});
