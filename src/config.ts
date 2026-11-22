// Todo lo que hay que ajustar antes de vender está acá: nombre, precios y textos legales.

export const MARCA = {
  /** Nombre neutro de análisis. Cambialo acá y se actualiza en toda la web. */
  nombre: 'Cuotalab',
  lema: 'Análisis de cuotas de fútbol con datos',
  /** Jurisdicción para los términos (a confirmar con el abogado). */
  jurisdiccion: 'Tribunales de San Miguel de Tucumán',
  contacto: '[correo de contacto a completar]',
};

export type PlanId = 'prueba' | 'basico' | 'pro' | 'pro_anual';

export interface Plan {
  id: PlanId;
  nombre: string;
  /** Precio en ARS. 0 = gratis. */
  precio: number;
  periodo: 'mes' | 'año' | '7 días';
  dias: number;
  combinadasPorDia: number;
  filtrosLiga: boolean;
  historialCompleto: boolean;
  aMedida: boolean;
  alertas: boolean;
  exportar: boolean;
  incluye: string[];
  nota?: string;
}

/** Precios de referencia: ajustalos al mercado. Son fijos y no dependen de lo que gane o pierda el usuario. */
export const PLANES: Plan[] = [
  {
    id: 'prueba', nombre: 'Prueba', precio: 0, periodo: '7 días', dias: 7,
    combinadasPorDia: 1, filtrosLiga: false, historialCompleto: false, aMedida: false, alertas: false, exportar: false,
    incluye: ['1 combinada sugerida por día', 'Historial público'],
  },
  {
    id: 'basico', nombre: 'Básico', precio: 9900, periodo: 'mes', dias: 30,
    combinadasPorDia: 3, filtrosLiga: true, historialCompleto: true, aMedida: false, alertas: false, exportar: false,
    incluye: ['3 combinadas por día', 'Filtros por liga', 'Historial completo con filtros'],
  },
  {
    id: 'pro', nombre: 'Pro', precio: 24900, periodo: 'mes', dias: 30,
    combinadasPorDia: Infinity, filtrosLiga: true, historialCompleto: true, aMedida: true, alertas: true, exportar: true,
    incluye: ['Combinadas ilimitadas', 'Combinadas a medida («buscame x20»)', 'Alertas', 'Exportar análisis'],
  },
  {
    id: 'pro_anual', nombre: 'Pro anual', precio: 249000, periodo: 'año', dias: 365,
    combinadasPorDia: Infinity, filtrosLiga: true, historialCompleto: true, aMedida: true, alertas: true, exportar: true,
    incluye: ['Todo lo de Pro', '2 meses bonificados'],
    nota: 'Equivale a 20.750 por mes',
  },
];

export const plan = (id: PlanId) => PLANES.find((p) => p.id === id) as Plan;

export const EDAD_MINIMA = 18;
/** Días del derecho de arrepentimiento (Ley 24.240). */
export const DIAS_ARREPENTIMIENTO = 10;

export const AYUDA = {
  /** Confirmar el número vigente de la línea provincial o nacional antes de publicar. */
  titulo: 'Ayuda por juego compulsivo',
  telefono: '[número a confirmar]',
  detalle: 'Línea gratuita y confidencial. Confirmar el número vigente de la línea provincial o nacional antes de publicar.',
  url: '',
};

export const AVISOS = {
  pie: 'Herramienta de análisis estadístico. No somos casa de apuestas ni garantizamos resultados. Solo mayores de 18. Jugar compulsivamente es perjudicial para la salud.',
  combinada: (prob: string) => `Probabilidad estimada: ${prob}. Podés perder todo lo que apostás.`,
  registro: 'Confirmo que soy mayor de 18 años y que entiendo que las sugerencias no garantizan ganancias.',
};
