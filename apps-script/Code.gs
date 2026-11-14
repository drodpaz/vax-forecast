/**
 * CONTADOR DE VACUNAS (VaxForecast)
 * Copyright (c) 2026 drodpaz · Licensed under the EUPL (EUPL-1.2) · https://github.com/drodpaz/vax-forecast
 * ------------------------------------------------------------------
 * Pegar en la Hoja de cálculo: Extensiones > Apps Script > Code.gs
 * Junto con los archivos HTML «Contador» y «Panel».
 *
 * Hojas que crea solas (y que completa si vienen de una versión anterior):
 *   Registro       una fila por cada toque (+1 / −1). No contiene datos de pacientes.
 *   Configuración  nombre del centro, enfermeras/os, huecos, días de vacunación, PIN del panel.
 *   Vacunas        vacunas, dosis necesarias por semana y stock mínimo.
 *   Profesionales  nombres que aparecen en el contador.
 *   Stock          entradas de pedidos, mermas y recuentos físicos de la nevera.
 *   Grupos         grupos de población de la campaña: vacunas, fecha de inicio, población y objetivo.
 *   Coberturas     datos oficiales de vacunados por grupo (p. ej. del informe semanal), opcionales.
 *   Repartos       días de reparto de vacunas y plazo para hacer el pedido.
 *   Citas          citados y faltas por agenda y día (opcional): asistencia y cuánto sobrecitar.
 *   Pacientes del día  pacientes reales de un día (de la agenda), si el cálculo del contador no cuadra.
 *   Contadores     filas de cada contador (perfil): vacuna, texto, grupo y casillas.
 */

// Zona horaria del centro. En Canarias: 'Atlantic/Canary'. Solo hay que cambiarla aquí:
// el contador, el panel y el contador flotante la reciben del servidor.
const TZ = 'Europe/Madrid';
const H_REG = 'Registro';
const H_CFG = 'Configuración';
const H_VAC = 'Vacunas';
const H_PRO = 'Profesionales';
const H_STK = 'Stock';

// «Paciente»: 1 en la primera dosis de cada paciente, 0 en las demás dosis del mismo acto (−1 al deshacer).
// «Pauta»: lo que se pulsó en el contador, p. ej. «Efluelda + Comirnaty30».
// «Fila»: el texto de la fila del contador (p. ej. «60–64 años»), para que dos filas de la misma vacuna no se mezclen.
const CAB_REG = ['Momento', 'Fecha', 'Semana', 'Turno', 'Profesional', 'Vacuna', 'Cambio', 'Id', 'Grupo', 'Paciente', 'Pauta', 'Fila'];
// Contadores (perfiles): cada fila es una vacuna de gripe (o solo COVID) con su texto, su grupo y con qué COVID puede ir.
const H_CON = 'Contadores';
const CAB_CON = ['Contador', 'Vacuna de gripe (vacío = solo COVID)', 'Texto de la fila (p. ej. 60–64 años)', 'Grupo', 'Sola (Sí/No)', 'Con COVID (separadas por comas)'];
const CAB_CFG = ['Parámetro', 'Valor'];
const CAB_VAC = ['Vacuna', 'Dosis necesarias por semana', 'Activa (Sí/No)', 'Stock mínimo', 'Protege frente a'];
const PROTEGE = ['Gripe', 'COVID', 'Gripe y COVID'];
// Huecos por día de cada profesional: vacío = el número general de Configuración; 0 = vacuna sin cita (oportunista, p. ej. matrona).
const CAB_PRO = ['Nombre', 'Activo (Sí/No)', 'Perfil', 'Huecos propios por día (vacío = los del perfil; 0 = sin cita)'];
const CAB_STK = ['Momento', 'Fecha', 'Vacuna', 'Tipo', 'Cantidad', 'Nota'];
const TIPOS_STK = ['Entrada', 'Merma', 'Recuento'];
const H_GRU = 'Grupos';
const H_COB = 'Coberturas';
const H_REP = 'Repartos';
const CAB_GRU = ['Grupo', 'Vacunas (separadas por comas)', 'Desde', 'Población', 'Objetivo %', 'Activo (Sí/No)', 'Techo esperado %', 'Suma en (opcional)'];
const H_CIT = 'Citas';
// Pacientes reales de un día (de la agenda), para corregir días en que cada dosis contó como un paciente.
const H_PAC = 'Pacientes del día';
const CAB_PAC = ['Momento', 'Fecha', 'Pacientes', 'Nota'];
const CAB_CIT = ['Momento', 'Fecha', 'Agenda', 'Citados', 'Faltaron'];
const CAB_COB = ['Momento', 'Fecha', 'Grupo', 'Vacunados acumulados', 'Nota'];
const CAB_REP = ['Desde', 'Hasta', 'Días de reparto', 'Antelación del pedido (días laborables)', 'Hora límite del pedido', 'Vacunas (vacío = todas las demás)'];

const PIN_FABRICA = '1234';
const P = {
  centro: 'Nombre del centro',
  enf: 'Enfermeras/os que vacunan',
  huecos: 'Huecos de vacunación por enfermera/o y día',
  dias: 'Días de vacunación por semana',
  pin: 'PIN del panel',
  porProf: 'Mostrar datos por profesional (Sí/No)',
  inicio: 'Inicio de campaña',
  fin: 'Fin de campaña',
  correo: 'Correo del resumen semanal',
  avisoCorreo: 'Aviso de pedido también por correo (Sí/No)',
  avisoHora: 'Hora del aviso de pedido',
  clave: 'Clave del equipo (vacío = sin clave)',
  agendas: 'Agendas de cita (separadas por comas)',
  pautas: 'Pautas del contador (separadas por ; vacío = todas)',
  perfiles: 'Perfiles y huecos por día (p. ej. Enfermería de familia: 14; Enfermería obstétrica: 0)'
};
// La vista por profesional viene desactivada: son datos personales de la plantilla (RGPD).
const PARAMS_DEF = [[P.centro, ''], [P.enf, '6'], [P.huecos, '12'], [P.dias, '5'], [P.pin, PIN_FABRICA], [P.porProf, 'No'],
  [P.inicio, ''], [P.fin, ''], [P.correo, ''], [P.avisoCorreo, 'No'], [P.avisoHora, '9'], [P.clave, ''], [P.agendas, ''], [P.pautas, ''], [P.perfiles, '']];
// El token del bot de Telegram y el chat se guardan en las propiedades del script, no en la hoja.
const PROP_TG_TOKEN = 'TELEGRAM_TOKEN';
const PROP_TG_CHAT = 'TELEGRAM_CHAT';
const PROP_TG_NOMBRE = 'TELEGRAM_CHAT_NOMBRE';
const PROP_AVISO_HECHO = 'AVISO_PEDIDO_ENVIADO';
const VAC_DEF = [['Gripe', 0, 'Sí', 0, 'Gripe'], ['COVID-19', 0, 'Sí', 0, 'COVID']];

/**
 * Plantillas de campaña. Solo cambian los grupos, las fechas y los repartos;
 * la población de cada grupo la pone cada centro.
 * Galicia 2026: «Campaña 2026 de vacinación fronte á gripe e á covid-19» (Instrución SERGAS),
 * cronograma (ap. 4), vacina por idade (ap. 7.1.3), obxectivos (ap. 2.2) e repartos (ap. 7.1.1).
 */
const PLANTILLAS = {
  'galicia-2026': {
    nombre: 'Galicia 2026 (gripe)',
    inicio: '2026-09-28',
    fin: '2026-12-31',
    vacunas: ['Efluelda', 'Vaxigrip', 'Fluenz'],
    grupos: [
      ['Infantil 6–23 meses', 'Vaxigrip', '2026-10-13', 60],
      ['Infantil 2–11 años', 'Fluenz', '2026-10-13', 60],
      ['Personal sanitario', 'Vaxigrip', '2026-10-13', 60],
      ['70 años o más', 'Efluelda', '2026-10-19', 75, '60 o más'],
      ['Embarazadas y puerperio', 'Vaxigrip', '2026-11-02', 60],
      ['Riesgo y otros 12–59 años', 'Vaxigrip', '2026-11-02', 0],
      ['65–69 años', 'Efluelda', '2026-11-09', 75, '60 o más'],
      ['60–64 años', 'Vaxigrip', '2026-11-09', 75, '60 o más']
    ],
    repartos: [
      ['2026-10-13', '2026-11-15', 'mar, mié, vie', 2, '14:00', ''],
      ['2026-11-16', '2026-12-31', 'mar, jue', 2, '14:00', '']
    ]
  }
};

/* ---------------------------- Web app ---------------------------- */

