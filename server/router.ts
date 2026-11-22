// API del servidor. Un único punto de entrada: manejar(Request) => Response.

import { randomUUID, timingSafeEqual } from 'node:crypto';
import { DIAS_ARREPENTIMIENTO, EDAD_MINIMA, MARCA, PLANES, type PlanId } from '../src/config';
import { nombreMercado } from '../src/motor/modelo';
import type { Registro } from '../src/motor/historial';
import { actualizarTodo } from './actualizar';
import { aMedida, alertasPara, combinadasPara, ligasDisponibles, partidosDisponibles } from './analisis';
import {
  consumirTokenReset, cookieCierre, cookieSesion, crearTokenReset, hashear, leerSesion, limitarIntentos, limpiarIntentos, sha256, verificar,
} from './auth';
import { enviarCorreo } from './correo';
import { leerMeta, q, q1 } from './db';
import { diaLocal, pagosSimulados, sumarDias, urlBase } from './entorno';
import { cuerpo, ErrorHttp, ipDe, json, texto } from './http';
import { activarSimulado, cancelarSuscripcion, crearSuscripcion, procesarWebhook, reintegrar, sincronizar } from './pagos';
import { actualizar, bloqueo, enPlazoDeArrepentimiento, pausada, porEmail, porId, publico, type FilaUsuario } from './usuarios';

interface Ctx { req: Request; url: URL; ip: string }
type Handler = (ctx: Ctx) => Promise<Response>;

// ---------- utilidades ----------

const vistaUsuario = (u: FilaUsuario) => publico(u, DIAS_ARREPENTIMIENTO);

async function usuario(req: Request): Promise<FilaUsuario> {
  const s = leerSesion(req);
  const u = s ? await porId(s.uid) : undefined;
  if (!u || u.sesion !== s!.version) throw new ErrorHttp(401, 'Tenés que iniciar sesión.', 'sin_sesion');
  return u;
}

/** Usuario que puede ver análisis ahora (no pausado, plan vigente, dentro del límite). */
async function usuarioHabilitado(req: Request): Promise<FilaUsuario> {
  const u = await usuario(req);
  const b = bloqueo(u);
  if (b) throw new ErrorHttp(403, 'Tu cuenta no puede ver análisis en este momento.', b);
  return u;
}

function edad(nacimiento: string): number {
  const hoy = diaLocal();
  const [a, m, d] = nacimiento.split('-').map(Number);
  const [ha, hm, hd] = hoy.split('-').map(Number);
  return ha - a - (hm < m || (hm === m && hd < d) ? 1 : 0);
}

const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 200;
const passwordValida = (p: string) => p.length >= 8 && p.length <= 200;

