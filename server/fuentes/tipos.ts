import type { Partido } from '../../src/motor/modelo';

/** Partido tal como se guarda: con la hora de inicio en UTC para comparar. */
export interface PartidoGuardado extends Partido {
  /** Inicio en ISO UTC. */
  inicio: string;
  /** Solo en la fuente simulada: goles esperados reales, para inventar el resultado. */
  sim?: { local: number; visitante: number };
}

export type EstadoPartido =
  | { estado: 'final'; resultado: { local: number; visitante: number } }
  | { estado: 'suspendido' }
  | { estado: 'pendiente' };

export interface Fuente {
  nombre: string;
  /** true si los datos son inventados (la web lo avisa). */
  demo: boolean;
  /** Partidos con cuotas de los próximos días. */
  proximos(dias: number): Promise<PartidoGuardado[]>;
  /** Estado de partidos ya jugados o en juego. */
  resultados(partidos: PartidoGuardado[]): Promise<Map<string, EstadoPartido>>;
}
