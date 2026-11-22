import { AYUDA, DIAS_ARREPENTIMIENTO, plan } from '../config';
import {
  arrepentirse, cambiarLimite, darDeBaja, eliminar, enPlazoDeArrepentimiento, guardar, leer, limiteAlcanzado,
  pausada, pausar, reactivar, vencida, type Cuenta,
} from '../cuenta';
import type { Datos } from '../datos';
import { buscarCombinadas, combinadasDelDia, type Combinada } from '../motor/combinadas';
import { nombreMercado } from '../motor/modelo';
import { csv, descargar, esc, fechaLarga, prob, tarjetaCombinada } from './formato';
import { avisoDemo, type Vista } from './paginas';

const LIMITES = [null, 15, 30, 60, 120];
const PAUSAS = [1, 7, 30];

const minutos = (s: number) => Math.floor(s / 60);

function bloqueo(c: Cuenta): string | null {
  if (pausada(c)) {
    const hasta = new Date(c.pausaHasta!).toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' });
    return `<h2>Tu cuenta está en pausa</h2><p>Elegiste pausarla hasta el ${esc(hasta)}. Mientras tanto no mostramos análisis. La pausa no se puede acortar.</p>`;
  }
  if (vencida(c)) {
    return c.plan === 'prueba'
      ? `<h2>Terminó tu prueba gratis</h2><p>Si querés seguir usando el análisis, elegí un plan. Si no, no tenés que hacer nada: no hay cobros automáticos en la prueba.</p><a class="btn btn-primario" href="#/planes">Ver planes</a>`
      : `<h2>Tu suscripción terminó</h2><p>El acceso venció el ${fechaLarga(c.venceEl)}.</p><a class="btn btn-primario" href="#/planes">Ver planes</a>`;
  }
  if (limiteAlcanzado(c)) {
    return `<h2>Llegaste a tu límite de hoy</h2><p>Fijaste un máximo de ${c.limiteMinutos} minutos por día. Vuelve a estar disponible mañana.</p>`;
  }
  return null;
}

export const panel: Vista = (raiz, datos) => {
  const c = leer();
  if (!c) {
    location.hash = '#/registro';
    return;
  }
  const p = plan(c.plan);
  const bloqueado = bloqueo(c);

  raiz.innerHTML = `
  ${avisoDemo(datos)}
  <section class="panel-cab">
    <div>
      <h1>Hola, ${esc(c.nombre)}</h1>
      <p class="meta">Plan <strong>${esc(p.nombre)}</strong> ·
        ${c.estado === 'baja' ? `sin renovación, acceso hasta el ${fechaLarga(c.venceEl)}` : c.plan === 'prueba' ? `prueba hasta el ${fechaLarga(c.venceEl)}` : `se renueva el ${fechaLarga(c.venceEl)}`}
        · uso hoy: ${minutos(c.uso.segundos)} min${c.limiteMinutos !== null ? ` de ${c.limiteMinutos}` : ''}</p>
    </div>
    <button class="btn btn-alerta" data-accion="pausa-rapida">Pausar mi cuenta</button>
  </section>

  ${bloqueado ? `<section class="caja bloqueo">${bloqueado}</section>` : contenido(c, datos)}

  <section class="caja" id="responsable">
    <h2>Juego responsable</h2>
    <div class="rg">
      <div>
        <h3>Pausar mi cuenta</h3>
        <p class="meta">No vas a ver análisis durante la pausa y no se puede acortar.</p>
        <div class="fila-btn">${PAUSAS.map((d) => `<button class="btn btn-chico" data-pausa="${d}"${pausada(c) ? ' disabled' : ''}>${d === 1 ? '24 horas' : `${d} días`}</button>`).join('')}</div>
      </div>
      <div>
        <h3>Límite de uso diario</h3>
        <p class="meta">Bajarlo rige ya. Subirlo o quitarlo rige desde mañana.</p>
        <select id="limite">${LIMITES.map((l) => `<option value="${l ?? ''}"${l === c.limiteMinutos ? ' selected' : ''}>${l === null ? 'Sin límite' : `${l} minutos`}</option>`).join('')}</select>
        ${c.limitePendiente ? `<p class="meta">Desde mañana: ${c.limitePendiente.valor === null ? 'sin límite' : `${c.limitePendiente.valor} minutos`}.</p>` : ''}
      </div>
      <div>
        <h3>${esc(AYUDA.titulo)}</h3>
        <p class="tel">${esc(AYUDA.telefono)}</p>
        <a href="#/juego-responsable">Más información y señales de alerta</a>
      </div>
    </div>
  </section>

  <section class="caja" id="suscripcion">
    <h2>Suscripción</h2>
    ${c.plan === 'prueba' && c.estado === 'activa' ? `
      <p>La prueba gratis no se renueva sola ni pide tarjeta.</p>
      <div class="fila-btn"><a class="btn" href="#/planes">Ver planes</a></div>` : c.estado === 'activa' ? `
      <p>Precio fijo de ${esc(p.nombre)}, con renovación automática. Podés darte de baja ahora con un clic: se corta la renovación y conservás el acceso hasta el ${fechaLarga(c.venceEl)}.</p>
      <div class="fila-btn">
        <button class="btn btn-alerta" data-accion="baja">Darme de baja</button>
        <a class="btn" href="#/planes">Cambiar de plan</a>
      </div>` : `
      <p><strong>Baja confirmada.</strong> No se va a renovar${vencida(c) ? '' : ` y conservás el acceso hasta el ${fechaLarga(c.venceEl)}`}.</p>
      <div class="fila-btn">${!vencida(c) && c.plan !== 'prueba' ? '<button class="btn" data-accion="reactivar">Reactivar la renovación</button>' : '<a class="btn" href="#/planes">Ver planes</a>'}</div>`}
    ${enPlazoDeArrepentimiento(c) ? `
      <p class="meta">Estás dentro de los ${DIAS_ARREPENTIMIENTO} días del derecho de arrepentimiento (Ley 24.240): podés anular la compra y recibir el reintegro total.</p>
      <div class="fila-btn"><button class="btn" data-accion="arrepentimiento">Arrepentirme de la compra</button></div>` : ''}
    <hr>
    <div class="fila-btn"><button class="btn btn-texto" data-accion="cerrar">Cerrar mi cuenta y borrar mis datos</button></div>
  </section>`;

  conectar(raiz, c, datos);
};

