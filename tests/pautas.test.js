// Pautas (un toque = un paciente con una o dos dosis), cuadrícula del contador, deshacer,
// cobertura por enfermedad (mCombriax cuenta en gripe y en COVID) y líneas de suma («60 o más»).
'use strict';
const assert = require('assert');
const { crearEntorno, Sheet, madrid } = require('./arnes');

const E = crearEntorno({ ahora: Date.UTC(2026, 10, 10, 10, 0, 0) }); // martes 10/11/2026, 11:00 Madrid
const G = E.G, sheets = E.sheets;
// Hoja v1.3: Registro con 9 columnas (una dosis antigua), Vacunas sin «Protege frente a»
sheets['Registro'] = new Sheet('Registro', [['Momento', 'Fecha', 'Semana', 'Turno', 'Profesional', 'Vacuna', 'Cambio', 'Id', 'Grupo'],
  [madrid('2026-11-10', '08:30'), '', '', 'Mañana', 'Ana', 'Efluelda', 1, 'viejo1', '']], 9);
sheets['Configuración'] = new Sheet('Configuración', [['Parámetro', 'Valor'], ['PIN del panel', '432100'], ['Inicio de campaña', '2026-09-28'], ['Fin de campaña', '2026-12-31']]);
sheets['Vacunas'] = new Sheet('Vacunas', [['Vacuna', 'Dosis necesarias por semana', 'Activa (Sí/No)', 'Stock mínimo'],
  ['Efluelda', 0, 'Sí', 0], ['Vaxigrip', 0, 'Sí', 0], ['Fluenz', 0, 'Sí', 0], ['mCombriax', 0, 'Sí', 0], ['Comirnaty30', 0, 'Sí', 0], ['Spikevax', 0, 'Sí', 0]], 4);
sheets['Profesionales'] = new Sheet('Profesionales', [['Nombre', 'Activo (Sí/No)'], ['Ana', 'Sí'], ['Bea', 'Sí']]);
G.doGet({ parameter: {} });

// Migración: «Protege frente a» deducido del nombre; columnas Paciente y Pauta
assert.deepStrictEqual(sheets['Vacunas'].d.slice(1).map(r => r[4]), ['Gripe', 'Gripe', 'Gripe', 'Gripe y COVID', 'COVID', 'COVID']);
assert.deepStrictEqual(sheets['Registro'].d[0].slice(9, 11), ['Paciente', 'Pauta']);

// Pautas que usáis (Spikevax solo con Efluelda; nada de Fluenz + COVID)
const PAUTAS = 'Efluelda; Efluelda + Comirnaty30; Efluelda + Spikevax; mCombriax; Vaxigrip; Vaxigrip + Comirnaty30; Fluenz; Comirnaty30';
const vacs = ['Efluelda', 'Vaxigrip', 'Fluenz', 'mCombriax', 'Comirnaty30', 'Spikevax'].map(n => ({ nombre: n, necesarias: 0, minimo: 0, activa: true }));
assert.throws(() => G.guardarConfig('432100', { vacunas: vacs, pautas: 'Efluelda + Vaxigrip' }), /dos vacunas de gripe/);
assert.throws(() => G.guardarConfig('432100', { vacunas: vacs, pautas: 'mCombriax + Comirnaty30' }), /ya lleva la COVID/);
assert.throws(() => G.guardarConfig('432100', { vacunas: vacs, pautas: 'Efluelda + Bimervax' }), /no está en la lista/);
G.guardarConfig('432100', { vacunas: vacs, profesionales: ['Ana', 'Bea'], pautas: PAUTAS.toLowerCase() });
assert.strictEqual(sheets['Configuración'].d.find(r => /^Pautas/.test(r[0]))[1], PAUTAS, 'nombres canónicos');