function doGet(e) {
  const prm = (e && e.parameter) || {};
  if (prm.api) return api_(prm.api, prm);
  asegurarHojas_();
  migrar_();
  const panel = prm.p === 'panel';
  const centro = leerConfig_().centro;
  const titulo = (panel ? 'Panel de vacunación' : 'Contador de vacunas') + (centro ? ' · ' + centro : '');
  return HtmlService.createHtmlOutputFromFile(panel ? 'Panel' : 'Contador')
    .setTitle(titulo)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Entrada para el contador flotante (widget): envía los toques por POST. */
function doPost(e) {
  let d = {};
  try { d = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) {}
  return api_(d.accion, d);
}

/** Pequeña API en JSON para el contador flotante. */
function api_(accion, d) {
  let out;
  try {
    if (accion === 'datos') out = datosContador(d.k);
    else if (accion === 'hoy') out = misHoy(d.profesional, d.k);
    else if (accion === 'registrar') out = registrar(d.lista, d.k);
    else out = { error: 'Acción desconocida' };
  } catch (err) {
    out = { error: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Vacunas')
    .addItem('Preparar hojas', 'prepararHojas')
    .addToUi();
}

function prepararHojas() {
  asegurarHojas_();
  migrar_();
}

/* ------------------------- Contador ------------------------------ */

/**
 * Clave del equipo (opcional). Si está puesta en Configuración, el contador solo funciona
 * con el enlace que la lleva al final (…/exec?k=CLAVE): quien tenga el enlace sin la clave
 * no puede apuntar dosis ni ver los nombres del equipo.
 */
const CLAVE_MIN = 6;
function comprobarClave_(c, k) {
  if (!c.clave) return;
  if (String(k == null ? '' : k).trim() !== c.clave) throw new Error('Clave del equipo incorrecta: pide el enlace nuevo del contador a quien coordina la vacunación.');
}
function claveValida_(k) { return new RegExp('^[A-Za-z0-9_-]{' + CLAVE_MIN + ',40}$').test(k); }
function urlContador_(c) { const u = urlApp_(); return u && c.clave ? u + '?k=' + encodeURIComponent(c.clave) : u; }

/** Datos que necesita la pantalla del contador. */
function datosContador(k) {
  const c = leerConfig_();
  comprobarClave_(c, k);
  return {
    centro: c.centro,
    tz: TZ,
    vacunas: c.vacunas.filter(function (v) { return v.activa; }).map(function (v) { return v.nombre; }),
    botones: botonesContador_(c), // contadores anteriores a la v1.4
    cuadricula: cuadricula_(c), // si no hay contadores definidos
    contadores: leerContadores_(c).map(function (k) { return { nombre: k.nombre, cuadricula: cuadriculaDe_(c, k) }; }),
    profesionales: c.profesionales,
    hoy: hoy_()
  };
}

/**
 * Botones del contador: uno por vacuna; si una vacuna está en varios grupos activos
 * (p. ej. Vaxigrip en «60–64 años» y en «Menores de 60»), uno por cada grupo, para que
 * la dosis quede apuntada en su grupo y la previsión no tenga que repartirla a ojo.
 *   [{vacuna, grupo}]   grupo '' = sin grupo (la vacuna está en uno o en ninguno).
 */
function botonesContador_(c) {
  const grupos = leerGrupos_().filter(function (g) { return g.activo; });
  const out = [];
  c.vacunas.filter(function (v) { return v.activa; }).forEach(function (v) {
    const kv = v.nombre.toLowerCase();
    const suyos = grupos.filter(function (g) { return g.vacunas.some(function (x) { return x.toLowerCase() === kv; }); });
    if (suyos.length < 2) out.push({ vacuna: v.nombre, grupo: '' });
    else suyos.forEach(function (g) { out.push({ vacuna: v.nombre, grupo: g.nombre }); });
  });
  return out;
}

/** Grupo de un toque: el nombre exacto de un grupo activo que usa esa vacuna, o ''. */
function grupoDeToque_(grupos, vac, g) {
  const kg = String(g == null ? '' : g).trim().toLowerCase();
  if (!kg) return '';
  const kv = vac.toLowerCase();
  const x = grupos.filter(function (y) {
    return y.nombre.toLowerCase() === kg && y.vacunas.some(function (v) { return v.toLowerCase() === kv; });
  })[0];
  return x ? x.nombre : '';
}

/**
 * Guarda una lista de toques. Cada toque: {id, momento, profesional, turno, vacuna, cambio, grupo}.
 * «grupo» es opcional: si no es un grupo activo que usa esa vacuna, se guarda vacío.
 * Devuelve los id guardados (también los repetidos, para que el móvil los borre de su cola)
 * y los rechazados (vacuna que ya no existe, id o fecha no válidos).
 *   - Repetidos: se comprueba el Id en la hoja (últimas IDS_REVISADOS filas), no solo en la caché.
 *   - Fecha: se guarda la del toque. Si viene del futuro (reloj del móvil adelantado), la de ahora;
 *     si tiene más de MAX_DIAS_ATRAS días, se rechaza.
 */
const IDS_REVISADOS = 20000;
const MAX_DIAS_ATRAS = 120;
function registrar(lista, k) {
  const c = leerConfig_();
  comprobarClave_(c, k);
  if (!Array.isArray(lista) || !lista.length) return { ok: true, guardados: [], rechazados: [] };
  lista = lista.slice(0, 500);
  const vacs = {};
  c.vacunas.forEach(function (v) { vacs[v.nombre] = true; });
  const grupos = leerGrupos_().filter(function (g) { return g.activo; });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const h = libro_().getSheetByName(H_REG);
    if (h.getMaxColumns() < CAB_REG.length) h.insertColumnsAfter(h.getMaxColumns(), CAB_REG.length - h.getMaxColumns());
    const ultima = h.getLastRow();
    const yaEstan = {};
    if (ultima > 1) {
      const desde = Math.max(2, ultima - IDS_REVISADOS + 1);
      h.getRange(desde, 8, ultima - desde + 1, 1).getValues().forEach(function (r) { if (r[0] !== '') yaEstan[String(r[0])] = true; });
    }
    const ahora = Date.now();
    const filas = [];
    const guardados = [];
    const rechazados = [];

    lista.forEach(function (e) {
      const id = String((e && e.id) || '').slice(0, 40);
      if (!id) return;
      if (!/^[\w-]+$/.test(id)) { rechazados.push(id); return; }
      if (yaEstan[id]) { guardados.push(id); return; }

      const vac = String(e.vacuna || '').trim();
      const cambio = Number(e.cambio);
      let t = Number(e.momento);
      if (!isFinite(t)) t = ahora;
      if (t > ahora + 5 * 60000) t = ahora;
      if (!vacs[vac] || (cambio !== 1 && cambio !== -1) || t < ahora - MAX_DIAS_ATRAS * 86400000) { rechazados.push(id); return; }

      const d = new Date(t);
      const prof = limpiarTexto_(e.profesional, 60) || 'Sin nombre';
      const turno = e.turno === 'Tarde' ? 'Tarde' : 'Mañana';
      const fecha = Utilities.formatDate(d, TZ, 'yyyy-MM-dd');

      // Paciente: los contadores v1.4 mandan 1/0/−1; los anteriores no, y cada dosis cuenta como un paciente.
      const pac = e.paciente === 0 || e.paciente === 1 || e.paciente === -1 ? (e.paciente === 0 ? 0 : cambio) : cambio;
      const pauta = limpiarTexto_(e.pauta, 80) || vac;
      filas.push([d, fecha, semanaDeFecha_(fecha), turno, prof, vac, cambio, id, grupoDeToque_(grupos, vac, e.grupo), pac, pauta, limpiarTexto_(e.fila, 40)]);
      guardados.push(id);
      yaEstan[id] = true;
    });

    if (filas.length) h.getRange(ultima + 1, 1, filas.length, CAB_REG.length).setValues(filas);
    return { ok: true, guardados: guardados, rechazados: rechazados };
  } finally {
    lock.releaseLock();
  }
}

/** Dosis de hoy: las de un profesional y las de todo el centro. */
function misHoy(profesional, k) {
  comprobarClave_(leerConfig_(), k);
  const hoy = hoy_();
  const prof = String(profesional || '').trim();
  const mias = {};
  const miasG = {}; // por botón de la v1.3: «vacuna|grupo»
  const casillas = {}; // pacientes por casilla de la cuadrícula: «pauta|grupo»
  const centro = {};
  let pila = []; // pacientes de hoy de este profesional, en orden, para «Deshacer»
  let ultima = 0, pac = 0, dosis = 0, pacCentro = 0;
  const filas = leerRegistroDesde_(hoy).filter(function (r) { return r.fecha === hoy; });
  filas.sort(function (a, b) { return a.t - b.t; });
  filas.forEach(function (r) {
    centro[r.vacuna] = (centro[r.vacuna] || 0) + r.cambio;
    pacCentro += r.paciente;
    if (r.profesional !== prof) return;
    mias[r.vacuna] = (mias[r.vacuna] || 0) + r.cambio;
    const kb = r.vacuna + '|' + r.grupo;
    miasG[kb] = (miasG[kb] || 0) + r.cambio;
    dosis += r.cambio;
    if (r.cambio > 0 && r.t > ultima) ultima = r.t;
    if (!r.paciente) return;
    pac += r.paciente;
    const kc = r.pauta + '|' + r.grupo + '|' + r.fila;
    casillas[kc] = (casillas[kc] || 0) + r.paciente;
    if (r.paciente > 0) pila.push({ p: r.pauta, g: r.grupo, f: r.fila, t: r.t });
    else for (let i = pila.length - 1; i >= 0; i--) if (pila[i].p === r.pauta && pila[i].g === r.grupo && pila[i].f === r.fila) { pila.splice(i, 1); break; }
  });
  return { hoy: hoy, mias: mias, miasG: miasG, centro: centro, ultima: ultima,
    casillas: casillas, pila: pila.slice(-30), pacientes: pac, dosis: dosis, pacientesCentro: pacCentro };
}

/* --------------------------- Panel ------------------------------- */

/** Nombre del centro para la pantalla del PIN (no es un dato reservado). */
function infoPublica() {
  return { centro: leerConfig_().centro };
}

/**
 * Comprueba el PIN. Si sigue siendo el de fábrica, avisa de que hay que pasar
 * por el asistente de primer uso y le manda lo que ya hay configurado.
 */
function comprobarPin(pin) {
  const c = leerConfig_();
  comprobarPin_(c, pin);
  if (!esPinFabrica_(c)) return { ok: true, primerUso: false, centro: c.centro, tz: TZ };
  return {
    ok: true,
    primerUso: true,
    centro: c.centro,
    tz: TZ,
    vacunas: c.vacunas.map(function (v) { return v.nombre; }),
    profesionales: c.profesionales
  };
}

/** Asistente de primer uso: nombre del centro, PIN nuevo, vacunas y profesionales. */
function completarAsistente(pin, d) {
  const c = leerConfig_();
  comprobarPin_(c, pin);
  if (!esPinFabrica_(c)) throw new Error('El asistente ya se completó. Usa «Configuración del centro».');
  d = d || {};

  const centro = limpiarTexto_(d.centro, 80);
  if (!centro) throw new Error('Escribe el nombre del centro.');
  const nuevoPin = String(d.pin || '').trim();
  if (!pinValido_(nuevoPin)) throw new Error('El PIN nuevo tiene que tener entre ' + PIN_MIN + ' y 20 caracteres, sin espacios.');
  if (nuevoPin === PIN_FABRICA) throw new Error('El PIN nuevo no puede ser ' + PIN_FABRICA + '.');

  // Se conservan las cifras de las vacunas que ya existían con el mismo nombre.
  const previas = {};
  c.vacunas.forEach(function (v) { previas[v.nombre.toLowerCase()] = v; });
  const vistasV = {};
  const vac = (d.vacunas || [])
    .map(function (s) { return limpiarTexto_(s, 40); })
    .filter(function (s) { if (!s || vistasV[s.toLowerCase()]) return false; vistasV[s.toLowerCase()] = true; return true; })
    .slice(0, 30)
    .map(function (n) {
      const p = previas[n.toLowerCase()];
      return [n, p ? p.necesarias : 0, 'Sí', p ? p.minimo : 0, p ? p.protegeTxt : protegeTxt_(protegeDe_(n, ''))];
    });
  if (!vac.length) throw new Error('Escribe al menos una vacuna.');

  const pro = listaProfesionales_(d.profesionales, c.perfiles);
  const params = filasParams_(c, { centro: centro, pin: nuevoPin });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = libro_();
    reescribir_(ss.getSheetByName(H_CFG), CAB_CFG, params, true);
    reescribir_(ss.getSheetByName(H_VAC), CAB_VAC, vac, false);
    reescribir_(ss.getSheetByName(H_PRO), CAB_PRO, pro, false);
  } finally {
    lock.releaseLock();
  }
  return { ok: true };
}

/** Resumen para el panel entre dos fechas (yyyy-MM-dd). */
function resumen(pin, desde, hasta) {
  const c = leerConfig_();
  comprobarPin_(c, pin);
  const reg = leerRegistro_();
  const hoy = hoy_();
  const re = /^\d{4}-\d{2}-\d{2}$/;

  let primero = null;
  reg.forEach(function (r) { if (!primero || r.fecha < primero) primero = r.fecha; });
  if (!re.test(String(desde || ''))) desde = primero || hoy;
  if (!re.test(String(hasta || ''))) hasta = hoy;
  if (desde > hasta) { const x = desde; desde = hasta; hasta = x; }

  const porDia = {};
  const porVac = {};
  const porProf = {};
  const porSem = {};
  const porTurno = {};
  let pacientes = 0, sinCita = 0;
  const porPerfil = {};
  const pacTodo = {}; // pacientes calculados de cada día (todas las fechas), para corregir las semanas

  reg.forEach(function (r) {
    const s = porSem[r.semana] || (porSem[r.semana] = { total: 0, pac: 0, v: {}, desde: r.fecha });
    s.total += r.cambio;
    s.pac += r.paciente;
    pacTodo[r.fecha] = (pacTodo[r.fecha] || 0) + r.paciente;
    s.v[r.vacuna] = (s.v[r.vacuna] || 0) + r.cambio;
    if (r.fecha < s.desde) s.desde = r.fecha;

    if (r.fecha < desde || r.fecha > hasta) return;

    const d = porDia[r.fecha] || (porDia[r.fecha] = { total: 0, pac: 0, pacSin: 0, v: {}, prof: {} });
    d.total += r.cambio;
    d.pac += r.paciente;
    if (!huecosDe_(c, r.profesional)) { d.pacSin += r.paciente; sinCita += r.paciente; }
    const pk = perfilDe_(c, r.profesional);
    const pp = porPerfil[pk] || (porPerfil[pk] = { pac: 0, dosis: 0, sin: 0, dias: {} });
    pp.pac += r.paciente;
    pp.dosis += r.cambio;
    if (!huecosDe_(c, r.profesional)) pp.sin += r.paciente;
    (pp.dias[r.fecha] || (pp.dias[r.fecha] = {}))[r.profesional] = true;
    pacientes += r.paciente;
    d.v[r.vacuna] = (d.v[r.vacuna] || 0) + r.cambio;
    d.prof[r.profesional] = true;

    porVac[r.vacuna] = (porVac[r.vacuna] || 0) + r.cambio;
    porTurno[r.turno] = (porTurno[r.turno] || 0) + r.cambio;

    if (c.porProfesional) {
      const p = porProf[r.profesional] || (porProf[r.profesional] = { total: 0, pac: 0, v: {}, dias: {} });
      p.total += r.cambio;
      p.pac += r.paciente;
      p.v[r.vacuna] = (p.v[r.vacuna] || 0) + r.cambio;
      p.dias[r.fecha] = true;
    }
  });

  // Pacientes reales apuntados a mano: sustituyen al cálculo de ese día (total del día, semana y periodo).
  const reales = leerPacientesDia_();
  Object.keys(reales).forEach(function (f) {
    const n = reales[f].n;
    const sk = semanaDeFecha_(f);
    const sem = porSem[sk] || (porSem[sk] = { total: 0, pac: 0, v: {}, desde: f });
    sem.pac += n - (pacTodo[f] || 0);
    if (f < desde || f > hasta) return;
    const d = porDia[f] || (porDia[f] = { total: 0, pac: 0, pacSin: 0, v: {}, prof: {} });
    pacientes += n - d.pac;
    d.calc = d.pac;
    d.pac = n;
    d.real = reales[f];
  });

  return {
    config: {
      tz: TZ, pinCorto: !!c.pin && c.pin.length < PIN_MIN,
      centro: c.centro, enfermeras: c.enfermeras, huecos: c.huecos, dias: c.dias,
      porProfesional: c.porProfesional, vacunas: c.vacunas, profesionales: c.profesionales, clave: c.clave,
      huecosProf: c.huecosProf, perfilProf: c.perfilProf, perfiles: c.perfiles, capDia: capacidadDia_(c), huecosPropios: porPersona_(c),
      grupos: leerGrupos_().filter(function (g) { return g.activo; }).map(function (g) { return { nombre: g.nombre, vacunas: g.vacunas }; }),
      contadores: leerContadores_(c),
      pautas: c.pautasTxt ? textoPautas_(c.pautas) : '', pautasLista: c.pautas
    },
    desde: desde,
    hasta: hasta,
    hoy: hoy,
    primerRegistro: primero,
    porDia: Object.keys(porDia).sort().map(function (f) {
      const d = porDia[f];
      const profs = Object.keys(d.prof);
      return { fecha: f, total: d.total, pacientes: d.pac, sinCita: Math.min(d.pacSin, d.pac), v: d.v, profesionales: profs.length,
        capacidad: profs.reduce(function (s, p) { return s + huecosDe_(c, p); }, 0),
        real: d.real ? { calculados: d.calc, nota: d.real.nota } : null };
    }),
    porVacuna: porVac,
    pacientes: pacientes,
    sinCita: sinCita,
    // Por perfil: sin nombres, así que se ve aunque «Mostrar datos por profesional» esté en No.
    porPerfil: c.perfiles.map(function (x) { return x.nombre; }).concat(['']).filter(function (k) { return porPerfil[k]; }).map(function (k) {
      const x = porPerfil[k];
      const fechas = Object.keys(x.dias);
      const cap = fechas.reduce(function (s, f) { return s + Object.keys(x.dias[f]).reduce(function (t, p) { return t + huecosDe_(c, p); }, 0); }, 0);
      return { perfil: k, pacientes: x.pac, dosis: x.dosis, sinCita: x.sin, dias: fechas.length, capacidad: cap };
    }),
    porTurno: porTurno,
    porProfesional: c.porProfesional
      ? Object.keys(porProf).map(function (n) {
          const p = porProf[n];
          return { nombre: n, total: p.total, pacientes: p.pac, v: p.v, dias: Object.keys(p.dias).length, huecos: huecosDe_(c, n) };
        }).sort(function (a, b) { return b.total - a.total; })
      : null,
    porSemana: Object.keys(porSem).sort().map(function (k) {
      return { semana: k, desde: lunesDe_(porSem[k].desde), total: porSem[k].total, pacientes: porSem[k].pac, v: porSem[k].v };
    }),
    urlContador: urlContador_(c),
    urlHoja: libro_().getUrl()
  };
}

/** Guarda la configuración desde el panel. */
function guardarConfig(pin, cfg) {
  const c = leerConfig_();
  comprobarPin_(c, pin);
  cfg = cfg || {};

  const vac = (cfg.vacunas || [])
    .filter(function (v) { return v && String(v.nombre || '').trim(); })
    .slice(0, 30)
    .map(function (v) {
      const nom = limpiarTexto_(v.nombre, 40);
      return [nom, num_(v.necesarias), v.activa === false ? 'No' : 'Sí', Math.round(num_(v.minimo)), protegeTxt_(protegeDe_(nom, v.protege))];
    });
  if (!vac.length) throw new Error('Tiene que haber al menos una vacuna.');
  // Pautas del contador: se comprueban con la lista de vacunas nueva.
  const vacsNuevas = vac.map(function (r) { return { nombre: r[0], activa: r[2] === 'Sí', protege: protegeDe_(r[0], r[4]) }; });
  const pautas = cfg.pautas == null ? c.pautasTxt : textoPautas_(leerPautas_(cfg.pautas, vacsNuevas, true));

  const perfiles = cfg.perfiles == null ? c.perfiles : perfilesDe_(cfg.perfiles);
  // Contadores: se comprueban con la lista de vacunas nueva.
  let contadores = null;
  if (cfg.contadores != null) {
    const c2 = Object.assign({}, c, { vacunas: vacsNuevas.map(function (v) { return { nombre: v.nombre, activa: v.activa, protege: v.protege }; }) });
    const filasK = [];
    (cfg.contadores || []).forEach(function (k) {
      (k.filas || []).forEach(function (fl) { filasK.push({ contador: k.nombre, gripe: fl.gripe, texto: fl.texto, grupo: fl.grupo, sola: fl.sola, covid: fl.covid || [] }); });
    });
    contadores = [];
    contadoresDe_(c2, filasK, true).forEach(function (k) {
      k.filas.forEach(function (fl) { contadores.push([k.nombre, fl.gripe, fl.texto, fl.grupo, fl.ambas || fl.sola ? 'Sí' : 'No', fl.covid.join(', ')]); });
    });
  }
  const pro = listaProfesionales_(cfg.profesionales, perfiles);
  const pinPedido = String(cfg.pin || '').trim();
  if (pinPedido && !pinValido_(pinPedido)) throw new Error('El PIN nuevo tiene que tener entre ' + PIN_MIN + ' y 20 caracteres, sin espacios.');
  const nuevoPin = pinPedido || c.pin;
  const clave = cfg.clave == null ? c.clave : String(cfg.clave).trim();
  if (clave && !claveValida_(clave)) throw new Error('La clave del equipo tiene que tener entre ' + CLAVE_MIN + ' y 40 letras sin tilde, números, - o _ (sin espacios).');
  const params = filasParams_(c, {
    clave: clave,
    centro: cfg.centro == null ? c.centro : limpiarTexto_(cfg.centro, 80),
    enfermeras: num_(cfg.enfermeras),
    huecos: num_(cfg.huecos),
    dias: Math.min(7, num_(cfg.dias) || 5),
    pin: nuevoPin,
    porProfesional: !!cfg.porProfesional,
    pautasTxt: pautas,
    perfiles: perfiles
  });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = libro_();
    reescribir_(ss.getSheetByName(H_CFG), CAB_CFG, params, true);
    reescribir_(ss.getSheetByName(H_VAC), CAB_VAC, vac, false);
    reescribir_(ss.getSheetByName(H_PRO), CAB_PRO, pro, false);
    if (contadores) reescribir_(ss.getSheetByName(H_CON), CAB_CON, contadores, [1, 2, 3, 4, 5, 6]);
  } finally {
    lock.releaseLock();
  }
  return { ok: true, pinCambiado: nuevoPin !== c.pin, claveCambiada: clave !== c.clave };
}

/* --------------------------- Stock ------------------------------- */

/** Stock actual por vacuna y últimos movimientos. */
function stock(pin) {
  const c = leerConfig_();
  comprobarPin_(c, pin);
  return calcularStock_(c);
}

/**
 * Añade un movimiento de stock: {vacuna, tipo: Entrada|Merma|Recuento, cantidad, nota}.
 * Devuelve el stock ya recalculado.
 */
