# Cuotalab

**Software de análisis estadístico de fútbol por suscripción fija.** Analiza cuotas y estadísticas de partidos y sugiere las combinadas con mejor relación entre probabilidad estimada y cuota (por ejemplo, objetivo x20), mostrando siempre la probabilidad al lado.

- **Qué no hace:** no recibe apuestas, no toca la plata del usuario, no paga premios y no está asociado a ninguna casa.
- **Quién decide:** el usuario. Apuesta por su cuenta, donde quiera, siempre en una casa con licencia.

> ⚠️ Esta versión usa **datos simulados** y la web lo avisa en cada pantalla. Antes de vender hay que conectar un proveedor de cuotas con licencia comercial (ver más abajo).

## Sin consumo de tus claves

Los usuarios **no consultan ninguna API ni ningún modelo de IA**. La web es estática:

- Los datos son dos archivos JSON en `public/data/` que se publican con la web.
- Las probabilidades y las combinadas se calculan en el navegador del usuario con un modelo estadístico (Poisson + cuotas del mercado), sin llamadas externas.
- Cuando conectes un proveedor de cuotas, la clave la usás **solo vos**, al actualizar los JSON (por ejemplo, con una tarea programada una vez por día). Los usuarios nunca la ven ni la gastan.

## Qué incluye

| Área | Dónde |
|---|---|
| Inicio, qué hace / qué no hace, planes | `src/ui/paginas.ts` |
| Registro con fecha de nacimiento y casilla +18 obligatoria | `src/ui/registro.ts` |
| Panel: combinadas por plan, filtros por liga, «buscame x20», alertas, exportar CSV | `src/ui/panel.ts` |
| Juego responsable: pausa (24 h, 7 o 30 días, no se acorta), límite diario en minutos (subirlo rige al día siguiente), línea de ayuda | `src/ui/panel.ts` |
| Baja en un clic, reactivación, derecho de arrepentimiento de 10 días, cerrar cuenta y borrar datos | `src/ui/panel.ts`, `src/cuenta.ts` |
| Historial público con las perdidas, ROI real y aciertos esperados frente a reales | `src/ui/historial.ts` |
| Borrador de términos y condiciones, cómo funciona, juego responsable | `src/ui/paginas.ts` |
| Aviso legal fijo en el pie de todas las páginas | `src/config.ts` |
| Modelo de probabilidades | `src/motor/modelo.ts` |
| Buscador de combinadas | `src/motor/combinadas.ts` |

**Nombre, precios, línea de ayuda y textos legales** están todos en `src/config.ts`.

## Ejecutarlo

Necesitás Node.js 22.6 o más reciente.

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # sitio estático en dist/
npm run datos:demo   # regenera los datos simulados
```

## Antes de vender (pendiente)

1. **Cuotas por API con licencia comercial.** Reemplazar `scripts/generar-demo.ts` por un script que lea al proveedor y escriba `public/data/partidos.json` con el mismo formato (`Partido` en `src/motor/modelo.ts`), con `demo: false`. Hacen falta cuotas 1X2, más/menos 2,5 y ambos marcan, y goles a favor y en contra de cada equipo como local y visitante.
2. **Historial real congelado.** Cada día, guardar las combinadas sugeridas y, cuando terminen los partidos, agregarlas a `historial.json` con `registrar()` (`src/motor/historial.ts`). Nunca borrar ni recalcular registros viejos.
3. **Servidor de cuentas y cobro.** Hoy la cuenta vive en el navegador y el pago está simulado. Para vender hacen falta cuentas reales, cobro con Mercado Pago o Stripe, baja que corte la renovación en el procesador de pagos y los límites de plan aplicados en el servidor (en el navegador se pueden saltear). Ahí también se servirían las combinadas solo a quien pagó.
4. **Validación de identidad** (DNI) además de la fecha de nacimiento.
5. **Completar** el número de la línea de ayuda, el correo de contacto, la política de privacidad (Ley 25.326) y la revisión del abogado de los términos.

## Calibración del modelo

El modelo pondera 25% la estadística propia y 75% el mercado (`PESO_MODELO`). Con más peso propio, el buscador elige justo las selecciones donde el modelo más se equivoca y las probabilidades salen infladas. Si cambiás el modelo, revisá en el historial que los aciertos reales se parezcan a los esperados.

## Licencia

MIT
