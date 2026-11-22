import { api, ErrorApi, sesion } from '../api';
import { AVISOS, EDAD_MINIMA, MARCA } from '../config';
import { esc } from './formato';
import type { Vista } from './paginas';

const hoyISO = () => new Date().toISOString().slice(0, 10);

/** Conecta un formulario: valida, llama a la API y muestra los errores. */
function formulario(raiz: HTMLElement, enviar: (d: FormData) => Promise<void>): void {
  const form = raiz.querySelector<HTMLFormElement>('form')!;
  const error = raiz.querySelector<HTMLElement>('.error')!;
  const boton = form.querySelector<HTMLButtonElement>('button[type=submit]')!;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.hidden = true;
    boton.disabled = true;
    try {
      await enviar(new FormData(form));
    } catch (err) {
      error.textContent = err instanceof ErrorApi || err instanceof Error ? err.message : 'Algo salió mal.';
      error.hidden = false;
    } finally {
      boton.disabled = false;
    }
  });
}

export const registro: Vista = (raiz) => {
  if (sesion.usuario) {
    location.hash = '#/panel';
    return;
  }
  raiz.innerHTML = `
  <section class="form-caja">
    <h1>Crear cuenta</h1>
    <p class="lead">7 días de prueba gratis. No pedimos tarjeta.</p>
    <form novalidate>
      <label>Nombre<input name="nombre" autocomplete="given-name" required maxlength="60"></label>
      <label>Correo electrónico<input name="email" type="email" autocomplete="email" required></label>
      <label>Contraseña<input name="password" type="password" autocomplete="new-password" required minlength="8"><span class="meta">Al menos 8 caracteres.</span></label>
      <label>Fecha de nacimiento<input name="nacimiento" type="date" autocomplete="bday" required max="${hoyISO()}"></label>
      <label class="check"><input type="checkbox" name="mayor" required> <span>${esc(AVISOS.registro)}</span></label>
      <label class="check"><input type="checkbox" name="terminos" required> <span>Leí y acepto los <a href="#/terminos" target="_blank">términos y condiciones</a> y la <a href="#/privacidad" target="_blank">política de privacidad</a>.</span></label>
      <p class="error" role="alert" hidden></p>
      <button class="btn btn-primario" type="submit">Empezar la prueba</button>
    </form>
    <p class="meta">¿Ya tenés cuenta? <a href="#/ingresar">Iniciá sesión</a>. ${esc(MARCA.nombre)} es solo para mayores de ${EDAD_MINIMA} años.</p>
  </section>`;
  formulario(raiz, async (d) => {
    if (!d.get('mayor')) throw new Error('Tenés que confirmar que sos mayor de 18 años.');
    if (!d.get('terminos')) throw new Error('Tenés que aceptar los términos y condiciones.');
    const r = await api.registro({
      nombre: String(d.get('nombre') ?? ''),
      email: String(d.get('email') ?? ''),
      password: String(d.get('password') ?? ''),
      nacimiento: String(d.get('nacimiento') ?? ''),
      mayor: true,
      terminos: true,
    });
    sesion.poner(r.usuario);
    location.hash = r.pruebaYaUsada ? '#/planes' : '#/panel';
  });
};

export const ingresar: Vista = (raiz) => {
  if (sesion.usuario) {
    location.hash = '#/panel';
    return;
  }
  raiz.innerHTML = `
  <section class="form-caja">
    <h1>Iniciar sesión</h1>
    <form novalidate>
      <label>Correo electrónico<input name="email" type="email" autocomplete="email" required></label>
      <label>Contraseña<input name="password" type="password" autocomplete="current-password" required></label>
      <p class="error" role="alert" hidden></p>
      <button class="btn btn-primario" type="submit">Entrar</button>
    </form>
    <p class="meta"><a href="#/olvide">Olvidé mi contraseña</a> · <a href="#/registro">Crear cuenta</a></p>
  </section>`;
  formulario(raiz, async (d) => {
    const r = await api.login(String(d.get('email') ?? ''), String(d.get('password') ?? ''));
    sesion.poner(r.usuario);
    location.hash = '#/panel';
  });
};

export const olvide: Vista = (raiz) => {
  raiz.innerHTML = `
  <section class="form-caja">
    <h1>Recuperar contraseña</h1>
    <p class="lead">Te mandamos un enlace para elegir una contraseña nueva.</p>
    <form novalidate>
      <label>Correo electrónico<input name="email" type="email" autocomplete="email" required></label>
      <p class="error" role="alert" hidden></p>
      <button class="btn btn-primario" type="submit">Enviar enlace</button>
    </form>
    <p class="ok" role="status" hidden>Si hay una cuenta con ese correo, te llega un enlace en unos minutos. Revisá también el correo no deseado.</p>
  </section>`;
  formulario(raiz, async (d) => {
    await api.olvido(String(d.get('email') ?? ''));
    raiz.querySelector<HTMLElement>('.ok')!.hidden = false;
    raiz.querySelector('form')!.remove();
  });
};

export const restablecer: Vista = (raiz) => {
  const token = new URLSearchParams(location.hash.split('?')[1] ?? '').get('token') ?? '';
  raiz.innerHTML = `
  <section class="form-caja">
    <h1>Elegí una contraseña nueva</h1>
    <form novalidate>
      <label>Contraseña nueva<input name="password" type="password" autocomplete="new-password" required minlength="8"><span class="meta">Al menos 8 caracteres. Se cierran las demás sesiones abiertas.</span></label>
      <p class="error" role="alert" hidden></p>
      <button class="btn btn-primario" type="submit">Guardar</button>
    </form>
  </section>`;
  formulario(raiz, async (d) => {
    if (!token) throw new Error('El enlace está incompleto. Pedí uno nuevo.');
    const r = await api.restablecer(token, String(d.get('password') ?? ''));
    sesion.poner(r.usuario);
    location.hash = '#/panel';
  });
};