function registrarStock(pin, mov) {
  const c = leerConfig_();
  comprobarPin_(c, pin);
  mov = mov || {};

  const vac = String(mov.vacuna || '').trim();
  if (!c.vacunas.some(function (v) { return v.nombre === vac; })) throw new Error('Esa vacuna no está en la configuración.');
  const tipo = TIPOS_STK.indexOf(mov.tipo) >= 0 ? mov.tipo : '';
  if (!tipo) throw new Error('Tipo de movimiento no válido.');
  const cant = Number(mov.cantidad);
  if (!isFinite(cant) || cant !== Math.floor(cant) || cant < 0 || cant > 100000) throw new Error('La cantidad tiene que ser un número entero, 0 o más.');
  if (tipo !== 'Recuento' && cant === 0) throw new Error('La cantidad tiene que ser mayor que cero.');
  const nota = limpiarTexto_(mov.nota, 200);

  const d = new Date();
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const h = libro_().getSheetByName(H_STK);
    h.getRange(h.getLastRow() + 1, 1, 1, CAB_STK.length)
      .setValues([[d, Utilities.formatDate(d, TZ, 'yyyy-MM-dd'), vac, tipo, cant, nota]]);
  } finally {
    lock.releaseLock();
  }
  return calcularStock_(c);
}

/**
 * Stock de cada vacuna:
 *   último Recuento (o 0 si no hay)
 *   + Entradas posteriores − Mermas posteriores
 *   − dosis netas del Registro posteriores (+1 y −1).
 * Consumo medio semanal = dosis netas de los últimos 14 días ÷ 2.
 */
function calcularStock_(c) {
  const movs = leerStock_();
  const reg = leerRegistro_();
  const ahora = Date.now();
  const desde14 = ahora - 14 * 86400000;
  const info = {};
  const orden = [];
  const de = function (n) {
    if (!info[n]) {
      info[n] = { activa: false, minimo: 0, rec: null, entradas: 0, mermas: 0, puestas: 0, consumo14: 0, nMovs: 0 };
      orden.push(n);
    }
    return info[n];
  };
  c.vacunas.forEach(function (v) { const x = de(v.nombre); x.activa = v.activa; x.minimo = v.minimo; });

  movs.forEach(function (m) {
    const x = de(m.vacuna);
    x.nMovs++;
    if (m.tipo === 'Recuento' && (!x.rec || m.t >= x.rec.t)) x.rec = m;
  });
  movs.forEach(function (m) {
    const x = info[m.vacuna];
    if (m.tipo === 'Recuento' || !posterior_(m, x.rec)) return;
    if (m.tipo === 'Entrada') x.entradas += m.cantidad;
    else x.mermas += m.cantidad;
  });
  reg.forEach(function (r) {
    const x = info[r.vacuna];
    if (!x) return;
    if (!x.rec || r.t > x.rec.t) x.puestas += r.cambio;
    if (r.t >= desde14 && r.t <= ahora) x.consumo14 += r.cambio;
  });

  const r1 = function (n) { return Math.round(n * 10) / 10; };
  const vacunas = orden
    .filter(function (n) { return info[n].activa || info[n].nMovs; })
    .map(function (n) {
      const x = info[n];
      const actual = (x.rec ? x.rec.cantidad : 0) + x.entradas - x.mermas - x.puestas;
      const semanal = Math.max(0, x.consumo14) / 2;
      const semanas = semanal > 0 ? Math.max(0, actual) / semanal : null;
      return {
        nombre: n,
        activa: x.activa,
        stock: actual,
        minimo: x.minimo,
        consumoSemanal: r1(semanal),
        semanas: semanas == null ? null : r1(semanas),
        entradas: x.entradas,
        mermas: x.mermas,
        puestas: x.puestas,
        ultimoRecuento: x.rec ? { t: x.rec.t, cantidad: x.rec.cantidad } : null,
        bajoMinimo: actual < x.minimo,
        pocasSemanas: semanas != null && semanas < 2
      };
    });

  const movimientos = movs.slice()
    .sort(function (a, b) { return b.t - a.t || b.i - a.i; })
    .slice(0, 30)
    .map(function (m) { return { t: m.t, vacuna: m.vacuna, tipo: m.tipo, cantidad: m.cantidad, nota: m.nota }; });

  return {
    vacunas: vacunas,
    movimientos: movimientos,
    nombres: c.vacunas.map(function (v) { return v.nombre; }),
    urlHoja: libro_().getUrl()
  };
}

/** ¿El movimiento m va después del recuento rec? (a igual momento, decide el orden de las filas) */
function posterior_(m, rec) {
  if (!rec) return true;
  return m.t > rec.t || (m.t === rec.t && m.i > rec.i);
}

/** Lee la hoja Stock. Acepta filas escritas a mano (solo con Fecha, tipo en minúsculas…). */
function leerStock_() {
  const h = libro_().getSheetByName(H_STK);
  if (!h) return [];
  const out = [];
  filas_(h, CAB_STK.length).forEach(function (r, i) {
    const vac = String(r[2] == null ? '' : r[2]).trim();
    const tipo = tipoStock_(r[3]);
    if (!vac || !tipo || r[4] === '' || r[4] == null) return;
    const cant = Number(String(r[4]).replace(',', '.'));
    if (!isFinite(cant)) return;
    const t = momentoStock_(r[0], r[1]);
    if (t == null) return;
    out.push({
      i: i, t: t, vacuna: vac, tipo: tipo,
      cantidad: tipo === 'Recuento' ? Math.max(0, cant) : Math.abs(cant),
      nota: String(r[5] == null ? '' : r[5])
    });
  });
  return out;
}

function tipoStock_(v) {
  const s = String(v == null ? '' : v).trim().toLowerCase();
  if (/^e/.test(s)) return 'Entrada';
  if (/^m/.test(s)) return 'Merma';
  if (/^r/.test(s)) return 'Recuento';
  return null;
}

/** Momento de un movimiento. Si solo hay Fecha, se toma el comienzo de ese día. */
function momentoStock_(m, f) {
  if (m instanceof Date && !isNaN(m.getTime())) return m.getTime();
  if (m !== '' && m != null) { const d = new Date(m); if (!isNaN(d.getTime())) return d.getTime(); }
  if (f instanceof Date && !isNaN(f.getTime())) return f.getTime();
  const s = String(f == null ? '' : f).trim();
  let a = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (a) return inicioDia_(+a[1], +a[2], +a[3]);
  a = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (a) return inicioDia_(+a[3], +a[2], +a[1]);
  return null;
}

function inicioDia_(y, mes, d) {
  const txt = y + '-' + (mes < 10 ? '0' : '') + mes + '-' + (d < 10 ? '0' : '') + d + ' 00:00:00';
  try { return Utilities.parseDate(txt, TZ, 'yyyy-MM-dd HH:mm:ss').getTime(); } catch (e) { return null; }
}

/* --------------------- Campaña y previsión ----------------------- */

/** Previsión de la campaña: cobertura por grupo, pedido sugerido y balance al final. */
function prevision(pin) {
  const c = leerConfig_();
  comprobarPin_(c, pin);
  return calcularPrevision_(c);
}

/** Guarda fechas de campaña, correo del resumen y grupos de población. */
function guardarCampana(pin, d) {
  const c = leerConfig_();
  comprobarPin_(c, pin);
  d = d || {};
  const inicio = fechaTxt_(d.inicio);
  const fin = fechaTxt_(d.fin);
  if (inicio && fin && inicio > fin) throw new Error('El inicio de la campaña es posterior al fin.');
  const correo = validarCorreos_(d.correo);

  const vacs = {};
  c.vacunas.forEach(function (v) { vacs[v.nombre.toLowerCase()] = v.nombre; });
  const vistos = {};
  const filas = (d.grupos || []).slice(0, 40).map(function (g) {
    const nombre = limpiarTexto_(g && g.nombre, 60);
    if (!nombre) return null;
    if (vistos[nombre.toLowerCase()]) throw new Error('El grupo «' + nombre + '» está repetido.');
    vistos[nombre.toLowerCase()] = true;
    const lista = String(g.vacunas || '').split(/[,;]+/).map(function (s) { return s.trim(); }).filter(Boolean).map(function (s) {
      const real = vacs[s.toLowerCase()];
      if (!real) throw new Error('La vacuna «' + s + '» del grupo «' + nombre + '» no está en la lista de vacunas.');
      return real;
    });
    if (!lista.length) throw new Error('Pon al menos una vacuna en el grupo «' + nombre + '».');
    return [nombre, lista.join(', '), fechaTxt_(g.desde), Math.round(num_(g.poblacion)), pct_(g.objetivo), g.activo === false ? 'No' : 'Sí', pct_(g.techo) || '', limpiarTexto_(g.suma, 40)];
  }).filter(Boolean);
  const agendas = d.agendas == null ? c.agendas : listaAgendas_(d.agendas);

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = libro_();
    reescribir_(ss.getSheetByName(H_CFG), CAB_CFG, filasParams_(c, { inicio: inicio, fin: fin, correo: correo, agendas: agendas }), true);
    reescribir_(ss.getSheetByName(H_GRU), CAB_GRU, filas, [3]);
  } finally {
    lock.releaseLock();
  }
  return calcularPrevision_(leerConfig_());
}

/**
 * Carga una plantilla de campaña: grupos, fechas y días de reparto.
 * Conserva la población de los grupos que se llamen igual y añade las vacunas que falten.
 */
function cargarPlantilla(pin, id) {
  const c = leerConfig_();
  comprobarPin_(c, pin);
  const t = PLANTILLAS[id];
  if (!t) throw new Error('No existe esa plantilla.');

  const previos = {};
  leerGrupos_().forEach(function (g) { previos[g.nombre.toLowerCase()] = g; });
  const grupos = t.grupos.map(function (g) {
    const p = previos[g[0].toLowerCase()];
    return [g[0], g[1], g[2], p ? p.poblacion : 0, g[3], 'Sí', p && p.techo ? p.techo : '', g[4] || (p ? p.suma : '')];
  });
  const tiene = {};
  c.vacunas.forEach(function (v) { tiene[v.nombre.toLowerCase()] = true; });
  const nuevas = t.vacunas.filter(function (v) { return !tiene[v.toLowerCase()]; });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = libro_();
    reescribir_(ss.getSheetByName(H_CFG), CAB_CFG, filasParams_(c, { inicio: t.inicio, fin: t.fin }), true);
    reescribir_(ss.getSheetByName(H_GRU), CAB_GRU, grupos, [3]);
    // Se conservan las filas con vacunas propias (p. ej. un calendario de COVID añadido a mano).
    const propias = filas_(ss.getSheetByName(H_REP), CAB_REP.length).filter(function (r) { return String(r[5] || '').trim(); });
    reescribir_(ss.getSheetByName(H_REP), CAB_REP, t.repartos.map(function (r) { return r.slice(); }).concat(propias), [1, 2, 3, 5, 6]);
    if (nuevas.length) {
      const hv = ss.getSheetByName(H_VAC);
      hv.getRange(hv.getLastRow() + 1, 1, nuevas.length, CAB_VAC.length)
        .setValues(nuevas.map(function (n) { return [n, 0, 'Sí', 0, protegeTxt_(protegeDe_(n, ''))]; }));
    }
  } finally {
    lock.releaseLock();
  }
  return { ok: true, vacunasNuevas: nuevas };
}

/**
 * Dato oficial de un grupo (p. ej. del informe de coberturas): {grupo, vacunados | porcentaje, fecha, nota}.
 *   - porcentaje: se convierte en vacunados con la población del grupo.
 *   - fecha (yyyy-MM-dd): el dato incluye las dosis hasta el final de ese día; las del contador
 *     posteriores se suman. Sin fecha, el dato es de este momento.
 */
function registrarCobertura(pin, d) {
  const c = leerConfig_();
  comprobarPin_(c, pin);
  d = d || {};
  const g = leerGrupos_().filter(function (x) { return x.nombre.toLowerCase() === String(d.grupo || '').trim().toLowerCase(); })[0];
  if (!g) throw new Error('Ese grupo no existe.');

  let n;
  let nota = limpiarTexto_(d.nota, 150);
  if (d.porcentaje != null && d.porcentaje !== '') {
    const pc = Number(String(d.porcentaje).replace(',', '.').replace('%', ''));
    if (!isFinite(pc) || pc < 0 || pc > 100) throw new Error('El porcentaje tiene que estar entre 0 y 100.');
    if (!g.poblacion) throw new Error('Pon antes la población del grupo «' + g.nombre + '» en «Campaña y previsión».');
    n = Math.round(g.poblacion * pc / 100);
    nota = (String(pc).replace('.', ',') + ' % de ' + g.poblacion) + (nota ? ' · ' + nota : '');
  } else {
    n = Number(d.vacunados);
    if (!isFinite(n) || n < 0 || n !== Math.floor(n) || n > 10000000) throw new Error('Los vacunados tienen que ser un número entero, 0 o más.');
  }

  const hoy = hoy_();
  let momento = new Date();
  let fecha = hoy;
  if (d.fecha) {
    fecha = fechaTxt_(d.fecha);
    if (!fecha) throw new Error('La fecha del dato no es válida.');
    if (fecha > hoy) throw new Error('La fecha del dato no puede ser futura.');
    if (fecha < hoy) {
      const a = fecha.split('-').map(Number);
      const siguiente = sumarDias_(fecha, 1).split('-').map(Number);
      const finDia = inicioDia_(siguiente[0], siguiente[1], siguiente[2]);
      if (finDia == null || inicioDia_(a[0], a[1], a[2]) == null) throw new Error('La fecha del dato no es válida.');
      momento = new Date(finDia - 1000);
    }
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const h = libro_().getSheetByName(H_COB);
    h.getRange(h.getLastRow() + 1, 1, 1, CAB_COB.length).setValues([[momento, fecha, g.nombre, n, nota]]);
  } finally {
    lock.releaseLock();
  }
  return calcularPrevision_(c);
}

/* ------------------- Pacientes reales del día --------------------- */

/**
 * Apunta los pacientes reales de un día (p. ej. de la agenda): {fecha, pacientes, nota}.
 * Sustituyen al cálculo del contador en el total de ese día. pacientes vacío = quitar la corrección.
 */
function registrarPacientesDia(pin, d) {
  const c = leerConfig_();
  comprobarPin_(c, pin);
  d = d || {};
  const hoy = hoy_();
  const fecha = fechaTxt_(d.fecha);
  if (!fecha) throw new Error('La fecha no es válida.');
  if (fecha > hoy) throw new Error('La fecha no puede ser futura.');
  let n = '';
  if (d.pacientes !== '' && d.pacientes != null) {
    n = Number(d.pacientes);
    if (!isFinite(n) || n < 0 || n !== Math.floor(n) || n > 5000) throw new Error('Los pacientes tienen que ser un número entero, 0 o más.');
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const h = libro_().getSheetByName(H_PAC);
    h.getRange(h.getLastRow() + 1, 1, 1, CAB_PAC.length).setValues([[new Date(), fecha, n, limpiarTexto_(d.nota, 150)]]);
  } finally {
    lock.releaseLock();
  }
  return { ok: true, fecha: fecha, pacientes: n === '' ? null : n };
}

/** Último dato de cada día: {fecha: {n, nota}}. Si el último está vacío, ese día no se corrige. */
function leerPacientesDia_() {
  const h = libro_().getSheetByName(H_PAC);
  const out = {};
  if (!h) return out;
  filas_(h, CAB_PAC.length).forEach(function (r) {
    const f = fechaTxt_(r[1]);
    if (!f) return;
    const n = Number(r[2]);
    if (r[2] === '' || r[2] == null || !isFinite(n) || n < 0) { delete out[f]; return; }
    out[f] = { n: Math.round(n), nota: String(r[3] == null ? '' : r[3]) };
  });
  return out;
}

/* --------------------- Citas y asistencia ------------------------ */

/**
 * Guarda los citados y las faltas de un día por agenda: {fecha, filas: [{agenda, citados, faltaron}]}.
 * Si se guarda otra vez el mismo día y agenda, vale el último dato.
 */
