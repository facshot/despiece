import type { Mercado, Partido, StatsEquipo } from '../../src/motor/modelo';

/** Cuotas que ofrece una casa para un partido. */
export interface OfertaCasa {
  /** Nombre normalizado de la casa (solo uso interno: nunca se muestra). */
  casa: string;
  cuotas: Partial<Record<Mercado, number>>;
}

/** Un partido tal como lo entrega una fuente, antes de cruzarlo con las demás. */
export interface PartidoBruto {
  /** Fuente que lo aportó (id de Fuente). */
  fuente: string;
  /** Identificador del partido dentro de esa fuente. */
  ref: string;
  liga: string;
  /** Inicio en ISO UTC. */
  inicio: string;
  local: string;
  visitante: string;
  stats?: { local: StatsEquipo; visitante: StatsEquipo };
  ofertas: OfertaCasa[];
  /** Cuándo publicó la fuente esas cuotas (ISO), si se sabe. */
  tomadas?: string;
  /** Solo en la fuente simulada: goles esperados reales. */
  sim?: { local: number; visitante: number };
}

/** Partido consolidado y guardado en la base. */
export interface PartidoGuardado extends Partido {
  /** Inicio en ISO UTC. */
  inicio: string;
  /** Referencia del partido en cada fuente: { 'football-data': '…', 'api-football': '…' }. */
  refs: Record<string, string>;
  sim?: { local: number; visitante: number };
}

export type EstadoPartido =
  | { estado: 'final'; resultado: { local: number; visitante: number } }
  | { estado: 'suspendido' }
  | { estado: 'pendiente' };

export interface Fuente {
  /** Identificador estable: 'football-data', 'api-football', 'simulada'. */
  id: string;
  /** Nombre para mostrar como atribución. */
  nombre: string;
  /** true si los datos son inventados (la web lo avisa). */
  demo: boolean;
  /** Partidos con cuotas de los próximos días. */
  proximos(dias: number): Promise<PartidoBruto[]>;
  /** Estado de los partidos que tienen referencia en esta fuente, por id de partido guardado. */
  resultados(partidos: PartidoGuardado[]): Promise<Map<string, EstadoPartido>>;
}
