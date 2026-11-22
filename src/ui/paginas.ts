import { AVISOS, AYUDA, DIAS_ARREPENTIMIENTO, MARCA, PLANES, type Plan } from '../config';
import { contratar, leer } from '../cuenta';
import type { Datos } from '../datos';
import { resumir } from '../motor/historial';
import { PESO_MODELO } from '../motor/modelo';
import { esc, pesos, porcentaje, prob } from './formato';

export type Vista = (raiz: HTMLElement, datos: Datos) => void;

const N = esc(MARCA.nombre);

export function avisoDemo(datos: Datos): string {
  if (!datos.partidos.demo && !datos.historial.demo) return '';
  return `<div class="banda-demo" role="note"><strong>Datos de demostración.</strong> Las cuotas, estadísticas y resultados de esta versión son simulados. No corresponden a partidos reales.</div>`;
}

export function tarjetaPlan(p: Plan, accion: string): string {
  const destacado = p.id === 'pro';
  return `
  <div class="plan${destacado ? ' plan-destacado' : ''}">
    ${destacado ? '<span class="chip chip-acento">El más completo</span>' : ''}
    <h3>${esc(p.nombre)}</h3>
    <p class="precio"><strong>${pesos(p.precio)}</strong>${p.precio ? `<span>/${p.periodo}</span>` : `<span> · ${p.periodo}</span>`}</p>
    ${p.nota ? `<p class="meta">${esc(p.nota)}</p>` : ''}
    <ul>${p.incluye.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
    ${accion}
  </div>`;
}

export const inicio: Vista = (raiz, datos) => {
  const r = resumir(datos.historial.registros);
  const cuenta = leer();
  raiz.innerHTML = `
  ${avisoDemo(datos)}
  <section class="hero">
    <p class="eyebrow">Software de análisis estadístico de fútbol</p>
    <h1>Combinadas analizadas con datos, con la probabilidad a la vista.</h1>
    <p class="lead">${N} analiza cuotas y estadísticas de partidos y sugiere las combinadas con mejor relación entre probabilidad estimada y cuota. Vos decidís qué hacer con esa información.</p>
    <div class="acciones">
      <a class="btn btn-primario" href="#/${cuenta ? 'panel' : 'registro'}">${cuenta ? 'Ir a mi panel' : 'Probar 7 días gratis'}</a>
      <a class="btn" href="#/historial">Ver el historial completo</a>
    </div>
    <p class="meta">Solo mayores de 18. Precio fijo, sin comisiones y con baja en un clic.</p>
  </section>

  <section class="cifras" aria-label="Rendimiento del historial">
    <div><strong>${r.total}</strong><span>combinadas publicadas</span></div>
    <div><strong>${r.ganadas}</strong><span>acertadas (${porcentaje(r.aciertos)})</span></div>
    <div><strong class="${r.roi < 0 ? 'neg' : 'pos'}">${porcentaje(r.roi, true)}</strong><span>ROI real sobre todo el historial</span></div>
    <div><a href="#/historial">Ver cada una, con las perdidas →</a></div>
  </section>

  <section class="dos-col">
    <div class="caja">
      <h2>Qué hace</h2>
      <ul class="lista-si">
        <li>Calcula la probabilidad de cada resultado con un modelo estadístico y la compara con la cuota.</li>
        <li>Arma combinadas cerca del objetivo que elijas (x3, x5, x10, x20) con la mejor probabilidad posible.</li>
        <li>Muestra al lado de cada combinada cuántas veces sale en promedio.</li>
        <li>Publica todas las sugerencias, también las que se pierden, y calcula el ROI real.</li>
      </ul>
    </div>
    <div class="caja">
      <h2>Qué no hace</h2>
      <ul class="lista-no">
        <li>No recibe apuestas ni toca tu plata.</li>
        <li>No paga premios ni promete ganancias.</li>
        <li>No está asociado a ninguna casa de apuestas: no hay links, logos ni códigos de bono.</li>
        <li>No decide por vos. Si apostás, hacelo por tu cuenta y solo en operadores con licencia.</li>
      </ul>
    </div>
  </section>

  <section>
    <h2>Un ejemplo de cómo leer una combinada</h2>
    <div class="caja ejemplo">
      <p><strong>Objetivo x20 = ≈ 5% de probabilidad.</strong> Sale, en promedio, 1 de cada 20 veces. Las otras 19 se pierde todo lo apostado.</p>
      <p>La cuota paga más cuando algo es menos probable. Por eso mostramos siempre las dos cosas juntas: la cuota y la probabilidad estimada.</p>
      <a href="#/como-funciona">Cómo calculamos las probabilidades →</a>
    </div>
  </section>

  <section id="planes">
    <h2>Planes</h2>
    <p class="lead">Precio fijo mensual. No cambia según lo que ganes o pierdas.</p>
    <div class="planes">${PLANES.map((p) => tarjetaPlan(p, `<a class="btn${p.id === 'pro' ? ' btn-primario' : ''}" href="#/${cuenta ? 'planes' : 'registro'}">${p.precio ? 'Elegir' : 'Empezar la prueba'}</a>`)).join('')}</div>
    <p class="meta">Sin comisión por ganancia, sin premios por acertar y sin «te devolvemos la plata si no ganás». Derecho de arrepentimiento de ${DIAS_ARREPENTIMIENTO} días.</p>
  </section>`;
};