const DIAS_ASISTENCIA = 28;
const ARRANQUE_DIAS = 3;
function registrarCitas(pin, d) {
  const c = leerConfig_();
  comprobarPin_(c, pin);
  d = d || {};
  if (!c.agendas.length) throw new Error('Escribe primero las agendas de cita en «Campaña y previsión» y guarda.');
  const hoy = hoy_();
  const fecha = d.fecha ? fechaTxt_(d.fecha) : hoy;
  if (!fecha) throw new Error('La fecha no es válida.');
  if (fecha > hoy) throw new Error('La fecha no puede ser futura.');
  if (fecha < sumarDias_(hoy, -MAX_DIAS_ATRAS)) throw new Error('La fecha es demasiado antigua.');
  const ag = {};
  c.agendas.forEach(function (a) { ag[a.toLowerCase()] = a; });
  const ent = function (v, que) {
    const n = Number(v);
    if (!isFinite(n) || n < 0 || n !== Math.floor(n) || n > 1000) throw new Error(que + ' tiene que ser un número entero, 0 o más.');
    return n;
  };
  const ahora = new Date();
  const filas = [];
  (d.filas || []).slice(0, 8).forEach(function (f) {
    if (!f || f.citados === '' || f.citados == null) return;
    const a = ag[String(f.agenda || '').trim().toLowerCase()];
    if (!a) throw new Error('La agenda «' + limpiarTexto_(f.agenda, 30) + '» no está en la lista.');
    const ci = ent(f.citados, 'Citados (' + a + ')');
    const fa = f.faltaron === '' || f.faltaron == null ? 0 : ent(f.faltaron, 'Faltaron (' + a + ')');
    if (fa > ci) throw new Error('En ' + a + ' faltaron más de los citados.');
    filas.push([ahora, fecha, a, ci, fa]);
  });
  if (!filas.length) throw new Error('Escribe los citados de al menos una agenda.');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const h = libro_().getSheetByName(H_CIT);
    h.getRange(h.getLastRow() + 1, 1, filas.length, CAB_CIT.length).setValues(filas);
  } finally {
    lock.releaseLock();
  }
  return calcularPrevision_(c);
}

/** Citas por día y agenda (el último dato de cada día y agenda): [{fecha, agenda, citados, faltaron}]. */
function leerCitas_() {
  const h = libro_().getSheetByName(H_CIT);
  if (!h) return [];
  const ult = {};
  filas_(h, CAB_CIT.length).forEach(function (r, i) {
    const f = fechaTxt_(r[1]);
    const a = String(r[2] == null ? '' : r[2]).trim();
    const ci = Number(r[3]);
    if (!f || !a || r[3] === '' || !isFinite(ci) || ci < 0) return;
    const fa = Math.max(0, Math.min(ci, Number(r[4]) || 0));
    ult[f + '|' + a.toLowerCase()] = { fecha: f, agenda: a, citados: Math.round(ci), faltaron: Math.round(fa), i: i };
  });
  return Object.keys(ult).map(function (k) { return ult[k]; });
}

/**
 * Asistencia de los últimos DIAS_ASISTENCIA días por agenda:
 *   asistencia = (citados − faltaron) ÷ citados;
 *   citarPara = citas que hacen falta al día para que vengan los mismos que citáis ahora
 *               (media de citados ÷ asistencia), o sea, cuánto sobrecitar para no perder huecos.
 */
function calcularAsistencia_(c, hoy) {
  const desde = sumarDias_(hoy, -(DIAS_ASISTENCIA - 1));
  const todas = leerCitas_();
  const por = {};
  const nombres = c.agendas.slice();
  todas.forEach(function (x) {
    if (x.fecha < desde || x.fecha > hoy) return;
    const k = x.agenda.toLowerCase();
    if (!por[k]) {
      por[k] = { agenda: x.agenda, dias: 0, citados: 0, faltaron: 0 };
      if (!nombres.some(function (n) { return n.toLowerCase() === k; })) nombres.push(x.agenda);
    }
    por[k].dias++;
    por[k].citados += x.citados;
    por[k].faltaron += x.faltaron;
  });
  const r1 = function (n) { return Math.round(n * 10) / 10; };
  const fila = function (a, x) {
    if (!x || !x.citados) return { agenda: a, dias: x ? x.dias : 0, citados: 0, faltaron: 0, asistencia: null, citadosDia: null, citarPara: null };
    const asis = (x.citados - x.faltaron) / x.citados;
    const media = x.citados / x.dias;
    return {
      agenda: a, dias: x.dias, citados: x.citados, faltaron: x.faltaron,
      asistencia: r1(asis * 100), citadosDia: r1(media),
      citarPara: asis > 0 ? Math.ceil(media / asis - 1e-9) : null
    };
  };
  const agendas = nombres.map(function (n) { return fila(n, por[n.toLowerCase()]); });
  const tot = agendas.reduce(function (s, a) { s.citados += a.citados; s.faltaron += a.faltaron; s.dias = Math.max(s.dias, a.dias); return s; }, { citados: 0, faltaron: 0, dias: 0 });
  const recientes = todas.filter(function (x) { return x.fecha >= sumarDias_(hoy, -13); })
    .sort(function (a, b) { return a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : a.agenda.localeCompare(b.agenda); });
  return {
    dias: DIAS_ASISTENCIA,
    agendas: agendas,
    total: tot.citados ? { citados: tot.citados, faltaron: tot.faltaron, asistencia: r1((tot.citados - tot.faltaron) / tot.citados * 100) } : null,
    recientes: recientes.map(function (x) { return { fecha: x.fecha, agenda: x.agenda, citados: x.citados, faltaron: x.faltaron }; })
  };
}

function leerGrupos_() {
  const h = libro_().getSheetByName(H_GRU);
  if (!h) return [];
  return filas_(h, CAB_GRU.length)
    .filter(function (r) { return String(r[0]).trim(); })
    .map(function (r) {
      return {
        nombre: String(r[0]).trim(),
        vacunas: String(r[1] == null ? '' : r[1]).split(/[,;]+/).map(function (s) { return s.trim(); }).filter(Boolean),
        desde: fechaTxt_(r[2]),
        poblacion: Math.round(num_(r[3])),
        objetivo: pct_(r[4]),
        activo: !esNo_(r[5]),
        techo: pct_(r[6]),
        suma: String(r[7] == null ? '' : r[7]).trim()
      };
    });
}

/** Último dato oficial de cada grupo: {nombre en minúsculas: {t, fecha, n}}. */
function leerCoberturas_() {
  const h = libro_().getSheetByName(H_COB);
  const out = {};
  if (!h) return out;
  filas_(h, CAB_COB.length).forEach(function (r, i) {
    const g = String(r[2] == null ? '' : r[2]).trim().toLowerCase();
    const n = Number(String(r[3]).replace(',', '.'));
    if (!g || r[3] === '' || !isFinite(n)) return;
    const t = momentoStock_(r[0], r[1]);
    if (t == null) return;
    const prev = out[g];
    if (!prev || t > prev.t || (t === prev.t && i > prev.i)) {
      out[g] = { t: t, i: i, n: Math.max(0, Math.round(n)), fecha: Utilities.formatDate(new Date(t), TZ, 'yyyy-MM-dd') };
    }
  });
  return out;
}

function leerRepartos_() {
  const h = libro_().getSheetByName(H_REP);
  if (!h) return [];
  return filas_(h, CAB_REP.length).map(function (r) {
    const ant = Number(r[3]);
    return {
      desde: fechaTxt_(r[0]),
      hasta: fechaTxt_(r[1]),
      diasTxt: String(r[2] == null ? '' : r[2]).trim(),
      dias: diasSemana_(r[2]),
      antelacion: r[3] === '' || !isFinite(ant) ? 2 : Math.max(0, Math.min(10, Math.round(ant))),
      hora: horaTxt_(r[4]) || '14:00',
      vacunasTxt: String(r[5] == null ? '' : r[5]).trim(),
      vacunas: String(r[5] == null ? '' : r[5]).split(/[,;]+/).map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean)
    };
  }).filter(function (r) { return r.desde && r.hasta && r.dias.length; });
}

/** «mar, mié, vie» → [2, 3, 5]. Entiende castellano y gallego (luns, martes, mércores, xoves, venres…). */
function diasSemana_(txt) {
  const mapa = { lu: 1, ma: 2, mi: 3, me: 3, ju: 4, xo: 4, vi: 5, ve: 5, sa: 6, do: 0 };
  const out = [];
  String(txt == null ? '' : txt).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/[^a-z]+/).forEach(function (t) {
      if (t.length < 2) return;
      const d = mapa[t.slice(0, 2)];
      if (d != null && out.indexOf(d) < 0) out.push(d);
    });
  return out;
}

function horaTxt_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return Utilities.formatDate(v, TZ, 'HH:mm');
  const s = String(v == null ? '' : v).trim();
  let a = s.match(/^(\d{1,2})(?:[:.h](\d{2}))?/);
  if (!a || Number(a[1]) > 23) return '';
  return dos_(a[1]) + ':' + (a[2] || '00');
}

/** Próximos repartos a los que aún se llega con el pedido: [{fecha, limite, hora}]. */
function proximosRepartos_(reps, hoy, ahoraHM, cuantos) {
  const out = [];
  if (!reps.length) return out;
  const ultimo = reps.reduce(function (m, r) { return r.hasta > m ? r.hasta : m; }, '');
  for (let f = hoy, i = 0; f <= ultimo && i < 400 && out.length < cuantos; f = sumarDias_(f, 1), i++) {
    const r = reps.filter(function (x) { return x.desde <= f && f <= x.hasta && x.dias.indexOf(diaSem_(f)) >= 0; })[0];
    if (!r) continue;
    const lim = restarLaborables_(f, r.antelacion);
    if (lim < hoy || (lim === hoy && ahoraHM >= r.hora)) continue;
    out.push({ fecha: f, limite: lim, hora: r.hora });
  }
  return out;
}

/**
 * Previsión.
 *   Vacunados por grupo = último dato oficial + dosis del contador posteriores.
 *   Una dosis apuntada con su grupo (botón «vacuna · grupo» del contador) cuenta solo para ese grupo.
 *   Si no lleva grupo, cuenta para los grupos que usan esa vacuna y ya han empezado;
 *   si son varios, se reparte en proporción a su población diana (población × objetivo).
 *   Ritmo = dosis de los últimos 14 días ÷ días laborables.
 *   Consumo previsto de cada vacuna = ritmo actual + ritmo que necesitarán los grupos que aún no empezaron.
 */
