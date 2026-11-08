// Seguridad y robustez (v1.2): bloqueo del PIN, fórmulas, Id, duplicados, fechas y lectura parcial del registro.
'use strict';
const assert = require('assert');
const { crearEntorno, Sheet } = require('./arnes');

const AHORA = Date.UTC(2026, 10, 9, 10, 0, 0); // lunes 9/11/2026, 11:00 en Madrid
const E = crearEntorno({ ahora: AHORA });
const G = E.G, sheets = E.sheets;
const DIA = 86400000;

G.doGet({ parameter: { p: 'panel' } });
G.completarAsistente('1234', { centro: 'CS Ejemplo', pin: 'clave123', vacunas: ['Gripe', 'COVID-19'], profesionales: ['Ana'] });

// ---- PIN: bloqueo tras 5 fallos ----
for (let i = 1; i <= 4; i++) assert.throws(() => G.comprobarPin('000000'), /^Error: PIN incorrecto$/);
assert.throws(() => G.comprobarPin('000000'), /bloqueado 15 minutos/);
assert.throws(() => G.comprobarPin('clave123'), /PIN bloqueado/, 'bloqueado también con el PIN bueno');
assert.throws(() => G.resumen('clave123'), /PIN bloqueado/);
delete E.cache.pin_bloqueo; // pasan los 15 minutos
assert.strictEqual(G.comprobarPin('clave123').ok, true);
// Un acierto pone a cero los fallos
for (let i = 1; i <= 4; i++) assert.throws(() => G.comprobarPin('x'), /PIN incorrecto/);
G.comprobarPin('clave123');
assert.throws(() => G.comprobarPin('x'), /^Error: PIN incorrecto$/, 'el contador volvió a cero');
G.comprobarPin('clave123');

// ---- PIN nuevo: al menos 6 caracteres ----
const cfg = { centro: 'CS Ejemplo', enfermeras: 6, huecos: 12, dias: 5, porProfesional: false, profesionales: ['Ana'],
  vacunas: [{ nombre: 'Gripe', necesarias: 0, minimo: 0, activa: true }, { nombre: 'COVID-19', necesarias: 0, minimo: 0, activa: true }] };
assert.throws(() => G.guardarConfig('clave123', Object.assign({}, cfg, { pin: '1234' })), /entre 6 y 20/);
assert.strictEqual(G.resumen('clave123').config.pinCorto, false);

// ---- Fórmulas: nada de lo que escribe un usuario se guarda como fórmula ----
G.guardarConfig('clave123', Object.assign({}, cfg, {
  profesionales: ['Ana', '=IMPORTXML("http://malo.example";"//a")'],
  vacunas: cfg.vacunas.concat([{ nombre: '+SUM(1)', necesarias: 0, minimo: 0, activa: true }])
}));
const nombreRaro = '=HYPERLINK("http://malo.example";"Pincha")';
let r = G.registrar([{ id: 'f1', momento: AHORA, profesional: nombreRaro, turno: 'Mañana', vacuna: 'Gripe', cambio: 1 }]);
assert.deepStrictEqual(Array.from(r.guardados), ['f1']);
assert.ok(!sheets['Registro'].formulas, 'el Registro no recibe fórmulas');
assert.ok(!sheets['Profesionales'].formulas && !sheets['Vacunas'].formulas, 'la configuración no recibe fórmulas');
assert.strictEqual(G.misHoy(nombreRaro).mias['Gripe'], 1, 'el nombre se lee igual que se escribió');
// Id con caracteres raros: rechazado
r = G.registrar([{ id: '=1+1', momento: AHORA, profesional: 'Ana', turno: 'Mañana', vacuna: 'Gripe', cambio: 1 }]);
assert.deepStrictEqual(Array.from(r.rechazados), ['=1+1']);

