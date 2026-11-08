// Ejecuta todas las pruebas: node tests/ejecutar.js
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const pruebas = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort();
let fallos = 0;
for (const f of pruebas) {
  try {
    const salida = execFileSync(process.execPath, [path.join(__dirname, f)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    process.stdout.write('✔ ' + f + '\n' + salida.trimEnd().replace(/^/gm, '   ') + '\n');
  } catch (e) {
    fallos++;
    process.stdout.write('✘ ' + f + '\n' + String(e.stdout || '') + String(e.stderr || e.message) + '\n');
  }
}
console.log(fallos ? fallos + ' de ' + pruebas.length + ' archivos con fallos' : 'Todo bien: ' + pruebas.length + ' archivos de pruebas');
process.exit(fallos ? 1 : 0);