function calcularPrevision_(c) {
  const hoy = hoy_();
  const ahoraHM = Utilities.formatDate(new Date(), TZ, 'HH:mm');
  const todos = leerGrupos_();
  const grupos = todos.filter(function (g) { return g.activo; });
  const ofi = leerCoberturas_();
  const reps = leerRepartos_();
  const reg = leerRegistro_();
  const stk = calcularStock_(c);
  const inicio = c.inicio;
  const fin = c.fin;
  const k = function (s) { return String(s).trim().toLowerCase(); };
  const r1 = function (n) { return Math.round(n * 10) / 10; };
  const desde14 = sumarDias_(hoy, -13);
  const labVent = laborables_(desde14, hoy) || 1;

  grupos.forEach(function (g) {
    g.meta = g.objetivo > 0 && g.poblacion > 0 ? Math.ceil(g.poblacion * g.objetivo / 100) : null;
    g.peso = g.poblacion * (g.objetivo > 0 ? g.objetivo : 100) / 100;
    g.vk = g.vacunas.map(k);
    g.oficial = ofi[k(g.nombre)] || null;
    g.est = g.oficial ? g.oficial.n : 0;
    g.reciente = 0;
    g.recienteV = {};
    g.labTotal = fin && g.desde ? laborables_(g.desde, fin) : 0;
  });

  const cache = {};
  const elegibles = function (v, f) {
    const clave = v + '|' + f;
    if (!cache[clave]) cache[clave] = grupos.filter(function (g) { return g.vk.indexOf(v) >= 0 && (!g.desde || g.desde <= f); });
    return cache[clave];
  };
  const porNombre = {};
  grupos.forEach(function (g) { porNombre[k(g.nombre)] = g; });
  /*
   * Enfermedad de cada grupo: la que protegen TODAS sus vacunas (un grupo «65 o más · gripe» con
   * Efluelda y mCombriax es de gripe; uno «65 o más · COVID» con Comirnaty30 y mCombriax, de COVID).
   * Una dosis cuenta, por cada enfermedad que protege, para los grupos de esa enfermedad: así una
   * mCombriax cuenta entera en el grupo de gripe y entera en el de COVID, y un paciente con
   * Efluelda + Comirnaty30 no cuenta dos veces en el mismo grupo.
   * Un grupo que mezcla vacunas de gripe y de COVID (p. ej. Efluelda y Comirnaty30) se marca «mixto»:
   * en él, un paciente con las dos contaría dos veces.
   */
  const prot = {};
  c.vacunas.forEach(function (v) { prot[k(v.nombre)] = v.protege; });
  const protDe = function (n) { return prot[n] || protegeDe_(n, ''); };
  grupos.forEach(function (g) {
    const ps = g.vk.map(protDe);
    g.dis = { gripe: ps.every(function (p) { return p.gripe; }), covid: ps.every(function (p) { return p.covid; }) };
    g.mixto = !g.dis.gripe && !g.dis.covid && ps.length > 0;
    if (g.mixto) g.dis = { gripe: true, covid: true };
  });
  const recientes = {};
  reg.forEach(function (r) {
    if ((inicio && r.fecha < inicio) || (fin && r.fecha > fin)) return;
    const v = k(r.vacuna);
    if (r.fecha >= desde14) recientes[v] = (recientes[v] || 0) + r.cambio;
    const el = elegibles(v, r.fecha);
    // Si la dosis se apuntó con su grupo, cuenta entera para ese grupo (en su enfermedad).
    const gr = r.grupo ? porNombre[k(r.grupo)] : null;
    const pv = protDe(v);
    const cob = new Map(); // grupo → parte (cobertura)
    let nDis = 0;
    ['gripe', 'covid'].forEach(function (d) {
      if (!pv[d]) return;
      let sub = gr && gr.vk.indexOf(v) >= 0 && gr.dis[d] ? [gr] : el.filter(function (g) { return g.dis[d]; });
      if (!sub.length) return;
      nDis++;
      const tot = sub.reduce(function (s, g) { return s + g.peso; }, 0);
      sub.forEach(function (g) {
        const parte = tot > 0 ? g.peso / tot : 1 / sub.length;
        cob.set(g, Math.max(cob.get(g) || 0, parte));
      });
    });
    if (!nDis) return;
    // Consumo: cada dosis se gasta una vez aunque cuente en dos enfermedades.
    const totCob = Array.from(cob.values()).reduce(function (s, x) { return s + x; }, 0);
    cob.forEach(function (parte, g) {
      if (!g.oficial || r.t > g.oficial.t) g.est += r.cambio * parte;
      if (r.fecha >= desde14) {
        g.reciente += r.cambio * parte;
        g.recienteV[v] = (g.recienteV[v] || 0) + r.cambio * parte / totCob;
      }
    });
  });

  /*
   * Techo esperado (opcional, p. ej. la cobertura de la campaña pasada): hay gente que no vendrá
   * nunca (no acude a la cita, rechaza la vacuna…). Con techo, el ritmo se va frenando a medida
   * que se acerca a él: cada día se vacuna la misma fracción q de los que aún pueden venir
   * (q = ritmo actual ÷ pendientes hasta el techo). Así:
   *   - acumulado tras n días laborables = pendientes × (1 − (1 − q)^n);
   *   - el objetivo puede no alcanzarse nunca si está por encima del techo;
   *   - el consumo previsto baja al final de la campaña (no se pide de más).
   * Sin techo, el ritmo actual se mantiene (como antes).
   */
  const outG = grupos.map(function (g) {
    const empezado = !g.desde || g.desde <= hoy;
    const dias = empezado ? (laborables_(maxF_(desde14, g.desde || desde14), hoy) || 1) : 0;
    const ritmo = empezado ? Math.max(0, g.reciente) / dias : 0;
    const vacunados = Math.max(0, Math.round(g.est));
    const faltan = g.meta != null ? Math.max(0, g.meta - vacunados) : null;
    const labRest = fin ? laborables_(maxF_(hoy, g.desde || hoy), fin) : 0;
    const tope = g.techo > 0 && g.poblacion > 0 ? Math.round(g.poblacion * g.techo / 100) : null;
    const quedan = tope != null ? Math.max(0, tope - vacunados) : null;
    const q = quedan ? Math.min(1, ritmo / quedan) : 0;
    // Recién empezado (3 primeros días laborables): aún no hay ritmo fiable, se usa el plan de la campaña.
    const arrancando = empezado && !!g.desde && laborables_(g.desde, hoy) <= ARRANQUE_DIAS;
    const proy = empezado && !arrancando;
    g.tope = tope;
    g.q = q;
    g.proy = proy;
    g.agotado = quedan === 0; // ya llegó al techo: no se prevén más dosis
    let llega = null;
    if (faltan === 0) llega = 'ok';
    else if (arrancando) llega = null;
    else if (faltan != null && tope != null) {
      if (faltan < quedan && q > 0) {
        const n = q >= 1 ? 1 : Math.ceil(Math.log(1 - faltan / quedan) / Math.log(1 - q));
        if (n <= 300) llega = sumarLaborables_(hoy, n);
      }
    } else if (faltan != null && ritmo > 0 && faltan / ritmo <= 300) llega = sumarLaborables_(hoy, Math.ceil(faltan / ritmo));
    // Vacunados previstos al final de la campaña
    let alFinal = null;
    if (fin && fin >= hoy) {
      const extra = !proy ? Math.max(0, (tope != null ? tope : (g.meta || 0)) - vacunados) :
        tope != null ? quedan * (1 - Math.pow(1 - q, labRest)) : ritmo * labRest;
      alFinal = vacunados + extra;
      if (g.poblacion > 0) alFinal = Math.min(alFinal, g.poblacion);
    }
    g.empezado = empezado;
    g.dias = dias;
    g.llega = llega;
    g.faltan = faltan;
    let estado = 'sinObjetivo';
    if (!empezado) estado = 'pendiente';
    else if (faltan === 0) estado = 'ok';
    else if (arrancando) estado = 'arrancando';
    else if (faltan != null) estado = fin && (llega == null || llega > fin) ? 'riesgo' : 'enCamino';
    return {
      nombre: g.nombre, vacunas: g.vacunas, desde: g.desde, poblacion: g.poblacion, objetivo: g.objetivo,
      meta: g.meta, vacunados: vacunados,
      cobertura: g.poblacion > 0 ? r1(vacunados / g.poblacion * 100) : null,
      faltan: faltan, ritmoDia: r1(ritmo),
      necesarioDia: faltan != null && labRest > 0 ? r1(faltan / labRest) : null,
      llega: llega, estado: estado,
      techo: g.techo || null,
      suma: g.suma || '',
      enfermedad: g.mixto ? 'mixto' : g.dis.gripe && g.dis.covid ? 'gripe y COVID' : g.dis.covid ? 'COVID' : 'gripe',
      techoBajo: !!(g.techo && g.objetivo && g.techo < g.objetivo),
      alFinal: alFinal == null ? null : Math.round(alFinal),
      coberturaFinal: alFinal != null && g.poblacion > 0 ? r1(alFinal / g.poblacion * 100) : null,
      oficial: g.oficial ? { fecha: g.oficial.fecha, n: g.oficial.n } : null
    };
  });

  // Número de día laborable desde hoy (0 = hoy o el primer laborable), para frenar el ritmo.
  const nLab = {};
  for (let f = hoy, n = 0, i = 0; i < 400 && (!fin || f <= fin); f = sumarDias_(f, 1), i++) {
    nLab[f] = n;
    if (esLaborable_(f)) n++;
  }

  /*
   * Consumo previsto por vacuna y día laborable:
   *   - grupos ya empezados: su ritmo actual, hasta el día en que llegan al objetivo;
   *   - grupos que aún no empezaron: su población diana repartida entre sus días de campaña;
   *   - dosis que no son de ningún grupo (p. ej. una vacuna sin grupos): su ritmo actual.
   */
  const sinGrupo = {};
  Object.keys(recientes).forEach(function (v) {
    const deGrupos = grupos.reduce(function (s, g) { return s + (g.recienteV[v] || 0); }, 0);
    sinGrupo[v] = Math.max(0, recientes[v] - deGrupos) / labVent;
  });
  const consumoDia = function (v, f) {
    let d = sinGrupo[v] || 0;
    grupos.forEach(function (g) {
      if (g.vk.indexOf(v) < 0) return;
      if (g.proy) {
        const base = Math.max(0, g.recienteV[v] || 0) / g.dias;
        if (g.tope != null) {
          if (g.agotado) return;
          // Con techo: el ritmo se frena (no se corta al llegar al objetivo: la gente sigue viniendo).
          d += base * Math.pow(1 - g.q, nLab[f] || 0);
          return;
        }
        if (g.llega === 'ok' || (g.llega && f > g.llega)) return;
        d += base;
      } else {
        const diana = g.tope != null ? g.tope : g.meta;
        if (diana && g.labTotal > 0 && g.desde <= f) d += diana / g.labTotal / g.vk.length;
      }
    });
    return d;
  };
  const consumo = function (v, desde, hasta) {
    let s = 0;
    for (let f = desde, i = 0; f <= hasta && i < 400; f = sumarDias_(f, 1), i++) if (esLaborable_(f)) s += consumoDia(v, f);
    return s;
  };

  const recibidas = {};
  leerStock_().forEach(function (m) {
    if (m.tipo !== 'Entrada') return;
    const f = Utilities.formatDate(new Date(m.t), TZ, 'yyyy-MM-dd');
    if ((inicio && f < inicio) || (fin && f > fin)) return;
    recibidas[k(m.vacuna)] = (recibidas[k(m.vacuna)] || 0) + m.cantidad;
  });

  // Cada vacuna usa las filas de Repartos que la nombran; si no la nombra ninguna, las filas sin vacunas.
  const repsDe = function (kv) {
    const propias = reps.filter(function (r) { return r.vacunas.indexOf(kv) >= 0; });
    return propias.length ? propias : reps.filter(function (r) { return !r.vacunas.length; });
  };
  const generales = proximosRepartos_(reps.filter(function (r) { return !r.vacunas.length; }), hoy, ahoraHM, 2);
  const enCampana = fin && fin >= hoy;

  const outV = c.vacunas.filter(function (v) { return v.activa; }).map(function (v) {
    const kv = k(v.nombre);
    const s = stk.vacunas.filter(function (x) { return k(x.nombre) === kv; })[0] ||
      { stock: 0, minimo: v.minimo, semanas: null, bajoMinimo: false, pocasSemanas: false };
    const res = {
      nombre: v.nombre, stock: s.stock, minimo: s.minimo, semanas: s.semanas,
      bajoMinimo: s.bajoMinimo, pocasSemanas: s.pocasSemanas,
      consumoDia: r1(consumoDia(kv, hoy)), recibidas: recibidas[kv] || 0,
      usada: grupos.some(function (g) { return g.vk.indexOf(kv) >= 0; })
    };
    const hastaFin = enCampana ? consumo(kv, hoy, fin) : null;
    if (hastaFin != null) {
      res.consumoHastaFin = Math.round(hastaFin);
      res.balanceFin = Math.round(s.stock - hastaFin);
    }
    const prox = proximosRepartos_(repsDe(kv), hoy, ahoraHM, 2);
    const D = prox[0] || null;
    const D2 = prox[1] || null;
    res.tieneCalendario = repsDe(kv).length > 0;
    res.reparto = D ? { fecha: D.fecha, limite: D.limite, hora: D.hora, siguiente: D2 ? D2.fecha : null } : null;
    if (D && enCampana) {
      res.noLlega = s.stock < consumo(kv, hoy, sumarDias_(D.fecha, -1));
      let hasta = D2 ? sumarDias_(D2.fecha, -1) : fin;
      if (hasta > fin) hasta = fin;
      let ped = Math.ceil(consumo(kv, hoy, hasta) + s.minimo - s.stock);
      ped = Math.min(Math.max(0, ped), Math.max(0, Math.ceil(hastaFin - s.stock)));
      res.pedido = ped;
    }
    return res;
  });

  return {
    hoy: hoy,
    configurada: grupos.length > 0,
    campana: { inicio: inicio, fin: fin, labRestantes: enCampana ? laborables_(hoy, fin) : 0 },
    grupos: outG,
    agregados: agregados_(outG),
    vacunas: outV,
    reparto: generales[0] ? { fecha: generales[0].fecha, limite: generales[0].limite, hora: generales[0].hora, siguiente: generales[1] ? generales[1].fecha : null } : null,
    repartos: reps.map(function (r) { return { desde: r.desde, hasta: r.hasta, dias: r.diasTxt, antelacion: r.antelacion, hora: r.hora, vacunas: r.vacunasTxt }; }),
    gruposConfig: todos,
    vacunasConfig: c.vacunas.map(function (v) { return v.nombre; }),
    plantillas: Object.keys(PLANTILLAS).map(function (id) { return { id: id, nombre: PLANTILLAS[id].nombre }; }),
    correo: c.correo,
    agendasConfig: c.agendas,
    asistencia: calcularAsistencia_(c, hoy),
    resumenActivo: resumenActivo_(),
    avisos: estadoAvisos_(c)
  };
}

/**
 * Líneas de suma: los grupos con el mismo «Suma en» (p. ej. «60 o más») se suman, porque el objetivo
 * oficial es del conjunto (Galicia 2026: cobertura ≥ 75 % en 60 o más años). Objetivo = el mayor de sus grupos.
 */
function agregados_(grupos) {
  const por = {};
  const orden = [];
  grupos.forEach(function (g) {
    if (!g.suma) return;
    const k = g.suma.toLowerCase();
    if (!por[k]) { por[k] = { nombre: g.suma, grupos: [], poblacion: 0, vacunados: 0, alFinal: 0, finalOk: true, objetivo: 0, faltaPob: false }; orden.push(k); }
    const a = por[k];
    a.grupos.push(g.nombre);
    a.poblacion += g.poblacion || 0;
    a.vacunados += g.vacunados || 0;
    if (!g.poblacion) a.faltaPob = true;
    if (g.alFinal == null) a.finalOk = false; else a.alFinal += g.alFinal;
    a.objetivo = Math.max(a.objetivo, g.objetivo || 0);
  });
  const r1 = function (n) { return Math.round(n * 10) / 10; };
  return orden.map(function (k) {
    const a = por[k];
    const meta = a.objetivo && a.poblacion ? Math.ceil(a.poblacion * a.objetivo / 100) : null;
    return {
      nombre: a.nombre, grupos: a.grupos, poblacion: a.poblacion, vacunados: a.vacunados, faltaPob: a.faltaPob,
      cobertura: a.poblacion ? r1(a.vacunados / a.poblacion * 100) : null,
      objetivo: a.objetivo || null,
      faltan: meta != null ? Math.max(0, meta - a.vacunados) : null,
      coberturaFinal: a.finalOk && a.poblacion ? r1(a.alFinal / a.poblacion * 100) : null
    };
  });
}

/* ----------------------- Resumen por correo ---------------------- */

/** Lo llama el activador semanal (lunes a las 8:00). */
function enviarResumenSemanal() {
  const c = leerConfig_();
  if (c.correo) enviarResumen_(c);
}

/** Envía ahora un resumen de prueba. */
function probarResumen(pin) {
  const c = leerConfig_();
  comprobarPin_(c, pin);
  if (!c.correo) throw new Error('Escribe primero el correo y guarda la campaña.');
  enviarResumen_(c);
  return { ok: true, a: c.correo };
}

/** Activa o desactiva el envío automático de los lunes. */
function programarResumen(pin, activo) {
  const c = leerConfig_();
  comprobarPin_(c, pin);
  if (activo && !c.correo) throw new Error('Escribe primero el correo y guarda la campaña.');
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'enviarResumenSemanal') ScriptApp.deleteTrigger(t);
  });
  if (activo) {
    ScriptApp.newTrigger('enviarResumenSemanal').timeBased()
      .onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).inTimezone(TZ).create();
  }
  return { activo: !!activo };
}

function resumenActivo_() {
  try {
    return ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'enviarResumenSemanal'; });
  } catch (e) {
    return false;
  }
}

function validarCorreos_(s) {
  const lista = String(s == null ? '' : s).split(/[,;\s]+/).map(function (x) { return x.trim(); }).filter(Boolean);
  if (lista.length > 5) throw new Error('Pon como mucho 5 correos.');
  lista.forEach(function (x) { if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)) throw new Error('El correo «' + x + '» no es válido.'); });
  return lista.join(', ');
}

function escH_(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
  });
}

function fechaCorta_(f) {
  if (!f) return '';
  const dias = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const a = f.split('-');
  return dias[diaSem_(f)] + ' ' + Number(a[2]) + '/' + Number(a[1]);
}

