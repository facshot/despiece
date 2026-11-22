import { api, ErrorApi, sesion, type RespuestaCombinadas, type Usuario } from '../api';
import { AYUDA, DIAS_ARREPENTIMIENTO, plan } from '../config';
import { esc, fechaLarga, prob, tarjetaCombinada } from './formato';
import { avisoDemo, type Vista } from './paginas';

const LIMITES = [null, 15, 30, 60, 120];
const PAUSAS = [1, 7, 30];

const minutos = (s: number) => Math.floor(s / 60);

function textoBloqueo(u: Usuario): string {
  switch (u.bloqueo) {
    case 'suspendida':
      return `<h2>Tu cuenta está suspendida</h2><p>Detectamos señales que nos preocupan y suspendimos el acceso. Si querés hablar con alguien, la ${esc(AYUDA.titulo.toLowerCase())} atiende en el ${esc(AYUDA.telefono)}.</p>`;
    case 'pausa': {
      const hasta = new Date(u.pausaHasta!).toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' });
      return `<h2>Tu cuenta está en pausa</h2><p>Elegiste pausarla hasta el ${esc(hasta)}. Mientras tanto no mostramos análisis. La pausa no se puede acortar.</p>`;
    }
    case 'vencida':
      return u.plan === 'prueba'
        ? `<h2>Tu prueba gratis terminó</h2><p>Si querés seguir usando el análisis, elegí un plan. Si no, no tenés que hacer nada: la prueba no tiene cobros.</p><a class="btn btn-primario" href="#/planes">Ver planes</a>`
        : `<h2>Tu suscripción terminó</h2><p>El acceso venció el ${fechaLarga(u.venceEl)}.</p><a class="btn btn-primario" href="#/planes">Ver planes</a>`;
    case 'limite':
      return `<h2>Llegaste a tu límite de hoy</h2><p>Fijaste un máximo de ${u.limiteMinutos} minutos por día. Vuelve a estar disponible mañana.</p>`;
    default:
      return '';
  }
}

function contenido(r: RespuestaCombinadas): string {
  const u = r.usuario;
  const f = u.funciones;
  const lista = r.combinadas ?? [];
  const alertas = r.alertas ?? [];
  const ligas = r.ligas ?? [];
  return `
  ${alertas.length ? `<div class="caja alerta-ok" role="status"><strong>Alerta:</strong> hay ${alertas.length} combinada${alertas.length > 1 ? 's' : ''} x${u.alertas.objetivo} con probabilidad estimada de al menos ${prob(u.alertas.probMin)}. <a href="#medida" data-accion="ver-alertas">Verlas</a></div>` : ''}

  <section>
    <div class="titulo-fila">
      <h2>Combinadas sugeridas</h2>
      ${f.exportar ? '<button class="btn btn-chico" data-accion="exportar">Exportar análisis</button>' : ''}
    </div>
    <p class="meta">Partidos de las próximas 72 horas que todavía no empezaron. ${f.combinadasPorDia === null ? 'Plan ilimitado.' : `Tu plan incluye ${f.combinadasPorDia} por día; las de hoy quedan fijas aunque cambies los filtros.`}</p>
    ${f.filtrosLiga ? `
      <fieldset class="ligas"><legend>Ligas</legend>
        ${ligas.map((l) => `<label class="check"><input type="checkbox" data-liga="${esc(l)}"${u.ligas.includes(l) ? ' checked' : ''}> ${esc(l)}</label>`).join('')}
        <span class="meta">${u.ligas.length ? '' : 'Sin selección = todas.'}</span>
      </fieldset>` : ''}
    <div class="combos">${lista.length ? lista.map(tarjetaCombinada).join('') : '<p class="vacio">No hay combinadas que cumplan los criterios con los partidos disponibles. Los datos se actualizan una vez por día.</p>'}</div>
    ${r.masEnPlanesSuperiores ? `<p class="meta">Hay ${r.masEnPlanesSuperiores} combinada${r.masEnPlanesSuperiores > 1 ? 's' : ''} más para otros objetivos en planes superiores. <a href="#/planes">Ver planes</a></p>` : ''}
  </section>

  ${f.aMedida ? `
  <section class="caja" id="medida">
    <h2>Combinada a medida</h2>
    <form id="f-medida" class="fila-form">
      <label>Buscame x<input type="number" name="objetivo" min="1.5" max="500" step="0.5" value="${u.alertas.objetivo}" required></label>
      <label>Máximo de selecciones<input type="number" name="patas" min="1" max="10" value="6"></label>
      <button class="btn btn-primario" type="submit">Buscar</button>
    </form>
    <div class="combos" id="resultado-medida"></div>
  </section>

  <section class="caja">
    <h2>Alertas</h2>
    <form id="f-alertas" class="fila-form">
      <label class="check"><input type="checkbox" name="activas"${u.alertas.activas ? ' checked' : ''}> Avisarme en el panel</label>
      <label>Objetivo x<input type="number" name="objetivo" min="1.5" max="500" step="0.5" value="${u.alertas.objetivo}"></label>
      <label>Probabilidad mínima<select name="probMin">${[0.02, 0.05, 0.1, 0.2, 0.3].map((v) => `<option value="${v}"${v === u.alertas.probMin ? ' selected' : ''}>${prob(v)}</option>`).join('')}</select></label>
      <button class="btn" type="submit">Guardar</button>
    </form>
    <p class="meta">Los avisos aparecen al abrir el panel.</p>
  </section>` : `
  <section class="caja">
    <h2>Combinadas a medida, alertas y exportación</h2>
    <p>Con el plan Pro podés pedir «buscame x20», recibir alertas y exportar el análisis.</p>
    <a class="btn" href="#/planes">Ver plan Pro</a>
  </section>`}`;
}

