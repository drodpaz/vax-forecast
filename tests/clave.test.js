// Clave del equipo (v1.2): opcional; con ella, el contador solo funciona con el enlace …/exec?k=CLAVE.
'use strict';
const assert = require('assert');
const { crearEntorno } = require('./arnes');

const AHORA = Date.UTC(2026, 10, 9, 10, 0, 0);
const E = crearEntorno({ ahora: AHORA });
const G = E.G;
const URL = 'https://script.google.com/macros/s/X/exec';

G.doGet({ parameter: { p: 'panel' } });
G.completarAsistente('1234', { centro: 'CS Ejemplo', pin: 'clave123', vacunas: ['Gripe'], profesionales: ['Ana'] });
const toque = id => ({ id: id, momento: AHORA, profesional: 'Ana', turno: 'Mañana', vacuna: 'Gripe', cambio: 1 });
const api = (prm) => JSON.parse(G.doGet({ parameter: prm }));
const post = (d) => JSON.parse(G.doPost({ postData: { contents: JSON.stringify(d) } }));

// Sin clave (lo de siempre): todo funciona sin k
assert.strictEqual(G.resumen('clave123').config.clave, '');
assert.strictEqual(G.resumen('clave123').urlContador, URL);
assert.deepStrictEqual(G.datosContador().vacunas, ['Gripe']);
assert.deepStrictEqual(Array.from(G.registrar([toque('a1')]).guardados), ['a1']);

// Poner la clave desde el panel
const cfg = { centro: 'CS Ejemplo', enfermeras: 6, huecos: 12, dias: 5, porProfesional: false, profesionales: ['Ana'],
  vacunas: [{ nombre: 'Gripe', necesarias: 0, minimo: 0, activa: true }] };
assert.throws(() => G.guardarConfig('clave123', Object.assign({}, cfg, { clave: 'abc' })), /entre 6 y 40/);
assert.throws(() => G.guardarConfig('clave123', Object.assign({}, cfg, { clave: 'con espacio' })), /entre 6 y 40/);
assert.throws(() => G.guardarConfig('clave123', Object.assign({}, cfg, { clave: '=1+1abc' })), /entre 6 y 40/);
let r = G.guardarConfig('clave123', Object.assign({}, cfg, { clave: 'milla7x2' }));
assert.strictEqual(r.claveCambiada, true);
assert.strictEqual(G.resumen('clave123').config.clave, 'milla7x2');
assert.strictEqual(G.resumen('clave123').urlContador, URL + '?k=milla7x2', 'el enlace que copia el panel lleva la clave');
// Guardar otra cosa sin tocar la clave no la cambia
r = G.guardarConfig('clave123', Object.assign({}, cfg, { enfermeras: 7 }));
assert.strictEqual(r.claveCambiada, false);
assert.strictEqual(G.resumen('clave123').config.clave, 'milla7x2');

// Sin la clave buena: no se apunta nada ni se ven los nombres del equipo
const filas = E.sheets['Registro'].getLastRow();
assert.throws(() => G.datosContador(), /Clave del equipo incorrecta/);
assert.throws(() => G.datosContador('otra00'), /Clave del equipo incorrecta/);
assert.throws(() => G.misHoy('Ana'), /Clave del equipo incorrecta/);
assert.throws(() => G.registrar([toque('b1')]), /Clave del equipo incorrecta/);
assert.throws(() => G.registrar([], 'mala00'), /Clave del equipo incorrecta/, 'tampoco con la lista vacía');
assert.strictEqual(E.sheets['Registro'].getLastRow(), filas, 'no se ha guardado nada');
// Lo mismo por la API del contador flotante
assert.match(api({ api: 'datos' }).error, /Clave del equipo/);
assert.match(post({ accion: 'registrar', lista: [toque('b2')] }).error, /Clave del equipo/);
assert.strictEqual(E.sheets['Registro'].getLastRow(), filas);

// Con la clave buena: funciona igual que antes
assert.deepStrictEqual(G.datosContador('milla7x2').profesionales, ['Ana']);
assert.deepStrictEqual(Array.from(G.registrar([toque('c1')], 'milla7x2').guardados), ['c1']);
assert.strictEqual(G.misHoy('Ana', 'milla7x2').mias['Gripe'], 2);
assert.deepStrictEqual(api({ api: 'datos', k: 'milla7x2' }).vacunas, ['Gripe']);
assert.deepStrictEqual(post({ accion: 'registrar', lista: [toque('c2')], k: 'milla7x2' }).guardados, ['c2']);
assert.strictEqual(api({ api: 'hoy', profesional: 'Ana', k: 'milla7x2' }).mias['Gripe'], 3);

// El panel no depende de la clave (va con el PIN)
assert.ok(G.resumen('clave123').porDia.length);

// Cambiarla: el enlace viejo deja de valer al momento
G.guardarConfig('clave123', Object.assign({}, cfg, { clave: 'nueva_99' }));
assert.throws(() => G.registrar([toque('d1')], 'milla7x2'), /Clave del equipo incorrecta/);
assert.deepStrictEqual(Array.from(G.registrar([toque('d1')], 'nueva_99').guardados), ['d1']);

// Quitarla: vuelve a funcionar sin k
G.guardarConfig('clave123', Object.assign({}, cfg, { clave: '' }));
assert.deepStrictEqual(Array.from(G.registrar([toque('e1')]).guardados), ['e1']);
assert.strictEqual(G.resumen('clave123').urlContador, URL);

console.log('OK clave del equipo: poner, comprobar, cambiar y quitar');