function contenido(c: Cuenta, datos: Datos): string {
  const p = plan(c.plan);
  const delDia = combinadasDelDia(datos.partidos.partidos, p.filtrosLiga ? c.ligas : undefined);
  const visibles = delDia.slice(0, p.combinadasPorDia);
  const ocultas = delDia.length - visibles.length;
  const alertas = p.alertas && c.alertas.activas
    ? buscarCombinadas(datos.partidos.partidos, { objetivo: c.alertas.objetivo, cantidad: 5, ligas: c.ligas }).filter((x) => x.prob >= c.alertas.probMin)
    : [];

  return `
  ${alertas.length ? `<div class="caja alerta-ok" role="status"><strong>Alerta:</strong> hay ${alertas.length} combinada${alertas.length > 1 ? 's' : ''} x${c.alertas.objetivo} con probabilidad estimada de al menos ${prob(c.alertas.probMin)}. <a href="#medida" data-accion="ver-alertas">Verlas</a></div>` : ''}

  <section>
    <div class="titulo-fila">
      <h2>Combinadas sugeridas</h2>
      ${p.exportar ? '<button class="btn btn-chico" data-accion="exportar">Exportar análisis</button>' : ''}
    </div>
    <p class="meta">Partidos de los próximos días. ${p.combinadasPorDia === Infinity ? 'Plan ilimitado.' : `Tu plan incluye ${p.combinadasPorDia} por día.`}</p>
    ${p.filtrosLiga ? `
      <fieldset class="ligas"><legend>Ligas</legend>
        ${datos.ligas.map((l) => `<label class="check"><input type="checkbox" data-liga="${esc(l)}"${c.ligas.includes(l) ? ' checked' : ''}> ${esc(l)}</label>`).join('')}
        <span class="meta">${c.ligas.length ? '' : 'Sin selección = todas.'}</span>
      </fieldset>` : ''}
    <div class="combos" id="del-dia">${visibles.length ? visibles.map(tarjetaCombinada).join('') : '<p class="vacio">No hay combinadas que cumplan los criterios con los partidos disponibles.</p>'}</div>
    ${ocultas > 0 ? `<p class="meta">Hay ${ocultas} combinada${ocultas > 1 ? 's' : ''} más para otros objetivos en planes superiores. <a href="#/planes">Ver planes</a></p>` : ''}
  </section>

  ${p.aMedida ? `
  <section class="caja" id="medida">
    <h2>Combinada a medida</h2>
    <form id="f-medida" class="fila-form">
      <label>Buscame x<input type="number" name="objetivo" min="1.5" max="500" step="0.5" value="${c.alertas.objetivo}" required></label>
      <label>Máximo de selecciones<input type="number" name="patas" min="1" max="10" value="6"></label>
      <button class="btn btn-primario" type="submit">Buscar</button>
    </form>
    <div class="combos" id="resultado-medida"></div>
  </section>

  <section class="caja">
    <h2>Alertas</h2>
    <form id="f-alertas" class="fila-form">
      <label class="check"><input type="checkbox" name="activas"${c.alertas.activas ? ' checked' : ''}> Avisarme en el panel</label>
      <label>Objetivo x<input type="number" name="objetivo" min="1.5" max="500" step="0.5" value="${c.alertas.objetivo}"></label>
      <label>Probabilidad mínima<select name="probMin">${[0.02, 0.05, 0.1, 0.2, 0.3].map((v) => `<option value="${v}"${v === c.alertas.probMin ? ' selected' : ''}>${prob(v)}</option>`).join('')}</select></label>
      <button class="btn" type="submit">Guardar</button>
    </form>
    <p class="meta">Los avisos aparecen al abrir el panel. Las notificaciones por correo o al celular necesitan el servidor de la versión comercial.</p>
  </section>` : `
  <section class="caja upsell">
    <h2>Combinadas a medida, alertas y exportación</h2>
    <p>Con el plan Pro podés pedir «buscame x20», recibir alertas y exportar el análisis.</p>
    <a class="btn" href="#/planes">Ver plan Pro</a>
  </section>`}`;
}