function cuerpoPanel(r: RespuestaCombinadas, demo: string, aviso: string): string {
  const u = r.usuario;
  const p = plan(u.plan);
  const vencida = u.bloqueo === 'vencida';
  return `
  ${demo}
  ${aviso}
  <section class="panel-cab">
    <div>
      <h1>Hola, ${esc(u.nombre)}</h1>
      <p class="meta">Plan <strong>${esc(p.nombre)}</strong> ·
        ${u.estado === 'baja' ? `sin renovación, acceso hasta el ${fechaLarga(u.venceEl)}` : u.plan === 'prueba' ? `prueba hasta el ${fechaLarga(u.venceEl)}` : `se renueva antes del ${fechaLarga(u.venceEl)}`}
        · uso hoy: ${minutos(u.usoSegundos)} min${u.limiteMinutos !== null ? ` de ${u.limiteMinutos}` : ''}</p>
    </div>
    <div class="fila-btn">
      <button class="btn btn-alerta" data-accion="ir-pausa">Pausar mi cuenta</button>
      <button class="btn" data-accion="salir">Salir</button>
    </div>
  </section>

  ${u.bloqueo ? `<section class="caja bloqueo">${textoBloqueo(u)}</section>` : contenido(r)}

  <section class="caja" id="responsable">
    <h2>Juego responsable</h2>
    <div class="rg">
      <div>
        <h3>Pausar mi cuenta</h3>
        <p class="meta">No vas a ver análisis durante la pausa y no se puede acortar.</p>
        <div class="fila-btn">${PAUSAS.map((d) => `<button class="btn btn-chico" data-pausa="${d}"${u.bloqueo === 'pausa' ? ' disabled' : ''}>${d === 1 ? '24 horas' : `${d} días`}</button>`).join('')}</div>
      </div>
      <div>
        <h3>Límite de uso diario</h3>
        <p class="meta">Bajarlo rige ya. Subirlo o quitarlo rige desde mañana.</p>
        <select id="limite" aria-label="Límite de uso diario">${LIMITES.map((l) => `<option value="${l ?? ''}"${l === u.limiteMinutos ? ' selected' : ''}>${l === null ? 'Sin límite' : `${l} minutos`}</option>`).join('')}</select>
        ${u.limitePendiente ? `<p class="meta">Desde mañana: ${u.limitePendiente.valor === null ? 'sin límite' : `${u.limitePendiente.valor} minutos`}.</p>` : ''}
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
    ${u.plan === 'prueba' ? `
      <p>La prueba gratis no se renueva sola ni pide tarjeta.</p>
      <div class="fila-btn"><a class="btn" href="#/planes">Ver planes</a></div>` : u.estado === 'activa' ? `
      <p>Precio fijo de ${esc(p.nombre)}, con renovación automática por Mercado Pago. Podés darte de baja ahora con un clic: se cancela la renovación y conservás el acceso hasta el ${fechaLarga(u.venceEl)}.</p>
      <div class="fila-btn">
        <button class="btn btn-alerta" data-accion="baja">Darme de baja</button>
        <a class="btn" href="#/planes">Cambiar de plan</a>
      </div>` : `
      <p><strong>Baja confirmada.</strong> No se va a renovar${vencida ? '' : ` y conservás el acceso hasta el ${fechaLarga(u.venceEl)}`}.</p>
      <div class="fila-btn"><a class="btn" href="#/planes">Volver a suscribirme</a></div>`}
    ${u.arrepentimiento ? `
      <p class="meta">Estás dentro de los ${DIAS_ARREPENTIMIENTO} días del derecho de arrepentimiento (Ley 24.240): podés anular la compra y recibir el reintegro total.</p>
      <div class="fila-btn"><button class="btn" data-accion="arrepentimiento">Arrepentirme de la compra</button></div>` : ''}
    <hr>
    <div class="fila-btn"><button class="btn btn-texto" data-accion="cerrar">Cerrar mi cuenta y borrar mis datos</button></div>
  </section>
  <p class="error" id="error-panel" role="alert" hidden></p>`;
}

