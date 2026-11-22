// Cuentas de usuario y reglas de acceso (plan, pausa, límite diario).

import { plan, type PlanId } from '../src/config';
import { q, q1 } from './db';
import { diaLocal, sumarDias } from './entorno';

export interface Alertas { activas: boolean; objetivo: number; probMin: number }

export interface FilaUsuario {
  id: string;
  email: string;
  nombre: string;
  nacimiento: string;
  hash: string;
  creado: string;
  sesion: number;
  plan: PlanId;
  vence_el: string;
  estado: 'activa' | 'baja';
  comprado_el: string | null;
  pausa_hasta: string | null;
  limite_minutos: number | null;
  limite_pendiente: { valor: number | null; desde: string } | null;
  uso_dia: string | null;
  uso_segundos: number;
  uso_ultimo: string | number | null;
  ligas: string[];
  alertas: Alertas;
  mp_suscripcion: string | null;
  suspendida: boolean;
}

export type Bloqueo = 'suspendida' | 'pausa' | 'vencida' | 'limite' | null;

export async function porId(id: string): Promise<FilaUsuario | undefined> {
  const u = await q1<FilaUsuario>('SELECT * FROM usuarios WHERE id = $1', [id]);
  return u && normalizar(u);
}

export async function porEmail(email: string): Promise<FilaUsuario | undefined> {
  const u = await q1<FilaUsuario>('SELECT * FROM usuarios WHERE email = $1', [email.toLowerCase()]);
  return u && normalizar(u);
}

/** Cambios que dependen de la fecha: nuevo día de uso, límite pendiente, fin de pausa. */
async function normalizar(u: FilaUsuario): Promise<FilaUsuario> {
  const hoy = diaLocal();
  const cambios: Partial<FilaUsuario> = {};
  if (u.uso_dia !== hoy) Object.assign(cambios, { uso_dia: hoy, uso_segundos: 0 });
  if (u.limite_pendiente && u.limite_pendiente.desde <= hoy) Object.assign(cambios, { limite_minutos: u.limite_pendiente.valor, limite_pendiente: null });
  if (u.pausa_hasta && new Date(u.pausa_hasta) <= new Date()) cambios.pausa_hasta = null;
  if (Object.keys(cambios).length) await actualizar(u.id, cambios);
  return { ...u, ...cambios };
}

const JSONB = new Set(['limite_pendiente', 'ligas', 'alertas']);

export async function actualizar(id: string, cambios: Partial<FilaUsuario>): Promise<void> {
  const claves = Object.keys(cambios) as (keyof FilaUsuario)[];
  if (!claves.length) return;
  const sets = claves.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const valores = claves.map((k) => (JSONB.has(k) && cambios[k] !== null ? JSON.stringify(cambios[k]) : cambios[k]));
  await q(`UPDATE usuarios SET ${sets} WHERE id = $1`, [id, ...valores]);
}

export const vencida = (u: FilaUsuario) => u.vence_el < diaLocal();
export const pausada = (u: FilaUsuario) => !!u.pausa_hasta && new Date(u.pausa_hasta) > new Date();
export const limiteAlcanzado = (u: FilaUsuario) => u.limite_minutos !== null && u.uso_segundos >= u.limite_minutos * 60;

export function bloqueo(u: FilaUsuario): Bloqueo {
  if (u.suspendida) return 'suspendida';
  if (pausada(u)) return 'pausa';
  if (vencida(u)) return 'vencida';
  if (limiteAlcanzado(u)) return 'limite';
  return null;
}

export function enPlazoDeArrepentimiento(u: FilaUsuario, dias: number): boolean {
  if (!u.comprado_el || u.plan === 'prueba') return false;
  return sumarDias(u.comprado_el, dias) >= diaLocal();
}

/** Lo que ve el navegador del usuario: nunca el hash ni datos internos. */
export function publico(u: FilaUsuario, dias: number) {
  return {
    nombre: u.nombre,
    email: u.email,
    plan: u.plan,
    venceEl: u.vence_el,
    estado: u.estado,
    pausaHasta: u.pausa_hasta,
    limiteMinutos: u.limite_minutos,
    limitePendiente: u.limite_pendiente,
    usoSegundos: u.uso_segundos,
    ligas: u.ligas,
    alertas: u.alertas,
    bloqueo: bloqueo(u),
    arrepentimiento: enPlazoDeArrepentimiento(u, dias),
    suscripcionActiva: !!u.mp_suscripcion && u.estado === 'activa',
    funciones: (({ combinadasPorDia, filtrosLiga, historialCompleto, aMedida, alertas, exportar }) => ({
      combinadasPorDia: combinadasPorDia === Infinity ? null : combinadasPorDia, filtrosLiga, historialCompleto, aMedida, alertas, exportar,
    }))(plan(u.plan)),
  };
}

export type UsuarioPublico = ReturnType<typeof publico>;
