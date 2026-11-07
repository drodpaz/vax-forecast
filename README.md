# VaxForecast — Contador de vacunas

*[Ler en galego](README.gl.md)*

Contador de dosis para campañas de vacunación en centros de salud, hecho con **Google Sheets + Apps Script**. Cada enfermera/o pulsa un botón cada vez que pone una vacuna y el panel compara lo puesto con las dosis necesarias, la capacidad del centro y el stock de la nevera.

- Sin servidores, sin cuentas nuevas, sin instalar nada: funciona en el móvil y en el ordenador.
- Sigue contando sin conexión y envía los toques cuando vuelve la red.
- **No guarda ningún dato de pacientes.**

<!-- CAPTURAS: guarda las imágenes en docs/capturas/ con estos nombres y borra la primera y la última línea de este bloque.
| Contador (móvil) | Panel | Stock |
|---|---|---|
| ![Contador](docs/capturas/contador.png) | ![Panel](docs/capturas/panel.png) | ![Stock](docs/capturas/stock.png) |
-->

---

## Qué hace

**Contador** (para todo el equipo)
- Un botón grande por vacuna: +1 al ponerla y −1 si te equivocas.
- Cada profesional elige su nombre y turno (mañana/tarde); ve sus dosis de hoy y las del centro.
- Si se corta la conexión, guarda los toques en el propio dispositivo y los envía después, sin duplicarlos.

**Contador flotante** (opcional, para el ordenador de la consulta)
- Una ventanita que se queda siempre encima del resto de programas, también del de historia clínica.

**Panel** (protegido con PIN)
- Dosis puestas por día, semana, vacuna, turno y profesional.
- Dosis necesarias por semana frente a dosis puestas, y capacidad (enfermeras/os × huecos × días).
- **Stock**: lo que queda de cada vacuna, consumo medio semanal, semanas que quedan y avisos de stock mínimo.
- Configuración del centro: nombre, capacidad, vacunas, profesionales y PIN.

## Privacidad

- **Cada centro tiene su propia copia**: la hoja de cálculo y el script viven en el Google Drive de quien lo instala. Los datos no pasan nunca por la persona autora ni por GitHub; este repositorio solo contiene el código.
- **No se guardan datos de pacientes.** Cada toque guarda únicamente: momento, turno, nombre del profesional, vacuna y +1/−1. El stock guarda vacuna, tipo de movimiento, cantidad y una nota opcional (no escribas ahí datos de pacientes).
- La aplicación se ejecuta con la cuenta de quien la instala y solo accede a esa hoja.
- El panel está protegido con un PIN. El enlace del contador lo puede abrir quien lo tenga: compártelo solo con el equipo.
- Puedes revisar, corregir o borrar cualquier dato directamente en la hoja.

## Instalación (unos 10 minutos, en el ordenador)

Necesitas una cuenta de Google (sirve una de Gmail).

1. En Google Drive: **Nuevo › Hojas de cálculo de Google › Hoja en blanco**. Ponle un nombre, p. ej. «Vacunación — mi centro».
2. En la hoja: **Extensiones › Apps Script**.
3. En el editor de Apps Script:
   - Borra lo que hay en `Code.gs` y pega el contenido de [`apps-script/Code.gs`](apps-script/Code.gs).
   - Pulsa **+ › HTML**, llámalo exactamente `Contador` y pega [`apps-script/Contador.html`](apps-script/Contador.html).
   - Pulsa **+ › HTML**, llámalo exactamente `Panel` y pega [`apps-script/Panel.html`](apps-script/Panel.html).
   - Guarda (icono del disquete).
4. Arriba, elige la función **prepararHojas** y pulsa **Ejecutar**. Google pedirá permisos: *Revisar permisos › tu cuenta › Configuración avanzada › Ir a … (no seguro) › Permitir*. El aviso sale porque el script es tuyo y no está verificado por Google; solo accede a esta hoja.
5. **Implementar › Nueva implementación ›** (rueda dentada) **Aplicación web**:
   - Ejecutar como: **Yo**.
   - Quién tiene acceso: **Cualquier usuario** (así no hace falta que cada profesional inicie sesión en Google).
   - Pulsa **Implementar** y copia la **URL de la aplicación web** (termina en `/exec`).
6. Enlaces:
   - **Contador** (para todo el equipo): la URL tal cual.
   - **Panel** (para quien coordina): la misma URL añadiendo `?p=panel` al final.
7. Abre el panel e introduce el PIN de fábrica **1234**. Se abrirá el **asistente de primer uso**, que pide:
   - el nombre del centro (aparece en el título del contador y del panel),
   - un PIN nuevo,
   - las vacunas que se ponen,
   - los nombres de los profesionales.
8. Después, en **Configuración del centro**, completa: enfermeras/os que vacunan, huecos por día, días de vacunación, dosis necesarias por semana y stock mínimo de cada vacuna.

