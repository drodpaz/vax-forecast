// Contador, migración de una hoja v1.0, stock, configuración y asistente de primer uso.
'use strict';
const assert = require('assert');
const { crearEntorno, Sheet, fmt } = require('./arnes');

const E = crearEntorno();
const G = E.G, sheets = E.sheets;
const DIA = 86400000, ahora = Date.now();
const d = n => new Date(ahora - n * DIA);

// ---- Hoja creada con la versión 1.0 ----
sheets['Registro'] = new Sheet('Registro', [
  ['Momento', 'Fecha', 'Semana', 'Turno', 'Profesional', 'Vacuna', 'Cambio', 'Id'],
  [d(20), '', '', 'Mañana', 'Ana', 'Gripe', 1, 'a1'],
  [d(10), '', '', 'Mañana', 'Ana', 'Gripe', 1, 'a2'],
  [d(5), '', '', 'Mañana', 'Ana', 'Gripe', 1, 'a3'],
  [d(5), '', '', 'Mañana', 'Ana', 'Gripe', 1, 'a4'],
  [d(4), '', '', 'Tarde', 'Luis', 'Gripe', -1, 'a5'],
  [d(1), '', '', 'Mañana', 'Luis', 'COVID-19', 1, 'a6']
]);
sheets['Configuración'] = new Sheet('Configuración', [
  ['Parámetro', 'Valor'], ['Enfermeras/os que vacunan', '6'], ['Huecos de vacunación por enfermera/o y día', '12'],
  ['Días de vacunación por semana', '5'], ['PIN del panel', 4321], ['Mostrar datos por profesional (Sí/No)', 'Sí']
]);
sheets['Vacunas'] = new Sheet('Vacunas', [['Vacuna', 'Dosis necesarias por semana', 'Activa (Sí/No)'], ['Gripe', 100, 'Sí'], ['COVID-19', 50, 'Sí'], ['Vieja', 0, 'No']], 3);
sheets['Profesionales'] = new Sheet('Profesionales', [['Nombre', 'Activo (Sí/No)'], ['Ana', 'Sí'], ['Luis', 'Sí']]);
const nReg = sheets['Registro'].getLastRow();

// 1. El contador y el widget funcionan ANTES de abrir la página (sin migrar, Vacunas con 3 columnas)
const r = JSON.parse(G.api_('datos', {}));
assert.deepStrictEqual(r.vacunas, ['Gripe', 'COVID-19']);
assert.ok(sheets['Stock'], 'Stock creada sola');

// 2. Abrir la página migra sin perder datos
const out = G.doGet({ parameter: { p: 'panel' } });
assert.strictEqual(out.t, 'Panel de vacunación');
assert.strictEqual(sheets['Vacunas'].d[0][3], 'Stock mínimo');
assert.strictEqual(sheets['Vacunas'].d[1][1], 100);
assert.ok(sheets['Configuración'].d.some(x => x[0] === 'Nombre del centro'));
assert.strictEqual(sheets['Configuración'].d.filter(x => x[0] === 'PIN del panel').length, 1, 'no duplica el PIN');
assert.strictEqual(sheets['Configuración'].d.find(x => x[0] === 'Mostrar datos por profesional (Sí/No)')[1], 'Sí', 'respeta lo que ya había');
assert.strictEqual(sheets['Registro'].getLastRow(), nReg);
G.doGet({ parameter: {} }); // dos veces: no duplica
assert.strictEqual(sheets['Configuración'].d.filter(x => x[0] === 'Nombre del centro').length, 1);

// 3. El PIN antiguo sigue valiendo y no salta el asistente
assert.throws(() => G.comprobarPin('1234'), /PIN incorrecto/);
assert.strictEqual(G.comprobarPin('4321').primerUso, false);
const res = G.resumen('4321', '', '');
assert.strictEqual(res.config.vacunas[0].minimo, 0);

// 4. Stock sin movimientos: parte de 0
let s = G.stock('4321');
let g = s.vacunas.find(v => v.nombre === 'Gripe');
assert.strictEqual(g.stock, -3); // 1+1+1+1−1 = 3 puestas netas
assert.strictEqual(g.consumoSemanal, 1); // últimos 14 días: 1+1+1−1 = 2 → 1
assert.ok(!s.vacunas.find(v => v.nombre === 'Vieja'), 'inactiva sin movimientos no sale');
assert.throws(() => G.stock('1'), /PIN/);

