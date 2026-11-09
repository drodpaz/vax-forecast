# VaxForecast — Contador de vacunas
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.24044549.svg)](https://doi.org/10.5281/zenodo.24044549)

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
- **Previsión de la campaña**: cobertura por grupo de población, fecha estimada para llegar al objetivo, ritmo necesario, **pedido sugerido** para el próximo reparto y dosis que sobrarían o faltarían al final.
- **Resumen semanal por correo** (opcional), cada lunes a las 8:00.
- **Aviso de pedido por Telegram o correo** (opcional): el día que vence el plazo del pedido, te dice qué pedir.
- Configuración del centro: nombre, capacidad, vacunas, profesionales y PIN.

## Privacidad

- **Cada centro tiene su propia copia**: la hoja de cálculo y el script viven en el Google Drive de quien lo instala. Los datos no pasan nunca por la persona autora ni por GitHub; este repositorio solo contiene el código.
- **No se guardan datos de pacientes.** Cada toque guarda únicamente: momento, turno, nombre del profesional, vacuna y +1/−1. El stock guarda vacuna, tipo de movimiento, cantidad y una nota opcional (no escribas ahí datos de pacientes). La previsión solo usa cifras agregadas: población y vacunados por grupo.
- El resumen semanal se envía desde la cuenta de Google de quien instala la aplicación, solo a los correos que pongas.
- Si conectas Telegram, el aviso de pedido (nombre del centro, vacunas y cantidades, sin datos de pacientes) pasa por los servidores de Telegram. El token del bot se guarda en las propiedades del script, no en la hoja.
- **Seguridad del panel:** el PIN nuevo tiene que tener al menos 6 caracteres y, tras 5 intentos fallidos, el panel se bloquea 15 minutos. Lo que se escribe en los formularios se guarda siempre como texto, nunca como fórmula.

### Datos del equipo (RGPD)

Aunque no haya datos de pacientes, **el registro dice quién vacuna, cuándo y cuánto**: son datos personales de la plantilla. Antes de usarlo:

1. **Informa al equipo** de qué se registra y para qué (organizar la campaña y el stock, no evaluar a nadie). Abajo tienes un modelo de nota.
2. **La vista por profesional viene desactivada.** Actívala solo si hay un motivo claro y la plantilla lo sabe, y nunca la uses para medir el rendimiento de nadie.
3. **Consulta con el delegado de protección de datos** de tu servicio de salud. Si tenéis Google Workspace corporativo, instálalo ahí y no en un Gmail personal. Los datos se guardan en servidores de Google, que pueden estar fuera de la UE.
4. Al acabar la campaña, guarda los totales que necesites y **borra o anonimiza** la columna *Profesional* del *Registro*.

> **Modelo de nota para el equipo**
> Durante la campaña de vacunación usaremos un contador para registrar las dosis que se ponen. Cada toque guarda el momento, el turno, el nombre de quien vacuna, la vacuna y si suma o resta. **No se registra ningún dato de pacientes.** Los datos se usan solo para organizar la campaña (dosis necesarias, capacidad y pedidos de vacunas) y no para evaluar a nadie. Están en una hoja de cálculo del centro a la que solo accede [quien coordina]. Se conservarán hasta [fecha] y después se borrarán o anonimizarán. Si tienes dudas o quieres ejercer tus derechos, habla con [quien coordina] o con el delegado de protección de datos.
- La aplicación se ejecuta con la cuenta de quien la instala y solo accede a esa hoja.
- El panel está protegido con un PIN. El enlace del contador lo puede abrir quien lo tenga: compártelo solo con el equipo.
- **Clave del equipo (opcional):** en *Configuración del centro* puedes poner una clave. Entonces el contador solo funciona con el enlace que la lleva al final (`…/exec?k=CLAVE`), y quien tenga el enlace sin ella no puede apuntar dosis ni ver los nombres del equipo. Nadie la escribe: va dentro del enlace que copias con **Copiar enlace del contador**. Si la cambias, el enlace viejo deja de funcionar al momento y hay que poner el nuevo en cada ordenador y móvil. Lo que se cuente mientras tanto se queda en el dispositivo y se envía al poner el enlace bueno.
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
9. Para la previsión, en **Campaña y previsión**: carga una plantilla (o crea los grupos) y pon la **población** de cada grupo.

> **Zona horaria.** Está puesta para la España peninsular (`Europe/Madrid`). En Canarias, cambia la constante `TZ` al principio de `Code.gs` por `'Atlantic/Canary'`. Solo ahí: el contador, el panel y el contador flotante la reciben del servidor.

### Contador flotante (opcional)

1. Descarga [`widget/contador-flotante.html`](widget/contador-flotante.html) y guárdalo en el escritorio de cada ordenador de vacunación.
2. Ábrelo con **Google Chrome** o **Microsoft Edge** (actualizados). La primera vez pide el **enlace del contador** (la URL que termina en `/exec`): pégalo y pulsa **Guardar y conectar**. El navegador lo recuerda.
3. Elige tu nombre y turno y pulsa **Abrir contador flotante**.

Si prefieres que no pregunte nada (por ejemplo, para repartirlo en un USB a todo el equipo), ábrelo con el Bloc de notas, pon tu enlace en lugar de `PEGA_AQUI_LA_URL_DE_TU_APLICACION_WEB` y guarda. Si usas clave del equipo, pega el enlace completo, con el `?k=…` del final. Si un día cambias la clave, el contador flotante lo avisa: pulsa **Cambiar el enlace del contador** y pega el nuevo.

## Uso

### Contador
1. Abre el enlace del contador (en el móvil: *Añadir a pantalla de inicio*).
2. Elige tu nombre y el turno. Se recuerdan para la próxima vez.
3. Pulsa la vacuna cada vez que la pongas; si te equivocas, pulsa **−1**. Si una vacuna está en varios grupos de la campaña, sale un botón por grupo (por ejemplo, *Vaxigrip · 60–64 años* y *Vaxigrip · Menores de 60*): pulsa el del grupo de esa persona.
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

### Previsión de la campaña

**1. Configura la campaña** (sección *Campaña y previsión* del panel):
- Carga una plantilla. Viene la de **Galicia 2026 (gripe)**, hecha a partir de la *Instrución da campaña 2026 de vacinación fronte á gripe e á covid-19* del SERGAS: grupos, fechas de inicio escalonadas, vacuna de cada grupo, objetivos de cobertura y días de reparto. También puedes crear los grupos a mano.
- Pon la **población de cada grupo** (de vuestros cupos o del informe de coberturas). Es lo único que hay que meter a mano.

| Grupo (plantilla Galicia 2026) | Vacuna | Desde | Objetivo |
|---|---|---|---|
| Infantil 6–23 meses | Vaxigrip | 13/10 | 60 % |
| Infantil 2–11 años | Fluenz | 13/10 | 60 % |
| Personal sanitario | Vaxigrip | 13/10 | 60 % |
| 70 años o más | Efluelda | 19/10 | 75 % |
| Embarazadas y puerperio | Vaxigrip | 2/11 | 60 % |
| Riesgo y otros 12–59 años | Vaxigrip | 2/11 | — |
| 65–69 años | Efluelda | 9/11 | 75 % |
| 60–64 años | Vaxigrip | 9/11 | 75 % |

Días de reparto: del 13/10 al 15/11, martes, miércoles y viernes; del 16/11 al 31/12, martes y jueves. El pedido se hace en RVACU antes de las 14:00, dos días laborables antes del reparto. Revisa siempre que coincide con la instrución vigente: se puede cambiar todo en el panel y en las pestañas *Grupos* y *Repartos*.

Si una vacuna se pide con **otro calendario** (por ejemplo, la COVID), añade una fila en la pestaña *Repartos* con su nombre en la columna **Vacunas**. Ejemplo: desde 13/10/2026 hasta 31/12/2026, días `mar, jue`, antelación `0` (se pide el mismo día del reparto), hora límite `12:00`, vacunas `COVID-19`. Las filas con la columna *Vacunas* vacía valen para todas las demás.

**2. Cómo se calcula** (son estimaciones):
- **Vacunados por grupo** = último **dato oficial** del grupo (si lo metes) + dosis del contador desde entonces. Si una vacuna está en varios grupos, el contador muestra un botón por grupo y cada dosis cuenta para el grupo pulsado (desde la v1.3). Las dosis sin grupo (anteriores a la v1.3 o de un contador antiguo) cuentan para los grupos que usan esa vacuna y ya han empezado, repartidas según la población diana de cada uno. Un grupo sin población (por ejemplo, *Menores de 60*) solo cuenta dosis y consumo, sin cobertura.
- **Dato oficial**: cuando tengas el informe de coberturas, mete la **cobertura (%)** o los vacunados de cada grupo y la fecha hasta la que llega el informe. Corrige la estimación igual que un recuento corrige el stock, y el contador suma las dosis posteriores a esa fecha. Sirve también para empezar a usar la app a mitad de campaña.
- **Ritmo** = dosis de los últimos 14 días ÷ días laborables. **Llega al objetivo** = fecha estimada si se mantiene el ritmo. **Necesario / día** = lo que falta ÷ días laborables que quedan.
- **Pedido sugerido** = consumo previsto hasta el reparto siguiente + stock mínimo − stock actual, sin pasar de lo que falta para acabar la campaña. El consumo previsto suma el ritmo de cada grupo hasta que llega a su objetivo y los grupos que todavía no han empezado. Si ya tienes un pedido en camino, réstalo.
- **Al final de la campaña**: dosis que sobrarían o faltarían. Avisa si lo que sobra pasa del 5 % de lo recibido.
- No tiene en cuenta los festivos.

**3. Resumen semanal por correo**: escribe el correo, guarda y pulsa *Activar el envío de los lunes*. Llega a las 8:00 con las dosis de la semana anterior, la cobertura por grupo, el stock y el pedido sugerido. No incluye datos de pacientes.

**4. Aviso de pedido por Telegram (o correo)**: el día en que vence el plazo del pedido del próximo reparto, a la hora que elijas (de 6:00 a 13:00), te llega un mensaje con lo que hay que pedir de cada vacuna, el stock y cuándo llega. Si no hace falta pedir nada, no envía nada, y avisa una sola vez por reparto.

Para conectarlo a Telegram (en *Campaña y previsión › Aviso de pedido*):
1. En Telegram, busca **@BotFather** (el oficial) y escríbele `/newbot`. Ponle un nombre y un usuario que termine en `bot`.
2. Copia el **token** que te da (algo como `123456789:AAF…`), pégalo en el panel y pulsa **Guardar avisos**. No lo compartas.
3. Abre tu bot en Telegram y pulsa **Iniciar** (o escribe `/start`).
4. En el panel, pulsa **Conectar mi Telegram**: te llegará un mensaje de confirmación.
5. Marca **Avisarme los días que toque pedir**, elige la hora y guarda. Con **Enviar aviso de prueba** ves cómo queda.

Para avisar a varias personas, crea un grupo en Telegram, añade el bot, escribe algo en el grupo y pulsa **Conectar** otra vez.

## Actualizar a una versión nueva sin cambiar la URL

1. En la hoja: **Extensiones › Apps Script**.
2. Sustituye el contenido de `Code.gs`, `Contador` y `Panel` por el de la versión nueva y guarda.
3. **Si la versión nueva pide permisos nuevos** (la v1.1 los pide, para enviar correos, programar los avisos y conectar con Telegram): elige la función **prepararHojas**, pulsa **Ejecutar** y acepta los permisos. **Si no lo haces, el contador y el panel dejan de funcionar** hasta que los aceptes.
4. **Implementar › Gestionar implementaciones ›** lápiz (editar) **› Versión: Nueva versión › Implementar**.

Así la URL no cambia y el equipo no tiene que hacer nada. **No uses «Nueva implementación»**: crearía una URL distinta.

Los datos no se pierden: al abrir el contador o el panel, la hoja se pone al día sola. Crea las pestañas que falten (*Stock*, *Grupos*, *Coberturas*, *Repartos*), añade la columna *Stock mínimo* a *Vacunas* y los parámetros nuevos a *Configuración*. Si el panel ya tenía un PIN distinto de 1234, no aparece el asistente: pon el nombre del centro en **Configuración del centro**.

## Hojas que crea

| Pestaña | Contenido |
|---|---|
| Registro | Una fila por toque: momento, fecha, semana, turno, profesional, vacuna, +1/−1, id, grupo (si la vacuna está en varios grupos) |
| Configuración | Nombre del centro, capacidad, PIN del panel… |
| Vacunas | Vacuna, dosis necesarias por semana, activa, stock mínimo |
| Profesionales | Nombres que salen en el contador |
| Stock | Entradas, mermas y recuentos |
| Grupos | Grupos de población: vacunas, fecha de inicio, población, objetivo |
| Coberturas | Datos oficiales de vacunados por grupo (opcional) |
| Repartos | Días de reparto, antelación y hora límite del pedido; opcionalmente, solo para algunas vacunas |

## Estructura del repositorio

```
apps-script/   Code.gs, Contador.html y Panel.html (lo que se pega en Apps Script)
widget/        contador-flotante.html (opcional)
docs/capturas/ imágenes para este README
tests/         pruebas automáticas (node tests/ejecutar.js)
```

## Pruebas

Si tienes [Node.js](https://nodejs.org/), desde la carpeta del proyecto:

```bash
node tests/ejecutar.js
```

Cargan `Code.gs` con una hoja de cálculo simulada y comprueban el contador, la migración de hojas antiguas, el stock, la previsión, los pedidos, los avisos y la seguridad (PIN, clave del equipo, fórmulas, duplicados y fechas).

## Consejos

- Pide que cada profesional abra el contador al empezar el turno y lo deje en una pestaña.
- Una vez por semana, compara el total con el registro oficial de vacunación para ver si algo se quedó sin pulsar.

## Licencia

Copyright © 2026 drodpaz · Licencia [**EUPL-1.2**](LICENSE) (Licencia Pública de la Unión Europea).

- Puedes usarlo, copiarlo, modificarlo y compartirlo, también en organizaciones públicas y privadas.
- Si distribuyes una versión modificada, o la ofreces como servicio en red, tienes que publicar tus cambios con esta misma licencia (o con una compatible, como GPL o AGPL) e indicar la autoría.
- Texto oficial en castellano, gallego y el resto de lenguas de la UE: https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12

Hasta la versión 1.1.0 el proyecto se publicó con licencia CC BY-NC 4.0; desde la 1.1.1 se publica con EUPL-1.2.