function csv(filas: (string | number)[][]): string {
  return '﻿' + filas.map((f) => f.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
}

// ---------- cuenta ----------

const registro: Handler = async ({ req, ip }) => {
  await limitarIntentos(`registro:${ip}`, 10, 60);
  const b = await cuerpo(req);
  const nombre = texto(b.nombre, 60);
  const email = texto(b.email).toLowerCase();
  const password = typeof b.password === 'string' ? b.password : '';
  const nacimiento = texto(b.nacimiento, 10);
  if (!nombre) throw new ErrorHttp(400, 'Escribí tu nombre.');
  if (!emailValido(email)) throw new ErrorHttp(400, 'Revisá el correo electrónico.');
  if (!passwordValida(password)) throw new ErrorHttp(400, 'La contraseña tiene que tener al menos 8 caracteres.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nacimiento) || edad(nacimiento) > 120) throw new ErrorHttp(400, 'Revisá la fecha de nacimiento.');
  if (edad(nacimiento) < EDAD_MINIMA) throw new ErrorHttp(403, `Tenés que ser mayor de ${EDAD_MINIMA} años para usar ${MARCA.nombre}.`);
  if (b.mayor !== true) throw new ErrorHttp(400, 'Tenés que confirmar que sos mayor de 18 años.');
  if (b.terminos !== true) throw new ErrorHttp(400, 'Tenés que aceptar los términos y condiciones.');
  if (await porEmail(email)) throw new ErrorHttp(409, 'Ya hay una cuenta con ese correo. Iniciá sesión.');

  // La prueba gratis es una sola por correo, aunque se cierre la cuenta.
  const emailHash = sha256(email);
  const yaUsoPrueba = !!(await q1('SELECT 1 FROM pruebas_usadas WHERE email_hash = $1', [emailHash]));
  const hoy = diaLocal();
  const id = randomUUID();
  await q(
    `INSERT INTO usuarios (id, email, nombre, nacimiento, hash, creado, vence_el, uso_dia) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, email, nombre, nacimiento, await hashear(password), new Date().toISOString(), yaUsoPrueba ? sumarDias(hoy, -1) : sumarDias(hoy, 7), hoy],
  );
  await q('INSERT INTO pruebas_usadas (email_hash, creado) VALUES ($1, $2) ON CONFLICT DO NOTHING', [emailHash, hoy]);
  const u = (await porId(id))!;
  return json({ usuario: vistaUsuario(u), pruebaYaUsada: yaUsoPrueba }, 201, { 'set-cookie': cookieSesion(id, u.sesion) });
};

const login: Handler = async ({ req, ip }) => {
  const b = await cuerpo(req);
  const email = texto(b.email).toLowerCase();
  const password = typeof b.password === 'string' ? b.password : '';
  await limitarIntentos(`login-ip:${ip}`, 30, 15);
  await limitarIntentos(`login:${email}`, 8, 15);
  const u = await porEmail(email);
  if (!u || !(await verificar(password, u.hash))) throw new ErrorHttp(401, 'Correo o contraseña incorrectos.');
  await limpiarIntentos(`login:${email}`);
  return json({ usuario: vistaUsuario(u) }, 200, { 'set-cookie': cookieSesion(u.id, u.sesion) });
};

const logout: Handler = async () => json({ ok: true }, 200, { 'set-cookie': cookieCierre() });

const yo: Handler = async ({ req }) => {
  const s = leerSesion(req);
  const u = s ? await porId(s.uid) : undefined;
  if (!u || u.sesion !== s!.version) return json({ usuario: null });
  return json({ usuario: vistaUsuario(u) });
};

const olvido: Handler = async ({ req, ip }) => {
  await limitarIntentos(`olvido:${ip}`, 5, 60);
  const email = texto((await cuerpo(req)).email).toLowerCase();
  const u = emailValido(email) ? await porEmail(email) : undefined;
  if (u) {
    const token = await crearTokenReset(u.id);
    const link = `${urlBase()}/#/restablecer?token=${token}`;
    await enviarCorreo(u.email, `Restablecer tu contraseña de ${MARCA.nombre}`,
      `<p>Hola ${u.nombre}:</p><p>Para elegir una contraseña nueva entrá a este enlace (vale 1 hora):</p><p><a href="${link}">${link}</a></p><p>Si no lo pediste, ignorá este correo.</p>`);
  }
  // Misma respuesta exista o no la cuenta, para no revelar qué correos están registrados.
  return json({ ok: true });
};

const restablecer: Handler = async ({ req, ip }) => {
  await limitarIntentos(`reset:${ip}`, 10, 60);
  const b = await cuerpo(req);
  const password = typeof b.password === 'string' ? b.password : '';
  if (!passwordValida(password)) throw new ErrorHttp(400, 'La contraseña tiene que tener al menos 8 caracteres.');
  const uid = await consumirTokenReset(texto(b.token, 100));
  if (!uid) throw new ErrorHttp(400, 'El enlace venció o ya se usó. Pedí uno nuevo.');
  const u = (await porId(uid))!;
  // Cambiar la contraseña cierra todas las sesiones abiertas.
  await actualizar(uid, { hash: await hashear(password), sesion: u.sesion + 1 });
  return json({ usuario: vistaUsuario({ ...u, sesion: u.sesion + 1 }) }, 200, { 'set-cookie': cookieSesion(uid, u.sesion + 1) });
};

const cerrarCuenta: Handler = async ({ req }) => {
  const u = await usuario(req);
  if (u.mp_suscripcion && u.estado === 'activa' && !u.mp_suscripcion.startsWith('simulada-')) await cancelarSuscripcion(u.mp_suscripcion);
  await q('DELETE FROM entregas WHERE usuario_id = $1', [u.id]);
  await q('DELETE FROM tokens_reset WHERE usuario_id = $1', [u.id]);
  await q('DELETE FROM usuarios WHERE id = $1', [u.id]);
  return json({ ok: true }, 200, { 'set-cookie': cookieCierre() });
};

// ---------- análisis ----------

const combinadas: Handler = async ({ req }) => {
  const u = await usuario(req);
  const b = bloqueo(u);
  if (b) return json({ bloqueo: b, usuario: vistaUsuario(u) });
  const [r, alertas, ligas] = await Promise.all([combinadasPara(u), alertasPara(u), ligasDisponibles()]);
  return json({ ...r, alertas, ligas, usuario: vistaUsuario(u) });
};

const medida: Handler = async ({ req }) => {
  const u = await usuarioHabilitado(req);
  if (!PLANES.find((p) => p.id === u.plan)?.aMedida) throw new ErrorHttp(403, 'Las combinadas a medida son del plan Pro.', 'plan');
  const b = await cuerpo(req);
  const objetivo = Number(b.objetivo);
  const maxPatas = Math.round(Number(b.maxPatas) || 6);
  if (!(objetivo >= 1.5 && objetivo <= 500)) throw new ErrorHttp(400, 'El objetivo tiene que estar entre x1,5 y x500.');
  if (!(maxPatas >= 1 && maxPatas <= 10)) throw new ErrorHttp(400, 'Entre 1 y 10 selecciones.');
  return json({ combinadas: await aMedida(u, objetivo, maxPatas) });
};

const exportar: Handler = async ({ req }) => {
  const u = await usuarioHabilitado(req);
  if (!PLANES.find((p) => p.id === u.plan)?.exportar) throw new ErrorHttp(403, 'Exportar es del plan Pro.', 'plan');
  const { combinadas: lista } = await combinadasPara(u);
  const filas: (string | number)[][] = [['objetivo', 'cuota_total', 'prob_estimada', 'liga', 'fecha', 'partido', 'seleccion', 'cuota', 'prob']];
  for (const c of lista) for (const s of c.selecciones)
    filas.push([c.objetivo, c.cuota.toFixed(2), c.prob.toFixed(4), s.liga, s.fecha, `${s.local} vs ${s.visitante}`, nombreMercado(s.mercado, s), s.cuota, s.prob.toFixed(4)]);
  return new Response(csv(filas), {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="analisis.csv"', 'cache-control': 'no-store' },
  });
};

const preferencias: Handler = async ({ req }) => {
  const u = await usuario(req);
  const b = await cuerpo(req);
  const cambios: Partial<FilaUsuario> = {};
  if (Array.isArray(b.ligas)) {
    const validas = new Set(await ligasDisponibles());
    cambios.ligas = b.ligas.filter((l): l is string => typeof l === 'string' && validas.has(l));
  }
  if (b.alertas && typeof b.alertas === 'object') {
    const a = b.alertas as Record<string, unknown>;
    const objetivo = Number(a.objetivo);
    const probMin = Number(a.probMin);
    cambios.alertas = {
      activas: a.activas === true,
      objetivo: objetivo >= 1.5 && objetivo <= 500 ? objetivo : 20,
      probMin: probMin > 0 && probMin < 1 ? probMin : 0.05,
    };
  }
  await actualizar(u.id, cambios);
  return json({ usuario: vistaUsuario({ ...u, ...cambios }) });
};

// ---------- juego responsable ----------

/** Latido del panel: suma el tiempo de uso para el límite diario. */
const uso: Handler = async ({ req }) => {
  const u = await usuario(req);
  const ahora = Date.now();
  const ultimo = Number(u.uso_ultimo ?? 0);
  // Se suma como máximo 20 segundos por latido, aunque el navegador mande muchos.
  const suma = Math.max(0, Math.min(20, Math.round((ahora - ultimo) / 1000)));
  const segundos = bloqueo(u) ? u.uso_segundos : u.uso_segundos + (ultimo ? suma : 0);
  await actualizar(u.id, { uso_segundos: segundos, uso_ultimo: ahora });
  return json({ usuario: vistaUsuario({ ...u, uso_segundos: segundos }) });
};

const pausa: Handler = async ({ req }) => {
  const u = await usuario(req);
  const dias = Number((await cuerpo(req)).dias);
  if (![1, 7, 30].includes(dias)) throw new ErrorHttp(400, 'La pausa puede ser de 1, 7 o 30 días.');
  if (pausada(u)) throw new ErrorHttp(409, 'Tu cuenta ya está en pausa.');
  const hasta = new Date(Date.now() + dias * 86400_000).toISOString();
  await actualizar(u.id, { pausa_hasta: hasta });
  return json({ usuario: vistaUsuario({ ...u, pausa_hasta: hasta }) });
};

const limite: Handler = async ({ req }) => {
  const u = await usuario(req);
  const v = (await cuerpo(req)).minutos;
  const valor = v === null ? null : Number(v);
  if (valor !== null && ![15, 30, 60, 120].includes(valor)) throw new ErrorHttp(400, 'Límite no válido.');
  const actual = u.limite_minutos;
  const masEstricto = valor !== null && (actual === null || valor <= actual);
  const cambios: Partial<FilaUsuario> = masEstricto
    ? { limite_minutos: valor, limite_pendiente: null }
    : { limite_pendiente: { valor, desde: sumarDias(diaLocal(), 1) } };
  await actualizar(u.id, cambios);
  return json({ usuario: vistaUsuario({ ...u, ...cambios }), rige: masEstricto ? 'ahora' : 'mañana' });
};

// ---------- suscripción ----------

const suscribir: Handler = async ({ req }) => {
  const u = await usuario(req);
  if (u.suspendida) throw new ErrorHttp(403, 'Tu cuenta está suspendida.');
  const id = texto((await cuerpo(req)).plan, 20) as PlanId;
  const p = PLANES.find((x) => x.id === id);
  if (!p || !p.precio) throw new ErrorHttp(400, 'Plan no válido.');
  if (u.plan === id && u.estado === 'activa' && u.mp_suscripcion) throw new ErrorHttp(409, 'Ya tenés ese plan.');
  if (pagosSimulados()) {
    await activarSimulado(u, id);
    return json({ simulado: true, usuario: vistaUsuario((await porId(u.id))!) });
  }
  // Si se dio de baja pero todavía tiene días pagos del mismo plan, la nueva suscripción empieza al terminar.
  const inicio = u.estado === 'baja' && u.plan === id && u.vence_el > diaLocal() ? u.vence_el : undefined;
  return json({ url: await crearSuscripcion(u, id, inicio) });
};

/** Al volver de Mercado Pago: consulta la suscripción sin esperar el webhook. */
const confirmar: Handler = async ({ req }) => {
  const u = await usuario(req);
  const id = texto((await cuerpo(req)).preapprovalId, 100);
  if (!/^[\w-]+$/.test(id)) throw new ErrorHttp(400, 'Identificador no válido.');
  // sincronizar() solo modifica la cuenta indicada por Mercado Pago en external_reference.
  if (!pagosSimulados()) await sincronizar(id);
  return json({ ok: true, usuario: vistaUsuario((await porId(u.id))!) });
};

const baja: Handler = async ({ req }) => {
  const u = await usuario(req);
  if (u.estado === 'baja') return json({ usuario: vistaUsuario(u) });
  if (u.mp_suscripcion && !u.mp_suscripcion.startsWith('simulada-')) await cancelarSuscripcion(u.mp_suscripcion);
  await actualizar(u.id, { estado: 'baja' });
  return json({ usuario: vistaUsuario({ ...u, estado: 'baja' }) });
};

const arrepentimiento: Handler = async ({ req }) => {
  const u = await usuario(req);
  if (!enPlazoDeArrepentimiento(u, DIAS_ARREPENTIMIENTO)) throw new ErrorHttp(400, `Pasaron más de ${DIAS_ARREPENTIMIENTO} días desde la compra.`);
  let reintegros = 0;
  let manual = false;
  if (u.mp_suscripcion && !u.mp_suscripcion.startsWith('simulada-')) {
    if (u.estado === 'activa') await cancelarSuscripcion(u.mp_suscripcion);
    try {
      reintegros = await reintegrar(u.mp_suscripcion);
    } catch (e) {
      console.error('Reintegro automático fallido', u.id, e);
      manual = true;
    }
  }
  await q('INSERT INTO pagos (id, usuario_id, tipo, estado, datos, creado) VALUES ($1, $2, $3, $4, $5, $6)',
    [randomUUID(), u.id, 'arrepentimiento', manual ? 'reintegro_manual' : 'reintegrado', JSON.stringify({ suscripcion: u.mp_suscripcion, reintegros }), new Date().toISOString()]);
  const cambios: Partial<FilaUsuario> = { plan: 'prueba', estado: 'baja', vence_el: sumarDias(diaLocal(), -1), comprado_el: null, mp_suscripcion: null };
  await actualizar(u.id, cambios);
  return json({ usuario: vistaUsuario({ ...u, ...cambios }), reintegroManual: manual });
};

const webhookMP: Handler = async ({ req, url }) => {
  await procesarWebhook(req, url, await cuerpo(req));
  return json({ ok: true });
};

// ---------- público ----------

const historial: Handler = async () => {
  const filas = await q<{ datos: Registro }>("SELECT datos FROM historial WHERE estado <> 'pendiente' ORDER BY fecha DESC, id DESC");
  const pendientes = await q1<{ n: string | number }>("SELECT count(*) AS n FROM historial WHERE estado = 'pendiente'");
  return json({ registros: filas.map((f) => f.datos), pendientes: Number(pendientes?.n ?? 0) });
};

const estado: Handler = async () => {
  const fuente = await leerMeta<{ nombre: string; demo: boolean; actualizado: string }>('fuente');
  const proximos = (await partidosDisponibles()).length;
  return json({ fuente: fuente ?? null, demo: fuente?.demo ?? true, partidosProximos: proximos, pagosSimulados: pagosSimulados() });
};

const cron: Handler = async ({ req }) => {
  const secreto = process.env.CRON_SECRET;
  const recibido = req.headers.get('authorization') ?? '';
  const esperado = `Bearer ${secreto}`;
  if (!secreto || recibido.length !== esperado.length || !timingSafeEqual(Buffer.from(recibido), Buffer.from(esperado))) {
    throw new ErrorHttp(401, 'No autorizado');
  }
  return json(await actualizarTodo());
};

// ---------- tabla de rutas ----------

const RUTAS: Record<string, Handler> = {
  'POST /api/registro': registro,
  'POST /api/login': login,
  'POST /api/logout': logout,
  'GET /api/yo': yo,
  'POST /api/password/olvido': olvido,
  'POST /api/password/restablecer': restablecer,
  'DELETE /api/cuenta': cerrarCuenta,
  'GET /api/combinadas': combinadas,
  'POST /api/combinadas/medida': medida,
  'GET /api/exportar': exportar,
  'PUT /api/preferencias': preferencias,
  'POST /api/uso': uso,
  'POST /api/pausa': pausa,
  'PUT /api/limite': limite,
  'POST /api/suscripcion': suscribir,
  'POST /api/suscripcion/confirmar': confirmar,
  'POST /api/suscripcion/baja': baja,
  'POST /api/suscripcion/arrepentimiento': arrepentimiento,
  'POST /api/webhooks/mercadopago': webhookMP,
  'GET /api/historial': historial,
  'GET /api/estado': estado,
  'GET /api/cron/actualizar': cron,
};

/** Rutas que reciben llamadas de otros sitios (no se les exige el mismo origen). */
const EXTERNAS = new Set(['/api/webhooks/mercadopago', '/api/cron/actualizar']);

export async function manejar(req: Request): Promise<Response> {
  const url = new URL(req.url);
  // Vercel reescribe /api/* a /api?ruta=*: se reconstruye la ruta original.
  const ruta = url.searchParams.get('ruta');
  const path = (ruta !== null ? `/api/${ruta}` : url.pathname).replace(/\/+$/, '');
  const handler = RUTAS[`${req.method} ${path}`];
  try {
    if (!handler) throw new ErrorHttp(404, 'No existe esa ruta.');
    // Protección CSRF: las peticiones que cambian algo tienen que venir de este mismo sitio.
    if (req.method !== 'GET' && !EXTERNAS.has(path)) {
      const origen = req.headers.get('origin');
      const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
      if (origen && host && new URL(origen).host !== host) throw new ErrorHttp(403, 'Origen no permitido.');
      if (!(req.headers.get('content-type') ?? '').includes('application/json') && req.method !== 'DELETE') {
        throw new ErrorHttp(415, 'Se espera JSON.');
      }
    }
    return await handler({ req, url, ip: ipDe(req) });
  } catch (e) {
    if (e instanceof ErrorHttp) return json({ error: e.message, codigo: e.codigo }, e.estado);
    console.error(e);
    return json({ error: 'Error interno. Probá de nuevo en unos minutos.' }, 500);
  }
}
