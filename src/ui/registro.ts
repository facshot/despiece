import { AVISOS, EDAD_MINIMA, MARCA } from '../config';
import { crear, edad, hoy, leer } from '../cuenta';
import { esc } from './formato';
import type { Vista } from './paginas';

export const registro: Vista = (raiz) => {
  if (leer()) {
    location.hash = '#/panel';
    return;
  }
  const max = hoy();
  raiz.innerHTML = `
  <section class="form-caja">
    <h1>Crear cuenta</h1>
    <p class="lead">7 días de prueba gratis. No pedimos tarjeta.</p>
    <form id="f-registro" novalidate>
      <label>Nombre<input name="nombre" autocomplete="given-name" required maxlength="60"></label>
      <label>Correo electrónico<input name="email" type="email" autocomplete="email" required></label>
      <label>Fecha de nacimiento<input name="nacimiento" type="date" autocomplete="bday" required max="${max}"></label>
      <label class="check"><input type="checkbox" name="mayor" required> <span>${esc(AVISOS.registro)}</span></label>
      <label class="check"><input type="checkbox" name="terminos" required> <span>Leí y acepto los <a href="#/terminos" target="_blank">términos y condiciones</a>.</span></label>
      <p class="error" id="error" role="alert" hidden></p>
      <button class="btn btn-primario" type="submit">Empezar la prueba</button>
    </form>
    <p class="meta">${esc(MARCA.nombre)} es solo para mayores de ${EDAD_MINIMA} años. La versión para vender debería validar el DNI además de la fecha de nacimiento.</p>
  </section>`;

  const form = raiz.querySelector<HTMLFormElement>('#f-registro')!;
  const error = raiz.querySelector<HTMLElement>('#error')!;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = new FormData(form);
    const nombre = String(d.get('nombre') ?? '').trim();
    const email = String(d.get('email') ?? '').trim();
    const nacimiento = String(d.get('nacimiento') ?? '');
    const fallo = (msg: string) => {
      error.textContent = msg;
      error.hidden = false;
    };
    if (!nombre) return fallo('Escribí tu nombre.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fallo('Revisá el correo electrónico.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nacimiento)) return fallo('Ingresá tu fecha de nacimiento.');
    const e2 = edad(nacimiento);
    if (e2 < EDAD_MINIMA) return fallo(`Tenés que ser mayor de ${EDAD_MINIMA} años para usar ${MARCA.nombre}.`);
    if (e2 > 120) return fallo('Revisá la fecha de nacimiento.');
    if (!d.get('mayor')) return fallo('Tenés que confirmar que sos mayor de 18 años.');
    if (!d.get('terminos')) return fallo('Tenés que aceptar los términos y condiciones.');
    crear({ nombre, email, nacimiento });
    location.hash = '#/panel';
  });
};