// ---- Duplicados: aunque la caché se haya vaciado ----
G.registrar([{ id: 'd1', momento: AHORA, profesional: 'Ana', turno: 'Mañana', vacuna: 'Gripe', cambio: 1 }]);
for (const k of Object.keys(E.cache)) delete E.cache[k];
const filasAntes = sheets['Registro'].getLastRow();
r = G.registrar([{ id: 'd1', momento: AHORA, profesional: 'Ana', turno: 'Mañana', vacuna: 'Gripe', cambio: 1 },
                 { id: 'd2', momento: AHORA, profesional: 'Ana', turno: 'Mañana', vacuna: 'Gripe', cambio: 1 },
                 { id: 'd2', momento: AHORA, profesional: 'Ana', turno: 'Mañana', vacuna: 'Gripe', cambio: 1 }]);
assert.deepStrictEqual(Array.from(r.guardados), ['d1', 'd2', 'd2']);
assert.strictEqual(sheets['Registro'].getLastRow(), filasAntes + 1, 'solo se añade d2, una vez');

// ---- Fechas: se respeta la fecha real del toque ----
const hace20 = AHORA - 20 * DIA;
r = G.registrar([{ id: 't20', momento: hace20, profesional: 'Ana', turno: 'Mañana', vacuna: 'COVID-19', cambio: 1 },
                 { id: 't200', momento: AHORA - 200 * DIA, profesional: 'Ana', turno: 'Mañana', vacuna: 'COVID-19', cambio: 1 },
                 { id: 'tfut', momento: AHORA + 3 * 3600000, profesional: 'Ana', turno: 'Mañana', vacuna: 'COVID-19', cambio: 1 }]);
assert.deepStrictEqual(Array.from(r.rechazados), ['t200']);
const fila = id => sheets['Registro'].d.find(x => x[7] === id);
assert.strictEqual(fila('t20')[1], '2026-10-20');
assert.strictEqual(fila('tfut')[0].getTime(), AHORA, 'del futuro → ahora');

// ---- El contador lee solo el final del registro y no se pierde nada ----
const ayer = new Date(AHORA - DIA);
const viejas = [];
for (let i = 0; i < 4500; i++) viejas.push([ayer, '', '', 'Mañana', 'Ana', 'Gripe', 1, 'v' + i]);
const reg = sheets['Registro'];
const hoyFilas = reg.d.slice(1);
reg.d = [reg.d[0]].concat(viejas, hoyFilas);
reg.appendRow([new Date(AHORA - 5 * DIA), '', '', 'Mañana', 'Ana', 'Gripe', 1, 'tarde']); // llega tarde de un móvil sin conexión
reg.appendRow([new Date(AHORA), '', '', 'Mañana', 'Ana', 'COVID-19', 1, 'h-ultima']);
let leidas = 0;
const original = reg.getRange.bind(reg);
reg.getRange = (r0, c0, nr, nc) => { if (c0 === 1 && nc === 7) leidas += nr; return original(r0, c0, nr, nc); };
const h = G.misHoy('Ana');
reg.getRange = original;
assert.ok(leidas < 4000, 'no lee todo el registro: ' + leidas + ' filas');
// Hoy: d1, d2 (Gripe) + tfut, h-ultima (COVID-19); el de 20 días y el que llegó tarde no cuentan
assert.strictEqual(h.mias['Gripe'], 2);
assert.strictEqual(h.mias['COVID-19'], 2);
// Mismo resultado que leyendo todo el registro
const todo = {};
G.leerRegistro_().forEach(x => { if (x.fecha === '2026-11-09' && x.profesional === 'Ana') todo[x.vacuna] = (todo[x.vacuna] || 0) + x.cambio; });
assert.deepStrictEqual(JSON.parse(JSON.stringify(h.mias)), todo);

// ---- Zona horaria: la mandan las respuestas del servidor ----
assert.strictEqual(G.datosContador().tz, 'Europe/Madrid');
assert.strictEqual(G.resumen('clave123').config.tz, 'Europe/Madrid');

console.log('OK seguridad: PIN, fórmulas, Id, duplicados, fechas y lectura parcial');