export const planes: Vista = (raiz) => {
  const c = leer();
  raiz.innerHTML = `
  <section>
    <h1>Planes</h1>
    <p class="lead">Precio fijo, renovación automática y baja en un clic desde tu panel.</p>
    <div class="planes">${PLANES.map((p) => {
      let accion: string;
      if (!c) accion = `<a class="btn" href="#/registro">Registrarme</a>`;
      else if (p.id === 'prueba') accion = `<span class="meta">${c.plan === 'prueba' ? 'Tu plan actual' : 'Incluida al registrarte'}</span>`;
      else if (c.plan === p.id && c.estado === 'activa') accion = `<span class="chip">Tu plan actual</span>`;
      else accion = `<button class="btn btn-primario" data-contratar="${p.id}">Contratar ${esc(p.nombre)}</button>`;
      return tarjetaPlan(p, accion);
    }).join('')}</div>
    <div class="caja nota">
      <p><strong>Versión de demostración:</strong> el pago está simulado y no se cobra nada. Para vender, este botón tiene que abrir el cobro de Mercado Pago o Stripe.</p>
    </div>
  </section>`;
  raiz.querySelectorAll<HTMLButtonElement>('[data-contratar]').forEach((b) =>
    b.addEventListener('click', () => {
      if (!c) return;
      contratar(c, b.dataset.contratar as Plan['id']);
      location.hash = '#/panel';
    }));
};

export const comoFunciona: Vista = (raiz) => {
  raiz.innerHTML = `
  <article class="texto">
    <h1>Cómo funciona</h1>
    <p class="lead">Contenido educativo sobre probabilidad y cuotas. Entender esto es más útil que cualquier sugerencia.</p>

    <h2>1. La cuota esconde una probabilidad</h2>
    <p>Una cuota de 2,00 equivale a una probabilidad de 1 / 2,00 = 50%. Pero si sumás las probabilidades de 1, X y 2 de cualquier casa, dan más de 100%: esa diferencia es el margen de la casa, y es la razón por la que, en promedio, quien apuesta pierde.</p>

    <h2>2. Nuestra estimación</h2>
    <p>Para cada partido calculamos cuántos goles se esperan de cada equipo a partir de sus goles a favor y en contra como local y como visitante (modelo de Poisson, suavizado hacia la media de la liga). Con eso estimamos la probabilidad de 1X2, más o menos de 2,5 goles y ambos marcan.</p>
    <p>Después mezclamos esa estimación con la probabilidad que reflejan las cuotas sin el margen: ${Math.round(PESO_MODELO * 100)}% nuestro modelo y ${Math.round((1 - PESO_MODELO) * 100)}% el mercado. El mercado tiene mucha información, y un modelo que se cree más listo que él suele equivocarse con confianza.</p>

    <h2>3. Cómo se arma una combinada</h2>
    <p>En una combinada se multiplican las cuotas, y también las probabilidades. Tres selecciones de 60% dan 0,6 × 0,6 × 0,6 = 21,6%. Una combinada x20 casi siempre está por debajo de 10%.</p>
    <p>El buscador elige una selección por partido para llegar cerca del objetivo con el mayor «cuota × probabilidad» posible. Si ese número es menor que 1, la combinada pierde plata a la larga, aunque sea la mejor disponible. Lo mostramos igual.</p>

    <h2>4. Lo que el modelo no sabe</h2>
    <ul>
      <li>Lesiones, rotaciones, clima o motivación de último momento.</li>
      <li>Que los partidos de una combinada no siempre son independientes.</li>
      <li>Que con pocas fechas jugadas las estadísticas son ruidosas.</li>
    </ul>

    <h2>5. Cómo comprobarlo</h2>
    <p>En el <a href="#/historial">historial</a> está cada combinada publicada, con su cuota, su probabilidad y su resultado. Comparamos los aciertos reales con los esperados para que puedas ver si las probabilidades están bien calibradas.</p>
  </article>`;
};

