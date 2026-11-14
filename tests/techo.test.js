// Techo esperado por grupo (el ritmo se frena) y asistencia a las citas por agenda.
'use strict';
const assert = require('assert');
const { crearEntorno, Sheet, madrid, laborablesEntre } = require('./arnes');

const E = crearEntorno({ ahora: Date.UTC(2026, 10, 9, 10, 0, 0) }); // lunes 9/11/2026, 11:00 Madrid
const G = E.G, sheets = E.sheets;
const filas = [['Momento', 'Fecha', 'Semana', 'Turno', 'Profesional', 'Vacuna', 'Cambio', 'Id', 'Grupo']];
let id = 0;
// 65 o más: 20 Efluelda al día del 19/10 al 6/11 (15 laborables = 300)
laborablesEntre('2026-10-19', '2026-11-06').forEach(f => { for (let i = 0; i < 20; i++) filas.push([madrid(f), '', '', 'Mañana', 'Ana', 'Efluelda', 1, 'e' + (id++), '']); });
sheets['Registro'] = new Sheet('Registro', filas);
sheets['Configuración'] = new Sheet('Configuración', [['Parámetro', 'Valor'], ['PIN del panel', '432100']]);
sheets['Vacunas'] = new Sheet('Vacunas', [['Vacuna', 'Dosis necesarias por semana', 'Activa (Sí/No)', 'Stock mínimo'], ['Efluelda', 0, 'Sí', 0]]);
sheets['Profesionales'] = new Sheet('Profesionales', [['Nombre', 'Activo (Sí/No)'], ['Ana', 'Sí']]);
// Hoja Grupos de la v1.3 (6 columnas): la migración añade «Techo esperado %»
sheets['Grupos'] = new Sheet('Grupos', [['Grupo', 'Vacunas (separadas por comas)', 'Desde', 'Población', 'Objetivo %', 'Activo (Sí/No)']], 6);
G.doGet({ parameter: { p: 'panel' } });
assert.strictEqual(sheets['Grupos'].d[0][6], 'Techo esperado %');
assert.ok(sheets['Citas'], 'crea la hoja Citas');

const campana = techo => G.guardarCampana('432100', { inicio: '2026-09-28', fin: '2026-12-31', agendas: 'GRI, Gri2, gri', grupos: [
  { nombre: '65 o más', vacunas: 'Efluelda', desde: '2026-10-19', poblacion: 1000, objetivo: 75, techo, activo: true }] });

// Sin techo: ritmo = 180 dosis ÷ 10 laborables (27/10–9/11, hoy incluido) = 18/día constante → faltan 450 → 25 laborables; al final 300 + 18 × 39 = 1002 → tope población 1000
let p = campana(0);
let g = p.grupos[0];
assert.strictEqual(g.vacunados, 300);
assert.strictEqual(g.ritmoDia, 18);
assert.strictEqual(g.techo, null);
assert.strictEqual(g.llega, '2026-12-14');
assert.strictEqual(g.alFinal, 1000);
const consumoSin = p.vacunas[0].consumoHastaFin;

// Techo 60 %: tope 600, quedan 300, q = 18/300. Objetivo 75 % > techo → no llega nunca.
p = campana(60);
g = p.grupos[0];
assert.deepStrictEqual(Array.from(p.agendasConfig), ['GRI', 'Gri2'], 'agendas sin repetidas');
assert.strictEqual(g.techo, 60);
assert.strictEqual(g.techoBajo, true);
assert.strictEqual(g.llega, null);
assert.strictEqual(g.estado, 'riesgo');
// Al final: 300 + 300 × (1 − (1 − 0,06)^39) ≈ 300 + 300 × 0,91 = 573
const lab = laborablesEntre('2026-11-09', '2026-12-31').length;
const esperado = Math.round(300 + 300 * (1 - Math.pow(1 - 18 / 300, lab)));
assert.strictEqual(g.alFinal, esperado);
assert.ok(g.alFinal < 600 && g.alFinal > 550, 'se queda cerca del techo: ' + g.alFinal);
assert.strictEqual(g.coberturaFinal, Math.round(esperado / 1000 * 1000) / 10);
// El consumo previsto hasta el fin baja: como mucho lo que falta hasta el techo
const consumoCon = p.vacunas[0].consumoHastaFin;
assert.ok(consumoCon <= 300 && consumoCon < consumoSin, 'consumo con techo ' + consumoCon + ' < sin techo ' + consumoSin);
assert.strictEqual(p.vacunas[0].consumoDia, 18, 'hoy, ritmo actual');