// 5. Recuento, entrada y merma
s = G.registrarStock('4321', { vacuna: 'Gripe', tipo: 'Recuento', cantidad: 10, nota: '=HACK()' });
g = s.vacunas.find(v => v.nombre === 'Gripe');
assert.strictEqual(g.stock, 10);
assert.strictEqual(sheets['Stock'].d[1][5], '=HACK()'); // guardado como texto (con apóstrofo)
G.registrar([{ id: 'n1', momento: Date.now() + 5, profesional: 'Ana', turno: 'Mañana', vacuna: 'Gripe', cambio: 1 }]);
G.registrarStock('4321', { vacuna: 'Gripe', tipo: 'Entrada', cantidad: 20 });
s = G.registrarStock('4321', { vacuna: 'Gripe', tipo: 'Merma', cantidad: 2, nota: 'Caducada' });
g = s.vacunas.find(v => v.nombre === 'Gripe');
assert.strictEqual(g.stock, 10 - 1 + 20 - 2);
assert.strictEqual(s.movimientos[0].tipo, 'Merma');
assert.throws(() => G.registrarStock('4321', { vacuna: 'Gripe', tipo: 'Entrada', cantidad: 0 }), /mayor que cero/);
assert.throws(() => G.registrarStock('4321', { vacuna: 'X', tipo: 'Entrada', cantidad: 1 }), /no está/);
assert.throws(() => G.registrarStock('4321', { vacuna: 'Gripe', tipo: 'Robo', cantidad: 1 }), /Tipo/);
assert.throws(() => G.registrarStock('4321', { vacuna: 'Gripe', tipo: 'Entrada', cantidad: 1.5 }), /entero/);

// Fila escrita a mano solo con fecha antigua (anterior al recuento): no cuenta
sheets['Stock'].appendRow(['', '2020-01-01', 'Gripe', 'entrada', 500, 'a mano']);
// Recuento a mano de COVID con fecha de hace 3 días en formato dd/mm/aaaa
sheets['Stock'].appendRow(['', fmt(d(3), 'Europe/Madrid', 'dd/MM/yyyy'), 'COVID-19', 'Recuento', 7, '']);
s = G.stock('4321');
assert.strictEqual(s.vacunas.find(v => v.nombre === 'Gripe').stock, 27);
const cv = s.vacunas.find(v => v.nombre === 'COVID-19');
assert.strictEqual(cv.stock, 6); // 7 − 1 puesta ayer
assert.strictEqual(cv.semanas, 12); // 6 / 0,5

// 6. Stock mínimo, alertas y nombre del centro
G.guardarConfig('4321', { centro: 'Centro de prueba', enfermeras: 6, huecos: 12, dias: 5, porProfesional: true, profesionales: ['Ana', 'Luis'],
  vacunas: [{ nombre: 'Gripe', necesarias: 100, minimo: 30, activa: true }, { nombre: 'COVID-19', necesarias: 50, minimo: 0, activa: true }] });
s = G.stock('4321');
g = s.vacunas.find(v => v.nombre === 'Gripe');
assert.strictEqual(g.minimo, 30); assert.strictEqual(g.bajoMinimo, true);
assert.strictEqual(G.datosContador().centro, 'Centro de prueba');
assert.strictEqual(G.doGet({ parameter: {} }).t, 'Contador de vacunas · Centro de prueba');
assert.strictEqual(sheets['Registro'].getLastRow(), nReg + 1);
assert.strictEqual(G.resumen('4321').porVacuna['Gripe'], 4);

// 7. Asistente de primer uso en una hoja nueva
for (const k of Object.keys(sheets)) delete sheets[k];
G.doGet({ parameter: { p: 'panel' } });
assert.strictEqual(sheets['Configuración'].d.find(x => x[0] === 'Mostrar datos por profesional (Sí/No)')[1], 'No', 'vista por profesional desactivada en instalaciones nuevas');
let c = G.comprobarPin('1234');
assert.strictEqual(c.primerUso, true);
assert.deepStrictEqual(Array.from(c.vacunas), ['Gripe', 'Comirnaty']);
assert.throws(() => G.completarAsistente('1234', { centro: 'X', pin: '1234', vacunas: ['A'] }), /entre 6 y 20|no puede ser/);
assert.throws(() => G.completarAsistente('1234', { centro: 'X', pin: '9876', vacunas: ['A'] }), /entre 6 y 20/);
assert.throws(() => G.completarAsistente('1234', { centro: '', pin: '987654', vacunas: ['A'] }), /centro/);
assert.throws(() => G.completarAsistente('1234', { centro: 'X', pin: '987654', vacunas: [] }), /vacuna/);
G.completarAsistente('1234', { centro: 'CS Ejemplo', pin: '987654', vacunas: ['Gripe', 'gripe', 'Neumococo'], profesionales: ['Eva'] });
assert.throws(() => G.comprobarPin('1234'), /PIN incorrecto/);
c = G.comprobarPin('987654');
assert.strictEqual(c.primerUso, false); assert.strictEqual(c.centro, 'CS Ejemplo');
assert.deepStrictEqual(Array.from(G.datosContador().vacunas), ['Gripe', 'Neumococo']);
assert.deepStrictEqual(Array.from(G.datosContador().profesionales), ['Eva']);
assert.throws(() => G.completarAsistente('987654', { centro: 'Y', pin: '555555', vacunas: ['A'] }), /ya se completó/);
assert.strictEqual(G.infoPublica().centro, 'CS Ejemplo');

console.log('OK básico: contador, migración, stock y asistente');
