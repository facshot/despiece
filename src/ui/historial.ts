import { plan } from '../config';
import { leer } from '../cuenta';
import { resumir, type Registro } from '../motor/historial';
import { csv, cuota, descargar, esc, fechaLarga, porcentaje, prob } from './formato';
import { avisoDemo, type Vista } from './paginas';

function fila(r: Registro): string {
  return `
  <details class="reg reg-${r.resultado}">
    <summary>
      <span class="reg-fecha">${fechaLarga(r.fecha)}</span>
      <span class="chip">x${r.objetivo}</span>
      <span class="num">x${cuota(r.cuota)}</span>
      <span class="meta">≈ ${prob(r.prob)}</span>
      <span class="estado">${r.resultado === 'ganada' ? 'Acertada' : 'Perdida'}</span>
    </summary>
    <ol class="patas">
      ${r.patas.map((p) => `
        <li class="${p.acerto ? 'ok' : 'mal'}">
          <div class="pata-partido"><span class="meta">${esc(p.liga)}</span><span>${esc(p.partido)} <strong>${esc(p.marcador)}</strong></span></div>
          <div class="pata-sel">${esc(p.etiqueta)}</div>
          <div class="pata-num"><span class="num">${cuota(p.cuota)}</span><span class="meta">${p.acerto ? '✓' : '✗'} ${prob(p.prob)}</span></div>
        </li>`).join('')}
    </ol>
  </details>`;
}

export const historial: Vista = (raiz, datos) => {
  const cuenta = leer();
  const completo = !!cuenta && plan(cuenta.plan).historialCompleto;
  const todos = datos.historial.registros;
  const estado = { objetivo: 0, liga: '', resultado: '' };

  const filtrar = () =>
    todos.filter((r) =>
      (!estado.objetivo || r.objetivo === estado.objetivo) &&
      (!estado.resultado || r.resultado === estado.resultado) &&
      (!estado.liga || r.patas.some((p) => p.liga === estado.liga)));

  const objetivos = [...new Set(todos.map((r) => r.objetivo))].sort((a, b) => a - b);

  raiz.innerHTML = `
  ${avisoDemo(datos)}
  <section>
    <h1>Historial público</h1>
    <p class="lead">Todas las combinadas sugeridas, con fecha, cuota, probabilidad y resultado. Las perdidas también. El ROI supone apostar 1 unidad a cada una.</p>
    <div id="resumen"></div>
    <div class="filtros">
      <label>Objetivo
        <select data-f="objetivo"><option value="0">Todos</option>${objetivos.map((o) => `<option value="${o}">x${o}</option>`).join('')}</select>
      </label>
      <label>Resultado
        <select data-f="resultado"><option value="">Todos</option><option value="ganada">Acertadas</option><option value="perdida">Perdidas</option></select>
      </label>
      ${completo ? `
        <label>Liga
          <select data-f="liga"><option value="">Todas</option>${datos.ligas.map((l) => `<option>${esc(l)}</option>`).join('')}</select>
        </label>
        <button class="btn btn-chico" id="exportar">Exportar CSV</button>` : `<span class="meta">Filtro por liga y exportación: <a href="#/planes">plan Básico o superior</a>.</span>`}
    </div>
    <div id="lista" class="registros"></div>
    <p class="meta">${esc(datos.historial.fuente)}. Generado el ${fechaLarga(datos.historial.generado.slice(0, 10))}.</p>
  </section>`;

  const pintar = () => {
    const lista = filtrar();
    const r = resumir(lista);
    raiz.querySelector('#resumen')!.innerHTML = `
      <div class="cifras">
        <div><strong>${r.total}</strong><span>combinadas</span></div>
        <div><strong>${r.ganadas}</strong><span>acertadas (${porcentaje(r.aciertos)})</span></div>
        <div><strong>${r.aciertosEsperados.toLocaleString('es-AR', { maximumFractionDigits: 1 })}</strong><span>acertadas esperadas según el modelo</span></div>
        <div><strong class="${r.roi < 0 ? 'neg' : 'pos'}">${porcentaje(r.roi, true)}</strong><span>ROI real (${r.retorno.toLocaleString('es-AR', { maximumFractionDigits: 1 })} de ${r.invertido} unidades)</span></div>
      </div>`;
    raiz.querySelector('#lista')!.innerHTML = lista.length ? lista.map(fila).join('') : '<p class="vacio">No hay combinadas con estos filtros.</p>';
  };

  raiz.querySelectorAll<HTMLSelectElement>('[data-f]').forEach((s) =>
    s.addEventListener('change', () => {
      const k = s.dataset.f as keyof typeof estado;
      (estado as Record<string, string | number>)[k] = k === 'objetivo' ? Number(s.value) : s.value;
      pintar();
    }));

  raiz.querySelector('#exportar')?.addEventListener('click', () => {
    const filas: (string | number)[][] = [['fecha', 'objetivo', 'cuota_total', 'prob_estimada', 'resultado', 'liga', 'partido', 'seleccion', 'cuota', 'prob', 'marcador', 'acerto']];
    for (const r of filtrar()) for (const p of r.patas)
      filas.push([r.fecha, r.objetivo, r.cuota.toFixed(2), r.prob.toFixed(4), r.resultado, p.liga, p.partido, p.etiqueta, p.cuota, p.prob.toFixed(4), p.marcador, p.acerto ? 'si' : 'no']);
    descargar('historial.csv', csv(filas));
  });

  pintar();
};