/** Correo con la semana pasada, la cobertura por grupo, el stock y el pedido sugerido. Sin datos de pacientes. */
function enviarResumen_(c) {
  const p = calcularPrevision_(c);
  const lunes = lunesDe_(p.hoy);
  const desde = sumarDias_(lunes, -7);
  const hasta = sumarDias_(lunes, -1);
  const porVac = {};
  let total = 0;
  leerRegistro_().forEach(function (r) {
    if (r.fecha < desde || r.fecha > hasta) return;
    porVac[r.vacuna] = (porVac[r.vacuna] || 0) + r.cambio;
    total += r.cambio;
  });
  const nf = function (n) { return n == null ? '—' : String(Math.round(n * 10) / 10).replace('.', ','); };
  const td = 'style="padding:4px 8px;border-bottom:1px solid #ddd"';
  const th = 'style="padding:4px 8px;border-bottom:2px solid #999;text-align:left"';
  const tabla = function (cab, filas) {
    return '<table style="border-collapse:collapse;font-size:14px"><tr>' + cab.map(function (x) { return '<th ' + th + '>' + escH_(x) + '</th>'; }).join('') + '</tr>' +
      filas.map(function (f) { return '<tr>' + f.map(function (x) { return '<td ' + td + '>' + x + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>';
  };

  let html = '<div style="font-family:Arial,sans-serif;color:#15212b;max-width:680px">' +
    '<h2 style="margin:0 0 4px">Resumen semanal de vacunación</h2>' +
    '<p style="margin:0 0 16px;color:#5d6b78">' + escH_(c.centro || '') + ' · semana del ' + fechaCorta_(desde) + ' al ' + fechaCorta_(hasta) + '</p>' +
    '<h3>Dosis puestas la semana pasada: ' + nf(total) + '</h3>' +
    tabla(['Vacuna', 'Dosis'], Object.keys(porVac).sort().map(function (v) { return [escH_(v), nf(porVac[v])]; }));

  if (p.configurada) {
    html += '<h3>Cobertura por grupo</h3>' + tabla(['Grupo', 'Cobertura', 'Objetivo', 'Faltan', 'Al final (previsto)', 'Llega al objetivo'],
      p.grupos.map(function (g) {
        const llega = g.estado === 'pendiente' ? 'empieza el ' + fechaCorta_(g.desde) : g.estado === 'arrancando' ? 'empezó el ' + fechaCorta_(g.desde) + ', aún sin ritmo' : g.llega === 'ok' ? '✓ alcanzado' :
          g.llega ? fechaCorta_(g.llega) + (p.campana.fin && g.llega > p.campana.fin ? ' ⚠' : '') :
          (g.faltan ? (g.techoBajo ? '⚠ no: techo por debajo' : g.techo ? '⚠ no: el ritmo se frena' : '⚠ al ritmo actual, no') : '—');
        return [escH_(g.nombre), g.cobertura == null ? '—' : nf(g.cobertura) + ' %', g.objetivo ? nf(g.objetivo) + ' %' : '—', nf(g.faltan),
          g.coberturaFinal == null ? '—' : nf(g.coberturaFinal) + ' %', llega];
      }).concat((p.agregados || []).map(function (a) {
        return ['<b>' + escH_(a.nombre) + '</b> (suma)', a.cobertura == null ? '—' : '<b>' + nf(a.cobertura) + ' %</b>', a.objetivo ? nf(a.objetivo) + ' %' : '—',
          nf(a.faltan), a.coberturaFinal == null ? '—' : nf(a.coberturaFinal) + ' %', ''];
      })));
  }
  const asis = p.asistencia && p.asistencia.agendas.filter(function (x) { return x.citados; });
  if (asis && asis.length) {
    html += '<h3>Asistencia a las citas (últimos ' + p.asistencia.dias + ' días)</h3>' + tabla(['Agenda', 'Citados / día', 'Faltaron', 'Asistencia', 'Citar al día'],
      asis.map(function (x) {
        return [escH_(x.agenda), nf(x.citadosDia), nf(x.faltaron), nf(x.asistencia) + ' %', x.citarPara == null ? '—' : nf(x.citarPara)];
      }));
  }

  html += '<h3>Stock</h3>' + tabla(['Vacuna', 'Stock', 'Semanas que quedan', 'Aviso'],
    p.vacunas.map(function (v) {
      return [escH_(v.nombre), nf(v.stock), nf(v.semanas), v.bajoMinimo ? '🔴 por debajo del mínimo' : v.pocasSemanas ? '🟠 menos de 2 semanas' : ''];
    }));

  const conReparto = p.vacunas.filter(function (v) { return v.reparto && (v.usada || v.consumoDia > 0); });
  if (conReparto.length) {
    html += '<h3>Pedido sugerido</h3>' +
      tabla(['Vacuna', 'Pedir antes de', 'Reparto', 'Pedido sugerido', 'Al final de la campaña'], conReparto.map(function (v) {
        return [escH_(v.nombre), escH_(v.reparto.hora) + ' del ' + fechaCorta_(v.reparto.limite), fechaCorta_(v.reparto.fecha),
          '<b>' + nf(v.pedido) + '</b>' + (v.noLlega ? ' ⚠ el stock no llega a este reparto' : ''),
          v.balanceFin == null ? '—' : v.balanceFin >= 0 ? 'sobrarían ' + nf(v.balanceFin) : 'faltarían ' + nf(-v.balanceFin)];
      }));
  }

  const url = urlApp_();
  html += '<p style="margin-top:18px;color:#5d6b78;font-size:12px">' + (url ? '<a href="' + escH_(url + '?p=panel') + '">Abrir el panel</a> · ' : '') +
    'Las previsiones son estimaciones. Este correo no contiene datos de pacientes.</p></div>';

  MailApp.sendEmail({
    to: c.correo,
    subject: 'Vacunación' + (c.centro ? ' · ' + c.centro : '') + ': resumen semanal',
    htmlBody: html,
    name: 'VaxForecast'
  });
}

/* ------------------ Aviso de pedido (Telegram/correo) -------------- */

/**
 * Lo llama el activador diario. Solo avisa el día en que vence el plazo del pedido
 * del próximo reparto, una vez por reparto, y solo si hay algo que pedir.
 */
function avisoPedidoDiario() {
  const c = leerConfig_();
  const p = calcularPrevision_(c);
  const props = PropertiesService.getScriptProperties();
  let hechos = [];
  try { hechos = JSON.parse(props.getProperty(PROP_AVISO_HECHO) || '[]'); } catch (e) {}
  if (!Array.isArray(hechos)) hechos = [];
  const grupos = gruposAviso_(p, false).filter(function (g) { return hechos.indexOf(g.clave) < 0; });
  if (!grupos.length) return;
  enviarAviso_(c, textoAviso_(c, p, grupos, false));
  props.setProperty(PROP_AVISO_HECHO, JSON.stringify(hechos.concat(grupos.map(function (g) { return g.clave; })).slice(-60)));
}

/**
 * Vacunas agrupadas por plazo de pedido: [{clave, limite, hora, fecha, siguiente, vacunas}].
 * Sin «prueba», solo los plazos que vencen hoy y con algo que pedir.
 */
function gruposAviso_(p, prueba) {
  const grupos = {};
  const orden = [];
  p.vacunas.forEach(function (v) {
    if (!v.reparto || !(v.usada || v.consumoDia > 0)) return;
    if (!prueba && (v.reparto.limite !== p.hoy || !(v.pedido > 0 || v.noLlega))) return;
    const r = v.reparto;
    const k = r.limite + ' ' + r.hora + '>' + r.fecha;
    if (!grupos[k]) { grupos[k] = { limite: r.limite, hora: r.hora, fecha: r.fecha, siguiente: r.siguiente, vacunas: [] }; orden.push(k); }
    grupos[k].vacunas.push(v);
  });
  return orden.sort().map(function (k) {
    const g = grupos[k];
    g.clave = k + ':' + g.vacunas.map(function (v) { return v.nombre; }).join(',');
    return g;
  });
}

/** Configura el aviso: {activo, hora, porCorreo, token}. token vacío = no cambiarlo; «borrar» = quitarlo. */
function guardarAvisos(pin, d) {
  const c = leerConfig_();
  comprobarPin_(c, pin);
  d = d || {};
  const props = PropertiesService.getScriptProperties();
  const token = String(d.token || '').trim();
  if (token === 'borrar') {
    props.deleteProperty(PROP_TG_TOKEN); props.deleteProperty(PROP_TG_CHAT); props.deleteProperty(PROP_TG_NOMBRE);
  } else if (token) {
    if (!/^\d{5,}:[\w-]{30,}$/.test(token)) throw new Error('Ese token no parece de un bot de Telegram (algo como 123456789:AAF…).');
    if (token !== props.getProperty(PROP_TG_TOKEN)) {
      telegram_(token, 'getMe', {});
      props.setProperty(PROP_TG_TOKEN, token);
      props.deleteProperty(PROP_TG_CHAT); props.deleteProperty(PROP_TG_NOMBRE);
    }
  }
  const hora = horaAviso_(d.hora);
  const porCorreo = !!d.porCorreo;
  if (porCorreo && !c.correo) throw new Error('Para el aviso por correo, escribe primero el correo en «Resumen semanal por correo» y guarda la campaña.');

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    reescribir_(libro_().getSheetByName(H_CFG), CAB_CFG, filasParams_(c, { avisoCorreo: porCorreo, avisoHora: hora }), true);
  } finally {
    lock.releaseLock();
  }
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'avisoPedidoDiario') ScriptApp.deleteTrigger(t);
  });
  if (d.activo) {
    const st = estadoAvisos_(leerConfig_());
    if (!st.telegram && !st.porCorreo) throw new Error('Conecta Telegram o marca el aviso por correo antes de activarlo.');
    ScriptApp.newTrigger('avisoPedidoDiario').timeBased().everyDays(1).atHour(hora).inTimezone(TZ).create();
  }
  return estadoAvisos_(leerConfig_());
}

/**
 * Busca el chat: hay que escribir antes al bot (/start) desde Telegram, o añadirlo a un grupo y escribir allí.
 * Guarda el último chat que le haya escrito y le manda un mensaje de confirmación.
 */
function conectarTelegram(pin) {
  const c = leerConfig_();
  comprobarPin_(c, pin);
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty(PROP_TG_TOKEN);
  if (!token) throw new Error('Pega primero el token del bot y guarda.');
  const upd = telegram_(token, 'getUpdates', { limit: 50, allowed_updates: ['message', 'my_chat_member'] }) || [];
  let chat = null;
  upd.forEach(function (u) {
    const m = u.message || u.my_chat_member;
    if (m && m.chat) chat = m.chat;
  });
  if (!chat) throw new Error('El bot no ha recibido ningún mensaje. Abre tu bot en Telegram, pulsa «Iniciar» (o escribe /start) y vuelve a pulsar «Conectar».');
  const nombre = chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.username || String(chat.id);
  props.setProperty(PROP_TG_CHAT, String(chat.id));
  props.setProperty(PROP_TG_NOMBRE, nombre);
  telegram_(token, 'sendMessage', {
    chat_id: chat.id, parse_mode: 'HTML',
    text: '✅ Conectado con <b>VaxForecast</b>' + (c.centro ? ' · ' + escH_(c.centro) : '') + '.\nAquí te avisaré los días que toque pedir vacunas.'
  });
  return estadoAvisos_(c);
}

/** Envía ahora el aviso de pedido (aunque hoy no toque pedir), marcado como prueba. */
function probarAviso(pin) {
  const c = leerConfig_();
  comprobarPin_(c, pin);
  const st = estadoAvisos_(c);
  if (!st.telegram && !st.porCorreo) throw new Error('Conecta Telegram o marca el aviso por correo.');
  const p = calcularPrevision_(c);
  const texto = textoAviso_(c, p, gruposAviso_(p, true), true);
  enviarAviso_(c, texto);
  return { ok: true, telegram: st.telegram, correo: st.porCorreo ? c.correo : '' };
}

function estadoAvisos_(c) {
  let props = null;
  try { props = PropertiesService.getScriptProperties(); } catch (e) {}
  let activo = false;
  try { activo = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'avisoPedidoDiario'; }); } catch (e) {}
  return {
    activo: activo,
    hora: c.avisoHora,
    porCorreo: c.avisoCorreo && !!c.correo,
    tokenGuardado: !!(props && props.getProperty(PROP_TG_TOKEN)),
    telegram: !!(props && props.getProperty(PROP_TG_TOKEN) && props.getProperty(PROP_TG_CHAT)),
    chatNombre: props ? props.getProperty(PROP_TG_NOMBRE) || '' : ''
  };
}

function horaAviso_(v) {
  const n = Math.round(Number(String(v == null ? '' : v).replace(/[^\d.]/g, '')));
  return isFinite(n) && n >= 6 && n <= 13 ? n : 9;
}

/** Texto del aviso (HTML de Telegram) para los grupos de gruposAviso_. */
function textoAviso_(c, p, grupos, prueba) {
  const cab = (prueba ? '🧪 <b>PRUEBA</b>\n' : '') + '💉 <b>Pedido de vacunas</b>' + (c.centro ? ' · ' + escH_(c.centro) : '');
  if (!grupos.length) return cab + '\nNo hay días de reparto configurados para las vacunas en uso: no puedo calcular cuándo pedir.';
  let t = cab;
  grupos.forEach(function (g) {
    const cuando = g.limite === p.hoy ? '<b>Hoy</b>' : 'El <b>' + fechaCorta_(g.limite) + '</b>';
    const lineas = g.vacunas.map(function (v) {
      return '• ' + escH_(v.nombre) + ': <b>' + (v.pedido || 0) + '</b> (' + (v.stock < 0 ? 'stock negativo: haz un recuento' : 'stock ' + v.stock) + ')' +
        (v.noLlega ? ' ⚠️ no llega al reparto' : '');
    });
    t += '\n\n' + cuando + ' antes de las ' + escH_(g.hora) + ' → reparto del ' + fechaCorta_(g.fecha) + ':\n' + lineas.join('\n') +
      (g.siguiente ? '\n<i>Cubre hasta el reparto del ' + fechaCorta_(g.siguiente) + '.</i>' : '\n<i>Es el último reparto de la campaña.</i>');
  });
  t += '\n\nRevísalo antes de pedir: es una estimación.';
  const url = urlApp_();
  if (url) t += '\n<a href="' + escH_(url + '?p=panel') + '">Abrir el panel</a>';
  return t;
}

function enviarAviso_(c, texto) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty(PROP_TG_TOKEN);
  const chat = props.getProperty(PROP_TG_CHAT);
  let errores = [];
  if (token && chat) {
    try { telegram_(token, 'sendMessage', { chat_id: chat, text: texto, parse_mode: 'HTML', disable_web_page_preview: true }); }
    catch (e) { errores.push('Telegram: ' + (e && e.message ? e.message : e)); }
  }
  if (c.avisoCorreo && c.correo) {
    MailApp.sendEmail({
      to: c.correo,
      subject: 'Pedido de vacunas' + (c.centro ? ' · ' + c.centro : ''),
      htmlBody: '<div style="font-family:Arial,sans-serif;font-size:15px">' + texto.replace(/\n/g, '<br>') + '</div>',
      name: 'VaxForecast'
    });
  }
  if (errores.length) throw new Error(errores.join(' · '));
}

/** Llamada a la API de bots de Telegram. Devuelve «result» o lanza el error que dé Telegram. */
function telegram_(token, metodo, datos) {
  const res = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/' + metodo, {
    method: 'post', contentType: 'application/json', payload: JSON.stringify(datos || {}), muteHttpExceptions: true
  });
  let j = {};
  try { j = JSON.parse(res.getContentText()); } catch (e) {}
  if (!j.ok) {
    const desc = j.description || ('HTTP ' + res.getResponseCode());
    if (/Unauthorized/i.test(desc)) throw new Error('Telegram no acepta ese token. Cópialo otra vez de @BotFather.');
    if (/chat not found|blocked/i.test(desc)) throw new Error('Telegram no encuentra el chat. Escribe /start a tu bot y vuelve a conectar.');
    throw new Error('Telegram: ' + desc);
  }
  return j.result;
}

/* -------------------------- Internas ----------------------------- */

function libro_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function hoy_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function urlApp_() { try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; } }

