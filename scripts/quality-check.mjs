import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();

async function collectFiles(directory, predicate) {
  const absoluteDirectory = path.join(root, directory);
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(relativePath, predicate));
    } else if (entry.isFile() && predicate(relativePath)) {
      files.push(relativePath);
    }
  }

  return files;
}

const failures = [];
const jsonFiles = await collectFiles('content', file => file.endsWith('.json'));

if (jsonFiles.length === 0) {
  failures.push('Aucun fichier JSON trouvé dans content/.');
} else {
  for (const file of jsonFiles) {
    try {
      JSON.parse(await readFile(path.join(root, file), 'utf8'));
    } catch (error) {
      failures.push(`JSON invalide : ${file} — ${error.message}`);
    }
  }
}

const sourceFiles = [
  ...await collectFiles('src', file => file.endsWith('.js') || file.endsWith('.mjs')),
  ...await collectFiles('scripts', file => file.endsWith('.js') || file.endsWith('.mjs')),
  'sw.js'
];

for (const file of sourceFiles) {
  const result = spawnSync(process.execPath, ['--check', file], {
    cwd: root,
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    failures.push(`Syntaxe JavaScript invalide : ${file}\n${result.stderr || result.stdout}`);
  }
}

console.log(`Contrôle JSON : ${jsonFiles.length} fichier(s) analysé(s).`);
console.log(`Contrôle JavaScript : ${sourceFiles.length} fichier(s) analysé(s).`);

if (failures.length > 0) {
  console.error(`\nÉCHEC : ${failures.length} problème(s) détecté(s).\n`);
  for (const failure of failures) console.error(`- ${failure}\n`);
  process.exitCode = 1;
} else {
  console.log('\nSUCCÈS : les fichiers JSON et JavaScript passent les contrôles.');
}
