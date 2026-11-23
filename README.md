# Cuotalab

**Software de análisis estadístico de fútbol por suscripción fija.** Analiza cuotas y estadísticas de partidos y sugiere las combinadas con mejor relación entre probabilidad estimada y cuota (por ejemplo, objetivo x20), mostrando siempre la probabilidad al lado.

- **Qué no hace:** no recibe apuestas, no toca la plata del usuario, no paga premios y no está asociado a ninguna casa.
- **Quién decide:** el usuario. Apuesta por su cuenta, donde quiera, siempre en una casa con licencia.

## Cómo funciona por dentro

```
football-data.co.uk (gratis) ──┐
API-Football (opcional) ───────┼─► Tarea programada ─► Consolidación del mercado ─► Base de datos
                               │   (1 vez por día)     (mismo partido, varias casas)        │
Navegador del usuario ──(cookie de sesión)──► API del servidor ──(según su plan)────────────┘
```

- **Funciona sin pagar datos.** La fuente base es football-data.co.uk: gratis, sin clave, con cuotas de varias casas para las ligas europeas principales. API-Football es opcional y suma cobertura.
- **Varias fuentes, un solo mercado.** El mismo partido se reconoce en todas las fuentes aunque escriban distinto los equipos («Man United» y «Manchester United»). Cada casa cuenta una sola vez. Se calcula:
  - la **cuota de referencia** (mediana) y la **mejor cuota disponible**, sin nombrar casas;
  - la **probabilidad de consenso**: cada casa sin su margen, promediadas (las de margen bajo pesan el doble);
  - y se descartan datos rotos (márgenes imposibles o cuotas muy desviadas del resto).
  Si una fuente falla, el resto sigue funcionando.
- **Nadie consume tus claves.** Solo la tarea programada consulta a las fuentes. Los usuarios piden sus combinadas a tu servidor, que las calcula con los partidos ya guardados: no hay llamadas a APIs externas ni a modelos de IA por cada usuario.
- **Nadie ve lo que no pagó.** Los partidos y las cuotas no se publican. El servidor entrega a cada cuenta solo lo que incluye su plan:
  - Prueba: 1 combinada por día. Básico: 3. Las de cada día quedan fijas, así que cambiar los filtros no da combinadas extra.
  - «A medida», alertas y exportar: solo Pro, y el servidor lo verifica en cada pedido.
  - Las combinadas del historial se publican recién cuando terminan los partidos.
- **Cobro real con Mercado Pago:** suscripción mensual o anual con renovación automática. El plan se activa cuando Mercado Pago confirma el pago (el servidor lo consulta a Mercado Pago, no confía en el navegador).

## Qué incluye

| Área | Archivos |
|---|---|
| Registro con contraseña, fecha de nacimiento y +18 verificados en el servidor, una prueba gratis por correo | `server/router.ts`, `src/ui/acceso.ts` |
| Inicio de sesión, cierre de sesión, recuperación de contraseña por correo, límite de intentos | `server/auth.ts`, `server/correo.ts` |
| Suscripción, baja en un clic (cancela en Mercado Pago), arrepentimiento con reintegro, cambio de plan | `server/pagos.ts` |
| Juego responsable en el servidor: pausa que no se acorta, límite de minutos diarios (subirlo rige al día siguiente), suspensión de cuentas | `server/usuarios.ts`, `src/ui/panel.ts` |
| Historial público, congelado y auditable, con perdidas, anuladas y ROI real | `server/actualizar.ts`, `src/ui/historial.ts` |
| Modelo de probabilidades y buscador de combinadas | `src/motor/` |
| Fuentes de datos: football-data.co.uk (gratis), API-Football (opcional), simulada (solo pruebas) | `server/fuentes/` |
| Consolidación del mercado entre fuentes y casas | `server/fuentes/mercado.ts`, `server/util/nombres.ts` |
| Pruebas automáticas (22) e integración continua | `tests/`, `.github/workflows/ci.yml` |
| Términos, privacidad, juego responsable, aviso fijo en el pie | `src/ui/paginas.ts`, `src/config.ts` |

**Nombre, precios, línea de ayuda y textos legales:** `src/config.ts`.

## Probarlo en tu computadora

