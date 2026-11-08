/**
 * Arnés de pruebas: carga apps-script/Code.gs en Node con una hoja de cálculo simulada
 * y simulaciones mínimas de los servicios de Google (SpreadsheetApp, Utilities, Cache,
 * Properties, MailApp, ScriptApp, UrlFetchApp para Telegram…).
 *
 *   const E = crearEntorno({ ahora: Date.UTC(2026, 10, 7, 10) });
 *   E.G.registrar([...]);   // cualquier función de Code.gs
 *   E.sheets['Registro'].d  // filas de la hoja simulada
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

/** Hoja simulada: d = filas (incluida la cabecera). */
function Sheet(name, rows, maxCols) {
  this.name = name; this.d = (rows || []).map(r => r.slice()); this.maxCols = maxCols || 26; this.maxRows = 1000;
}
Sheet.prototype = {
  getLastRow() { let n = this.d.length; while (n && this.d[n - 1].every(v => v === '' || v == null)) n--; return n; },
  getMaxRows() { return Math.max(this.maxRows, this.d.length); },
  getMaxColumns() { return this.maxCols; },
  insertColumnsAfter(c, n) { this.maxCols += n; },
  clearContents() { this.d = []; },
  setFrozenRows() {}, setColumnWidth() {},
  appendRow(r) { this.d.splice(this.getLastRow(), 0, r.slice()); },
  getRange(r, c, nr, nc) {
    const sh = this; nr = nr || 1; nc = nc || 1;
    if (c + nc - 1 > sh.maxCols) throw new Error('Rango fuera de columnas en ' + sh.name);
    const rng = {
      getValues() {
        const out = [];
        for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) { const v = (sh.d[r - 1 + i] || [])[c - 1 + j]; row.push(v == null ? '' : v); } out.push(row); }
        return out;
      },
      setValues(v) {
        assert.strictEqual(v.length, nr); v.forEach(x => assert.strictEqual(x.length, nc));
        for (let i = 0; i < nr; i++) {
          const k = r - 1 + i; while (sh.d.length <= k) sh.d.push([]);
          for (let j = 0; j < nc; j++) {
            let val = v[i][j];
            // Como Sheets: un texto que empieza por = sin apóstrofo sería una fórmula.
            if (typeof val === 'string' && val[0] === '=') sh.formulas = (sh.formulas || 0) + 1;
            if (typeof val === 'string' && val[0] === "'") val = val.slice(1);
            sh.d[k][c - 1 + j] = val;
          }
        }
        return rng;
      },
      setValue(x) { return rng.setValues([[x]]); },
      setFontWeight() { return rng; }, setNumberFormat() { return rng; }
    };
    return rng;
  }
};

/** Fecha en hora de Madrid (invierno, UTC+1): madrid('2026-11-06', '20:00'). */
const madrid = (f, h) => new Date(f + 'T' + (h || '10:00') + ':00+01:00');

/** Días laborables (lunes a viernes) entre dos fechas yyyy-mm-dd, ambas incluidas. */
function laborablesEntre(a, b) {
  const out = [];
  for (let t = new Date(a + 'T12:00:00Z'); t <= new Date(b + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + 1)) {
    const w = t.getUTCDay(); if (w >= 1 && w <= 5) out.push(t.toISOString().slice(0, 10));
  }
  return out;
}

function fmt(d, tz, f) {
  const p = {};
  new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    .formatToParts(d).forEach(x => { p[x.type] = x.value; });
  return f.replace('yyyy', p.year).replace('MM', p.month).replace('dd', p.day).replace('HH', p.hour).replace('mm', p.minute).replace('ss', p.second);
}