G.guardarCampana('432100', { inicio: '2026-09-28', fin: '2026-12-31', grupos: [
  { nombre: '65 o más', vacunas: 'Efluelda, mCombriax', desde: '2026-10-19', poblacion: 1000, objetivo: 75, suma: '60 o más', activo: true },
  { nombre: '60–64 años', vacunas: 'Vaxigrip', desde: '2026-11-09', poblacion: 300, objetivo: 75, suma: '60 o más', activo: true },
  { nombre: 'Menores de 60', vacunas: 'Vaxigrip, Fluenz', desde: '2026-10-13', poblacion: 0, objetivo: 0, activo: true },
  { nombre: '65 o más · COVID', vacunas: 'Comirnaty30, Spikevax, mCombriax', desde: '2026-10-19', poblacion: 1000, objetivo: 0, activo: true }
] });

// Cuadrícula
const q = G.datosContador().cuadricula;
assert.deepStrictEqual(Array.from(q.columnas), ['Comirnaty30', 'Spikevax']);
const fila = (g, gr) => q.filas.find(f => f.gripe === g && f.grupo === (gr || ''));
assert.deepStrictEqual(Array.from(fila('Efluelda').celdas), [true, true, true]);
assert.deepStrictEqual(Array.from(fila('Vaxigrip', '60–64 años').celdas), [true, true, false]);
assert.deepStrictEqual(Array.from(fila('Vaxigrip', 'Menores de 60').celdas), [true, true, false]);
assert.deepStrictEqual(Array.from(fila('Fluenz').celdas), [true, false, false]);
assert.strictEqual(fila('mCombriax').ambas, true);
assert.deepStrictEqual(Array.from(fila('').celdas), [false, true, false], 'Solo COVID: Comirnaty30');
assert.strictEqual(q.filas.length, 6);

// Toques como los manda el contador: una fila por dosis, Paciente 1 en la primera y 0 en la segunda
let n = 0;
const t = madrid('2026-11-10', '09:00').getTime();
const acto = (prof, pauta, grupo, signo) => pauta.split(' + ').map((v, i) => ({ id: 'a' + (n) + '-' + i, momento: t + n * 60000, profesional: prof, turno: 'Mañana',
  vacuna: v, grupo: grupo || '', cambio: signo || 1, paciente: i === 0 ? (signo || 1) : 0, pauta })).concat([]).map((x, i, a) => { if (i === a.length - 1) n++; return x; });
const lista = [].concat(
  acto('Ana', 'Efluelda + Comirnaty30', ''), acto('Ana', 'Efluelda + Comirnaty30', ''), acto('Ana', 'Efluelda + Spikevax', ''),
  acto('Ana', 'mCombriax', ''), acto('Ana', 'Vaxigrip', '60–64 años'), acto('Ana', 'Vaxigrip + Comirnaty30', 'Menores de 60'),
  acto('Bea', 'Comirnaty30', ''), acto('Bea', 'Efluelda', ''));
assert.strictEqual(G.registrar(lista).guardados.length, lista.length);
const reg = sheets['Registro'].d;
const filaId = id => reg.find(r => r[7] === id);
assert.deepStrictEqual(filaId('a0-0').slice(5, 11), ['Efluelda', 1, 'a0-0', '', 1, 'Efluelda + Comirnaty30']);
assert.deepStrictEqual(filaId('a0-1').slice(5, 11), ['Comirnaty30', 1, 'a0-1', '', 0, 'Efluelda + Comirnaty30']);
assert.strictEqual(filaId('a5-1')[8], '', 'Comirnaty30 no está en «Menores de 60»: sin grupo');
assert.strictEqual(filaId('a5-0')[8], 'Menores de 60');

let h = G.misHoy('Ana');
// 6 pacientes nuevos + 1 dosis antigua (antes de la v1.4 cada dosis era un paciente) = 7; dosis 1 + 10 = 11
assert.strictEqual(h.pacientes, 7);
assert.strictEqual(h.dosis, 11);
assert.strictEqual(h.casillas['Efluelda + Comirnaty30||'], 2);
assert.strictEqual(h.casillas['Vaxigrip|60–64 años|'], 1);
assert.strictEqual(h.casillas['Vaxigrip + Comirnaty30|Menores de 60|'], 1);
assert.strictEqual(h.casillas['Efluelda||'], 1, 'la dosis antigua cuenta en «Efluelda sola»');
assert.strictEqual(h.pacientesCentro, 9);
assert.strictEqual(h.pila[h.pila.length - 1].p, 'Vaxigrip + Comirnaty30');

