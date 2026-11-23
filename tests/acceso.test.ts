// Integración: base temporal + datos simulados + la API real (manejar).
// Comprueba que cada plan recibe solo lo que paga.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';

const dir = mkdtempSync(join(tmpdir(), 'cuotalab-'));
process.env.PGLITE_DIR = dir;
process.env.FUENTE_SIMULADA = '1';
delete process.env.DATABASE_URL;
delete process.env.MP_ACCESS_TOKEN;

const { manejar } = await import('../server/router');
const { actualizarTodo } = await import('../server/actualizar');

const BASE = 'http://localhost';

class Cliente {
  cookie = '';
  async pedir(metodo: string, ruta: string, cuerpo?: unknown) {
    const headers: Record<string, string> = { cookie: this.cookie };
    if (cuerpo !== undefined) headers['content-type'] = 'application/json';
    const r = await manejar(new Request(`${BASE}/api/${ruta}`, { method: metodo, headers, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) }));
    const sc = r.headers.get('set-cookie');
    if (sc) this.cookie = sc.split(';')[0];
    const tipo = r.headers.get('content-type') ?? '';
    return { estado: r.status, datos: tipo.includes('json') ? await r.json() : await r.text() };
  }
}

const registrar = async (email: string, nacimiento = '1990-05-05') => {
  const c = new Cliente();
  const r = await c.pedir('POST', 'registro', { nombre: 'Prueba', email, password: 'clave-segura-123', nacimiento, mayor: true, terminos: true });
  return { c, r };
};

before(async () => {
  const r = await actualizarTodo();
  assert.ok(r.partidos > 0);
});
after(() => rmSync(dir, { recursive: true, force: true }));

test('Sin sesión no hay combinadas ni exportación', async () => {
  const c = new Cliente();
  assert.equal((await c.pedir('GET', 'combinadas')).estado, 401);
  assert.equal((await c.pedir('GET', 'exportar')).estado, 401);
});

test('Menores de 18: rechazados en el servidor', async () => {
  const { r } = await registrar('menor@ejemplo.com', '2012-01-01');
  assert.equal(r.estado, 403);
});

test('Prueba: 1 combinada por día; Básico: 3 fijas aunque cambie los filtros; Pro: todas', async () => {
  const { c } = await registrar('plan@ejemplo.com');
  const prueba = await c.pedir('GET', 'combinadas');
  assert.equal(prueba.datos.combinadas.length, 1);
  assert.ok(prueba.datos.masEnPlanesSuperiores > 0);
  assert.equal((await c.pedir('POST', 'combinadas/medida', { objetivo: 20 })).estado, 403);

  assert.equal((await c.pedir('POST', 'suscripcion', { plan: 'basico' })).estado, 200);
  const basico = await c.pedir('GET', 'combinadas');
  assert.equal(basico.datos.combinadas.length, 3);
  const ids = basico.datos.combinadas.map((x: { id: string }) => x.id);
  assert.equal(ids[0], prueba.datos.combinadas[0].id, 'la del día se conserva');

  const liga = basico.datos.ligas[0];
  await c.pedir('PUT', 'preferencias', { ligas: [liga] });
  const filtrado = await c.pedir('GET', 'combinadas');
  assert.deepEqual(filtrado.datos.combinadas.map((x: { id: string }) => x.id), ids, 'cambiar filtros no da combinadas extra');
  assert.equal((await c.pedir('GET', 'exportar')).estado, 403);

  await c.pedir('PUT', 'preferencias', { ligas: [] });
  await c.pedir('POST', 'suscripcion', { plan: 'pro' });
  const pro = await c.pedir('GET', 'combinadas');
  assert.equal(pro.datos.cupo, null);
  assert.ok(pro.datos.combinadas.length > 3);
  assert.equal((await c.pedir('POST', 'combinadas/medida', { objetivo: 10 })).estado, 200);
  const csv = await c.pedir('GET', 'exportar');
  assert.equal(csv.estado, 200);
  assert.match(csv.datos, /"objetivo";"cuota_total"/);
});

test('Las combinadas entregadas no exponen datos internos', async () => {
  const { c } = await registrar('interno@ejemplo.com');
  const r = await c.pedir('GET', 'combinadas');
  const texto = JSON.stringify(r.datos);
  assert.ok(!texto.includes('"sim"'));
  assert.ok(!texto.includes('"refs"'));
  assert.ok(!texto.includes('"hash"'));
});

test('Pausa: bloquea los análisis y no se puede acortar', async () => {
  const { c } = await registrar('pausa@ejemplo.com');
  assert.equal((await c.pedir('POST', 'pausa', { dias: 1 })).estado, 200);
  const r = await c.pedir('GET', 'combinadas');
  assert.equal(r.datos.bloqueo, 'pausa');
  assert.equal(r.datos.combinadas, undefined);
  assert.equal((await c.pedir('POST', 'pausa', { dias: 1 })).estado, 409);
});

test('Límite diario: bajarlo rige ya, subirlo rige mañana', async () => {
  const { c } = await registrar('limite@ejemplo.com');
  assert.equal((await c.pedir('PUT', 'limite', { minutos: 30 })).datos.rige, 'ahora');
  const subir = await c.pedir('PUT', 'limite', { minutos: 120 });
  assert.equal(subir.datos.rige, 'mañana');
  assert.equal(subir.datos.usuario.limiteMinutos, 30);
});

test('Historial público: no muestra las combinadas del día todavía en juego', async () => {
  const r = await new Cliente().pedir('GET', 'historial');
  assert.ok(r.datos.pendientes > 0);
  assert.equal(r.datos.registros.length, 0);
});

test('Petición desde otro sitio: rechazada', async () => {
  const { c } = await registrar('csrf@ejemplo.com');
  const r = await manejar(new Request(`${BASE}/api/pausa`, {
    method: 'POST', headers: { cookie: c.cookie, origin: 'https://otro-sitio.com', host: 'localhost', 'content-type': 'application/json' }, body: '{"dias":1}',
  }));
  assert.equal(r.status, 403);
});