function crearEntorno(op) {
  op = op || {};
  const src = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');
  const E = { sheets: {}, Sheet, madrid, laborablesEntre, fmt, assert, correos: [], activadores: [], props: {}, llamadas: [], updates: [], cache: {} };
  const ss = {
    getSheetByName: n => E.sheets[n] || null,
    insertSheet: n => (E.sheets[n] = new Sheet(n, [])),
    getUrl: () => 'https://docs.google.com/spreadsheets/d/x'
  };
  const respuesta = (ok, result, d) => ({ getContentText: () => JSON.stringify(ok ? { ok, result } : { ok, description: d }), getResponseCode: () => (ok ? 200 : 401) });
  const ctx = {
    console,
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    Utilities: {
      formatDate: fmt,
      parseDate: (s) => { // aproximación: hora de Madrid en invierno (UTC+1)
        const m = s.match(/(\d+)-(\d+)-(\d+) (\d+):(\d+):(\d+)/);
        return new Date(Date.UTC(+m[1], m[2] - 1, +m[3], m[4] - 1, +m[5], +m[6]));
      }
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, tryLock() { return true; }, releaseLock() {} }) },
    CacheService: { getScriptCache: () => ({
      get: k => (k in E.cache ? E.cache[k] : null),
      put: (k, v) => { E.cache[k] = String(v); },
      remove: k => { delete E.cache[k]; },
      getAll: ks => { const o = {}; ks.forEach(k => { if (k in E.cache) o[k] = E.cache[k]; }); return o; },
      putAll: o => { Object.keys(o).forEach(k => { E.cache[k] = String(o[k]); }); }
    }) },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: k => (k in E.props ? E.props[k] : null),
      setProperty: (k, v) => { E.props[k] = String(v); },
      deleteProperty: k => { delete E.props[k]; }
    }) },
    MailApp: { sendEmail: o => E.correos.push(o) },
    ScriptApp: {
      getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/X/exec' }),
      getProjectTriggers: () => E.activadores.slice(),
      deleteTrigger: t => E.activadores.splice(E.activadores.indexOf(t), 1),
      WeekDay: { MONDAY: 'MONDAY' },
      newTrigger: f => {
        const b = { timeBased: () => b, onWeekDay: () => b, everyDays: () => b, atHour: h => { b.h = h; return b; }, inTimezone: () => b,
          create: () => { const t = { getHandlerFunction: () => f, h: b.h }; E.activadores.push(t); return t; } };
        return b;
      }
    },
    UrlFetchApp: { fetch: (url, o) => {
      const metodo = url.split('/').pop();
      E.llamadas.push({ metodo, body: JSON.parse(o.payload), url });
      if (url.indexOf('/bot999') >= 0) return respuesta(false, null, 'Unauthorized');
      if (metodo === 'getMe') return respuesta(true, { id: 1, username: 'vacunas_bot' });
      if (metodo === 'getUpdates') return respuesta(true, E.updates);
      if (metodo === 'sendMessage') return respuesta(true, { message_id: 1 });
      return respuesta(false, null, 'Not Found');
    } },
    HtmlService: { createHtmlOutputFromFile: f => { const o = { f, setTitle(t) { o.t = t; return o; }, addMetaTag() { return o; } }; return o; } },
    ContentService: { createTextOutput: s => ({ setMimeType() { return s; } }), MimeType: { JSON: 1 } }
  };
  // Reloj fijo opcional: new Date() y Date.now() devuelven op.ahora.
  const fijar = op.ahora == null ? '' :
    'Date = (function (D) { function F(...a) { return a.length ? new D(...a) : new D(' + op.ahora + '); }' +
    ' F.prototype = D.prototype; F.UTC = D.UTC; F.parse = D.parse; F.now = () => ' + op.ahora + '; return F; })(Date);\n';
  vm.createContext(ctx);
  vm.runInContext(fijar + src, ctx, { filename: 'Code.gs' });
  E.ctx = ctx;
  E.G = ctx; // las funciones de nivel superior de Code.gs quedan como globales del contexto
  return E;
}

module.exports = { crearEntorno, Sheet, madrid, laborablesEntre, fmt };
