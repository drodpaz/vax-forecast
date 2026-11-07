# VaxForecast — Contador de vacinas

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
- Configuración do centro: nome, capacidade, vacinas, profesionais e PIN.

## Privacidade

- **Cada centro ten a súa propia copia**: a folla de cálculo e o script viven no Google Drive de quen o instala. Os datos nunca pasan pola persoa autora nin por GitHub; este repositorio só contén o código.
- **Non se gardan datos de pacientes.** Cada toque garda unicamente: momento, quenda, nome do profesional, vacina e +1/−1. O stock garda vacina, tipo de movemento, cantidade e unha nota opcional (non escribas aí datos de pacientes).
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

> **Fuso horario.** Está posto para a España peninsular (`Europe/Madrid`). En Canarias, cambia `Europe/Madrid` por `Atlantic/Canary` en `Code.gs`, `Contador.html`, `Panel.html` e no contador flotante.

### Contador flotante (opcional)

1. Descarga [`widget/contador-flotante.html`](widget/contador-flotante.html) no ordenador.
2. Ábreo co Bloc de notas, busca `PEGA_AQUI_LA_URL_DE_TU_APLICACION_WEB` e pon no seu lugar o URL da túa aplicación web (o que remata en `/exec`). Garda.
3. Ábreo con **Google Chrome** ou **Microsoft Edge** (actualizados), escolle o teu nome e preme **Abrir contador flotante**.

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

## Actualizar a unha versión nova sen cambiar o URL

1. Na folla: **Extensións › Apps Script**.
2. Substitúe o contido de `Code.gs`, `Contador` e `Panel` polo da versión nova e garda.
3. **Implementar › Xestionar implementacións ›** lapis (editar) **› Versión: Nova versión › Implementar**.

Así o URL non cambia e o equipo non ten que facer nada. **Non uses «Nova implementación»**: crearía un URL distinto.

Os datos non se perden: ao abrir o contador ou o panel, a folla ponse ao día soa (crea a lapela *Stock*, engade a columna *Stock mínimo* a *Vacunas* e o parámetro *Nombre del centro* a *Configuración*). Se queres, podes forzalo executando **prepararHojas** unha vez. Se o panel xa tiña un PIN distinto de 1234, non aparece o asistente: pon o nome do centro en **Configuración del centro**.

## Follas que crea

| Lapela | Contido |
|---|---|
| Registro | Unha fila por toque: momento, data, semana, quenda, profesional, vacina, +1/−1 |
| Configuración | Nome do centro, capacidade, PIN do panel… |
| Vacunas | Vacina, doses necesarias por semana, activa, stock mínimo |
| Profesionales | Nomes que saen no contador |
| Stock | Entradas, mermas e recontos |

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
