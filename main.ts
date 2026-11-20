// main.ts — hands SOLMARA in: copies game/ and screenshots/ to the output
// directory and writes dossier.json with the kit's buildDossier.
// Node 22, standard library only, deterministic across runs.
import { buildDossier } from './vendor/makefun-game.ts';
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

function fail(message: string): never {
  console.error(`main.ts: ${message}`);
  process.exit(1);
}

const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');
if (!existsSync(gameDir)) fail('game/ is missing from the repository');
if (!existsSync(join(gameDir, 'index.html'))) fail('game/index.html is missing');
if (!existsSync(shotsDir)) fail('screenshots/ is missing from the repository');

// The grader hands us an empty writable output dir (mounted /output); only
// create it, never remove it — removing it needs write access to its parent,
// which is read-only in the grader, and rmSync throws EACCES there.
mkdirSync(outDir, { recursive: true });

cpSync(gameDir, join(outDir, 'game'), { recursive: true });
cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`main.ts: wrote ${outDir} (dossier ${dossier.length} bytes)`);
