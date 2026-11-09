// Dosis apuntadas con su grupo: botones del contador, columna Grupo y previsión por grupo.
'use strict';
const assert = require('assert');
const { crearEntorno, Sheet, madrid } = require('./arnes');

const E = crearEntorno({ ahora: Date.UTC(2026, 10, 10, 10, 0, 0) }); // martes 10/11/2026, 11:00 Madrid
const G = E.G, sheets = E.sheets;
// Hoja antigua: Registro con 8 columnas y dosis sin grupo
sheets['Registro'] = new Sheet('Registro', [['Momento', 'Fecha', 'Semana', 'Turno', 'Profesional', 'Vacuna', 'Cambio', 'Id'],
  [madrid('2026-11-09'), '', '', 'Mañana', 'Ana', 'Vaxigrip', 1, 'old1'],
  [madrid('2026-11-09'), '', '', 'Mañana', 'Ana', 'Vaxigrip', 1, 'old2']], 8);
sheets['Configuración'] = new Sheet('Configuración', [['Parámetro', 'Valor'], ['PIN del panel', '432100'], ['Inicio de campaña', '2026-09-28'], ['Fin de campaña', '2026-12-31']]);
sheets['Vacunas'] = new Sheet('Vacunas', [['Vacuna', 'Dosis necesarias por semana', 'Activa (Sí/No)', 'Stock mínimo'], ['Efluelda', 0, 'Sí', 0], ['Vaxigrip', 0, 'Sí', 0]]);
sheets['Profesionales'] = new Sheet('Profesionales', [['Nombre', 'Activo (Sí/No)'], ['Ana', 'Sí']]);
G.doGet({ parameter: {} });
assert.strictEqual(sheets['Registro'].d[0][8], 'Grupo', 'migración añade la columna Grupo');

G.guardarCampana('432100', { inicio: '2026-09-28', fin: '2026-12-31', grupos: [
  { nombre: '65 o más', vacunas: 'Efluelda', desde: '2026-10-19', poblacion: 1000, objetivo: 75, activo: true },
  { nombre: '60–64 años', vacunas: 'Vaxigrip', desde: '2026-11-09', poblacion: 300, objetivo: 75, activo: true },
  { nombre: 'Menores de 60', vacunas: 'Vaxigrip', desde: '2026-10-13', poblacion: 0, objetivo: 0, activo: true }
] });

// Botones: Efluelda una vez; Vaxigrip uno por grupo
const d = G.datosContador();
assert.deepStrictEqual(JSON.parse(JSON.stringify(d.botones)), [
  { vacuna: 'Efluelda', grupo: '' }, { vacuna: 'Vaxigrip', grupo: '60–64 años' }, { vacuna: 'Vaxigrip', grupo: 'Menores de 60' }]);

const t = madrid('2026-11-10', '09:00').getTime();
const toque = (id, vac, grupo, cambio) => ({ id, momento: t, profesional: 'Ana', turno: 'Mañana', vacuna: vac, grupo, cambio: cambio || 1 });
const r = G.registrar([toque('a1', 'Vaxigrip', '60–64 AÑOS'), toque('a2', 'Vaxigrip', '60–64 años'), toque('a3', 'Vaxigrip', '60–64 años'),
  toque('a4', 'Vaxigrip', 'Menores de 60'), toque('a5', 'Efluelda', ''), toque('a6', 'Vaxigrip', 'Grupo inventado'), toque('a7', 'Efluelda', 'Menores de 60')]);
assert.strictEqual(r.guardados.length, 7);
const fila = id => sheets['Registro'].d.find(x => x[7] === id);
assert.strictEqual(fila('a1')[8], '60–64 años', 'nombre canónico del grupo');
assert.strictEqual(fila('a6')[8], '', 'grupo desconocido → vacío');
assert.strictEqual(fila('a7')[8], '', 'grupo que no usa esa vacuna → vacío');

// Recuento por botón
const h = G.misHoy('Ana');
assert.strictEqual(h.miasG['Vaxigrip|60–64 años'], 3);
assert.strictEqual(h.miasG['Vaxigrip|Menores de 60'], 1);
assert.strictEqual(h.miasG['Vaxigrip|'], 1);
assert.strictEqual(h.mias['Vaxigrip'], 5);

// −1 en un grupo
G.registrar([toque('a8', 'Vaxigrip', '60–64 años', -1)]);
const p = G.prevision('432100');
const g = n => p.grupos.find(x => x.nombre === n);
// 60–64: 3 − 1 = 2 con grupo; las sin grupo (old1, old2 del 9/11 y a6 del 10/11) se reparten por población diana:
// Menores de 60 tiene peso 0 → todo a 60–64 → 2 + 3 = 5
assert.strictEqual(g('60–64 años').vacunados, 5);
// Menores de 60: solo la apuntada con su grupo
assert.strictEqual(g('Menores de 60').vacunados, 1);
assert.strictEqual(g('65 o más').vacunados, 2);
console.log('OK grupos: botones por grupo, columna Grupo, recuento y previsión');