// Deshacer el último de Ana: las dos dosis en negativo, Paciente −1 / 0
G.registrar(acto('Ana', 'Vaxigrip + Comirnaty30', 'Menores de 60', -1));
h = G.misHoy('Ana');
assert.strictEqual(h.pacientes, 6);
assert.strictEqual(h.dosis, 9);
assert.strictEqual(h.casillas['Vaxigrip + Comirnaty30|Menores de 60|'], 0);
assert.strictEqual(h.pila[h.pila.length - 1].p, 'Vaxigrip', 'ahora el último es el anterior');
// Un contador antiguo (sin paciente ni pauta): cada dosis = un paciente
G.registrar([{ id: 'antiguo1', momento: t, profesional: 'Bea', turno: 'Mañana', vacuna: 'Fluenz', cambio: 1 }]);
assert.deepStrictEqual(filaId('antiguo1').slice(9, 11), [1, 'Fluenz']);

// Panel: pacientes frente a dosis
const rs = G.resumen('432100', '2026-11-10', '2026-11-10');
assert.strictEqual(rs.pacientes, 9);   // Ana 6 + Bea 2 + Fluenz antiguo 1
assert.strictEqual(rs.porDia[0].total, 12); // dosis
assert.strictEqual(rs.porDia[0].pacientes, 9);

// Cobertura por enfermedad
const p = G.prevision('432100');
const g = nn => p.grupos.find(x => x.nombre === nn);
// 65+ (gripe): Efluelda antigua 1 + 2 (con Comirnaty30) + 1 (con Spikevax) + mCombriax 1 + Efluelda Bea 1 = 6
assert.strictEqual(g('65 o más').vacunados, 6);
assert.strictEqual(g('65 o más').enfermedad, 'gripe');
// 65+ COVID: Comirnaty30 ×2 (con Efluelda) + Spikevax 1 + mCombriax 1 + Comirnaty30 sola de Bea 1 = 5
// (la Comirnaty30 deshecha de «Menores de 60» se compensa)
assert.strictEqual(g('65 o más · COVID').vacunados, 5);
assert.strictEqual(g('65 o más · COVID').enfermedad, 'COVID');
assert.strictEqual(g('60–64 años').vacunados, 1);
// Línea de suma «60 o más» = 65+ (gripe) + 60–64
const a = p.agregados.find(x => x.nombre === '60 o más');
assert.deepStrictEqual(Array.from(a.grupos), ['65 o más', '60–64 años']);
assert.strictEqual(a.poblacion, 1300);
assert.strictEqual(a.vacunados, 7);
assert.strictEqual(a.objetivo, 75);
assert.strictEqual(a.faltan, 975 - 7);
// mCombriax se gasta una vez aunque cuente en dos grupos
const mc = p.vacunas.find(v => v.nombre === 'mCombriax');
assert.ok(mc.consumoDia <= 1, 'consumo mCombriax ' + mc.consumoDia);

// Grupo que mezcla gripe y COVID: se marca
G.guardarCampana('432100', { inicio: '2026-09-28', fin: '2026-12-31', grupos: [
  { nombre: 'Todo junto', vacunas: 'Efluelda, Comirnaty30', desde: '2026-10-19', poblacion: 1000, objetivo: 75, activo: true }] });
assert.strictEqual(G.prevision('432100').grupos[0].enfermedad, 'mixto');

// Sin pautas guardadas: todas las combinaciones posibles
G.guardarConfig('432100', { vacunas: vacs, profesionales: ['Ana'], pautas: '' });
const q2 = G.datosContador().cuadricula;
assert.deepStrictEqual(Array.from(q2.filas.find(f => f.gripe === 'Fluenz').celdas), [true, true, true]);
assert.strictEqual(q2.filas.find(f => f.gripe === 'mCombriax').ambas, true);
console.log('OK pautas: cuadrícula, pacientes, deshacer, gripe/COVID por separado y «60 o más»');

