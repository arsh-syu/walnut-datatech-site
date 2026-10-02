// Reads .env (KEY=value, optional single or double quotes, # comments). Never committed — see .gitignore.

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

export function loadEnv(file = join(projectRoot, '.env')) {
  const env = {};
  if (!existsSync(file)) return env;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match || line.trim().startsWith('#')) continue;
    let value = match[2];
    const quoted = value.match(/^(['"])(.*)\1$/);
    if (quoted) value = quoted[2];
    env[match[1]] = value;
  }
  return env;
}