// Techo 80 % (por encima del objetivo): tope 800, quedan 500, q = 0,036; faltan 450 → n = ln(0,1)/ln(0,964) ≈ 63 laborables (después del fin)
p = campana(80);
g = p.grupos[0];
assert.strictEqual(g.techoBajo, false);
assert.ok(g.llega > '2026-12-31', 'se frena: llega después del fin (' + g.llega + ')');
assert.strictEqual(g.estado, 'riesgo');

// Ya en el techo: no se prevén más dosis
p = campana(30);
assert.strictEqual(p.grupos[0].alFinal, 300);
assert.strictEqual(p.vacunas[0].consumoHastaFin, 0);

// Grupo que empieza hoy: sin ritmo todavía, se usa el plan (techo 55 % de 300 = 165 entre los laborables hasta el fin)
p = G.guardarCampana('432100', { inicio: '2026-09-28', fin: '2026-12-31', grupos: [
  { nombre: '65 o más', vacunas: 'Efluelda', desde: '2026-10-19', poblacion: 1000, objetivo: 75, techo: 30, activo: true },
  { nombre: '60–64 años', vacunas: 'Efluelda', desde: '2026-11-09', poblacion: 300, objetivo: 75, techo: 55, activo: true }] });
const nuevo = p.grupos.find(x => x.nombre === '60–64 años');
assert.strictEqual(nuevo.estado, 'arrancando');
assert.strictEqual(nuevo.alFinal, 165);
assert.strictEqual(nuevo.llega, null);
assert.ok(Math.abs(p.vacunas[0].consumoHastaFin - 165) <= 1, 'consumo del plan: ' + p.vacunas[0].consumoHastaFin);
p = campana(30);

// ---- Asistencia ----
assert.strictEqual(p.asistencia.total, null);
assert.throws(() => G.registrarCitas('432100', { fecha: '2026-11-06', filas: [{ agenda: 'GRI', citados: 7, faltaron: 8 }] }), /faltaron más/);
assert.throws(() => G.registrarCitas('432100', { fecha: '2026-11-06', filas: [{ agenda: 'Otra', citados: 7 }] }), /no está en la lista/);
assert.throws(() => G.registrarCitas('432100', { fecha: '2026-11-10', filas: [{ agenda: 'GRI', citados: 7 }] }), /futura/);
assert.throws(() => G.registrarCitas('1', { fecha: '2026-11-06', filas: [] }), /PIN/);
G.registrarCitas('432100', { fecha: '2026-11-05', filas: [{ agenda: 'gri', citados: 7, faltaron: 1 }, { agenda: 'Gri2', citados: 7, faltaron: 0 }] });
G.registrarCitas('432100', { fecha: '2026-11-06', filas: [{ agenda: 'GRI', citados: 7, faltaron: 5 }] });
// Corrección del mismo día: vale la última
p = G.registrarCitas('432100', { fecha: '2026-11-06', filas: [{ agenda: 'GRI', citados: 7, faltaron: 3 }, { agenda: 'Gri2', citados: 7, faltaron: 1 }] });
const a = n => p.asistencia.agendas.find(x => x.agenda === n);
// GRI: 14 citados, 4 faltas → 71,4 %; media 7 → citar 7 / 0,714 = 9,8 → 10
assert.strictEqual(a('GRI').citados, 14);
assert.strictEqual(a('GRI').faltaron, 4);
assert.strictEqual(a('GRI').asistencia, 71.4);
assert.strictEqual(a('GRI').citarPara, 10);
// Gri2: 14 citados, 1 falta → 92,9 % → citar 8
assert.strictEqual(a('Gri2').asistencia, 92.9);
assert.strictEqual(a('Gri2').citarPara, 8);
assert.strictEqual(p.asistencia.total.asistencia, 82.1);
assert.strictEqual(p.asistencia.recientes.length, 4);
// Sin faltas: citar lo mismo
G.registrarCitas('432100', { fecha: '2026-11-04', filas: [{ agenda: 'Gri2', citados: 7, faltaron: 0 }] });

// Resumen por correo con la asistencia
G.guardarCampana('432100', { inicio: '2026-09-28', fin: '2026-12-31', correo: 'c@ejemplo.org', grupos: [
  { nombre: '65 o más', vacunas: 'Efluelda', desde: '2026-10-19', poblacion: 1000, objetivo: 75, techo: 60, activo: true }] });
assert.deepStrictEqual(Array.from(G.prevision('432100').agendasConfig), ['GRI', 'Gri2'], 'guardar sin agendas no las borra');
G.probarResumen('432100');
const html = E.correos[E.correos.length - 1].htmlBody;
assert.ok(/Asistencia a las citas/.test(html) && /Al final/.test(html));
console.log('OK techo y asistencia: ritmo que se frena, cobertura final, consumo y sobrecitación');
