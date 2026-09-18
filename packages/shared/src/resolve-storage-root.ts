import { existsSync } from 'fs';
import path from 'path';

export function resolveMonorepoRoot(startDir = process.cwd()): string {
  let dir = path.resolve(startDir);
  for (;;) {
    if (
      existsSync(path.join(dir, 'package-lock.json')) &&
      existsSync(path.join(dir, 'apps'))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(startDir);
    dir = parent;
  }
}

/** Resolve STORAGE_LOCAL_ROOT so API and worker share the same folder. */
export function resolveStorageRoot(raw: string | undefined): string {
  const value = raw?.trim() || '.data/media';
  if (path.isAbsolute(value)) return path.normalize(value);
  return path.resolve(resolveMonorepoRoot(), value);
}
