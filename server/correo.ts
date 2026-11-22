// Envío de correos con Resend (https://resend.com). Sin RESEND_API_KEY, en
// desarrollo se muestran en la consola.

import { MARCA } from '../src/config';
import { esProduccion } from './entorno';

export async function enviarCorreo(para: string, asunto: string, html: string): Promise<void> {
  const clave = process.env.RESEND_API_KEY;
  if (!clave) {
    if (esProduccion()) throw new Error('Falta RESEND_API_KEY para enviar correos');
    console.log(`\n[correo a ${para}] ${asunto}\n${html.replace(/<[^>]+>/g, ' ')}\n`);
    return;
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${clave}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: process.env.CORREO_REMITENTE ?? `${MARCA.nombre} <no-responder@example.com>`, to: [para], subject: asunto, html }),
  });
  if (!r.ok) throw new Error(`Resend respondió ${r.status}: ${await r.text()}`);
}