function exportarCombinadas(lista: Combinada[]): void {
  const filas: (string | number)[][] = [['objetivo', 'cuota_total', 'prob_estimada', 'liga', 'fecha', 'partido', 'seleccion', 'cuota', 'prob']];
  for (const c of lista) for (const s of c.selecciones)
    filas.push([c.objetivo, c.cuota.toFixed(2), c.prob.toFixed(4), s.liga, s.fecha, `${s.local} vs ${s.visitante}`, nombreMercado(s.mercado, s), s.cuota, s.prob.toFixed(4)]);
  descargar('analisis.csv', csv(filas));
}

function conectar(raiz: HTMLElement, c: Cuenta, datos: Datos): void {
  const volver = () => {
    const nuevo = document.createElement('div');
    raiz.replaceWith(nuevo);
    panel(nuevo, datos);
  };
  let ultimaBusqueda: Combinada[] = [];

  raiz.querySelectorAll<HTMLButtonElement>('[data-pausa]').forEach((b) =>
    b.addEventListener('click', () => {
      const d = Number(b.dataset.pausa);
      const texto = d === 1 ? '24 horas' : `${d} días`;
      if (confirm(`¿Pausar tu cuenta por ${texto}? No se puede acortar.`)) {
        pausar(c, d);
        volver();
      }
    }));

  raiz.querySelector<HTMLSelectElement>('#limite')?.addEventListener('change', (e) => {
    const v = (e.target as HTMLSelectElement).value;
    const cuando = cambiarLimite(c, v === '' ? null : Number(v));
    if (cuando === 'mañana') alert('Para cuidarte, los aumentos del límite rigen recién desde mañana.');
    volver();
  });

  raiz.querySelectorAll<HTMLInputElement>('[data-liga]').forEach((i) =>
    i.addEventListener('change', () => {
      const l = i.dataset.liga!;
      c.ligas = i.checked ? [...c.ligas, l] : c.ligas.filter((x) => x !== l);
      guardar(c);
      volver();
    }));

  raiz.querySelector<HTMLFormElement>('#f-medida')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.target as HTMLFormElement);
    const objetivo = Number(f.get('objetivo'));
    const maxPatas = Number(f.get('patas')) || 6;
    ultimaBusqueda = buscarCombinadas(datos.partidos.partidos, { objetivo, cantidad: 3, maxPatas, ligas: c.ligas });
    raiz.querySelector('#resultado-medida')!.innerHTML = ultimaBusqueda.length
      ? ultimaBusqueda.map(tarjetaCombinada).join('')
      : `<p class="vacio">No encontramos una combinada cerca de x${objetivo} con los partidos y ligas disponibles.</p>`;
  });

  raiz.querySelector<HTMLFormElement>('#f-alertas')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.target as HTMLFormElement);
    c.alertas = { activas: !!f.get('activas'), objetivo: Number(f.get('objetivo')) || 20, probMin: Number(f.get('probMin')) };
    guardar(c);
    volver();
  });

  raiz.addEventListener('click', (e) => {
    const accion = (e.target as HTMLElement).closest<HTMLElement>('[data-accion]')?.dataset.accion;
    switch (accion) {
      case 'pausa-rapida':
        raiz.querySelector('#responsable')?.scrollIntoView({ behavior: 'smooth' });
        break;
      case 'baja':
        darDeBaja(c);
        volver();
        break;
      case 'reactivar':
        reactivar(c);
        volver();
        break;
      case 'arrepentimiento':
        if (confirm('¿Anular la compra? Se reintegra el total y se termina el acceso al plan pago.')) {
          arrepentirse(c);
          volver();
        }
        break;
      case 'cerrar':
        if (confirm('¿Cerrar tu cuenta? Se borran todos tus datos de este navegador.')) {
          eliminar();
          location.hash = '#/';
        }
        break;
      case 'exportar': {
        const p = plan(c.plan);
        exportarCombinadas([...combinadasDelDia(datos.partidos.partidos, p.filtrosLiga ? c.ligas : undefined), ...ultimaBusqueda]);
        break;
      }
      case 'ver-alertas': {
        e.preventDefault();
        const form = raiz.querySelector<HTMLFormElement>('#f-medida');
        if (form) {
          (form.elements.namedItem('objetivo') as HTMLInputElement).value = String(c.alertas.objetivo);
          form.requestSubmit();
          form.scrollIntoView({ behavior: 'smooth' });
        }
        break;
      }
    }
  });
}