function num_(v) {
  const n = Number(String(v == null ? '' : v).replace(',', '.'));
  return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

/** Texto de una línea, recortado. Si empieza por = + - @ se guarda como texto, no como fórmula. */
function limpiarTexto_(s, max) {
  const t = String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
  return /^[=+\-@]/.test(t) ? "'" + t : t;
}

/**
 * Lista de profesionales: nombres sueltos o {nombre, perfil, huecos}.
 * perfil: uno de «perfiles» (si no existe, sin perfil). huecos: '' = los del perfil; 0 = sin cita.
 */
function listaProfesionales_(lista, perfiles) {
  const vistos = {};
  const pf = {};
  (perfiles || []).forEach(function (p) { pf[p.nombre.toLowerCase()] = p.nombre; });
  return (lista || [])
    .map(function (x) {
      const o = x && typeof x === 'object' ? x : { nombre: x };
      return { n: limpiarTexto_(o.nombre, 60), p: pf[String(o.perfil || '').trim().toLowerCase()] || '', h: huecosTxt_(o.huecos) };
    })
    .filter(function (o) { if (!o.n || vistos[o.n.toLowerCase()]) return false; vistos[o.n.toLowerCase()] = true; return true; })
    .slice(0, 200)
    .map(function (o) { return [o.n, 'Sí', o.p, o.h]; });
}

/** Perfiles: «Enfermería de familia: 14; Enfermería pediátrica: 8; Enfermería obstétrica: 0» → [{nombre, huecos}]. */
function leerPerfiles_(txt) {
  const vistos = {};
  return String(txt == null ? '' : txt).split(/[;\n]+/).map(function (x) { return x.trim(); }).filter(Boolean).map(function (x) {
    const m = x.match(/^(.*?)\s*[:=]\s*(\d+)\s*$/);
    return m ? { nombre: limpiarTexto_(m[1], 40), huecos: Math.min(200, Number(m[2])) } : { nombre: limpiarTexto_(x, 40), huecos: null };
  }).filter(function (p) { if (!p.nombre || vistos[p.nombre.toLowerCase()]) return false; vistos[p.nombre.toLowerCase()] = true; return true; }).slice(0, 12);
}
function textoPerfiles_(lista) {
  return lista.map(function (p) { return p.nombre + (p.huecos == null ? '' : ': ' + p.huecos); }).join('; ');
}
/** Perfiles que llegan del panel: [{nombre, huecos}]; comprueba nombres y números. */
function perfilesDe_(lista) {
  const vistos = {};
  return (lista || []).slice(0, 12).map(function (p) {
    const nombre = limpiarTexto_(p && p.nombre, 40).replace(/[:;=]/g, ' ').trim();
    if (!nombre) return null;
    if (vistos[nombre.toLowerCase()]) throw new Error('El perfil «' + nombre + '» está repetido.');
    vistos[nombre.toLowerCase()] = true;
    const h = huecosTxt_(p.huecos);
    return { nombre: nombre, huecos: h === '' ? null : h };
  }).filter(Boolean);
}
function huecosTxt_(v) {
  if (v === '' || v == null) return '';
  const n = Number(String(v).replace(',', '.'));
  if (!isFinite(n) || n < 0) return '';
  return Math.min(200, Math.round(n));
}

/**
 * Huecos por día de cada profesional: los suyos propios si los tiene; si no, los de su perfil;
 * si no, el número general de Configuración. 0 = vacuna sin cita (oportunista, p. ej. la matrona).
 * Capacidad diaria del centro:
 *   - si nadie tiene perfil ni huecos propios: enfermeras/os × huecos generales (como antes);
 *   - si no: suma de los huecos de cada profesional activo.
 */
function perfilDe_(c, prof) { return c.perfilProf[prof] || ''; }
function huecosDe_(c, prof) {
  const h = c.huecosProf[prof];
  if (h != null) return h;
  const pf = c.perfiles.filter(function (p) { return p.nombre === perfilDe_(c, prof); })[0];
  return pf && pf.huecos != null ? pf.huecos : c.huecos;
}
function porPersona_(c) { return Object.keys(c.huecosProf).length > 0 || Object.keys(c.perfilProf).length > 0; }
function capacidadDia_(c) {
  if (!porPersona_(c) || !c.profesionales.length) return c.enfermeras * c.huecos;
  return c.profesionales.reduce(function (s, p) { return s + huecosDe_(c, p); }, 0);
}

/** Filas de Configuración: lo que ya hay (c) con los cambios de «cambios» encima. */
function filasParams_(c, cambios) {
  const o = {};
  Object.keys(c).forEach(function (k) { o[k] = c[k]; });
  Object.keys(cambios || {}).forEach(function (k) { o[k] = cambios[k]; });
  return [
    [P.centro, o.centro || ''],
    [P.enf, String(o.enfermeras || 0)],
    [P.huecos, String(o.huecos || 0)],
    [P.dias, String(o.dias || 5)],
    [P.pin, o.pin],
    [P.porProf, o.porProfesional ? 'Sí' : 'No'],
    [P.inicio, o.inicio || ''],
    [P.fin, o.fin || ''],
    [P.correo, o.correo || ''],
    [P.avisoCorreo, o.avisoCorreo ? 'Sí' : 'No'],
    [P.avisoHora, String(o.avisoHora == null ? 9 : o.avisoHora)],
    [P.clave, o.clave || ''],
    [P.agendas, (o.agendas || []).join(', ')],
    [P.pautas, o.pautasTxt || ''],
    [P.perfiles, textoPerfiles_(o.perfiles || [])]
  ];
}

/* ------------------- Vacunas y pautas del contador ------------------- */

/** Frente a qué protege una vacuna: {gripe, covid}. Si la hoja no lo dice, se deduce del nombre. */
function protegeDe_(nombre, txt) {
  const s = String(txt == null ? '' : txt).toLowerCase();
  const g = /grip/.test(s), cv = /covid/.test(s);
  if (g || cv) return { gripe: g, covid: cv };
  const n = String(nombre || '').toLowerCase();
  if (/combriax|mrna-?1083/.test(n)) return { gripe: true, covid: true };
  if (/covid|comirnaty|spikevax|bimervax|nuvaxovid|vidprevtyn|kostaive/.test(n)) return { gripe: false, covid: true };
  return { gripe: true, covid: false };
}
function protegeTxt_(p) { return p.gripe && p.covid ? PROTEGE[2] : p.covid ? PROTEGE[1] : PROTEGE[0]; }

/**
 * Pautas: lo que se pone a un paciente en un mismo acto. Texto «Efluelda + Comirnaty30; Efluelda; mCombriax».
 * Cada pauta: {gripe: vacuna con gripe o '', covid: vacuna solo de COVID o ''}.
 * Vacío = todas las combinaciones posibles con las vacunas activas.
 */
function leerPautas_(txt, vacunas, estricto) {
  const act = vacunas.filter(function (v) { return v.activa; });
  const por = {};
  act.forEach(function (v) { por[v.nombre.toLowerCase()] = v; });
  const s = String(txt == null ? '' : txt).trim();
  if (!s) return pautasPorDefecto_(act);
  const out = [];
  const vistas = {};
  s.split(/[;\n]+/).map(function (x) { return x.trim(); }).filter(Boolean).forEach(function (p) {
    const nombres = p.split('+').map(function (x) { return x.trim(); }).filter(Boolean);
    const vs = nombres.map(function (n) { return por[n.toLowerCase()]; });
    const malo = function (m) { if (estricto) throw new Error('Pauta «' + limpiarTexto_(p, 60) + '»: ' + m); };
    if (vs.some(function (v) { return !v; })) return malo('alguna vacuna no está en la lista de vacunas activas.');
    let gripe = '', covid = '';
    for (let i = 0; i < vs.length; i++) {
      const v = vs[i];
      if (v.protege.gripe) { if (gripe) return malo('lleva dos vacunas de gripe.'); gripe = v.nombre; }
      else { if (covid) return malo('lleva dos vacunas de COVID.'); covid = v.nombre; }
    }
    if (gripe && covid && por[gripe.toLowerCase()].protege.covid) return malo(gripe + ' ya lleva la COVID.');
    const k = (gripe + '|' + covid).toLowerCase();
    if (!vistas[k]) { vistas[k] = true; out.push({ gripe: gripe, covid: covid }); }
  });
  if (!out.length && estricto) throw new Error('Pon al menos una pauta.');
  return out.length ? out : pautasPorDefecto_(act);
}
function pautasPorDefecto_(act) {
  const gripe = act.filter(function (v) { return v.protege.gripe; });
  const covid = act.filter(function (v) { return !v.protege.gripe; });
  const out = [];
  gripe.forEach(function (g) {
    out.push({ gripe: g.nombre, covid: '' });
    if (!g.protege.covid) covid.forEach(function (c) { out.push({ gripe: g.nombre, covid: c.nombre }); });
  });
  covid.forEach(function (c) { out.push({ gripe: '', covid: c.nombre }); });
  return out;
}
function nombrePauta_(p) { return [p.gripe, p.covid].filter(Boolean).join(' + '); }
function textoPautas_(lista) { return lista.map(nombrePauta_).join('; '); }

/**
 * Cuadrícula del contador: filas = vacuna con gripe (partida por grupo si está en varios grupos activos)
 * y una fila «Solo COVID»; columnas = «sola» + vacunas solo de COVID que salen en alguna pauta.
 * Cada casilla es un paciente: {gripe, covid, grupo}.
 */
function cuadricula_(c) {
  const pautas = c.pautas;
  const grupos = leerGrupos_().filter(function (g) { return g.activo; });
  const cols = [];
  c.vacunas.forEach(function (v) {
    if (v.activa && !v.protege.gripe && pautas.some(function (p) { return p.covid === v.nombre; })) cols.push(v.nombre);
  });
  const celdas = function (gr) {
    return [''].concat(cols).map(function (cv) { return pautas.some(function (p) { return p.gripe === gr && p.covid === cv; }); });
  };
  // Las filas son de gripe: se parten solo por grupos de gripe (no por «65 o más · COVID»).
  const prot = {};
  c.vacunas.forEach(function (v) { prot[v.nombre.toLowerCase()] = v.protege; });
  const deGripe = function (g) {
    return g.vacunas.every(function (x) { return (prot[x.toLowerCase()] || protegeDe_(x, '')).gripe; }) ||
      !g.vacunas.every(function (x) { return (prot[x.toLowerCase()] || protegeDe_(x, '')).covid; }); // mixto: también
  };
  const filas = [];
  c.vacunas.forEach(function (v) {
    if (!v.activa || !v.protege.gripe || !pautas.some(function (p) { return p.gripe === v.nombre; })) return;
    const kv = v.nombre.toLowerCase();
    const suyos = grupos.filter(function (g) { return deGripe(g) && g.vacunas.some(function (x) { return x.toLowerCase() === kv; }); });
    const base = { gripe: v.nombre, texto: '', ambas: v.protege.covid, celdas: celdas(v.nombre) };
    if (suyos.length < 2) filas.push(Object.assign({ grupo: '' }, base));
    else suyos.forEach(function (g) { filas.push(Object.assign({ grupo: g.nombre }, base)); });
  });
  if (pautas.some(function (p) { return !p.gripe; })) filas.push({ gripe: '', grupo: '', texto: '', ambas: false, celdas: celdas('') });
  return { columnas: cols, filas: filas };
}

/**
 * Contadores definidos en la hoja «Contadores» (perfiles: «Adultos», «Pediatría»…).
 * [{nombre, filas: [{gripe, texto, grupo, sola, covid: [...], ambas}]}], en el orden de la hoja.
 */
function leerContadores_(c) {
  const h = libro_().getSheetByName(H_CON);
  if (!h) return [];
  return contadoresDe_(c, filas_(h, CAB_CON.length).map(function (r) {
    return { contador: r[0], gripe: r[1], texto: r[2], grupo: r[3], sola: !esNo_(r[4]), covid: String(r[5] == null ? '' : r[5]).split(/[,;+]+/) };
  }), false);
}
/** Comprueba y ordena filas {contador, gripe, texto, grupo, sola, covid[]}. estricto = error si algo no cuadra. */
function contadoresDe_(c, filas, estricto) {
  const vac = {};
  c.vacunas.forEach(function (v) { if (v.activa) vac[v.nombre.toLowerCase()] = v; });
  const gru = {};
  leerGrupos_().forEach(function (g) { if (g.activo) gru[g.nombre.toLowerCase()] = g; });
  const out = [];
  const por = {};
  filas.forEach(function (r) {
    const nombre = limpiarTexto_(r.contador, 40);
    if (!nombre) return;
    const malo = function (m) { if (estricto) throw new Error('Contador «' + nombre + '»: ' + m); };
    const g = String(r.gripe || '').trim() ? vac[String(r.gripe).trim().toLowerCase()] : null;
    if (String(r.gripe || '').trim() && (!g || !g.protege.gripe)) return malo('«' + limpiarTexto_(r.gripe, 40) + '» no es una vacuna de gripe activa.');
    const covid = [];
    (r.covid || []).forEach(function (x) {
      x = String(x || '').trim();
      if (!x) return;
      const v = vac[x.toLowerCase()];
      if (!v || v.protege.gripe) return malo('«' + limpiarTexto_(x, 40) + '» no es una vacuna solo de COVID activa.');
      if (covid.indexOf(v.nombre) < 0) covid.push(v.nombre);
    });
    const ambas = !!(g && g.protege.covid);
    const sola = g ? (ambas ? true : !!r.sola) : false;
    if (ambas) covid.length = 0;
    if (!sola && !covid.length) return malo('una fila no tiene ninguna casilla.');
    let grupo = '';
    if (String(r.grupo || '').trim()) {
      const gg = gru[String(r.grupo).trim().toLowerCase()];
      if (!gg) return malo('el grupo «' + limpiarTexto_(r.grupo, 60) + '» no existe o no está activo.');
      const vk = g ? g.nombre.toLowerCase() : (covid[0] || '').toLowerCase();
      if (!gg.vacunas.some(function (x) { return x.toLowerCase() === vk; })) return malo('el grupo «' + gg.nombre + '» no usa ' + (g ? g.nombre : covid[0]) + '.');
      grupo = gg.nombre;
    }
    if (!por[nombre.toLowerCase()]) { por[nombre.toLowerCase()] = { nombre: nombre, filas: [] }; out.push(por[nombre.toLowerCase()]); }
    por[nombre.toLowerCase()].filas.push({ gripe: g ? g.nombre : '', texto: limpiarTexto_(r.texto, 40), grupo: grupo, sola: sola, covid: covid, ambas: ambas });
  });
  return out.slice(0, 12);
}
/** Cuadrícula de un contador: columnas = vacunas de COVID que salen en sus filas (en el orden de «Vacunas»). */
function cuadriculaDe_(c, k) {
  const cols = c.vacunas.filter(function (v) {
    return k.filas.some(function (f) { return f.covid.indexOf(v.nombre) >= 0; });
  }).map(function (v) { return v.nombre; });
  return {
    columnas: cols,
    filas: k.filas.map(function (f) {
      return { gripe: f.gripe, texto: f.texto, grupo: f.grupo, ambas: f.ambas,
        celdas: f.ambas ? [true] : [f.sola].concat(cols.map(function (cv) { return f.covid.indexOf(cv) >= 0; })) };
    })
  };
}

/** «GRI, Gri2» → ['GRI', 'Gri2'] (sin repetidas, máximo 8). */
function listaAgendas_(s) {
  const vistos = {};
  return String(s == null ? '' : s).split(/[,;]+/).map(function (x) { return limpiarTexto_(x, 30); })
    .filter(function (x) { if (!x || vistos[x.toLowerCase()]) return false; vistos[x.toLowerCase()] = true; return true; })
    .slice(0, 8);
}

function esNo_(v) { return /^n/i.test(String(v == null ? '' : v).trim()); }

/** Porcentaje: acepta 75, «75 %» o 0,75. */
function pct_(v) {
  const n = num_(String(v == null ? '' : v).replace('%', '').trim());
  return n > 0 && n <= 1 && /[.,]/.test(String(v)) ? Math.round(n * 1000) / 10 : Math.min(100, n);
}

/** Fecha como texto yyyy-MM-dd (acepta fechas de la hoja, yyyy-mm-dd y dd/mm/aaaa). */
function fechaTxt_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  const s = String(v == null ? '' : v).trim();
  let a = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (a) return fechaValida_(+a[1], +a[2], +a[3]);
  a = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (a) return fechaValida_(+a[3], +a[2], +a[1]);
  return '';
}
function fechaValida_(y, m, d) {
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return '';
  return y + '-' + dos_(m) + '-' + dos_(d);
}
function dos_(n) { n = String(Number(n)); return n.length < 2 ? '0' + n : n; }