// ---- Perfiles: familia 14, pediatría 8, obstétrica 0 (sin cita); excepción por persona ----
const E2 = crearEntorno({ ahora: Date.UTC(2026, 10, 10, 10, 0, 0) });
const S2 = E2.sheets, G2 = E2.G;
S2['Registro'] = new Sheet('Registro', [['Momento', 'Fecha', 'Semana', 'Turno', 'Profesional', 'Vacuna', 'Cambio', 'Id', 'Grupo', 'Paciente', 'Pauta']]);
S2['Configuración'] = new Sheet('Configuración', [['Parámetro', 'Valor'], ['PIN del panel', '432100'], ['Enfermeras/os que vacunan', '6'], ['Huecos de vacunación por enfermera/o y día', '14']]);
S2['Vacunas'] = new Sheet('Vacunas', [['Vacuna', 'Dosis necesarias por semana', 'Activa (Sí/No)', 'Stock mínimo', 'Protege frente a'], ['Efluelda', 0, 'Sí', 0, 'Gripe'], ['Vaxigrip', 0, 'Sí', 0, 'Gripe']]);
S2['Profesionales'] = new Sheet('Profesionales', [['Nombre', 'Activo (Sí/No)'], ['Ana', 'Sí'], ['Eva', 'Sí'], ['Pili', 'Sí'], ['Marta', 'Sí']], 2);
G2.doGet({ parameter: { p: 'panel' } });
assert.deepStrictEqual(S2['Profesionales'].d[0].slice(2, 4), ['Perfil', 'Huecos propios por día (vacío = los del perfil; 0 = sin cita)'], 'migración Profesionales');
let r2 = G2.resumen('432100', '2026-11-10', '2026-11-10');
assert.strictEqual(r2.config.capDia, 84, 'sin perfiles: 6 × 14');
const vac2 = [{ nombre: 'Efluelda', activa: true }, { nombre: 'Vaxigrip', activa: true }];
assert.throws(() => G2.guardarConfig('432100', { enfermeras: 6, huecos: 14, dias: 5, vacunas: vac2, perfiles: [{ nombre: 'A', huecos: 1 }, { nombre: 'a', huecos: 2 }] }), /repetido/);
G2.guardarConfig('432100', { enfermeras: 6, huecos: 14, dias: 5, vacunas: vac2,
  perfiles: [{ nombre: 'Enfermería de familia', huecos: 14 }, { nombre: 'Enfermería pediátrica', huecos: 8 }, { nombre: 'Enfermería obstétrica', huecos: 0 }],
  profesionales: [{ nombre: 'Ana', perfil: 'enfermería de familia', huecos: '' }, { nombre: 'Eva', perfil: 'Enfermería de familia', huecos: 7 },
    { nombre: 'Pili', perfil: 'Enfermería pediátrica', huecos: '' }, { nombre: 'Marta', perfil: 'Enfermería obstétrica', huecos: '' }] });
assert.strictEqual(S2['Configuración'].d.find(r => /^Perfiles/.test(r[0]))[1], 'Enfermería de familia: 14; Enfermería pediátrica: 8; Enfermería obstétrica: 0');
assert.deepStrictEqual(S2['Profesionales'].d.slice(1).map(r => r.slice(0, 4)), [
  ['Ana', 'Sí', 'Enfermería de familia', ''], ['Eva', 'Sí', 'Enfermería de familia', 7],
  ['Pili', 'Sí', 'Enfermería pediátrica', ''], ['Marta', 'Sí', 'Enfermería obstétrica', '']]);
const t2 = madrid('2026-11-10', '09:00').getTime();
const toq = (id, prof, vac) => ({ id, momento: t2, profesional: prof, turno: 'Mañana', vacuna: vac, cambio: 1, paciente: 1, pauta: vac });
G2.registrar([toq('h1', 'Ana', 'Efluelda'), toq('h2', 'Ana', 'Efluelda'), toq('h3', 'Pili', 'Vaxigrip'),
  toq('h4', 'Marta', 'Vaxigrip'), toq('h5', 'Marta', 'Vaxigrip'), toq('h6', 'Eva', 'Efluelda'), toq('h7', 'Sustituta', 'Efluelda')]);
