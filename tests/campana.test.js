// Campaña: plantilla Galicia 2026, previsión por grupos, dato oficial, pedido sugerido,
// resumen por correo, aviso por Telegram y calendario propio de la COVID.
// Reloj fijo: sábado 7/11/2026 a las 11:00 (hora de Madrid).
'use strict';
const assert = require('assert');
const { crearEntorno, Sheet, madrid, laborablesEntre } = require('./arnes');

const E = crearEntorno({ ahora: Date.UTC(2026, 10, 7, 10, 0, 0) });
const G = E.G, sheets = E.sheets;
// ---- Hoja v1.0 (sin hojas de campaña) ----
const filasReg = [['Momento', 'Fecha', 'Semana', 'Turno', 'Profesional', 'Vacuna', 'Cambio', 'Id']];
let id = 0;
const poner = (vac, desde, hasta, porDia) => laborablesEntre(desde, hasta).forEach(f => { for (let i = 0; i < porDia; i++) filasReg.push([madrid(f), '', '', 'Mañana', 'Ana', vac, 1, 'x' + (id++)]); });
poner('Efluelda', '2026-10-19', '2026-11-06', 30);
poner('Fluenz', '2026-10-13', '2026-11-06', 10);
poner('Vaxigrip', '2026-10-13', '2026-11-06', 6);
sheets['Registro'] = new Sheet('Registro', filasReg);
sheets['Configuración'] = new Sheet('Configuración', [['Parámetro', 'Valor'], ['Enfermeras/os que vacunan', '6'], ['Huecos de vacunación por enfermera/o y día', '12'], ['Días de vacunación por semana', '5'], ['PIN del panel', '4321'], ['Mostrar datos por profesional (Sí/No)', 'Sí']]);
sheets['Vacunas'] = new Sheet('Vacunas', [['Vacuna', 'Dosis necesarias por semana', 'Activa (Sí/No)'], ['Efluelda', 0, 'Sí'], ['Vaxigrip', 0, 'Sí'], ['COVID-19', 0, 'Sí']], 3);
sheets['Profesionales'] = new Sheet('Profesionales', [['Nombre', 'Activo (Sí/No)'], ['Ana', 'Sí']]);

G.doGet({ parameter: { p: 'panel' } });
let p = G.prevision('4321');
assert.strictEqual(p.configurada, false);
assert.strictEqual(p.reparto, null);
assert.ok(sheets['Grupos'] && sheets['Coberturas'] && sheets['Repartos']);
assert.ok(sheets['Configuración'].d.some(r => r[0] === 'Inicio de campaña'));

// ---- Plantilla Galicia 2026 ----
const r = G.cargarPlantilla('4321', 'galicia-2026');
assert.deepStrictEqual(Array.from(r.vacunasNuevas), ['Fluenz']);
assert.ok(sheets['Vacunas'].d.some(x => x[0] === 'Fluenz'));
p = G.prevision('4321');
assert.strictEqual(p.configurada, true);
assert.strictEqual(p.campana.fin, '2026-12-31');
assert.strictEqual(p.grupos.length, 8);

// Población (lo único a mano)
const pob = { 'Infantil 6–23 meses': 100, 'Infantil 2–11 años': 800, 'Personal sanitario': 80, '70 años o más': 1000, 'Embarazadas y puerperio': 50, 'Riesgo y otros 12–59 años': 400, '65–69 años': 500, '60–64 años': 600 };
const gc = p.gruposConfig.map(g => ({ nombre: g.nombre, vacunas: g.vacunas.join(', '), desde: g.desde, poblacion: pob[g.nombre], objetivo: g.objetivo, activo: true }));
p = G.guardarCampana('4321', { inicio: '2026-09-28', fin: '2026-12-31', correo: 'coord@ejemplo.org', grupos: gc });
// guardarConfig no debe borrar la campaña
G.guardarConfig('4321', { centro: 'CS Ejemplo', enfermeras: 6, huecos: 12, dias: 5, porProfesional: true, profesionales: ['Ana'],
  vacunas: ['Efluelda', 'Vaxigrip', 'Fluenz', 'COVID-19'].map(n => ({ nombre: n, necesarias: 0, minimo: n === 'Efluelda' ? 20 : 0, activa: true })) });
p = G.prevision('4321');
assert.strictEqual(p.campana.inicio, '2026-09-28');
assert.strictEqual(p.correo, 'coord@ejemplo.org');
const g = n => p.grupos.find(x => x.nombre === n);

