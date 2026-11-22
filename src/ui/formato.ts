import { AVISOS } from '../config';
import type { Combinada } from '../motor/combinadas';
import { nombreMercado } from '../motor/modelo';

export const esc = (s: unknown) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

const num = (x: number, dec: number) => x.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec });

export const cuota = (x: number) => num(x, 2);

export function prob(p: number): string {
  const pct = p * 100;
  if (pct >= 10) return `${Math.round(pct)}%`;
  if (pct >= 1) return `${num(pct, 1)}%`;
  return `${num(pct, 2)}%`;
}

export const pesos = (x: number) => (x === 0 ? 'Gratis' : `$${x.toLocaleString('es-AR')}`);

export function porcentaje(x: number, signo = false): string {
  const t = `${num(Math.abs(x * 100), 1)}%`;
  if (!signo) return t;
  return x > 0 ? `+${t}` : x < 0 ? `−${t}` : t;
}

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export function fechaHora(iso: string): string {
  const [d, h] = iso.split('T');
  const f = new Date(`${d}T12:00:00`);
  return `${DIAS[f.getDay()]} ${f.getDate()}/${f.getMonth() + 1}${h ? ` ${h}` : ''}`;
}
export function fechaLarga(dia: string): string {
  return new Date(`${dia}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** «1 de cada 24» a partir de una probabilidad. */
export const unaDeCada = (p: number) => `1 de cada ${Math.max(1, Math.round(1 / p)).toLocaleString('es-AR')}`;

export function tarjetaCombinada(c: Combinada): string {
  return `
  <article class="combo">
    <header class="combo-cab">
      <span class="chip">Objetivo x${c.objetivo}</span>
      <strong class="combo-cuota">x${cuota(c.cuota)}</strong>
      <span class="combo-prob" title="Probabilidad estimada de acertar todas las selecciones">≈ ${prob(c.prob)} de probabilidad</span>
    </header>
    <ol class="patas">
      ${c.selecciones.map((s) => `
        <li>
          <div class="pata-partido">
            <span class="meta">${esc(s.liga)} · ${fechaHora(s.fecha)}</span>
            <span>${esc(s.local)} <span class="vs">vs</span> ${esc(s.visitante)}</span>
          </div>
          <div class="pata-sel">${esc(nombreMercado(s.mercado, s))}</div>
          <div class="pata-num"><span class="num">${cuota(s.cuota)}</span><span class="meta">${prob(s.prob)}</span></div>
        </li>`).join('')}
    </ol>
    <p class="combo-detalle">
      En promedio sale ${unaDeCada(c.prob)} veces. Las demás se pierde todo lo apostado.
    </p>
    <p class="aviso-combo">${esc(AVISOS.combinada(prob(c.prob)))}</p>
  </article>`;
}

export function descargar(nombre: string, contenido: string, tipo = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob(['﻿', contenido], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const csv = (filas: (string | number)[][]) =>
  filas.map((f) => f.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