r2 = G2.resumen('432100', '2026-11-10', '2026-11-10');
assert.strictEqual(r2.config.capDia, 29, 'Ana 14 + Eva 7 (excepción) + Pili 8 + Marta 0');
assert.strictEqual(r2.pacientes, 7);
assert.strictEqual(r2.sinCita, 2, 'los de la matrona');
assert.strictEqual(r2.porDia[0].capacidad, 14 + 7 + 8 + 0 + 14, 'la sustituta sin perfil usa los huecos generales');
const pp = n => r2.porPerfil.find(x => x.perfil === n);
assert.deepStrictEqual([pp('Enfermería de familia').pacientes, pp('Enfermería de familia').capacidad], [3, 21]);
assert.deepStrictEqual([pp('Enfermería pediátrica').pacientes, pp('Enfermería pediátrica').capacidad], [1, 8]);
assert.deepStrictEqual([pp('Enfermería obstétrica').pacientes, pp('Enfermería obstétrica').sinCita, pp('Enfermería obstétrica').capacidad], [2, 2, 0]);
assert.deepStrictEqual([pp('').pacientes, pp('').capacidad], [1, 14], 'sin perfil');
assert.strictEqual(r2.porProfesional, null, 'por perfil se ve aunque la vista por profesional esté apagada');
console.log('OK perfiles: huecos por perfil, excepción por persona, sin cita y tabla por perfil');

// ---- Contadores (perfiles): filas explícitas con texto y grupo ----
const E3 = crearEntorno({ ahora: Date.UTC(2026, 10, 10, 10, 0, 0) });
const S3 = E3.sheets, G3 = E3.G;
S3['Registro'] = new Sheet('Registro', [['Momento', 'Fecha', 'Semana', 'Turno', 'Profesional', 'Vacuna', 'Cambio', 'Id', 'Grupo', 'Paciente', 'Pauta']], 11);
S3['Configuración'] = new Sheet('Configuración', [['Parámetro', 'Valor'], ['PIN del panel', '432100'], ['Inicio de campaña', '2026-09-28'], ['Fin de campaña', '2026-12-31']]);
S3['Vacunas'] = new Sheet('Vacunas', [['Vacuna', 'Dosis necesarias por semana', 'Activa (Sí/No)', 'Stock mínimo', 'Protege frente a'],
  ['Efluelda', 0, 'Sí', 0, 'Gripe'], ['Vaxigrip', 0, 'Sí', 0, 'Gripe'], ['Fluenz', 0, 'Sí', 0, 'Gripe'], ['mCombriax', 0, 'Sí', 0, 'Gripe y COVID'], ['Comirnaty30', 0, 'Sí', 0, 'COVID'], ['Spikevax', 0, 'Sí', 0, 'COVID']]);
S3['Profesionales'] = new Sheet('Profesionales', [['Nombre', 'Activo (Sí/No)'], ['Ana', 'Sí']]);
G3.doGet({ parameter: {} });
assert.strictEqual(S3['Registro'].d[0][11], 'Fila', 'migración: columna Fila');
assert.ok(S3['Contadores'], 'crea la hoja Contadores');
G3.guardarCampana('432100', { inicio: '2026-09-28', fin: '2026-12-31', grupos: [
  { nombre: '65 o más', vacunas: 'Efluelda, mCombriax', desde: '2026-10-19', poblacion: 1000, objetivo: 75, activo: true },
  { nombre: '60–64 años', vacunas: 'Vaxigrip', desde: '2026-11-09', poblacion: 300, objetivo: 75, activo: true },
  { nombre: 'Infantil 6–23 meses', vacunas: 'Vaxigrip', desde: '2026-10-13', poblacion: 80, objetivo: 60, activo: true },
  { nombre: 'Infantil 2–11 años', vacunas: 'Fluenz', desde: '2026-10-13', poblacion: 700, objetivo: 60, activo: true },
  { nombre: 'Riesgo y otros 12–59 años', vacunas: 'Vaxigrip', desde: '2026-11-02', poblacion: 0, objetivo: 0, activo: true }] });
