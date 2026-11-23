// Lector de CSV (RFC 4180): comillas, comas dentro de comillas, CRLF y BOM.

export function leerCSV(texto: string): Record<string, string>[] {
  const filas = filasCSV(texto.replace(/^﻿/, ''));
  if (!filas.length) return [];
  const cab = filas[0].map((c) => c.trim());
  return filas.slice(1)
    .filter((f) => f.some((c) => c.trim() !== ''))
    .map((f) => Object.fromEntries(cab.map((c, i) => [c, (f[i] ?? '').trim()])));
}

function filasCSV(t: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let comillas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (comillas) {
      if (c === '"' && t[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === ',') { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = '';
    } else campo += c;
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
  return filas;
}
