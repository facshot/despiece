import './style.css';
import { MARCA } from './config';
import { leer, puedeUsar, sumarUso } from './cuenta';
import { cargarDatos, type Datos } from './datos';
import { historial } from './ui/historial';
import { comoFunciona, inicio, juegoResponsable, noEncontrada, pie, planes, terminos, type Vista } from './ui/paginas';
import { panel } from './ui/panel';
import { registro } from './ui/registro';
import { esc } from './ui/formato';

const RUTAS: Record<string, { vista: Vista; titulo: string }> = {
  '': { vista: inicio, titulo: MARCA.lema },
  'como-funciona': { vista: comoFunciona, titulo: 'Cómo funciona' },
  historial: { vista: historial, titulo: 'Historial público' },
  planes: { vista: planes, titulo: 'Planes' },
  registro: { vista: registro, titulo: 'Crear cuenta' },
  panel: { vista: panel, titulo: 'Mi panel' },
  terminos: { vista: terminos, titulo: 'Términos y condiciones' },
  'juego-responsable': { vista: juegoResponsable, titulo: 'Juego responsable' },
};

const app = document.querySelector<HTMLElement>('#app')!;
const ruta = () => location.hash.replace(/^#\/?/, '').split(/[?#]/)[0];

function cabecera(): string {
  const c = leer();
  const r = ruta();
  const link = (href: string, texto: string) => `<a href="#/${href}"${r === href ? ' aria-current="page"' : ''}>${texto}</a>`;
  return `
  <header class="cab">
    <a class="logo" href="#/"><span class="logo-marca" aria-hidden="true"></span>${esc(MARCA.nombre)}</a>
    <nav>
      ${link('como-funciona', 'Cómo funciona')}
      ${link('historial', 'Historial')}
      ${link('planes', 'Planes')}
      ${c ? `<a class="btn btn-chico btn-primario" href="#/panel">Mi panel</a>` : `<a class="btn btn-chico btn-primario" href="#/registro">Probar gratis</a>`}
    </nav>
  </header>`;
}

let datos: Datos | null = null;

function pintar(): void {
  const r = RUTAS[ruta()];
  document.title = `${r?.titulo ?? 'No encontrada'} · ${MARCA.nombre}`;
  app.innerHTML = `${cabecera()}<main id="contenido"></main>${pie()}`;
  const vista = document.createElement('div');
  app.querySelector('#contenido')!.append(vista);
  if (!datos) {
    vista.innerHTML = '<p class="vacio">Cargando datos…</p>';
    return;
  }
  (r?.vista ?? noEncontrada)(vista, datos);
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', pintar);
pintar();
cargarDatos()
  .then((d) => {
    datos = d;
    pintar();
  })
  .catch(() => {
    app.querySelector('#contenido')!.innerHTML = '<p class="vacio">No pudimos cargar los datos. Probá recargar la página.</p>';
  });

// Contador de uso para el límite diario: suma tiempo solo con el panel abierto y visible.
const PASO = 15;
setInterval(() => {
  if (ruta() !== 'panel' || document.hidden) return;
  const c = leer();
  if (!c || !puedeUsar(c)) return;
  sumarUso(c, PASO);
  if (!puedeUsar(c)) pintar();
}, PASO * 1000);
