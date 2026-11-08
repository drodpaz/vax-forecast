/**
 * CONTADOR DE VACUNAS
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
 */

// Zona horaria del centro. En Canarias: 'Atlantic/Canary' (cámbiala también en Contador, Panel y el contador flotante).
const TZ = 'Europe/Madrid';
const H_REG = 'Registro';
const H_CFG = 'Configuración';
const H_VAC = 'Vacunas';
const H_PRO = 'Profesionales';
const H_STK = 'Stock';

const CAB_REG = ['Momento', 'Fecha', 'Semana', 'Turno', 'Profesional', 'Vacuna', 'Cambio', 'Id'];
const CAB_CFG = ['Parámetro', 'Valor'];
const CAB_VAC = ['Vacuna', 'Dosis necesarias por semana', 'Activa (Sí/No)', 'Stock mínimo'];
const CAB_PRO = ['Nombre', 'Activo (Sí/No)'];
const CAB_STK = ['Momento', 'Fecha', 'Vacuna', 'Tipo', 'Cantidad', 'Nota'];
const TIPOS_STK = ['Entrada', 'Merma', 'Recuento'];
const H_GRU = 'Grupos';
const H_COB = 'Coberturas';
const H_REP = 'Repartos';
const CAB_GRU = ['Grupo', 'Vacunas (separadas por comas)', 'Desde', 'Población', 'Objetivo %', 'Activo (Sí/No)'];
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
  avisoHora: 'Hora del aviso de pedido'
};
const PARAMS_DEF = [[P.centro, ''], [P.enf, '6'], [P.huecos, '12'], [P.dias, '5'], [P.pin, PIN_FABRICA], [P.porProf, 'Sí'],
  [P.inicio, ''], [P.fin, ''], [P.correo, ''], [P.avisoCorreo, 'No'], [P.avisoHora, '9']];
// El token del bot de Telegram y el chat se guardan en las propiedades del script, no en la hoja.
const PROP_TG_TOKEN = 'TELEGRAM_TOKEN';
const PROP_TG_CHAT = 'TELEGRAM_CHAT';
const PROP_TG_NOMBRE = 'TELEGRAM_CHAT_NOMBRE';
const PROP_AVISO_HECHO = 'AVISO_PEDIDO_ENVIADO';
const VAC_DEF = [['Gripe', 0, 'Sí', 0], ['COVID-19', 0, 'Sí', 0]];

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
      ['70 años o más', 'Efluelda', '2026-10-19', 75],
      ['Embarazadas y puerperio', 'Vaxigrip', '2026-11-02', 60],
      ['Riesgo y otros 12–59 años', 'Vaxigrip', '2026-11-02', 0],
      ['65–69 años', 'Efluelda', '2026-11-09', 75],
      ['60–64 años', 'Vaxigrip', '2026-11-09', 75]
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
    if (accion === 'datos') out = datosContador();
    else if (accion === 'hoy') out = misHoy(d.profesional);
    else if (accion === 'registrar') out = registrar(d.lista);
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

/** Datos que necesita la pantalla del contador. */
function datosContador() {
  const c = leerConfig_();
  return {
    centro: c.centro,
    vacunas: c.vacunas.filter(function (v) { return v.activa; }).map(function (v) { return v.nombre; }),
    profesionales: c.profesionales,
    hoy: hoy_(),
    url: urlApp_()
  };
}

/**
 * Guarda una lista de toques. Cada toque: {id, momento, profesional, turno, vacuna, cambio}.
 * Devuelve los id guardados (también los repetidos, para que el móvil los borre de su cola).
 */
function registrar(lista) {
  if (!Array.isArray(lista) || !lista.length) return { ok: true, guardados: [], rechazados: [] };
  lista = lista.slice(0, 500);
  const c = leerConfig_();
  const vacs = {};
  c.vacunas.forEach(function (v) { vacs[v.nombre] = true; });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const cache = CacheService.getScriptCache();
    const claves = lista.map(function (e) { return 'ev_' + String((e && e.id) || '').slice(0, 40); });
    const vistos = cache.getAll(claves) || {};
    const ahora = Date.now();
    const filas = [];
    const guardados = [];
    const rechazados = [];
    const nuevos = {};

    lista.forEach(function (e, i) {
      const id = String((e && e.id) || '').slice(0, 40);
      if (!id) return;
      const clave = claves[i];
      if (vistos[clave] || nuevos[clave]) { guardados.push(id); return; }

      const vac = String(e.vacuna || '').trim();
      const cambio = Number(e.cambio);
      if (!vacs[vac] || (cambio !== 1 && cambio !== -1)) { rechazados.push(id); return; }

      let t = Number(e.momento);
      if (!isFinite(t) || t > ahora + 5 * 60000 || t < ahora - 14 * 86400000) t = ahora;
      const d = new Date(t);
      const prof = String(e.profesional || '').trim().slice(0, 60) || 'Sin nombre';
      const turno = e.turno === 'Tarde' ? 'Tarde' : 'Mañana';
      const fecha = Utilities.formatDate(d, TZ, 'yyyy-MM-dd');

      filas.push([d, fecha, semanaDeFecha_(fecha), turno, prof, vac, cambio, id]);
      guardados.push(id);
      nuevos[clave] = '1';
    });

    if (filas.length) {
      const h = libro_().getSheetByName(H_REG);
      h.getRange(h.getLastRow() + 1, 1, filas.length, CAB_REG.length).setValues(filas);
      cache.putAll(nuevos, 21600);
    }
    return { ok: true, guardados: guardados, rechazados: rechazados };
  } finally {
    lock.releaseLock();
  }
}