/* Fechas yyyy-MM-dd como texto; laborables = lunes a viernes (no tiene en cuenta festivos). */
function fUTC_(f) { const a = f.split('-').map(Number); return new Date(Date.UTC(a[0], a[1] - 1, a[2])); }
function sumarDias_(f, n) { const d = fUTC_(f); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function diaSem_(f) { return fUTC_(f).getUTCDay(); }
function esLaborable_(f) { const w = diaSem_(f); return w >= 1 && w <= 5; }
function maxF_(a, b) { return a > b ? a : b; }
function laborables_(a, b) {
  if (!a || !b || a > b) return 0;
  let n = 0;
  for (let f = a, i = 0; f <= b && i < 800; f = sumarDias_(f, 1), i++) if (esLaborable_(f)) n++;
  return n;
}
function sumarLaborables_(f, n) { let k = 0; while (k < n) { f = sumarDias_(f, 1); if (esLaborable_(f)) k++; } return f; }
function restarLaborables_(f, n) { let k = 0; while (k < n) { f = sumarDias_(f, -1); if (esLaborable_(f)) k++; } return f; }

/**
 * Comprueba el PIN del panel. Tras PIN_INTENTOS fallos seguidos, el panel queda bloqueado
 * PIN_BLOQUEO_MIN minutos (también para el PIN bueno), para que no se pueda adivinar probando.
 */
const PIN_MIN = 6;
const PIN_INTENTOS = 5;
const PIN_BLOQUEO_MIN = 15;
function comprobarPin_(c, pin) {
  if (!c.pin) return;
  const cache = CacheService.getScriptCache();
  const hasta = Number(cache.get('pin_bloqueo') || 0);
  if (hasta > Date.now()) {
    throw new Error('PIN bloqueado por demasiados intentos fallidos. Prueba dentro de ' + Math.ceil((hasta - Date.now()) / 60000) + ' min.');
  }
  if (String(pin == null ? '' : pin).trim() === c.pin) {
    if (cache.get('pin_fallos')) cache.remove('pin_fallos');
    return;
  }
  const fallos = Number(cache.get('pin_fallos') || 0) + 1;
  if (fallos >= PIN_INTENTOS) {
    cache.put('pin_bloqueo', String(Date.now() + PIN_BLOQUEO_MIN * 60000), PIN_BLOQUEO_MIN * 60);
    cache.remove('pin_fallos');
    throw new Error('PIN incorrecto. Panel bloqueado ' + PIN_BLOQUEO_MIN + ' minutos por demasiados intentos.');
  }
  cache.put('pin_fallos', String(fallos), PIN_BLOQUEO_MIN * 60);
  throw new Error('PIN incorrecto');
}

function pinValido_(p) {
  return new RegExp('^\\S{' + PIN_MIN + ',20}$').test(p);
}

function esPinFabrica_(c) { return !c.pin || c.pin === PIN_FABRICA; }

function asegurarHojas_() {
  const ss = libro_();
  let h = ss.getSheetByName(H_REG);
  if (!h) {
    h = ss.insertSheet(H_REG);
    h.getRange(1, 1, 1, CAB_REG.length).setValues([CAB_REG]).setFontWeight('bold');
    h.setFrozenRows(1);
    h.getRange(1, 1, h.getMaxRows(), 1).setNumberFormat('dd/mm/yyyy hh:mm:ss');
    h.getRange(1, 3, h.getMaxRows(), 1).setNumberFormat('@');
  }
  h = ss.getSheetByName(H_CFG);
  if (!h) { h = ss.insertSheet(H_CFG); reescribir_(h, CAB_CFG, PARAMS_DEF, true); h.setColumnWidth(1, 330); }
  h = ss.getSheetByName(H_VAC);
  if (!h) { h = ss.insertSheet(H_VAC); reescribir_(h, CAB_VAC, VAC_DEF, false); h.setColumnWidth(2, 200); }
  h = ss.getSheetByName(H_PRO);
  if (!h) { h = ss.insertSheet(H_PRO); reescribir_(h, CAB_PRO, [], false); h.setColumnWidth(1, 220); }
  h = ss.getSheetByName(H_STK);
  if (!h) {
    h = ss.insertSheet(H_STK);
    h.getRange(1, 1, 1, CAB_STK.length).setValues([CAB_STK]).setFontWeight('bold');
    h.setFrozenRows(1);
    h.getRange(1, 1, h.getMaxRows(), 1).setNumberFormat('dd/mm/yyyy hh:mm:ss');
    h.getRange(1, 2, h.getMaxRows(), 1).setNumberFormat('@');
    h.getRange(1, 6, h.getMaxRows(), 1).setNumberFormat('@');
    h.setColumnWidth(6, 280);
  }
  h = ss.getSheetByName(H_GRU);
  if (!h) { h = ss.insertSheet(H_GRU); reescribir_(h, CAB_GRU, [], [3]); h.setColumnWidth(1, 220); h.setColumnWidth(2, 200); }
  h = ss.getSheetByName(H_COB);
  if (!h) {
    h = ss.insertSheet(H_COB);
    reescribir_(h, CAB_COB, [], [2, 5]);
    h.getRange(1, 1, h.getMaxRows(), 1).setNumberFormat('dd/mm/yyyy hh:mm:ss');
    h.setColumnWidth(3, 220); h.setColumnWidth(5, 260);
  }
  h = ss.getSheetByName(H_CON);
  if (!h) { h = ss.insertSheet(H_CON); reescribir_(h, CAB_CON, [], [1, 2, 3, 4, 5, 6]); h.setColumnWidth(1, 180); h.setColumnWidth(3, 200); h.setColumnWidth(4, 180); h.setColumnWidth(6, 220); }
  h = ss.getSheetByName(H_PAC);
  if (!h) {
    h = ss.insertSheet(H_PAC);
    reescribir_(h, CAB_PAC, [], [2, 4]);
    h.getRange(1, 1, h.getMaxRows(), 1).setNumberFormat('dd/mm/yyyy hh:mm:ss');
    h.setColumnWidth(4, 260);
  }
  h = ss.getSheetByName(H_CIT);
  if (!h) {
    h = ss.insertSheet(H_CIT);
    reescribir_(h, CAB_CIT, [], [2, 3]);
    h.getRange(1, 1, h.getMaxRows(), 1).setNumberFormat('dd/mm/yyyy hh:mm:ss');
  }
  h = ss.getSheetByName(H_REP);
  if (!h) { h = ss.insertSheet(H_REP); reescribir_(h, CAB_REP, [], [1, 2, 3, 5, 6]); h.setColumnWidth(3, 160); h.setColumnWidth(4, 260); h.setColumnWidth(6, 220); }
}

/**
 * Pone al día una hoja creada con una versión anterior, sin borrar nada:
 *   - añade la columna «Stock mínimo» a Vacunas;
 *   - añade a Configuración los parámetros que falten (p. ej. «Nombre del centro»).
 */
function migrar_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    const ss = libro_();
    const hv = ss.getSheetByName(H_VAC);
    if (hv.getMaxColumns() < CAB_VAC.length) hv.insertColumnsAfter(hv.getMaxColumns(), CAB_VAC.length - hv.getMaxColumns());
    const cab = hv.getRange(1, 1, 1, CAB_VAC.length).getValues()[0];
    if (String(cab[3]).trim() === '') hv.getRange(1, 4).setValue(CAB_VAC[3]).setFontWeight('bold');
    // Vacunas: «Protege frente a» (v1.4). Se rellena según el nombre; se puede cambiar en el panel.
    if (String(cab[4]).trim() === '') {
      hv.getRange(1, 5).setValue(CAB_VAC[4]).setFontWeight('bold');
      const nv = hv.getLastRow() - 1;
      if (nv > 0) {
        const noms = hv.getRange(2, 1, nv, 1).getValues();
        hv.getRange(2, 5, nv, 1).setValues(noms.map(function (r) { return [String(r[0]).trim() ? protegeTxt_(protegeDe_(String(r[0]), '')) : '']; }));
      }
    }
    // Profesionales: «Huecos por día» (v1.4)
    const hp = ss.getSheetByName(H_PRO);
    if (hp) {
      if (hp.getMaxColumns() < CAB_PRO.length) hp.insertColumnsAfter(hp.getMaxColumns(), CAB_PRO.length - hp.getMaxColumns());
      const cp = hp.getRange(1, 3, 1, 2).getValues()[0];
      if (String(cp[0]).trim() === '' && String(cp[1]).trim() === '') hp.getRange(1, 3, 1, 2).setValues([[CAB_PRO[2], CAB_PRO[3]]]).setFontWeight('bold');
    }
    // Registro: «Paciente» y «Pauta» (v1.4)
    const hr2 = ss.getSheetByName(H_REG);
    if (hr2) {
      if (hr2.getMaxColumns() < CAB_REG.length) hr2.insertColumnsAfter(hr2.getMaxColumns(), CAB_REG.length - hr2.getMaxColumns());
      const cr = hr2.getRange(1, 10, 1, 3).getValues()[0];
      if (String(cr[0]).trim() === '') hr2.getRange(1, 10, 1, 2).setValues([[CAB_REG[9], CAB_REG[10]]]).setFontWeight('bold');
      if (String(cr[2]).trim() === '') hr2.getRange(1, 12).setValue(CAB_REG[11]).setFontWeight('bold');
    }

    // Registro: columna «Grupo» (v1.3)
    const hg = ss.getSheetByName(H_REG);
    if (hg) {
      if (hg.getMaxColumns() < CAB_REG.length) hg.insertColumnsAfter(hg.getMaxColumns(), CAB_REG.length - hg.getMaxColumns());
      if (String(hg.getRange(1, 9).getValues()[0][0]).trim() === '') hg.getRange(1, 9).setValue(CAB_REG[8]).setFontWeight('bold');
    }

    // Grupos: columna «Techo esperado %» (v1.4)
    const hgr = ss.getSheetByName(H_GRU);
    if (hgr) {
      if (hgr.getMaxColumns() < CAB_GRU.length) hgr.insertColumnsAfter(hgr.getMaxColumns(), CAB_GRU.length - hgr.getMaxColumns());
      if (String(hgr.getRange(1, 7).getValues()[0][0]).trim() === '') hgr.getRange(1, 7).setValue(CAB_GRU[6]).setFontWeight('bold');
      if (String(hgr.getRange(1, 8).getValues()[0][0]).trim() === '') hgr.getRange(1, 8).setValue(CAB_GRU[7]).setFontWeight('bold');
    }

    // Repartos: columna «Vacunas» (v1.1)
    const hr = ss.getSheetByName(H_REP);
    if (hr) {
      if (hr.getMaxColumns() < CAB_REP.length) hr.insertColumnsAfter(hr.getMaxColumns(), CAB_REP.length - hr.getMaxColumns());
      if (String(hr.getRange(1, 6).getValues()[0][0]).trim() === '') {
        hr.getRange(1, 6).setValue(CAB_REP[5]).setFontWeight('bold');
        hr.getRange(1, 6, hr.getMaxRows(), 1).setNumberFormat('@');
      }
    }

    const hc = ss.getSheetByName(H_CFG);
    const tiene = {};
    filas_(hc, 1).forEach(function (r) { tiene[String(r[0]).trim()] = true; });
    PARAMS_DEF.forEach(function (p) { if (!tiene[p[0]]) hc.appendRow(p); });
  } finally {
    lock.releaseLock();
  }
}

/** Reescribe una hoja. «texto»: true (columna 2 como texto) o lista de columnas que se guardan como texto. */
function reescribir_(h, cab, filas, texto) {
  if (h.getMaxColumns() < cab.length) h.insertColumnsAfter(h.getMaxColumns(), cab.length - h.getMaxColumns());
  h.clearContents();
  (texto === true ? [2] : texto || []).forEach(function (col) { h.getRange(1, col, h.getMaxRows(), 1).setNumberFormat('@'); });
  h.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold');
  if (filas.length) h.getRange(2, 1, filas.length, cab.length).setValues(filas);
  h.setFrozenRows(1);
}

/** Filas de datos (sin cabecera) con nc columnas; rellena con '' si la hoja tiene menos columnas. */
function filas_(h, nc) {
  const n = h.getLastRow() - 1;
  if (n <= 0) return [];
  const m = Math.min(nc, h.getMaxColumns());
  return h.getRange(2, 1, n, m).getValues().map(function (r) {
    while (r.length < nc) r.push('');
    return r;
  });
}

function leerConfig_() {
  asegurarHojas_();
  const ss = libro_();
  const p = {};
  filas_(ss.getSheetByName(H_CFG), 2).forEach(function (r) {
    if (String(r[0]).trim()) p[String(r[0]).trim()] = r[1];
  });
  const esNo = function (v) { return /^n/i.test(String(v == null ? '' : v).trim()); };
  const vacunas = filas_(ss.getSheetByName(H_VAC), CAB_VAC.length)
    .filter(function (r) { return String(r[0]).trim(); })
    .map(function (r) {
      const nombre = String(r[0]).trim();
      const pr = protegeDe_(nombre, r[4]);
      return { nombre: nombre, necesarias: num_(r[1]), activa: !esNo(r[2]), minimo: Math.round(num_(r[3])), protege: pr, protegeTxt: protegeTxt_(pr) };
    });
  const filasPro = filas_(ss.getSheetByName(H_PRO), 4).filter(function (r) { return String(r[0]).trim() && !esNo(r[1]); });
  const profesionales = filasPro.map(function (r) { return String(r[0]).trim(); });
  const perfiles = leerPerfiles_(p[P.perfiles]);
  const pfN = {};
  perfiles.forEach(function (x) { pfN[x.nombre.toLowerCase()] = x.nombre; });
  const huecosProf = {}; // solo los que tienen huecos propios
  const perfilProf = {}; // solo los que tienen perfil
  filasPro.forEach(function (r) {
    const n = String(r[0]).trim();
    const pf = pfN[String(r[2] == null ? '' : r[2]).trim().toLowerCase()];
    if (pf) perfilProf[n] = pf;
    const h = huecosTxt_(r[3]);
    if (h !== '') huecosProf[n] = h;
  });
  return {
    centro: String(p[P.centro] == null ? '' : p[P.centro]).trim(),
    enfermeras: num_(p[P.enf]),
    huecos: num_(p[P.huecos]),
    dias: Math.min(7, num_(p[P.dias]) || 5),
    pin: String(p[P.pin] == null ? '' : p[P.pin]).trim(),
    porProfesional: !esNo(p[P.porProf] == null ? 'No' : p[P.porProf]),
    inicio: fechaTxt_(p[P.inicio]),
    fin: fechaTxt_(p[P.fin]),
    correo: String(p[P.correo] == null ? '' : p[P.correo]).trim(),
    avisoCorreo: !esNo(p[P.avisoCorreo] == null ? 'No' : p[P.avisoCorreo]),
    avisoHora: horaAviso_(p[P.avisoHora]),
    clave: String(p[P.clave] == null ? '' : p[P.clave]).trim(),
    agendas: listaAgendas_(p[P.agendas]),
    pautasTxt: String(p[P.pautas] == null ? '' : p[P.pautas]).trim(),
    pautas: leerPautas_(p[P.pautas], vacunas, false),
    vacunas: vacunas,
    profesionales: profesionales,
    huecosProf: huecosProf,
    perfilProf: perfilProf,
    perfiles: perfiles
  };
}

/** Lee el registro. La fecha sale siempre del «Momento» en la zona horaria del centro. */
function leerRegistro_() {
  const h = libro_().getSheetByName(H_REG);
  const n = h.getLastRow() - 1;
  if (n <= 0) return [];
  return filasRegistro_(h.getRange(2, 1, n, colsReg_(h)).getValues());
}

/**
 * Lee solo el final del registro, por bloques, hasta llegar a filas anteriores a «fecha».
 * Las filas se añaden al final, así que las de hoy están abajo (también las que llegan tarde
 * de un móvil sin conexión). Para el contador, que consulta cada pocos minutos.
 */
const BLOQUE_REG = 2000;
function leerRegistroDesde_(fecha) {
  const h = libro_().getSheetByName(H_REG);
  let fin = h.getLastRow();
  let out = [];
  while (fin >= 2) {
    const ini = Math.max(2, fin - BLOQUE_REG + 1);
    const bloque = filasRegistro_(h.getRange(ini, 1, fin - ini + 1, colsReg_(h)).getValues());
    out = bloque.concat(out);
    // Seguir subiendo solo si alguna de las primeras filas del bloque aún es de la fecha buscada o posterior.
    if (!bloque.slice(0, 20).some(function (r) { return r.fecha >= fecha; })) break;
    fin = ini - 1;
  }
  return out;
}

/** Columnas que se leen del Registro: hasta «Grupo» si la hoja la tiene. */
function colsReg_(h) { return Math.min(CAB_REG.length, Math.max(7, h.getMaxColumns())); }

function filasRegistro_(valores) {
  const out = [];
  valores.forEach(function (r) {
    if (r[0] === '' || r[0] == null) return;
    const d = r[0] instanceof Date ? r[0] : new Date(r[0]);
    if (isNaN(d.getTime())) return;
    const fecha = Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
    out.push({
      t: d.getTime(),
      fecha: fecha,
      semana: semanaDeFecha_(fecha),
      turno: String(r[3] || 'Mañana'),
      profesional: String(r[4] || 'Sin nombre'),
      vacuna: String(r[5] || ''),
      cambio: Number(r[6]) || 0,
      grupo: String(r[8] == null ? '' : r[8]).trim(),
      // Filas anteriores a la v1.4: cada dosis cuenta como un paciente.
      paciente: r[9] === '' || r[9] == null ? (Number(r[6]) || 0) : (Number(r[9]) || 0),
      pauta: String(r[10] == null || r[10] === '' ? (r[5] || '') : r[10]).trim(),
      fila: String(r[11] == null ? '' : r[11]).trim()
    });
  });
  return out;
}

/** Semana ISO de una fecha yyyy-MM-dd, p. ej. «2026-S45». */
function semanaDeFecha_(f) {
  const a = f.split('-').map(Number);
  const t = new Date(Date.UTC(a[0], a[1] - 1, a[2]));
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7) + 3);
  const y = t.getUTCFullYear();
  const j4 = new Date(Date.UTC(y, 0, 4));
  const w = 1 + Math.round(((t - j4) / 86400000 - 3 + ((j4.getUTCDay() + 6) % 7)) / 7);
  return y + '-S' + (w < 10 ? '0' : '') + w;
}

function lunesDe_(f) {
  const a = f.split('-').map(Number);
  const t = new Date(Date.UTC(a[0], a[1] - 1, a[2]));
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
  return t.toISOString().slice(0, 10);
}
