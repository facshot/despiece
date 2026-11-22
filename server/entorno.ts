// Variables de entorno. Ver .env.example.

export const esProduccion = () => process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';

export function secreto(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (esProduccion()) throw new Error('SESSION_SECRET falta o tiene menos de 32 caracteres');
  return 'secreto-de-desarrollo-local-no-usar-en-produccion';
}

/** URL pública del sitio, para links de correo y de vuelta de Mercado Pago. */
export const urlBase = () => (process.env.URL_BASE ?? 'http://localhost:5173').replace(/\/$/, '');

/** Pagos simulados: solo fuera de producción, para probar sin Mercado Pago. */
export const pagosSimulados = () => !esProduccion() && !process.env.MP_ACCESS_TOKEN;

/** Zona horaria del negocio: define qué es "hoy" para los límites diarios. */
export const ZONA = 'America/Argentina/Buenos_Aires';

export function diaLocal(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function sumarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Fecha y hora local `AAAA-MM-DDTHH:MM` en la zona del negocio. */
export function fechaHoraLocal(d: Date): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(d).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
