// Suscripciones con Mercado Pago (API de preapproval).
//
// Flujo:
//  1. El usuario elige un plan: creamos una suscripción pendiente y lo mandamos a init_point.
//  2. Mercado Pago avisa al webhook. Nunca confiamos en el aviso: consultamos la
//     suscripción a la API y recién ahí activamos o damos de baja el plan.

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { MARCA, plan, type PlanId } from '../src/config';
import { q } from './db';
import { diaLocal, sumarDias, urlBase } from './entorno';
import { ErrorHttp } from './http';
import { actualizar, porId, type FilaUsuario } from './usuarios';

const API = 'https://api.mercadopago.com';
/** Días de gracia después de la fecha de cobro, por si el pago se demora. */
const GRACIA = 3;

interface Preapproval {
  id: string;
  status: 'pending' | 'authorized' | 'paused' | 'cancelled';
  external_reference: string;
  next_payment_date?: string;
  date_created?: string;
}

async function mp<T>(ruta: string, init: RequestInit = {}): Promise<T> {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new ErrorHttp(503, 'Los pagos todavía no están configurados.');
  const r = await fetch(`${API}${ruta}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error('Mercado Pago', ruta, r.status, JSON.stringify(datos));
    throw new ErrorHttp(502, 'Mercado Pago no respondió bien. Probá de nuevo en unos minutos.');
  }
  return datos as T;
}

/** Crea la suscripción y devuelve la URL de pago. */
export async function crearSuscripcion(u: FilaUsuario, id: PlanId, inicio?: string): Promise<string> {
  const p = plan(id);
  if (!p.precio) throw new ErrorHttp(400, 'Ese plan no se cobra.');
  const anual = p.periodo === 'año';
  const auto_recurring: Record<string, unknown> = {
    frequency: anual ? 12 : 1,
    frequency_type: 'months',
    transaction_amount: p.precio,
    currency_id: 'ARS',
  };
  if (inicio && inicio > diaLocal()) auto_recurring.start_date = new Date(`${inicio}T12:00:00-03:00`).toISOString();
  const r = await mp<{ id: string; init_point: string }>('/preapproval', {
    method: 'POST',
    body: JSON.stringify({
      reason: `${MARCA.nombre} ${p.nombre}`,
      external_reference: `${u.id}|${id}`,
      payer_email: u.email,
      back_url: `${urlBase()}/#/panel`,
      auto_recurring,
      status: 'pending',
    }),
  });
  await registrarEvento(r.id, u.id, 'suscripcion_creada', 'pending', { plan: id });
  return r.init_point;
}

export async function cancelarSuscripcion(id: string): Promise<void> {
  await mp(`/preapproval/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'cancelled' }) });
}

/** Derecho de arrepentimiento: reintegra los pagos de la suscripción. Devuelve cuántos se reintegraron. */
export async function reintegrar(preapprovalId: string): Promise<number> {
  const r = await mp<{ results?: { payment?: { id: number; status: string } }[] }>(
    `/authorized_payments/search?preapproval_id=${encodeURIComponent(preapprovalId)}`,
  );
  let n = 0;
  for (const ap of r.results ?? []) {
    const pago = ap.payment;
    if (!pago || pago.status !== 'approved') continue;
    await mp(`/v1/payments/${pago.id}/refunds`, { method: 'POST', headers: { 'x-idempotency-key': randomUUID() }, body: '{}' });
    n++;
  }
  return n;
}

/** Trae la suscripción de Mercado Pago y deja la cuenta como corresponde. */
export async function sincronizar(preapprovalId: string): Promise<void> {
  const s = await mp<Preapproval>(`/preapproval/${preapprovalId}`);
  const [uid, planId] = (s.external_reference ?? '').split('|') as [string, PlanId];
  const u = uid ? await porId(uid) : undefined;
  if (!u || !planId) return;
  await registrarEvento(`${s.id}-${s.status}-${s.next_payment_date ?? ''}`, u.id, 'sincronizacion', s.status, s);

  if (s.status === 'authorized') {
    // Si tenía otra suscripción (cambio de plan), se cancela la anterior.
    if (u.mp_suscripcion && u.mp_suscripcion !== s.id) {
      await cancelarSuscripcion(u.mp_suscripcion).catch((e) => console.error('No se pudo cancelar la suscripción anterior', e));
    }
    const proximo = s.next_payment_date ? diaLocal(new Date(s.next_payment_date)) : sumarDias(diaLocal(), plan(planId).dias);
    const nuevo = u.mp_suscripcion !== s.id;
    await actualizar(u.id, {
      plan: planId,
      estado: 'activa',
      mp_suscripcion: s.id,
      vence_el: sumarDias(proximo, GRACIA),
      ...(nuevo ? { comprado_el: diaLocal() } : {}),
    });
  } else if ((s.status === 'cancelled' || s.status === 'paused') && u.mp_suscripcion === s.id) {
    // Conserva el acceso hasta el final del período ya pagado.
    await actualizar(u.id, { estado: 'baja' });
  }
}

/** Activa un plan sin cobrar. Solo en desarrollo, cuando no hay token de Mercado Pago. */
export async function activarSimulado(u: FilaUsuario, id: PlanId): Promise<void> {
  await actualizar(u.id, { plan: id, estado: 'activa', comprado_el: diaLocal(), vence_el: sumarDias(diaLocal(), plan(id).dias), mp_suscripcion: `simulada-${randomUUID()}` });
}

async function registrarEvento(id: string, uid: string | null, tipo: string, estado: string, datos: unknown): Promise<void> {
  await q(
    'INSERT INTO pagos (id, usuario_id, tipo, estado, datos, creado) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING',
    [id, uid, tipo, estado, JSON.stringify(datos), new Date().toISOString()],
  );
}

/** Verifica la firma x-signature del webhook (si MP_WEBHOOK_SECRET está configurado). */
export function firmaValida(req: Request, dataId: string): boolean {
  const secreto = process.env.MP_WEBHOOK_SECRET;
  if (!secreto) return true;
  const firma = req.headers.get('x-signature') ?? '';
  const partes = Object.fromEntries(firma.split(',').map((p) => p.trim().split('=') as [string, string]));
  if (!partes.ts || !partes.v1) return false;
  const manifiesto = `id:${dataId.toLowerCase()};request-id:${req.headers.get('x-request-id') ?? ''};ts:${partes.ts};`;
  const esperado = createHmac('sha256', secreto).update(manifiesto).digest('hex');
  return esperado.length === partes.v1.length && timingSafeEqual(Buffer.from(esperado), Buffer.from(partes.v1));
}

/** Procesa un aviso del webhook. */
export async function procesarWebhook(req: Request, url: URL, cuerpo: Record<string, unknown>): Promise<void> {
  const tipo = String(cuerpo.type ?? url.searchParams.get('type') ?? url.searchParams.get('topic') ?? '');
  const data = (cuerpo.data ?? {}) as { id?: string | number };
  const dataId = String(data.id ?? url.searchParams.get('data.id') ?? url.searchParams.get('id') ?? '');
  if (!dataId) return;
  if (!firmaValida(req, dataId)) throw new ErrorHttp(401, 'Firma inválida');

  if (tipo === 'subscription_preapproval' || tipo === 'preapproval') {
    await sincronizar(dataId);
  } else if (tipo === 'subscription_authorized_payment' || tipo === 'authorized_payment') {
    const ap = await mp<{ preapproval_id?: string }>(`/authorized_payments/${dataId}`);
    if (ap.preapproval_id) await sincronizar(ap.preapproval_id);
  }
}