// 70+: toda la Efluelda antes del 9/11 = 15 días × 30 = 450; ritmo 30/día; faltan 750−450 = 300 → 10 laborables → vie 20/11
assert.strictEqual(g('70 años o más').vacunados, 450);
assert.strictEqual(g('70 años o más').ritmoDia, 30);
assert.strictEqual(g('70 años o más').faltan, 300);
assert.strictEqual(g('70 años o más').llega, '2026-11-20');
assert.strictEqual(g('70 años o más').estado, 'enCamino');
assert.strictEqual(g('65–69 años').estado, 'pendiente');
assert.strictEqual(g('65–69 años').vacunados, 0);
// Fluenz solo infantil 2–11: 19 días × 10 = 190
assert.strictEqual(g('Infantil 2–11 años').vacunados, 190);
// Vaxigrip repartida entre los grupos que la usan: el total cuadra
const vSum = ['Infantil 6–23 meses', 'Personal sanitario', 'Embarazadas y puerperio', 'Riesgo y otros 12–59 años'].reduce((s, n) => s + g(n).vacunados, 0);
assert.ok(Math.abs(vSum - 19 * 6) <= 2, 'Vaxigrip repartida: ' + vSum);
assert.strictEqual(g('Riesgo y otros 12–59 años').faltan, null);

// Dato oficial: 70+ tenía 500 el viernes 6/11 a las 20:00 → 500 + 0 dosis posteriores
sheets['Coberturas'].appendRow([madrid('2026-11-06', '20:00'), '2026-11-06', '70 años o más', 500, 'WPRESS']);
p = G.prevision('4321');
assert.strictEqual(g('70 años o más').vacunados, 500);
assert.strictEqual(g('70 años o más').oficial.n, 500);
p = G.registrarCobertura('4321', { grupo: '70 AÑOS O MÁS', vacunados: 510 });
assert.strictEqual(g('70 años o más').vacunados, 510);
assert.throws(() => G.registrarCobertura('4321', { grupo: 'X', vacunados: 1 }), /no existe/);

// ---- Repartos y pedido ----
// Sábado 7/11: el martes 10 se pedía el viernes 6 (ya pasó) → próximo: miércoles 11 (pedido hasta el lunes 9 a las 14:00); siguiente: viernes 13
assert.deepStrictEqual(JSON.parse(JSON.stringify(p.reparto)), { fecha: '2026-11-11', limite: '2026-11-09', hora: '14:00', siguiente: '2026-11-13' });
sheets['Stock'].appendRow([madrid('2026-11-06', '21:00'), '2026-11-06', 'Efluelda', 'Recuento', 120, '']);
p = G.prevision('4321');
const ef = p.vacunas.find(v => v.nombre === 'Efluelda');
// consumo: 30/día; desde el 9/11 + 65–69: 375 / 39 laborables (9/11–31/12) = 9,6 → 39,6/día
assert.strictEqual(ef.consumoDia, 30);
// hasta el 12/11 (lun–jue, 4 laborables): 158,5 + mínimo 20 − 120 = 58,5 → 59
assert.strictEqual(ef.pedido, 59);
assert.strictEqual(ef.noLlega, false);
// hasta el 31/12: 70+ a 30/día hasta llegar al objetivo el 18/11 (8 laborables = 240) + 65–69: 375 → 615
assert.strictEqual(ef.consumoHastaFin, 615);
assert.strictEqual(ef.balanceFin, 120 - 615);
// COVID-19 no está en ningún grupo y no se ha puesto: consumo 0
assert.strictEqual(p.vacunas.find(v => v.nombre === 'COVID-19').consumoDia, 0);

// Días de reparto en gallego y hora «14h»
sheets['Repartos'].d[1][2] = 'martes, mércores e venres'; sheets['Repartos'].d[1][4] = '14h';
p = G.prevision('4321');
assert.strictEqual(p.reparto.fecha, '2026-11-11');

// ---- Correo ----
assert.strictEqual(G.programarResumen('4321', true).activo, true);
G.programarResumen('4321', true);
assert.strictEqual(E.activadores.length, 1, 'no duplica el activador');
assert.strictEqual(G.prevision('4321').resumenActivo, true);
G.probarResumen('4321');
assert.strictEqual(E.correos.length, 1);
assert.strictEqual(E.correos[0].to, 'coord@ejemplo.org');
assert.ok(/CS Ejemplo/.test(E.correos[0].subject));
assert.ok(/Pedido sugerido/.test(E.correos[0].htmlBody) && /70 años o más/.test(E.correos[0].htmlBody));
// semana 2–6/11: (30 + 10 + 6) × 5 = 230
assert.ok(/Dosis puestas la semana pasada: 230/.test(E.correos[0].htmlBody), 'total semana pasada');
G.programarResumen('4321', false);
assert.strictEqual(E.activadores.length, 0);
assert.throws(() => G.guardarCampana('4321', { correo: 'no-es-correo', grupos: [] }), /no es válido/);
assert.throws(() => G.guardarCampana('4321', { grupos: [{ nombre: 'A', vacunas: 'Inventada', poblacion: 1 }] }), /no está en la lista/);
console.log('OK v1.1: todas las comprobaciones pasan');