const vac3 = S3['Vacunas'].d.slice(1).map(r => ({ nombre: r[0], activa: true, protege: r[4] }));
const K = (nombre, filas) => ({ nombre, filas });
const FL = (gripe, texto, grupo, sola, covid) => ({ gripe, texto, grupo, sola, covid });
assert.throws(() => G3.guardarConfig('432100', { vacunas: vac3, contadores: [K('Mal', [FL('Fluenz', '', '60–64 años', true, [])])] }), /no usa Fluenz/);
assert.throws(() => G3.guardarConfig('432100', { vacunas: vac3, contadores: [K('Mal', [FL('Comirnaty30', '', '', true, [])])] }), /no es una vacuna de gripe/);
G3.guardarConfig('432100', { vacunas: vac3, profesionales: ['Ana'], contadores: [
  K('Adultos + COMBO-GAL', [FL('Efluelda', '', '65 o más', true, ['Comirnaty30', 'Spikevax']), FL('Vaxigrip', '60–64 años', '60–64 años', true, ['Comirnaty30']),
    FL('Vaxigrip', 'menores de 60', 'Riesgo y otros 12–59 años', true, ['Comirnaty30']), FL('mCombriax', '', '65 o más', true, []), FL('', '', '', false, ['Comirnaty30'])]),
  K('Pediatría', [FL('Vaxigrip', '6–23 meses', 'Infantil 6–23 meses', true, []), FL('Fluenz', '2–11 años', 'Infantil 2–11 años', true, []),
    FL('Vaxigrip', '12–14 años', 'Riesgo y otros 12–59 años', true, [])])] });
assert.strictEqual(S3['Contadores'].d.length, 9, 'cabecera + 8 filas');
const d3 = G3.datosContador();
assert.deepStrictEqual(Array.from(d3.contadores, k => k.nombre), ['Adultos + COMBO-GAL', 'Pediatría']);
const ped = d3.contadores[1].cuadricula;
assert.deepStrictEqual(Array.from(ped.columnas), []);
assert.deepStrictEqual(Array.from(ped.filas, f => f.texto), ['6–23 meses', '2–11 años', '12–14 años']);
const ad = d3.contadores[0].cuadricula;
assert.deepStrictEqual(Array.from(ad.columnas), ['Comirnaty30', 'Spikevax']);
assert.deepStrictEqual(Array.from(ad.filas, f => Array.from(f.celdas).map(Number).join('')), ['111', '110', '110', '1', '010']);
// Toques con su fila: las dos Vaxigrip de Riesgo 12–59 (menores de 60 y 12–14) no se mezclan
const t3 = madrid('2026-11-10', '09:00').getTime();
const tq = (id, pauta, grupo, fila) => pauta.split(' + ').map((v, i) => ({ id: id + '-' + i, momento: t3, profesional: 'Ana', turno: 'Mañana', vacuna: v, grupo, cambio: 1, paciente: i ? 0 : 1, pauta, fila }));
G3.registrar([].concat(tq('p1', 'Vaxigrip', 'Infantil 6–23 meses', '6–23 meses'), tq('p2', 'Vaxigrip', 'Infantil 6–23 meses', '6–23 meses'),
  tq('p3', 'Vaxigrip', 'Riesgo y otros 12–59 años', '12–14 años'), tq('p4', 'Vaxigrip + Comirnaty30', 'Riesgo y otros 12–59 años', 'menores de 60')));
const h3 = G3.misHoy('Ana');
assert.strictEqual(h3.casillas['Vaxigrip|Infantil 6–23 meses|6–23 meses'], 2);
assert.strictEqual(h3.casillas['Vaxigrip|Riesgo y otros 12–59 años|12–14 años'], 1);
assert.strictEqual(h3.casillas['Vaxigrip + Comirnaty30|Riesgo y otros 12–59 años|menores de 60'], 1);
assert.strictEqual(h3.pila[h3.pila.length - 1].f, 'menores de 60');
const p3 = G3.prevision('432100');
const g3 = n => p3.grupos.find(x => x.nombre === n).vacunados;
assert.strictEqual(g3('Infantil 6–23 meses'), 2);
assert.strictEqual(g3('Riesgo y otros 12–59 años'), 2);
assert.strictEqual(g3('60–64 años'), 0, 'nada se cuela en 60–64');
// Sin contadores: vuelve la cuadrícula automática
G3.guardarConfig('432100', { vacunas: vac3, profesionales: ['Ana'], contadores: [] });
assert.strictEqual(G3.datosContador().contadores.length, 0);
console.log('OK contadores: perfiles con filas, texto y grupo; dosis en su grupo sin mezclarse');

