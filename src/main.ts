import './style.css';
import { api, sesion } from './api';
import { MARCA } from './config';
import { ingresar, olvide, registro, restablecer } from './ui/acceso';
import { esc } from './ui/formato';
import { historial } from './ui/historial';
import { comoFunciona, inicio, juegoResponsable, noEncontrada, pie, planes, privacidad, terminos, type Vista } from './ui/paginas';
import { panel } from './ui/panel';

const RUTAS: Record<string, { vista: Vista; titulo: string }> = {
  '': { vista: inicio, titulo: MARCA.lema },
  'como-funciona': { vista: comoFunciona, titulo: 'Cómo funciona' },
  historial: { vista: historial, titulo: 'Historial público' },
  planes: { vista: planes, titulo: 'Planes' },
  registro: { vista: registro, titulo: 'Crear cuenta' },
  ingresar: { vista: ingresar, titulo: 'Iniciar sesión' },
  olvide: { vista: olvide, titulo: 'Recuperar contraseña' },
  restablecer: { vista: restablecer, titulo: 'Contraseña nueva' },
  panel: { vista: panel, titulo: 'Mi panel' },
  terminos: { vista: terminos, titulo: 'Términos y condiciones' },
  privacidad: { vista: privacidad, titulo: 'Política de privacidad' },
  'juego-responsable': { vista: juegoResponsable, titulo: 'Juego responsable' },
};

const app = document.querySelector<HTMLElement>('#app')!;
const ruta = () => location.hash.replace(/^#\/?/, '').split(/[?#]/)[0];

function cabecera(): string {
  const u = sesion.usuario;
  const r = ruta();
  const link = (href: string, texto: string) => `<a href="#/${href}"${r === href ? ' aria-current="page"' : ''}>${texto}</a>`;
  return `
  <header class="cab">
    <a class="logo" href="#/"><span class="logo-marca" aria-hidden="true"></span>${esc(MARCA.nombre)}</a>
    <nav>
      ${link('como-funciona', 'Cómo funciona')}
      ${link('historial', 'Historial')}
      ${link('planes', 'Planes')}
      ${u ? `<a class="btn btn-chico btn-primario" href="#/panel">Mi panel</a>` : `${link('ingresar', 'Ingresar')}<a class="btn btn-chico btn-primario" href="#/registro">Probar gratis</a>`}
    </nav>
  </header>`;
}

let turno = 0;
async function pintar(): Promise<void> {
  const mio = ++turno;
  const r = RUTAS[ruta()];
  document.title = `${r?.titulo ?? 'No encontrada'} · ${MARCA.nombre}`;
  app.innerHTML = `${cabecera()}<main id="contenido"></main>${pie()}`;
  const vista = document.createElement('div');
  vista.innerHTML = '<p class="vacio">Cargando…</p>';
  app.querySelector('#contenido')!.append(vista);
  window.scrollTo(0, 0);
  try {
    await (r?.vista ?? noEncontrada)(vista);
  } catch {
    if (mio === turno) vista.innerHTML = '<p class="vacio">No pudimos cargar esta página. Revisá tu conexión y recargá.</p>';
  }
  // La cabecera depende de la sesión, que puede cambiar dentro de la vista.
  if (mio === turno) app.querySelector('.cab')!.outerHTML = cabecera();
}

window.addEventListener('hashchange', () => void pintar());
void sesion.cargar().then(pintar);

// Latido para el límite de uso diario: solo con el panel abierto y visible.
// El servidor decide cuánto tiempo sumar y cuándo bloquear.
setInterval(async () => {
  if (ruta() !== 'panel' || document.hidden || !sesion.usuario || sesion.usuario.bloqueo) return;
  try {
    const { usuario } = await api.uso();
    sesion.poner(usuario);
    if (usuario.bloqueo) void pintar();
  } catch { /* sin conexión: se reintenta en el próximo latido */ }
}, 15_000);