// ---- Dato oficial en % y con fecha ----
// Infantil 2–11 (800): 25 % hasta el 5/11 incluido = 200; el contador suma lo del 6/11 (10 Fluenz) → 210
p = G.registrarCobertura('4321', { grupo: 'Infantil 2–11 años', porcentaje: '25', fecha: '2026-11-05' });
assert.strictEqual(g('Infantil 2–11 años').vacunados, 210);
assert.strictEqual(g('Infantil 2–11 años').oficial.n, 200);
assert.strictEqual(g('Infantil 2–11 años').oficial.fecha, '2026-11-05');
assert.ok(/25 % de 800/.test(sheets['Coberturas'].d[sheets['Coberturas'].getLastRow() - 1][4]));
// Número con fecha de hoy: dato de este momento
p = G.registrarCobertura('4321', { grupo: 'Infantil 2–11 años', vacunados: 300, fecha: '2026-11-07' });
assert.strictEqual(g('Infantil 2–11 años').vacunados, 300);
// Un dato más antiguo no pisa al más reciente
p = G.registrarCobertura('4321', { grupo: 'Infantil 2–11 años', porcentaje: 10, fecha: '2026-11-01' });
assert.strictEqual(g('Infantil 2–11 años').vacunados, 300);
assert.throws(() => G.registrarCobertura('4321', { grupo: 'Infantil 2–11 años', porcentaje: 101 }), /entre 0 y 100/);
assert.throws(() => G.registrarCobertura('4321', { grupo: 'Infantil 2–11 años', vacunados: 5, fecha: '2026-11-08' }), /futura/);
assert.throws(() => G.registrarCobertura('4321', { grupo: 'Infantil 2–11 años', porcentaje: '52,5', fecha: '31/13/2026' }), /no es válida/);
p = G.registrarCobertura('4321', { grupo: '60–64 años', porcentaje: '52,5', fecha: '06/11/2026' });
assert.strictEqual(g('60–64 años').oficial.n, 315); // 52,5 % de 600
console.log('OK dato oficial en % y con fecha');

// ---- Aviso de pedido y Telegram ----
const TOKEN = '123456789:AAFabcdefghijklmnopqrstuvwxyz012345';

// Sin nada configurado no se puede activar
assert.throws(() => G.guardarAvisos('4321', { activo: true, hora: 9 }), /Conecta Telegram/);
assert.throws(() => G.guardarAvisos('4321', { token: 'hola' }), /no parece/);
assert.throws(() => G.guardarAvisos('4321', { token: '999:AAFabcdefghijklmnopqrstuvwxyz012345' }), /no parece|no acepta/);
// Token guardado, sin chat
let a = G.guardarAvisos('4321', { token: TOKEN, hora: 8 });
assert.strictEqual(a.tokenGuardado, true); assert.strictEqual(a.telegram, false);
assert.ok(!sheets['Configuración'].d.some(r => String(r[1]).indexOf('AAF') >= 0), 'el token no va a la hoja');
assert.throws(() => G.conectarTelegram('4321'), /no ha recibido ningún mensaje/);
E.updates.length = 0; E.updates.push(...[{ update_id: 1, message: { chat: { id: 555, first_name: 'Damián', type: 'private' }, text: '/start' } }]);
a = G.conectarTelegram('4321');
assert.strictEqual(a.telegram, true); assert.strictEqual(a.chatNombre, 'Damián');
assert.strictEqual(E.props.TELEGRAM_CHAT, '555');
assert.ok(/Conectado/.test(E.llamadas[E.llamadas.length - 1].body.text));
// Activar a las 8:00; la hora y el correo se guardan en la hoja; un solo activador
a = G.guardarAvisos('4321', { activo: true, hora: 8, porCorreo: true });
a = G.guardarAvisos('4321', { activo: true, hora: 8, porCorreo: true });
assert.strictEqual(E.activadores.filter(t => t.getHandlerFunction() === 'avisoPedidoDiario').length, 1);
assert.strictEqual(a.activo, true); assert.strictEqual(a.hora, 8); assert.strictEqual(a.porCorreo, true);
// Guardar la configuración del centro no borra los avisos
G.guardarConfig('4321', { centro: 'CS Ejemplo', enfermeras: 6, huecos: 12, dias: 5, porProfesional: true, profesionales: ['Ana'],
  vacunas: ['Efluelda', 'Vaxigrip', 'Fluenz', 'COVID-19'].map(n => ({ nombre: n, necesarias: 0, minimo: n === 'Efluelda' ? 20 : 0, activa: true })) });
