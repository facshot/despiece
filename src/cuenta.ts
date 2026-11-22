// Cuenta del usuario.
//
// DEMO: se guarda solo en este navegador (localStorage). Para vender hace falta
// un servidor con cuentas reales, cobro (Mercado Pago o Stripe) y los límites de
// plan aplicados del lado del servidor: en el navegador se pueden saltear.

import { DIAS_ARREPENTIMIENTO, EDAD_MINIMA, plan, type PlanId } from './config';

export interface Cuenta {
  nombre: string;
  email: string;
  nacimiento: string;
  creada: string;
  plan: PlanId;
  /** Fin de la prueba o del período pago (`AAAA-MM-DD`). */
  venceEl: string;
  /** Inicio del período pago actual, para el derecho de arrepentimiento. */
  compradoEl?: string;
  estado: 'activa' | 'baja';
  /** Pausa voluntaria hasta esta fecha y hora (ISO). */
  pausaHasta?: string;
  /** Minutos de uso por día; null = sin límite. */
  limiteMinutos: number | null;
  /** Los aumentos del límite se aplican recién al día siguiente. */
  limitePendiente?: { valor: number | null; desde: string };
  uso: { dia: string; segundos: number };
  ligas: string[];
  alertas: { activas: boolean; objetivo: number; probMin: number };
}

const CLAVE = 'cuotalab:cuenta';

export const hoy = (d = new Date()) => {
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};
export const sumarDias = (dia: string, n: number) => {
  const d = new Date(`${dia}T12:00:00`);
  d.setDate(d.getDate() + n);
  return hoy(d);
};
const diasEntre = (a: string, b: string) =>
  Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86400000);

export function edad(nacimiento: string, ref = new Date()): number {
  const n = new Date(`${nacimiento}T12:00:00`);
  let e = ref.getFullYear() - n.getFullYear();
  const m = ref.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < n.getDate())) e--;
  return e;
}

export const esMayor = (nacimiento: string) => edad(nacimiento) >= EDAD_MINIMA;

export function leer(): Cuenta | null {
  try {
    const raw = localStorage.getItem(CLAVE);
    if (!raw) return null;
    const c = JSON.parse(raw) as Cuenta;
    return normalizar(c);
  } catch {
    return null;
  }
}

export function guardar(c: Cuenta): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(c));
  } catch {
    /* sin almacenamiento: la sesión dura lo que dure la pestaña */
  }
}

export function eliminar(): void {
  try { localStorage.removeItem(CLAVE); } catch { /* nada */ }
}

/** Aplica cambios que dependen de la fecha: nuevo día de uso, límite pendiente. */
function normalizar(c: Cuenta): Cuenta {
  const d = hoy();
  if (c.uso.dia !== d) c.uso = { dia: d, segundos: 0 };
  if (c.limitePendiente && c.limitePendiente.desde <= d) {
    c.limiteMinutos = c.limitePendiente.valor;
    delete c.limitePendiente;
  }
  if (c.pausaHasta && new Date(c.pausaHasta) <= new Date()) delete c.pausaHasta;
  return c;
}

export function crear(datos: { nombre: string; email: string; nacimiento: string }): Cuenta {
  if (!esMayor(datos.nacimiento)) throw new Error('menor');
  const d = hoy();
  const c: Cuenta = {
    ...datos, creada: d, plan: 'prueba', venceEl: sumarDias(d, plan('prueba').dias), estado: 'activa',
    limiteMinutos: null, uso: { dia: d, segundos: 0 }, ligas: [],
    alertas: { activas: false, objetivo: 20, probMin: 0.05 },
  };
  guardar(c);
  return c;
}

export const vencida = (c: Cuenta) => c.venceEl < hoy();
export const pausada = (c: Cuenta) => !!c.pausaHasta && new Date(c.pausaHasta) > new Date();
export const limiteAlcanzado = (c: Cuenta) => c.limiteMinutos !== null && c.uso.segundos >= c.limiteMinutos * 60;
export const puedeUsar = (c: Cuenta) => c.estado === 'activa' && !vencida(c) && !pausada(c) && !limiteAlcanzado(c);

/** DEMO: simula el pago. Acá va la integración con Mercado Pago o Stripe. */
export function contratar(c: Cuenta, id: PlanId): void {
  const d = hoy();
  c.plan = id;
  c.estado = 'activa';
  c.compradoEl = d;
  c.venceEl = sumarDias(d, plan(id).dias);
  guardar(c);
}

/** Baja en un clic: corta la renovación automática. El acceso sigue hasta el fin del período pago. */
export function darDeBaja(c: Cuenta): void {
  c.estado = 'baja';
  guardar(c);
}

export function reactivar(c: Cuenta): void {
  c.estado = 'activa';
  guardar(c);
}

export function enPlazoDeArrepentimiento(c: Cuenta): boolean {
  return !!c.compradoEl && c.plan !== 'prueba' && diasEntre(c.compradoEl, hoy()) <= DIAS_ARREPENTIMIENTO;
}

/** Derecho de arrepentimiento: se anula la compra y se reintegra el total. */
export function arrepentirse(c: Cuenta): void {
  c.plan = 'prueba';
  c.venceEl = hoy();
  delete c.compradoEl;
  c.estado = 'baja';
  guardar(c);
}

export function pausar(c: Cuenta, dias: number): void {
  c.pausaHasta = new Date(Date.now() + dias * 86400000).toISOString();
  guardar(c);
}

/** Bajar el límite rige ya; subirlo o quitarlo rige desde mañana. */
export function cambiarLimite(c: Cuenta, valor: number | null): 'ahora' | 'mañana' {
  const actual = c.limiteMinutos;
  const esMasEstricto = valor !== null && (actual === null || valor <= actual);
  if (esMasEstricto) {
    c.limiteMinutos = valor;
    delete c.limitePendiente;
    guardar(c);
    return 'ahora';
  }
  c.limitePendiente = { valor, desde: sumarDias(hoy(), 1) };
  guardar(c);
  return 'mañana';
}

export function sumarUso(c: Cuenta, segundos: number): void {
  normalizar(c);
  c.uso.segundos += segundos;
  guardar(c);
}
