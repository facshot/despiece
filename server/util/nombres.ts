// Reconoce el mismo equipo aunque cada fuente lo escriba distinto
// ("Man United" / "Manchester United", "Ath Madrid" / "Atletico Madrid").

/** Formas abreviadas → nombre completo (ya normalizados: minúsculas, sin acentos ni signos). */
const ALIAS: Record<string, string> = {
  'man united': 'manchester united', 'man utd': 'manchester united', 'man city': 'manchester city',
  'nottm forest': 'nottingham forest', 'wolves': 'wolverhampton', 'spurs': 'tottenham',
  'brighton and hove albion': 'brighton', 'west bromwich albion': 'west brom', 'sheffield weds': 'sheffield wednesday',
  'qpr': 'queens park rangers',
  'ath madrid': 'atletico madrid', 'atl madrid': 'atletico madrid', 'ath bilbao': 'athletic club', 'athletic bilbao': 'athletic club',
  'espanol': 'espanyol', 'vallecano': 'rayo vallecano', 'la coruna': 'deportivo la coruna', 'sp gijon': 'sporting gijon',
  'internazionale': 'inter', 'inter milan': 'inter',
  'bayern munich': 'bayern munchen', 'mgladbach': 'borussia monchengladbach', 'ein frankfurt': 'eintracht frankfurt',
  'paris sg': 'paris saint germain', 'psg': 'paris saint germain', 'st etienne': 'saint etienne',
  'sp lisbon': 'sporting cp', 'sporting lisbon': 'sporting cp',
};

/** Palabras que no distinguen equipos (FC, CF, Real, Club...). */
const VACIAS = new Set(['fc', 'cf', 'ac', 'as', 'sc', 'afc', 'cd', 'ud', 'sd', 'rc', 'ca', 'club', 'de', 'del', 'la', 'vfl', 'vfb', 'fsv', 'sv', 'tsg', 'calcio', 'ssc', 'hsc', 'osc', 'ogc', 'rcd', 'sad']);

export function normalizarNombre(nombre: string): string {
  const base = nombre
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b\d+\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return ALIAS[base] ?? base;
}

export function claveEquipo(nombre: string): string[] {
  const n = normalizarNombre(nombre);
  const tokens = n.split(' ').filter((t) => t && !VACIAS.has(t));
  const t = tokens.length ? tokens : n.split(' ');
  const unido = t.join(' ');
  return (ALIAS[unido] ?? unido).split(' ').filter((x) => !VACIAS.has(x));
}

/** ¿Son el mismo equipo? Igualdad de palabras clave, o una contenida en la otra. */
export function mismoEquipo(a: string, b: string): boolean {
  const ta = claveEquipo(a);
  const tb = claveEquipo(b);
  if (!ta.length || !tb.length) return false;
  if (ta.join(' ') === tb.join(' ')) return true;
  const [chico, grande] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const sg = new Set(grande);
  return chico.every((t) => sg.has(t)) && chico.join('').length >= 4;
}