assert.strictEqual(G.prevision('4321').avisos.hora, 8);
assert.strictEqual(G.prevision('4321').avisos.porCorreo, true);

// Hoy (sábado 7/11) no vence ningún plazo → no avisa
let n = E.llamadas.length, nc = E.correos.length;
G.avisoPedidoDiario();
assert.strictEqual(E.llamadas.length, n); assert.strictEqual(E.correos.length, nc);

// Aviso de prueba: se envía aunque hoy no toque
G.probarAviso('4321');
const prueba = E.llamadas[E.llamadas.length - 1].body;
assert.strictEqual(prueba.chat_id, '555');
assert.ok(/PRUEBA/.test(prueba.text) && /Efluelda: <b>59<\/b> \(stock 120\)/.test(prueba.text) && /lun 9\/11/.test(prueba.text), prueba.text);
assert.strictEqual(E.correos.length, nc + 1);

// Un reparto el sábado con plazo hoy hasta las 14:00 (son las 11:00) → hoy toca pedir
sheets['Repartos'].appendRow(['2026-11-07', '2026-11-07', 'sáb', 0, '14:00']);
n = E.llamadas.length;
G.avisoPedidoDiario();
assert.strictEqual(E.llamadas.length, n + 1);
const aviso = E.llamadas[E.llamadas.length - 1].body.text;
assert.ok(/<b>Hoy<\/b> antes de las 14:00 → reparto del sáb 7\/11/.test(aviso), aviso);
assert.ok(!/PRUEBA/.test(aviso));
// Una sola vez por reparto
G.avisoPedidoDiario();
assert.strictEqual(E.llamadas.length, n + 1);

// Quitar Telegram
a = G.guardarAvisos('4321', { token: 'borrar', activo: false, porCorreo: false });
assert.strictEqual(a.tokenGuardado, false); assert.strictEqual(a.activo, false);
console.log('OK aviso de pedido y Telegram');

// ---- Calendario propio para la COVID ----
G.guardarAvisos('4321', { token: TOKEN }); G.conectarTelegram('4321');
// Repartos de una hoja anterior con 5 columnas: la migración añade «Vacunas» sin tocar las filas
sheets['Repartos'].d = sheets['Repartos'].d.map(r => r.slice(0, 5)); sheets['Repartos'].maxCols = 5;
G.doGet({ parameter: { p: 'panel' } });
assert.strictEqual(sheets['Repartos'].d[0][5], 'Vacunas (vacío = todas las demás)');
assert.strictEqual(sheets['Repartos'].d[1][2], 'martes, mércores e venres');
// Dosis de COVID esta semana y fila propia: martes y jueves, pedido el mismo día antes de las 12:00
['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'].forEach((f, i) => { for (let j = 0; j < 4; j++) sheets['Registro'].appendRow([madrid(f), '', '', 'Mañana', 'Ana', 'COVID-19', 1, 'c' + i + j]); });
sheets['Repartos'].appendRow(['2026-10-13', '2026-12-31', 'mar, jue', 0, '12:00', 'COVID-19']);
p = G.prevision('4321');
const cv = p.vacunas.find(v => v.nombre === 'COVID-19');
assert.deepStrictEqual(JSON.parse(JSON.stringify(cv.reparto)), { fecha: '2026-11-10', limite: '2026-11-10', hora: '12:00', siguiente: '2026-11-12' });
assert.ok(cv.consumoDia > 0 && cv.pedido > 0, 'COVID con pedido: ' + JSON.stringify(cv));
// La gripe sigue con su calendario general
assert.strictEqual(p.vacunas.find(v => v.nombre === 'Efluelda').reparto.hora, '14:00');
// Aviso de prueba: dos plazos distintos, cada uno con sus vacunas
G.probarAviso('4321');
const txt = E.llamadas[E.llamadas.length - 1].body.text;
assert.ok(/antes de las 12:00 → reparto del mar 10\/11:\n• COVID-19/.test(txt), txt);
assert.ok(/antes de las 14:00/.test(txt), txt);
// La plantilla no borra la fila propia de la COVID
G.cargarPlantilla('4321', 'galicia-2026');
assert.ok(sheets['Repartos'].d.some(r => r[5] === 'COVID-19'));
console.log('OK calendario propio de la COVID');