// ---- Pacientes reales de un día (corrección a mano) ----
const E4 = crearEntorno({ ahora: Date.UTC(2026, 10, 10, 10, 0, 0) });
const S4 = E4.sheets, G4 = E4.G;
// Día con la v1.3: 3 pacientes con Efluelda + Comirnaty30 = 6 filas, cada una contaba como paciente
S4['Registro'] = new Sheet('Registro', [['Momento', 'Fecha', 'Semana', 'Turno', 'Profesional', 'Vacuna', 'Cambio', 'Id', 'Grupo']].concat(
  [0, 1, 2].flatMap(i => [[madrid('2026-11-09', '10:0' + i), '', '', 'Mañana', 'Ana', 'Efluelda', 1, 'e' + i, ''], [madrid('2026-11-09', '10:0' + i), '', '', 'Mañana', 'Ana', 'Comirnaty30', 1, 'c' + i, '']])), 9);
S4['Configuración'] = new Sheet('Configuración', [['Parámetro', 'Valor'], ['PIN del panel', '432100'], ['Enfermeras/os que vacunan', '1'], ['Huecos de vacunación por enfermera/o y día', '14']]);
S4['Vacunas'] = new Sheet('Vacunas', [['Vacuna', 'Dosis necesarias por semana', 'Activa (Sí/No)'], ['Efluelda', 0, 'Sí'], ['Comirnaty30', 0, 'Sí']], 3);
S4['Profesionales'] = new Sheet('Profesionales', [['Nombre', 'Activo (Sí/No)'], ['Ana', 'Sí']]);
G4.doGet({ parameter: { p: 'panel' } });
assert.ok(S4['Pacientes del día'], 'crea la hoja Pacientes del día');
let r4 = G4.resumen('432100', '2026-11-09', '2026-11-10');
assert.strictEqual(r4.pacientes, 6, 'sin corregir: cada dosis contaba como paciente');
assert.throws(() => G4.registrarPacientesDia('432100', { fecha: '2026-11-11', pacientes: 3 }), /futura/);
assert.throws(() => G4.registrarPacientesDia('432100', { fecha: '2026-11-09', pacientes: 2.5 }), /entero/);
G4.registrarPacientesDia('432100', { fecha: '2026-11-09', pacientes: 4, nota: 'primero me equivoqué' });
G4.registrarPacientesDia('432100', { fecha: '2026-11-09', pacientes: 3, nota: 'agenda' });
r4 = G4.resumen('432100', '2026-11-09', '2026-11-10');
assert.strictEqual(r4.pacientes, 3, 'vale el último dato');
assert.strictEqual(r4.porDia[0].pacientes, 3);
assert.strictEqual(r4.porDia[0].total, 6, 'las dosis no cambian');
assert.deepStrictEqual(JSON.parse(JSON.stringify(r4.porDia[0].real)), { calculados: 6, nota: 'agenda' });
assert.strictEqual(r4.porSemana.find(w => w.semana === '2026-S46').pacientes, 3, 'la semana también');
// Fuera del periodo: no cambia el total del periodo
assert.strictEqual(G4.resumen('432100', '2026-11-10', '2026-11-10').pacientes, 0);
// Quitar la corrección
G4.registrarPacientesDia('432100', { fecha: '2026-11-09', pacientes: '' });
assert.strictEqual(G4.resumen('432100', '2026-11-09', '2026-11-10').pacientes, 6);
console.log('OK pacientes reales del día: corrige el día, la semana y el periodo; se puede quitar');
