// Base de datos PostgreSQL.
//
// Producción: DATABASE_URL (Neon, Supabase, Vercel Postgres o cualquier Postgres).
// Desarrollo local sin DATABASE_URL: PGlite, un Postgres embebido que guarda en ./.datos-locales.

import { esProduccion } from './entorno';

type Fila = Record<string, unknown>;
interface Conexion {
  query(sql: string, params?: unknown[]): Promise<{ rows: Fila[] }>;
}

const MIGRACIONES = [
  `CREATE TABLE IF NOT EXISTS usuarios (
    id text PRIMARY KEY,
    email text UNIQUE NOT NULL,
    nombre text NOT NULL,
    nacimiento text NOT NULL,
    hash text NOT NULL,
    creado text NOT NULL,
    sesion integer NOT NULL DEFAULT 1,
    plan text NOT NULL DEFAULT 'prueba',
    vence_el text NOT NULL,
    estado text NOT NULL DEFAULT 'activa',
    comprado_el text,
    pausa_hasta text,
    limite_minutos integer,
    limite_pendiente jsonb,
    uso_dia text,
    uso_segundos integer NOT NULL DEFAULT 0,
    uso_ultimo bigint,
    ligas jsonb NOT NULL DEFAULT '[]',
    alertas jsonb NOT NULL DEFAULT '{"activas":false,"objetivo":20,"probMin":0.05}',
    mp_suscripcion text,
    suspendida boolean NOT NULL DEFAULT false
  )`,
  `CREATE TABLE IF NOT EXISTS pruebas_usadas (email_hash text PRIMARY KEY, creado text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS tokens_reset (hash text PRIMARY KEY, usuario_id text NOT NULL, expira bigint NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS partidos (
    id text PRIMARY KEY,
    inicio text NOT NULL,
    liga text NOT NULL,
    estado text NOT NULL DEFAULT 'programado',
    datos jsonb NOT NULL,
    actualizado text NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS partidos_inicio ON partidos (inicio)`,
  `CREATE TABLE IF NOT EXISTS historial (
    id text PRIMARY KEY,
    fecha text NOT NULL,
    estado text NOT NULL,
    datos jsonb NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS entregas (
    usuario_id text NOT NULL,
    dia text NOT NULL,
    combinada_id text NOT NULL,
    orden integer NOT NULL,
    datos jsonb NOT NULL,
    PRIMARY KEY (usuario_id, dia, combinada_id)
  )`,
  `CREATE TABLE IF NOT EXISTS pagos (
    id text PRIMARY KEY,
    usuario_id text,
    tipo text NOT NULL,
    estado text,
    datos jsonb,
    creado text NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS intentos (clave text PRIMARY KEY, cuenta integer NOT NULL, desde bigint NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS meta (clave text PRIMARY KEY, valor jsonb NOT NULL)`,
];

let conexion: Promise<Conexion> | null = null;

async function conectar(): Promise<Conexion> {
  const url = process.env.DATABASE_URL;
  let c: Conexion;
  if (url) {
    const { default: pg } = await import('pg');
    c = new pg.Pool({ connectionString: url, max: 3 });
  } else {
    if (esProduccion()) throw new Error('Falta configurar DATABASE_URL');
    // Import dinámico con nombre en variable: así no entra en el paquete de producción.
    const modulo = '@electric-sql/pglite';
    const { PGlite } = (await import(/* @vite-ignore */ modulo)) as typeof import('@electric-sql/pglite');
    const db = new PGlite(process.env.PGLITE_DIR ?? '.datos-locales');
    c = { query: (sql, params) => db.query<Fila>(sql, params) };
  }
  for (const sql of MIGRACIONES) await c.query(sql);
  return c;
}

export async function q<T = Fila>(sql: string, params: unknown[] = []): Promise<T[]> {
  conexion ??= conectar().catch((e) => {
    conexion = null;
    throw e;
  });
  const c = await conexion;
  return (await c.query(sql, params)).rows as T[];
}

export async function q1<T = Fila>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  return (await q<T>(sql, params))[0];
}

export async function leerMeta<T>(clave: string): Promise<T | undefined> {
  return (await q1<{ valor: T }>('SELECT valor FROM meta WHERE clave = $1', [clave]))?.valor;
}

export async function guardarMeta(clave: string, valor: unknown): Promise<void> {
  await q(
    'INSERT INTO meta (clave, valor) VALUES ($1, $2) ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor',
    [clave, JSON.stringify(valor)],
  );
}