export const juegoResponsable: Vista = (raiz) => {
  raiz.innerHTML = `
  <article class="texto">
    <h1>Juego responsable</h1>
    <div class="caja ayuda">
      <h2>${esc(AYUDA.titulo)}</h2>
      <p class="tel">${esc(AYUDA.telefono)}</p>
      <p>${esc(AYUDA.detalle)}</p>
    </div>
    <h2>Señales de alerta</h2>
    <ul>
      <li>Apostás más de lo que pensabas o de lo que podés perder.</li>
      <li>Intentás recuperar lo perdido apostando de nuevo.</li>
      <li>Ocultás cuánto apostás o pedís plata prestada para hacerlo.</li>
      <li>Te pone de mal humor no poder apostar.</li>
    </ul>
    <h2>Herramientas en tu panel</h2>
    <ul>
      <li><strong>Pausar mi cuenta</strong> por 24 horas, 7 días o 30 días. Durante la pausa no se muestran análisis.</li>
      <li><strong>Límite de uso diario</strong> en minutos. Bajarlo rige al instante; subirlo, recién al día siguiente.</li>
      <li><strong>Baja</strong> en un clic y <strong>cerrar la cuenta</strong> borrando tus datos.</li>
    </ul>
    <p>${N} puede suspender cuentas ante señales de juego problemático.</p>
  </article>`;
};

export const terminos: Vista = (raiz) => {
  raiz.innerHTML = `
  <article class="texto">
    <p class="chip">Borrador para revisión del abogado</p>
    <h1>Términos y condiciones</h1>
    <ol class="clausulas">
      <li><strong>Objeto.</strong> ${N} es un software de análisis estadístico de eventos deportivos. Brinda información y sugerencias orientativas. No es una plataforma de juegos de azar ni de apuestas.</li>
      <li><strong>Sin intermediación.</strong> ${N} no recibe, gestiona ni procesa apuestas, depósitos ni premios, y no tiene acuerdos con operadores de apuestas.</li>
      <li><strong>Sin garantía de resultados.</strong> Los análisis se basan en datos y probabilidades. Ningún resultado está garantizado y los resultados pasados no aseguran resultados futuros.</li>
      <li><strong>Responsabilidad del usuario.</strong> El usuario decide libremente si apuesta, dónde y cuánto. Se compromete a hacerlo solo en operadores con licencia en su jurisdicción. ${N} no responde por pérdidas derivadas de esas decisiones.</li>
      <li><strong>Edad.</strong> El servicio es solo para mayores de 18 años. La cuenta se cancela si se detecta un menor.</li>
      <li><strong>Suscripción y baja.</strong> Tiene precio fijo y renovación automática. El usuario puede darse de baja en cualquier momento desde el panel. Corresponde el derecho de arrepentimiento de ${DIAS_ARREPENTIMIENTO} días (Ley 24.240).</li>
      <li><strong>Uso personal.</strong> Está prohibido revender o redistribuir los análisis.</li>
      <li><strong>Juego responsable.</strong> El usuario puede pausar o cerrar su cuenta en cualquier momento. ${N} puede suspender cuentas ante señales de juego problemático.</li>
      <li><strong>Datos personales.</strong> Se tratan según la Ley 25.326. <em>[Completar con una política de privacidad.]</em></li>
      <li><strong>Jurisdicción.</strong> ${esc(MARCA.jurisdiccion)}. <em>[A confirmar con el abogado.]</em></li>
    </ol>
    <p class="meta">Contacto: ${esc(MARCA.contacto)}</p>
  </article>`;
};

export const noEncontrada: Vista = (raiz) => {
  raiz.innerHTML = `<section class="texto"><h1>No encontramos esa página</h1><p><a href="#/">Volver al inicio</a></p></section>`;
};

export const pie = () => `
  <footer class="pie">
    <nav>
      <a href="#/como-funciona">Cómo funciona</a>
      <a href="#/historial">Historial</a>
      <a href="#/planes">Planes</a>
      <a href="#/terminos">Términos</a>
      <a href="#/juego-responsable">Juego responsable</a>
    </nav>
    <p class="meta">${esc(AYUDA.titulo)}: ${esc(AYUDA.telefono)}</p>
    <p class="meta">© ${new Date().getFullYear()} ${N}. Probabilidades estimadas, por ejemplo «x20 ≈ ${prob(0.05)}»: no son garantías.</p>
  </footer>
  <div class="aviso-fijo" role="contentinfo">${esc(AVISOS.pie)}</div>`;
