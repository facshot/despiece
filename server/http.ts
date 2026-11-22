// Utilidades HTTP sobre la API estándar Request/Response.

export class ErrorHttp extends Error {
  constructor(public estado: number, mensaje: string, public codigo?: string) {
    super(mensaje);
  }
}

export const json = (datos: unknown, estado = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(datos), {
    status: estado,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });

export async function cuerpo<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    const t = await req.text();
    return (t ? JSON.parse(t) : {}) as T;
  } catch {
    throw new ErrorHttp(400, 'El cuerpo de la petición no es JSON válido.');
  }
}

export function cookies(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const par of (req.headers.get('cookie') ?? '').split(';')) {
    const i = par.indexOf('=');
    if (i > 0) out[par.slice(0, i).trim()] = decodeURIComponent(par.slice(i + 1).trim());
  }
  return out;
}

export function ipDe(req: Request): string {
  return (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'local';
}

export const texto = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
