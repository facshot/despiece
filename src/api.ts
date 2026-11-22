// Cliente de la API del servidor. La sesión viaja en una cookie HttpOnly.

import type { Combinada } from './motor/combinadas';
import type { Registro } from './motor/historial';
import type { UsuarioPublico } from '../server/usuarios';

export type Usuario = UsuarioPublico;

export class ErrorApi extends Error {
  constructor(public estado: number, mensaje: string, public codigo?: string) {
    super(mensaje);
  }
}

async function pedir<T>(metodo: string, ruta: string, datos?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`/api/${ruta}`, {
      method: metodo,
      credentials: 'same-origin',
      headers: datos !== undefined ? { 'content-type': 'application/json' } : {},
      body: datos !== undefined ? JSON.stringify(datos) : undefined,
    });
  } catch {
    throw new ErrorApi(0, 'No hay conexión. Revisá tu internet y probá de nuevo.');
  }
  const cuerpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErrorApi(r.status, cuerpo.error ?? 'Algo salió mal.', cuerpo.codigo);
  return cuerpo as T;
}

type ConUsuario = { usuario: Usuario };

export interface RespuestaCombinadas {
  bloqueo?: Usuario['bloqueo'];
  combinadas?: Combinada[];
  cupo?: number | null;
  masEnPlanesSuperiores?: number;
  alertas?: Combinada[];
  ligas?: string[];
  usuario: Usuario;
}

export interface Estado {
  fuente: { nombre: string; demo: boolean; actualizado: string } | null;
  demo: boolean;
  partidosProximos: number;
  pagosSimulados: boolean;
}

export const api = {
  yo: () => pedir<{ usuario: Usuario | null }>('GET', 'yo'),
  registro: (d: { nombre: string; email: string; password: string; nacimiento: string; mayor: boolean; terminos: boolean }) =>
    pedir<ConUsuario & { pruebaYaUsada: boolean }>('POST', 'registro', d),
  login: (email: string, password: string) => pedir<ConUsuario>('POST', 'login', { email, password }),
  logout: () => pedir<{ ok: true }>('POST', 'logout', {}),
  olvido: (email: string) => pedir<{ ok: true }>('POST', 'password/olvido', { email }),
  restablecer: (token: string, password: string) => pedir<ConUsuario>('POST', 'password/restablecer', { token, password }),
  cerrarCuenta: () => pedir<{ ok: true }>('DELETE', 'cuenta'),

  combinadas: () => pedir<RespuestaCombinadas>('GET', 'combinadas'),
  medida: (objetivo: number, maxPatas: number) => pedir<{ combinadas: Combinada[] }>('POST', 'combinadas/medida', { objetivo, maxPatas }),
  preferencias: (d: { ligas?: string[]; alertas?: Usuario['alertas'] }) => pedir<ConUsuario>('PUT', 'preferencias', d),

  uso: () => pedir<ConUsuario>('POST', 'uso', {}),
  pausa: (dias: number) => pedir<ConUsuario>('POST', 'pausa', { dias }),
  limite: (minutos: number | null) => pedir<ConUsuario & { rige: 'ahora' | 'mañana' }>('PUT', 'limite', { minutos }),

  suscribir: (plan: string) => pedir<{ url?: string; simulado?: boolean; usuario?: Usuario }>('POST', 'suscripcion', { plan }),
  confirmarPago: (preapprovalId: string) => pedir<{ ok: true }>('POST', 'suscripcion/confirmar', { preapprovalId }),
  baja: () => pedir<ConUsuario>('POST', 'suscripcion/baja', {}),
  arrepentimiento: () => pedir<ConUsuario & { reintegroManual: boolean }>('POST', 'suscripcion/arrepentimiento', {}),

  historial: () => pedir<{ registros: Registro[]; pendientes: number }>('GET', 'historial'),
  estado: () => pedir<Estado>('GET', 'estado'),
};

// ---- Estado de sesión compartido por las vistas ----

let actual: Usuario | null = null;
let cargado = false;

export const sesion = {
  get usuario() { return actual; },
  get cargado() { return cargado; },
  poner(u: Usuario | null) { actual = u; cargado = true; },
  async cargar() {
    try { actual = (await api.yo()).usuario; } catch { actual = null; }
    cargado = true;
    return actual;
  },
};