> **Zona horaria.** Está puesta para la España peninsular (`Europe/Madrid`). En Canarias, cambia `Europe/Madrid` por `Atlantic/Canary` en `Code.gs`, `Contador.html`, `Panel.html` y en el contador flotante.

### Contador flotante (opcional)

1. Descarga [`widget/contador-flotante.html`](widget/contador-flotante.html) en el ordenador.
2. Ábrelo con el Bloc de notas, busca `PEGA_AQUI_LA_URL_DE_TU_APLICACION_WEB` y pon en su lugar la URL de tu aplicación web (la que termina en `/exec`). Guarda.
3. Ábrelo con **Google Chrome** o **Microsoft Edge** (actualizados), elige tu nombre y pulsa **Abrir contador flotante**.

## Uso

### Contador
1. Abre el enlace del contador (en el móvil: *Añadir a pantalla de inicio*).
2. Elige tu nombre y el turno. Se recuerdan para la próxima vez.
3. Pulsa la vacuna cada vez que la pongas; si te equivocas, pulsa **−1**.
4. Arriba a la derecha verás **✓ Guardado**, o cuántos toques quedan pendientes de enviar. No cierres la página mientras haya pendientes.

### Panel
- Elige el periodo (hoy, esta semana, semana pasada, últimas 4 semanas, toda la campaña o fechas concretas).
- **Necesidades cubiertas**: dosis puestas frente a dosis necesarias del periodo.
- **Huecos aprovechados**: dosis puestas frente a la capacidad del centro.
- **Evolución por semanas**, **día a día** y **por profesional** (esto último se puede ocultar en la configuración).

### Stock
En la sección **Stock** del panel:

| Movimiento | Cuándo usarlo | Efecto |
|---|---|---|
| **Entrada** | Llega un pedido | Suma las dosis |
| **Merma** | Dosis rotas, caducadas o desechadas | Resta las dosis |
| **Recuento** | Cuentas lo que hay en la nevera | El stock pasa a ser exactamente esa cifra |

Cómo se calcula el stock de cada vacuna:

> **último recuento** (o 0 si no hay ninguno) **+ entradas − mermas − dosis puestas** (los +1 y −1 del contador) desde ese recuento.

- **Consumo medio semanal**: dosis puestas en los últimos 14 días ÷ 2.
- **Semanas que quedan**: stock ÷ consumo semanal.
- La fila sale en **rojo** si el stock está por debajo del **stock mínimo**, y en **naranja** si quedan menos de 2 semanas.
- Consejo: empieza con un **Recuento** de cada vacuna y repítelo de vez en cuando (por ejemplo, cada viernes) para corregir los descuadres.
- Para corregir o borrar un movimiento, edítalo en la pestaña **Stock** de la hoja. Si escribes una fila a mano solo con la *Fecha*, se toma como el comienzo de ese día.

## Actualizar a una versión nueva sin cambiar la URL

1. En la hoja: **Extensiones › Apps Script**.
2. Sustituye el contenido de `Code.gs`, `Contador` y `Panel` por el de la versión nueva y guarda.
3. **Implementar › Gestionar implementaciones ›** lápiz (editar) **› Versión: Nueva versión › Implementar**.

Así la URL no cambia y el equipo no tiene que hacer nada. **No uses «Nueva implementación»**: crearía una URL distinta.

Los datos no se pierden: al abrir el contador o el panel, la hoja se pone al día sola (crea la pestaña *Stock*, añade la columna *Stock mínimo* a *Vacunas* y el parámetro *Nombre del centro* a *Configuración*). Si quieres, puedes forzarlo ejecutando **prepararHojas** una vez. Si el panel ya tenía un PIN distinto de 1234, no aparece el asistente: pon el nombre del centro en **Configuración del centro**.

## Hojas que crea

| Pestaña | Contenido |
|---|---|
| Registro | Una fila por toque: momento, fecha, semana, turno, profesional, vacuna, +1/−1 |
| Configuración | Nombre del centro, capacidad, PIN del panel… |
| Vacunas | Vacuna, dosis necesarias por semana, activa, stock mínimo |
| Profesionales | Nombres que salen en el contador |
| Stock | Entradas, mermas y recuentos |

## Estructura del repositorio

```
apps-script/   Code.gs, Contador.html y Panel.html (lo que se pega en Apps Script)
widget/        contador-flotante.html (opcional)
docs/capturas/ imágenes para este README
```

## Consejos

- Pide que cada profesional abra el contador al empezar el turno y lo deje en una pestaña.
- Una vez por semana, compara el total con el registro oficial de vacunación para ver si algo se quedó sin pulsar.

## Licencia

[CC BY-NC 4.0](LICENSE): puedes usarlo, copiarlo y adaptarlo citando la autoría, **sin fines comerciales**.
