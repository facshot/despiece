// Contraseñas, sesiones y límite de intentos.

import { createHash, createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { q, q1 } from './db';
import { esProduccion, secreto } from './entorno';
import { cookies, ErrorHttp } from './http';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export async function hashear(password: string): Promise<string> {
  const salt = randomBytes(16);
  const h = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${h.toString('base64')}`;
}

export async function verificar(password: string, guardado: string): Promise<boolean> {
  const [alg, salt, hash] = guardado.split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const esperado = Buffer.from(hash, 'base64');
  const h = await scrypt(password, Buffer.from(salt, 'base64'), esperado.length);
  return timingSafeEqual(h, esperado);
}

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

// ---- Sesión: cookie firmada uid.version.expira.firma ----

const COOKIE = 'cl_sesion';
const DURACION_S = 30 * 24 * 3600;

const firmar = (s: string) => createHmac('sha256', secreto()).update(s).digest('base64url');

export function cookieSesion(uid: string, version: number): string {
  const exp = Math.floor(Date.now() / 1000) + DURACION_S;
  const datos = `${uid}.${version}.${exp}`;
  return `${COOKIE}=${datos}.${firmar(datos)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DURACION_S}${esProduccion() ? '; Secure' : ''}`;
}

export const cookieCierre = () => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${esProduccion() ? '; Secure' : ''}`;

/** Devuelve el id de usuario y la versión de sesión si la cookie es válida. */
export function leerSesion(req: Request): { uid: string; version: number } | null {
  const v = cookies(req)[COOKIE];
  if (!v) return null;
  const partes = v.split('.');
  if (partes.length !== 4) return null;
  const [uid, version, exp, firma] = partes;
  const esperada = firmar(`${uid}.${version}.${exp}`);
  if (firma.length !== esperada.length || !timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))) return null;
  if (Number(exp) * 1000 < Date.now()) return null;
  return { uid, version: Number(version) };
}

// ---- Límite de intentos (login, registro, recuperación) ----

export async function limitarIntentos(clave: string, max: number, ventanaMin: number): Promise<void> {
  const ahora = Date.now();
  const fila = await q1<{ cuenta: number; desde: string }>('SELECT cuenta, desde FROM intentos WHERE clave = $1', [clave]);
  if (!fila || ahora - Number(fila.desde) > ventanaMin * 60000) {
    await q(
      'INSERT INTO intentos (clave, cuenta, desde) VALUES ($1, 1, $2) ON CONFLICT (clave) DO UPDATE SET cuenta = 1, desde = $2',
      [clave, ahora],
    );
    return;
  }
  if (fila.cuenta >= max) throw new ErrorHttp(429, 'Demasiados intentos. Esperá unos minutos y volvé a probar.');
  await q('UPDATE intentos SET cuenta = cuenta + 1 WHERE clave = $1', [clave]);
}

export const limpiarIntentos = (clave: string) => q('DELETE FROM intentos WHERE clave = $1', [clave]);

// ---- Tokens de recuperación de contraseña ----

export async function crearTokenReset(uid: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await q('DELETE FROM tokens_reset WHERE usuario_id = $1 OR expira < $2', [uid, Date.now()]);
  await q('INSERT INTO tokens_reset (hash, usuario_id, expira) VALUES ($1, $2, $3)', [sha256(token), uid, Date.now() + 3600_000]);
  return token;
}

export async function consumirTokenReset(token: string): Promise<string | null> {
  const fila = await q1<{ usuario_id: string; expira: string }>('DELETE FROM tokens_reset WHERE hash = $1 RETURNING usuario_id, expira', [sha256(token)]);
  if (!fila || Number(fila.expira) < Date.now()) return null;
  return fila.usuario_id;
}