export const panel: Vista = async (raiz, aviso = '') => {
  if (!sesion.usuario) {
    location.hash = '#/ingresar';
    return;
  }
  let r: RespuestaCombinadas;
  try {
    // Volviendo de Mercado Pago: confirmamos la suscripción sin esperar el webhook.
    const pre = new URLSearchParams(location.search + '&' + (location.hash.split('?')[1] ?? '')).get('preapproval_id');
    if (pre) {
      await api.confirmarPago(pre).catch(() => undefined);
      history.replaceState(null, '', `${location.pathname}#/panel`);
      aviso = '<div class="caja alerta-ok" role="status">Gracias. Si el pago ya se acreditó, tu plan está activo; si no, se activa apenas Mercado Pago lo confirme.</div>';
    }
    r = await api.combinadas();
  } catch (e) {
    if (e instanceof ErrorApi && e.estado === 401) {
      sesion.poner(null);
      location.hash = '#/ingresar';
      return;
    }
    throw e;
  }
  sesion.poner(r.usuario);
  raiz.innerHTML = cuerpoPanel(r, await avisoDemo(), aviso);
  conectar(raiz, r.usuario);
};

function conectar(raiz: HTMLElement, u: Usuario): void {
  const volver = (aviso = '') => {
    const nuevo = document.createElement('div');
    raiz.replaceWith(nuevo);
    void (panel as (r: HTMLElement, a?: string) => Promise<void>)(nuevo, aviso);
  };
  const error = (e: unknown) => {
    const el = raiz.querySelector<HTMLElement>('#error-panel')!;
    el.textContent = e instanceof Error ? e.message : 'Algo salió mal.';
    el.hidden = false;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const hacer = async (f: () => Promise<unknown>, aviso = '') => {
    try {
      await f();
      volver(aviso);
    } catch (e) {
      error(e);
    }
  };

  raiz.querySelectorAll<HTMLButtonElement>('[data-pausa]').forEach((b) =>
    b.addEventListener('click', () => {
      const d = Number(b.dataset.pausa);
      if (confirm(`¿Pausar tu cuenta por ${d === 1 ? '24 horas' : `${d} días`}? No se puede acortar.`)) void hacer(() => api.pausa(d));
    }));

  raiz.querySelector<HTMLSelectElement>('#limite')?.addEventListener('change', (e) => {
    const v = (e.target as HTMLSelectElement).value;
    void hacer(async () => {
      const r = await api.limite(v === '' ? null : Number(v));
      if (r.rige === 'mañana') alert('Para cuidarte, los aumentos del límite rigen recién desde mañana.');
    });
  });

  raiz.querySelectorAll<HTMLInputElement>('[data-liga]').forEach((i) =>
    i.addEventListener('change', () => {
      const l = i.dataset.liga!;
      const ligas = i.checked ? [...u.ligas, l] : u.ligas.filter((x) => x !== l);
      void hacer(() => api.preferencias({ ligas }));
    }));

  raiz.querySelector<HTMLFormElement>('#f-medida')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target as HTMLFormElement);
    const objetivo = Number(f.get('objetivo'));
    const destino = raiz.querySelector('#resultado-medida')!;
    destino.innerHTML = '<p class="vacio">Buscando…</p>';
    try {
      const { combinadas } = await api.medida(objetivo, Number(f.get('patas')) || 6);
      destino.innerHTML = combinadas.length
        ? combinadas.map(tarjetaCombinada).join('')
        : `<p class="vacio">No encontramos una combinada cerca de x${objetivo} con los partidos y ligas disponibles.</p>`;
    } catch (err) {
      destino.innerHTML = '';
      error(err);
    }
  });

  raiz.querySelector<HTMLFormElement>('#f-alertas')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.target as HTMLFormElement);
    void hacer(() => api.preferencias({ alertas: { activas: !!f.get('activas'), objetivo: Number(f.get('objetivo')) || 20, probMin: Number(f.get('probMin')) } }));
  });

  raiz.addEventListener('click', async (e) => {
    const accion = (e.target as HTMLElement).closest<HTMLElement>('[data-accion]')?.dataset.accion;
    switch (accion) {
      case 'ir-pausa':
        raiz.querySelector('#responsable')?.scrollIntoView({ behavior: 'smooth' });
        break;
      case 'salir':
        await api.logout().catch(() => undefined);
        sesion.poner(null);
        location.hash = '#/';
        break;
      case 'baja':
        void hacer(() => api.baja());
        break;
      case 'arrepentimiento':
        if (confirm('¿Anular la compra? Se reintegra el total y se termina el acceso al plan pago.')) {
          try {
            const r = await api.arrepentimiento();
            volver(r.reintegroManual
              ? '<div class="caja alerta-ok" role="status">Cancelamos tu suscripción. El reintegro lo procesamos a mano en las próximas 48 horas hábiles.</div>'
              : '<div class="caja alerta-ok" role="status">Cancelamos tu suscripción y pedimos el reintegro total a Mercado Pago.</div>');
          } catch (err) {
            error(err);
          }
        }
        break;
      case 'cerrar':
        if (confirm('¿Cerrar tu cuenta? Se cancela la suscripción y se borran tus datos. No se puede deshacer.')) {
          try {
            await api.cerrarCuenta();
            sesion.poner(null);
            location.hash = '#/';
          } catch (err) {
            error(err);
          }
        }
        break;
      case 'exportar':
        try {
          const r = await fetch('/api/exportar', { credentials: 'same-origin' });
          if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'No se pudo exportar.');
          const url = URL.createObjectURL(await r.blob());
          const a = document.createElement('a');
          a.href = url;
          a.download = 'analisis.csv';
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (err) {
          error(err);
        }
        break;
      case 'ver-alertas': {
        e.preventDefault();
        const form = raiz.querySelector<HTMLFormElement>('#f-medida');
        if (form) {
          (form.elements.namedItem('objetivo') as HTMLInputElement).value = String(u.alertas.objetivo);
          form.requestSubmit();
          form.scrollIntoView({ behavior: 'smooth' });
        }
        break;
      }
    }
  });
}