Necesitás Node.js 20 o más reciente. No hace falta configurar nada: usa una base de datos local y datos y pagos simulados.

```bash
npm install
npm run demo:sembrar   # carga 60 días de historial SIMULADO y partidos de prueba
npm run dev            # http://localhost:5173
npm test               # pruebas automáticas
```

Para probar con datos **reales y gratuitos** (necesita internet): `npm run actualizar`. Trae los partidos y las cuotas de football-data.co.uk a la base local.

Los correos de recuperación de contraseña aparecen en la consola.

## Ponerlo en producción (Vercel)

1. **Base de datos.** En Vercel → Storage, creá una base Postgres (Neon). Eso carga `DATABASE_URL` sola. Las tablas se crean solas la primera vez.
2. **Datos.** football-data.co.uk funciona sin configurar nada; las ligas están en `server/fuentes/footballdata.ts` (`DIVISIONES`). Opcional: contratá [API-Football](https://www.api-football.com) con uso comercial para sumar la Liga Profesional, «ambos marcan» y cuotas diarias (`LIGAS_API` en `server/fuentes/apifootball.ts`).
3. **Mercado Pago.** En [Tus integraciones](https://www.mercadopago.com.ar/developers/panel/app) creá una aplicación de suscripciones y copiá el Access Token de producción. En Webhooks, configurá la URL `https://TU-DOMINIO/api/webhooks/mercadopago` con los eventos de *Planes y suscripciones* y copiá la clave secreta.
4. **Correo.** Creá una cuenta en [Resend](https://resend.com), verificá tu dominio y copiá la clave.
5. **Variables de entorno.** En Vercel → Settings → Environment Variables, cargá las de `.env.example`: `SESSION_SECRET`, `URL_BASE`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `API_FOOTBALL_KEY`, `CRON_SECRET`, `RESEND_API_KEY` y `CORREO_REMITENTE`.
6. **Publicar.** Hacé deploy. La tarea programada (`vercel.json`) corre todos los días a las 7:00 de Argentina. Para cargar datos la primera vez, ejecutala a mano:
   ```bash
   curl -H "Authorization: Bearer TU_CRON_SECRET" https://TU-DOMINIO/api/cron/actualizar
   ```

En producción la tarea nunca usa datos simulados. Sin `MP_ACCESS_TOKEN`, el botón de pago avisa que los pagos no están configurados. **Nunca corras `demo:sembrar` contra la base de producción** (el script se niega si hay `DATABASE_URL`).

### Límites a tener en cuenta

- El plan gratuito de Vercel permite una tarea programada por día. Con el plan Pro podés cambiar el horario en `vercel.json` para actualizar cuotas y resultados varias veces por día.
- **football-data.co.uk** actualiza sus cuotas unas dos veces por semana y cubre ligas europeas (sin «ambos marcan» ni Liga Profesional). La web muestra la atribución y la fecha de actualización. **Antes de vender, confirmá con ellos las condiciones de uso comercial.**
- Con API-Football, cada actualización usa unas 3 consultas por día de partidos, 1 por partido (cuotas) y 1 por equipo (estadísticas, guardadas un día). Con 4 ligas son unas 100 a 150 consultas por corrida.
- Para suspender una cuenta ante señales de juego problemático: `UPDATE usuarios SET suspendida = true WHERE email = '…';`.

## Pendiente antes de lanzar

- **Validación de identidad (DNI):** hoy se verifica la fecha de nacimiento declarada. Para validar el DNI hace falta un proveedor de verificación (por ejemplo, con RENAPER).
- Completar el número de la línea de ayuda, el correo de contacto y el responsable de la base de datos en `src/config.ts` y en la política de privacidad.
- Revisión del abogado de los términos, la privacidad y las preguntas del documento original.
- Probar el cobro completo con usuarios de prueba de Mercado Pago antes de activar las credenciales de producción.

## Calibración del modelo

El modelo pondera 25% la estadística propia y 75% el mercado (`PESO_MODELO` en `src/motor/modelo.ts`). Con más peso propio, el buscador elige justo las selecciones donde el modelo más se equivoca y las probabilidades salen infladas. El historial muestra los aciertos esperados frente a los reales para vigilarlo.

## Licencia

MIT