/** Dosis de hoy: las de un profesional y las de todo el centro. */
function misHoy(profesional) {
  const hoy = hoy_();
  const prof = String(profesional || '').trim();
  const mias = {};
  const centro = {};
  let ultima = 0;
  leerRegistro_().forEach(function (r) {
    if (r.fecha !== hoy) return;
    centro[r.vacuna] = (centro[r.vacuna] || 0) + r.cambio;
    if (r.profesional === prof) {
      mias[r.vacuna] = (mias[r.vacuna] || 0) + r.cambio;
      if (r.cambio > 0 && r.t > ultima) ultima = r.t;
    }
  });
  return { hoy: hoy, mias: mias, centro: centro, ultima: ultima };
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
  if (!esPinFabrica_(c)) return { ok: true, primerUso: false, centro: c.centro };
  return {
    ok: true,
    primerUso: true,
    centro: c.centro,
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
  if (!/^\S{4,20}$/.test(nuevoPin)) throw new Error('El PIN nuevo tiene que tener entre 4 y 20 caracteres, sin espacios.');
  if (nuevoPin === PIN_FABRICA) throw new Error('El PIN nuevo no puede ser ' + PIN_FABRICA + '.');

  // Se conservan las cifras de las vacunas que ya existían con el mismo nombre.
  const previas = {};
  c.vacunas.forEach(function (v) { previas[v.nombre.toLowerCase()] = v; });
  const vistasV = {};
  const vac = (d.vacunas || [])
    .map(function (s) { return String(s || '').trim().slice(0, 40); })
    .filter(function (s) { if (!s || vistasV[s.toLowerCase()]) return false; vistasV[s.toLowerCase()] = true; return true; })
    .slice(0, 30)
    .map(function (n) {
      const p = previas[n.toLowerCase()];
      return [n, p ? p.necesarias : 0, 'Sí', p ? p.minimo : 0];
    });
  if (!vac.length) throw new Error('Escribe al menos una vacuna.');

  const pro = listaProfesionales_(d.profesionales);
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

  reg.forEach(function (r) {
    const s = porSem[r.semana] || (porSem[r.semana] = { total: 0, v: {}, desde: r.fecha });
    s.total += r.cambio;
    s.v[r.vacuna] = (s.v[r.vacuna] || 0) + r.cambio;
    if (r.fecha < s.desde) s.desde = r.fecha;

    if (r.fecha < desde || r.fecha > hasta) return;

    const d = porDia[r.fecha] || (porDia[r.fecha] = { total: 0, v: {}, prof: {} });
    d.total += r.cambio;
    d.v[r.vacuna] = (d.v[r.vacuna] || 0) + r.cambio;
    d.prof[r.profesional] = true;

    porVac[r.vacuna] = (porVac[r.vacuna] || 0) + r.cambio;
    porTurno[r.turno] = (porTurno[r.turno] || 0) + r.cambio;

    if (c.porProfesional) {
      const p = porProf[r.profesional] || (porProf[r.profesional] = { total: 0, v: {}, dias: {} });
      p.total += r.cambio;
      p.v[r.vacuna] = (p.v[r.vacuna] || 0) + r.cambio;
      p.dias[r.fecha] = true;
    }
  });

  return {
    config: {
      centro: c.centro, enfermeras: c.enfermeras, huecos: c.huecos, dias: c.dias,
      porProfesional: c.porProfesional, vacunas: c.vacunas, profesionales: c.profesionales
    },
    desde: desde,
    hasta: hasta,
    hoy: hoy,
    primerRegistro: primero,
    porDia: Object.keys(porDia).sort().map(function (f) {
      const d = porDia[f];
      return { fecha: f, total: d.total, v: d.v, profesionales: Object.keys(d.prof).length };
    }),
    porVacuna: porVac,
    porTurno: porTurno,
    porProfesional: c.porProfesional
      ? Object.keys(porProf).map(function (n) {
          const p = porProf[n];
          return { nombre: n, total: p.total, v: p.v, dias: Object.keys(p.dias).length };
        }).sort(function (a, b) { return b.total - a.total; })
      : null,
    porSemana: Object.keys(porSem).sort().map(function (k) {
      return { semana: k, desde: lunesDe_(porSem[k].desde), total: porSem[k].total, v: porSem[k].v };
    }),
    urlContador: urlApp_(),
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
      return [String(v.nombre).trim().slice(0, 40), num_(v.necesarias), v.activa === false ? 'No' : 'Sí', Math.round(num_(v.minimo))];
    });
  if (!vac.length) throw new Error('Tiene que haber al menos una vacuna.');

  const pro = listaProfesionales_(cfg.profesionales);
  const nuevoPin = String(cfg.pin || '').trim() || c.pin;
  const params = filasParams_(c, {
    centro: cfg.centro == null ? c.centro : limpiarTexto_(cfg.centro, 80),
    enfermeras: num_(cfg.enfermeras),
    huecos: num_(cfg.huecos),
    dias: Math.min(7, num_(cfg.dias) || 5),
    pin: nuevoPin,
    porProfesional: !!cfg.porProfesional
  });

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
  return { ok: true, pinCambiado: nuevoPin !== c.pin };
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
    return [nombre, lista.join(', '), fechaTxt_(g.desde), Math.round(num_(g.poblacion)), pct_(g.objetivo), g.activo === false ? 'No' : 'Sí'];
  }).filter(Boolean);

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = libro_();
    reescribir_(ss.getSheetByName(H_CFG), CAB_CFG, filasParams_(c, { inicio: inicio, fin: fin, correo: correo }), true);
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
    return [g[0], g[1], g[2], p ? p.poblacion : 0, g[3], 'Sí'];
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
        .setValues(nuevas.map(function (n) { return [n, 0, 'Sí', 0]; }));
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
        activo: !esNo_(r[5])
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
 *   Cada dosis cuenta para los grupos que usan esa vacuna y ya han empezado;
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
  const recientes = {};
  reg.forEach(function (r) {
    if ((inicio && r.fecha < inicio) || (fin && r.fecha > fin)) return;
    const v = k(r.vacuna);
    if (r.fecha >= desde14) recientes[v] = (recientes[v] || 0) + r.cambio;
    const el = elegibles(v, r.fecha);
    if (!el.length) return;
    const tot = el.reduce(function (s, g) { return s + g.peso; }, 0);
    el.forEach(function (g) {
      const parte = tot > 0 ? g.peso / tot : 1 / el.length;
      if (!g.oficial || r.t > g.oficial.t) g.est += r.cambio * parte;
      if (r.fecha >= desde14) {
        g.reciente += r.cambio * parte;
        g.recienteV[v] = (g.recienteV[v] || 0) + r.cambio * parte;
      }
    });
  });

  const outG = grupos.map(function (g) {
    const empezado = !g.desde || g.desde <= hoy;
    const dias = empezado ? (laborables_(maxF_(desde14, g.desde || desde14), hoy) || 1) : 0;
    const ritmo = empezado ? Math.max(0, g.reciente) / dias : 0;
    const vacunados = Math.max(0, Math.round(g.est));
    const faltan = g.meta != null ? Math.max(0, g.meta - vacunados) : null;
    const labRest = fin ? laborables_(maxF_(hoy, g.desde || hoy), fin) : 0;
    let llega = null;
    if (faltan === 0) llega = 'ok';
    else if (faltan != null && ritmo > 0 && faltan / ritmo <= 300) llega = sumarLaborables_(hoy, Math.ceil(faltan / ritmo));
    g.empezado = empezado;
    g.dias = dias;
    g.llega = llega;
    g.faltan = faltan;
    let estado = 'sinObjetivo';
    if (!empezado) estado = 'pendiente';
    else if (faltan === 0) estado = 'ok';
    else if (faltan != null) estado = fin && (llega == null || llega > fin) ? 'riesgo' : 'enCamino';
    return {
      nombre: g.nombre, vacunas: g.vacunas, desde: g.desde, poblacion: g.poblacion, objetivo: g.objetivo,
      meta: g.meta, vacunados: vacunados,
      cobertura: g.poblacion > 0 ? r1(vacunados / g.poblacion * 100) : null,
      faltan: faltan, ritmoDia: r1(ritmo),
      necesarioDia: faltan != null && labRest > 0 ? r1(faltan / labRest) : null,
      llega: llega, estado: estado,
      oficial: g.oficial ? { fecha: g.oficial.fecha, n: g.oficial.n } : null
    };
  });

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
      if (g.empezado) {
        if (g.llega === 'ok' || (g.llega && f > g.llega)) return;
        d += Math.max(0, g.recienteV[v] || 0) / g.dias;
      } else if (g.meta && g.labTotal > 0 && g.desde <= f) {
        d += g.meta / g.labTotal / g.vk.length;
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
    vacunas: outV,
    reparto: generales[0] ? { fecha: generales[0].fecha, limite: generales[0].limite, hora: generales[0].hora, siguiente: generales[1] ? generales[1].fecha : null } : null,
    repartos: reps.map(function (r) { return { desde: r.desde, hasta: r.hasta, dias: r.diasTxt, antelacion: r.antelacion, hora: r.hora, vacunas: r.vacunasTxt }; }),
    gruposConfig: todos,
    vacunasConfig: c.vacunas.map(function (v) { return v.nombre; }),
    plantillas: Object.keys(PLANTILLAS).map(function (id) { return { id: id, nombre: PLANTILLAS[id].nombre }; }),
    correo: c.correo,
    resumenActivo: resumenActivo_(),
    avisos: estadoAvisos_(c)
  };
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
    html += '<h3>Cobertura por grupo</h3>' + tabla(['Grupo', 'Cobertura', 'Objetivo', 'Faltan', 'Llega al objetivo'],
      p.grupos.map(function (g) {
        const llega = g.estado === 'pendiente' ? 'empieza el ' + fechaCorta_(g.desde) : g.llega === 'ok' ? '✓ alcanzado' :
          g.llega ? fechaCorta_(g.llega) + (p.campana.fin && g.llega > p.campana.fin ? ' ⚠' : '') : (g.faltan ? '⚠ al ritmo actual, no' : '—');
        return [escH_(g.nombre), g.cobertura == null ? '—' : nf(g.cobertura) + ' %', g.objetivo ? nf(g.objetivo) + ' %' : '—', nf(g.faltan), llega];
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

function listaProfesionales_(lista) {
  const vistos = {};
  return (lista || [])
    .map(function (s) { return String(s || '').trim().slice(0, 60); })
    .filter(function (s) { if (!s || vistos[s.toLowerCase()]) return false; vistos[s.toLowerCase()] = true; return true; })
    .slice(0, 200)
    .map(function (n) { return [n, 'Sí']; });
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
    [P.avisoHora, String(o.avisoHora == null ? 9 : o.avisoHora)]
  ];
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

function comprobarPin_(c, pin) {
  if (c.pin && String(pin == null ? '' : pin).trim() !== c.pin) throw new Error('PIN incorrecto');
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
      return { nombre: String(r[0]).trim(), necesarias: num_(r[1]), activa: !esNo(r[2]), minimo: Math.round(num_(r[3])) };
    });
  const profesionales = filas_(ss.getSheetByName(H_PRO), 2)
    .filter(function (r) { return String(r[0]).trim() && !esNo(r[1]); })
    .map(function (r) { return String(r[0]).trim(); });
  return {
    centro: String(p[P.centro] == null ? '' : p[P.centro]).trim(),
    enfermeras: num_(p[P.enf]),
    huecos: num_(p[P.huecos]),
    dias: Math.min(7, num_(p[P.dias]) || 5),
    pin: String(p[P.pin] == null ? '' : p[P.pin]).trim(),
    porProfesional: !esNo(p[P.porProf] == null ? 'Sí' : p[P.porProf]),
    inicio: fechaTxt_(p[P.inicio]),
    fin: fechaTxt_(p[P.fin]),
    correo: String(p[P.correo] == null ? '' : p[P.correo]).trim(),
    avisoCorreo: !esNo(p[P.avisoCorreo] == null ? 'No' : p[P.avisoCorreo]),
    avisoHora: horaAviso_(p[P.avisoHora]),
    vacunas: vacunas,
    profesionales: profesionales
  };
}

/** Lee el registro. La fecha sale siempre del «Momento» en la zona horaria del centro. */
function leerRegistro_() {
  const h = libro_().getSheetByName(H_REG);
  const n = h.getLastRow() - 1;
  if (n <= 0) return [];
  const out = [];
  h.getRange(2, 1, n, 7).getValues().forEach(function (r) {
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
      cambio: Number(r[6]) || 0
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
