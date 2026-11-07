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

const PIN_FABRICA = '1234';
const P = {
  centro: 'Nombre del centro',
  enf: 'Enfermeras/os que vacunan',
  huecos: 'Huecos de vacunación por enfermera/o y día',
  dias: 'Días de vacunación por semana',
  pin: 'PIN del panel',
  porProf: 'Mostrar datos por profesional (Sí/No)'
};
const PARAMS_DEF = [[P.centro, ''], [P.enf, '6'], [P.huecos, '12'], [P.dias, '5'], [P.pin, PIN_FABRICA], [P.porProf, 'Sí']];
const VAC_DEF = [['Gripe', 0, 'Sí', 0], ['COVID-19', 0, 'Sí', 0]];

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
  const params = filasParams_({
    centro: centro, enfermeras: c.enfermeras, huecos: c.huecos, dias: c.dias, pin: nuevoPin, porProfesional: c.porProfesional
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
  const params = filasParams_({
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

function filasParams_(o) {
  return [
    [P.centro, o.centro || ''],
    [P.enf, String(o.enfermeras || 0)],
    [P.huecos, String(o.huecos || 0)],
    [P.dias, String(o.dias || 5)],
    [P.pin, o.pin],
    [P.porProf, o.porProfesional ? 'Sí' : 'No']
  ];
}

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

    const hc = ss.getSheetByName(H_CFG);
    const tiene = {};
    filas_(hc, 1).forEach(function (r) { tiene[String(r[0]).trim()] = true; });
    PARAMS_DEF.forEach(function (p) { if (!tiene[p[0]]) hc.appendRow(p); });
  } finally {
    lock.releaseLock();
  }
}

function reescribir_(h, cab, filas, texto) {
  if (h.getMaxColumns() < cab.length) h.insertColumnsAfter(h.getMaxColumns(), cab.length - h.getMaxColumns());
  h.clearContents();
  if (texto) h.getRange(1, 2, h.getMaxRows(), 1).setNumberFormat('@');
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
