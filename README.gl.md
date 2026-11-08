# VaxForecast — Contador de vacinas
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.24044549.svg)](https://doi.org/10.5281/zenodo.24044549)

*[Leer en castellano](README.md)*

Contador de doses para campañas de vacinación en centros de saúde, feito con **Google Sheets + Apps Script**. Cada enfermeira/o preme un botón cada vez que pon unha vacina e o panel compara o posto coas doses necesarias, a capacidade do centro e o stock da neveira.

- Sen servidores, sen contas novas, sen instalar nada: funciona no móbil e no ordenador.
- Segue contando sen conexión e envía os toques cando volve a rede.
- **Non garda ningún dato de pacientes.**

<!-- CAPTURAS: garda as imaxes en docs/capturas/ con estes nomes e borra a primeira e a última liña deste bloque.
| Contador (móbil) | Panel | Stock |
|---|---|---|
| ![Contador](docs/capturas/contador.png) | ![Panel](docs/capturas/panel.png) | ![Stock](docs/capturas/stock.png) |
-->

> A aplicación está en castelán; esta guía está en galego.

---

## Que fai

**Contador** (para todo o equipo)
- Un botón grande por vacina: +1 ao poñela e −1 se te equivocas.
- Cada profesional escolle o seu nome e quenda (mañá/tarde); ve as súas doses de hoxe e as do centro.
- Se se corta a conexión, garda os toques no propio dispositivo e envíaos despois, sen duplicalos.

**Contador flotante** (opcional, para o ordenador da consulta)
- Unha xaneliña que queda sempre enriba do resto de programas, tamén do de historia clínica.

**Panel** (protexido con PIN)
- Doses postas por día, semana, vacina, quenda e profesional.
- Doses necesarias por semana fronte a doses postas, e capacidade (enfermeiras/os × ocos × días).
- **Stock**: o que queda de cada vacina, consumo medio semanal, semanas que quedan e avisos de stock mínimo.
- **Previsión da campaña**: cobertura por grupo de poboación, data estimada para chegar ao obxectivo, ritmo necesario, **pedido suxerido** para o próximo reparto e doses que sobrarían ou faltarían ao final.
- **Resumo semanal por correo** (opcional), cada luns ás 8:00.
- **Aviso de pedido por Telegram ou correo** (opcional): o día que vence o prazo do pedido, dille o que pedir.
- Configuración do centro: nome, capacidade, vacinas, profesionais e PIN.

## Privacidade

- **Cada centro ten a súa propia copia**: a folla de cálculo e o script viven no Google Drive de quen o instala. Os datos nunca pasan pola persoa autora nin por GitHub; este repositorio só contén o código.
- **Non se gardan datos de pacientes.** Cada toque garda unicamente: momento, quenda, nome do profesional, vacina e +1/−1. O stock garda vacina, tipo de movemento, cantidade e unha nota opcional (non escribas aí datos de pacientes). A previsión só usa cifras agregadas: poboación e vacinados por grupo.
- O resumo semanal envíase desde a conta de Google de quen instala a aplicación, só aos correos que poñas.
- Se conectas Telegram, o aviso de pedido (nome do centro, vacinas e cantidades, sen datos de pacientes) pasa polos servidores de Telegram. O token do bot gárdase nas propiedades do script, non na folla.
- A aplicación execútase coa conta de quen a instala e só accede a esa folla.
- O panel está protexido cun PIN. A ligazón do contador pode abrila quen a teña: compártea só co equipo.
- Podes revisar, corrixir ou borrar calquera dato directamente na folla.

## Instalación (uns 10 minutos, no ordenador)

Precisas unha conta de Google (vale unha de Gmail).

1. En Google Drive: **Novo › Follas de cálculo de Google › Folla en branco**. Ponlle un nome, p. ex. «Vacinación — o meu centro».
2. Na folla: **Extensións › Apps Script**.
3. No editor de Apps Script:
   - Borra o que hai en `Code.gs` e pega o contido de [`apps-script/Code.gs`](apps-script/Code.gs).
   - Preme **+ › HTML**, chámao exactamente `Contador` e pega [`apps-script/Contador.html`](apps-script/Contador.html).
   - Preme **+ › HTML**, chámao exactamente `Panel` e pega [`apps-script/Panel.html`](apps-script/Panel.html).
   - Garda (icona do disquete).
4. Arriba, escolle a función **prepararHojas** e preme **Executar**. Google pedirá permisos: *Revisar permisos › a túa conta › Configuración avanzada › Ir a … (non seguro) › Permitir*. O aviso sae porque o script é teu e non está verificado por Google; só accede a esta folla.
5. **Implementar › Nova implementación ›** (roda dentada) **Aplicación web**:
   - Executar como: **Eu**.
   - Quen ten acceso: **Calquera usuario** (así non fai falla que cada profesional inicie sesión en Google).
   - Preme **Implementar** e copia o **URL da aplicación web** (remata en `/exec`).
6. Ligazóns:
   - **Contador** (para todo o equipo): o URL tal cal.
   - **Panel** (para quen coordina): o mesmo URL engadindo `?p=panel` ao final.
7. Abre o panel e introduce o PIN de fábrica **1234**. Abrirase o **asistente de primeiro uso**, que pide:
   - o nome do centro (aparece no título do contador e do panel),
   - un PIN novo,
   - as vacinas que se poñen,
   - os nomes dos profesionais.
8. Despois, en **Configuración del centro**, completa: enfermeiras/os que vacinan, ocos por día, días de vacinación, doses necesarias por semana e stock mínimo de cada vacina.
9. Para a previsión, en **Campaña y previsión**: carga un modelo (ou crea os grupos) e pon a **poboación** de cada grupo.

> **Fuso horario.** Está posto para a España peninsular (`Europe/Madrid`). En Canarias, cambia `Europe/Madrid` por `Atlantic/Canary` en `Code.gs`, `Contador.html`, `Panel.html` e no contador flotante.

### Contador flotante (opcional)

1. Descarga [`widget/contador-flotante.html`](widget/contador-flotante.html) e gárdao no escritorio de cada ordenador de vacinación.
2. Ábreo con **Google Chrome** ou **Microsoft Edge** (actualizados). A primeira vez pide a **ligazón do contador** (o URL que remata en `/exec`): pégaa e preme **Guardar y conectar**. O navegador lémbraa.
3. Escolle o teu nome e quenda e preme **Abrir contador flotante**.

Se prefires que non pregunte nada (por exemplo, para repartilo nun USB a todo o equipo), ábreo co Bloc de notas, pon a túa ligazón no lugar de `PEGA_AQUI_LA_URL_DE_TU_APLICACION_WEB` e garda.

## Uso

### Contador
1. Abre a ligazón do contador (no móbil: *Engadir á pantalla de inicio*).
2. Escolle o teu nome e a quenda. Lémbranse para a próxima vez.
3. Preme a vacina cada vez que a poñas; se te equivocas, preme **−1**.
4. Arriba á dereita verás **✓ Guardado**, ou cantos toques quedan pendentes de enviar. Non peches a páxina mentres haxa pendentes.

### Panel
- Escolle o período (hoxe, esta semana, semana pasada, últimas 4 semanas, toda a campaña ou datas concretas).
- **Necesidades cubertas**: doses postas fronte a doses necesarias do período.
- **Ocos aproveitados**: doses postas fronte á capacidade do centro.
- **Evolución por semanas**, **día a día** e **por profesional** (isto último pódese agochar na configuración).

### Stock
Na sección **Stock** do panel:

| Movemento | Cando usalo | Efecto |
|---|---|---|
| **Entrada** | Chega un pedido | Suma as doses |
| **Merma** | Doses rotas, caducadas ou desbotadas | Resta as doses |
| **Recuento** | Contas o que hai na neveira | O stock pasa a ser exactamente esa cifra |

Como se calcula o stock de cada vacina:

> **último reconto** (ou 0 se non hai ningún) **+ entradas − mermas − doses postas** (os +1 e −1 do contador) desde ese reconto.

- **Consumo medio semanal**: doses postas nos últimos 14 días ÷ 2.
- **Semanas que quedan**: stock ÷ consumo semanal.
- A fila sae en **vermello** se o stock está por debaixo do **stock mínimo**, e en **laranxa** se quedan menos de 2 semanas.
- Consello: comeza cun **Recuento** de cada vacina e repíteo de cando en vez (por exemplo, cada venres) para corrixir os descadres.
- Para corrixir ou borrar un movemento, edítao na lapela **Stock** da folla. Se escribes unha fila a man só coa *Fecha*, tómase como o comezo dese día.

### Previsión da campaña

**1. Configura a campaña** (sección *Campaña y previsión* do panel):
- Carga un modelo. Vén o de **Galicia 2026 (gripe)**, feito a partir da *Instrución da campaña 2026 de vacinación fronte á gripe e á covid-19* do SERGAS: grupos, datas de inicio escalonadas, vacina de cada grupo, obxectivos de cobertura e días de reparto. Tamén podes crear os grupos a man.
- Pon a **poboación de cada grupo** (das vosas cotas ou do informe de coberturas). É o único que hai que meter a man.

| Grupo (modelo Galicia 2026) | Vacina | Desde | Obxectivo |
|---|---|---|---|
| Infantil 6–23 meses | Vaxigrip | 13/10 | 60 % |
| Infantil 2–11 anos | Fluenz | 13/10 | 60 % |
| Persoal sanitario | Vaxigrip | 13/10 | 60 % |
| 70 anos ou máis | Efluelda | 19/10 | 75 % |
| Embarazadas e puerperio | Vaxigrip | 2/11 | 60 % |
| Risco e outros 12–59 anos | Vaxigrip | 2/11 | — |
| 65–69 anos | Efluelda | 9/11 | 75 % |
| 60–64 anos | Vaxigrip | 9/11 | 75 % |

Na aplicación os nomes dos grupos están en castelán. Días de reparto: do 13/10 ao 15/11, martes, mércores e venres; do 16/11 ao 31/12, martes e xoves. O pedido faise en RVACU antes das 14:00, dous días laborables antes do reparto. Revisa sempre que coincide coa instrución vixente: pódese cambiar todo no panel e nas lapelas *Grupos* e *Repartos*.

Se unha vacina se pide con **outro calendario** (por exemplo, a COVID), engade unha fila na lapela *Repartos* co seu nome na columna **Vacunas**. Exemplo: desde 13/10/2026 ata 31/12/2026, días `mar, jue`, antelación `0` (pídese o mesmo día do reparto), hora límite `12:00`, vacinas `COVID-19`. As filas coa columna *Vacunas* baleira valen para todas as demais.

**2. Como se calcula** (son estimacións):
- **Vacinados por grupo** = último **dato oficial** do grupo (se o metes) + doses do contador desde entón. Cada dose conta para os grupos que usan esa vacina e xa comezaron; se son varios (por exemplo, Vaxigrip), repártese segundo a poboación diana de cada un. Así o contador das enfermeiras non cambia.
- **Dato oficial**: cando teñas o informe de coberturas, mete a **cobertura (%)** ou os vacinados de cada grupo e a data ata a que chega o informe. Corrixe a estimación igual que un reconto corrixe o stock, e o contador suma as doses posteriores a esa data. Serve tamén para comezar a usar a app a metade de campaña.
- **Ritmo** = doses dos últimos 14 días ÷ días laborables. **Chega ao obxectivo** = data estimada se se mantén o ritmo. **Necesario / día** = o que falta ÷ días laborables que quedan.
- **Pedido suxerido** = consumo previsto ata o reparto seguinte + stock mínimo − stock actual, sen pasar do que falta para acabar a campaña. O consumo previsto suma o ritmo de cada grupo ata que chega ao seu obxectivo e os grupos que aínda non comezaron. Se xa tes un pedido en camiño, réstao.
- **Ao final da campaña**: doses que sobrarían ou faltarían. Avisa se o que sobra pasa do 5 % do recibido.
- Non ten en conta os festivos.

**3. Resumo semanal por correo**: escribe o correo, garda e preme *Activar el envío de los lunes*. Chega ás 8:00 coas doses da semana anterior, a cobertura por grupo, o stock e o pedido suxerido. Non inclúe datos de pacientes.

**4. Aviso de pedido por Telegram (ou correo)**: o día en que vence o prazo do pedido do próximo reparto, á hora que escollas (das 6:00 ás 13:00), chégache unha mensaxe co que hai que pedir de cada vacina, o stock e cando chega. Se non fai falla pedir nada, non envía nada, e avisa unha soa vez por reparto.

Para conectalo a Telegram (en *Campaña y previsión › Aviso de pedido*):
1. En Telegram, busca **@BotFather** (o oficial) e escríbelle `/newbot`. Ponlle un nome e un usuario que remate en `bot`.
2. Copia o **token** que che dá (algo como `123456789:AAF…`), pégao no panel e preme **Guardar avisos**. Non o compartas.
3. Abre o teu bot en Telegram e preme **Iniciar** (ou escribe `/start`).
4. No panel, preme **Conectar mi Telegram**: chegarache unha mensaxe de confirmación.
5. Marca **Avisarme los días que toque pedir**, escolle a hora e garda. Con **Enviar aviso de prueba** ves como queda.

Para avisar a varias persoas, crea un grupo en Telegram, engade o bot, escribe algo no grupo e preme **Conectar** outra vez.

## Actualizar a unha versión nova sen cambiar o URL

1. Na folla: **Extensións › Apps Script**.
2. Substitúe o contido de `Code.gs`, `Contador` e `Panel` polo da versión nova e garda.
3. **Se a versión nova pide permisos novos** (a v1.1 pídeos, para enviar correos, programar os avisos e conectar con Telegram): escolle a función **prepararHojas**, preme **Executar** e acepta os permisos. **Se non o fas, o contador e o panel deixan de funcionar** ata que os aceptes.
4. **Implementar › Xestionar implementacións ›** lapis (editar) **› Versión: Nova versión › Implementar**.

Así o URL non cambia e o equipo non ten que facer nada. **Non uses «Nova implementación»**: crearía un URL distinto.

Os datos non se perden: ao abrir o contador ou o panel, a folla ponse ao día soa. Crea as lapelas que falten (*Stock*, *Grupos*, *Coberturas*, *Repartos*), engade a columna *Stock mínimo* a *Vacunas* e os parámetros novos a *Configuración*. Se o panel xa tiña un PIN distinto de 1234, non aparece o asistente: pon o nome do centro en **Configuración del centro**.

## Follas que crea

| Lapela | Contido |
|---|---|
| Registro | Unha fila por toque: momento, data, semana, quenda, profesional, vacina, +1/−1 |
| Configuración | Nome do centro, capacidade, PIN do panel… |
| Vacunas | Vacina, doses necesarias por semana, activa, stock mínimo |
| Profesionales | Nomes que saen no contador |
| Stock | Entradas, mermas e recontos |
| Grupos | Grupos de poboación: vacinas, data de inicio, poboación, obxectivo |
| Coberturas | Datos oficiais de vacinados por grupo (opcional) |
| Repartos | Días de reparto, antelación e hora límite do pedido; opcionalmente, só para algunhas vacinas |

## Estrutura do repositorio

```
apps-script/   Code.gs, Contador.html e Panel.html (o que se pega en Apps Script)
widget/        contador-flotante.html (opcional)
docs/capturas/ imaxes para este README
```

## Consellos

- Pide que cada profesional abra o contador ao comezar a quenda e o deixe nunha lapela.
- Unha vez por semana, compara o total co rexistro oficial de vacinación para ver se algo quedou sen premer.

## Licenza

[CC BY-NC 4.0](LICENSE): podes usalo, copialo e adaptalo citando a autoría, **sen fins comerciais**.
