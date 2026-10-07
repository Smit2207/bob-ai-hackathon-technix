import { defineConfig } from 'vitest/config';
import path from 'node:path';
import fs from 'node:fs';

function toDir(importer: string): string | null {
  try {
    if (importer.startsWith('file://')) {
      return path.dirname(decodeURIComponent(new URL(importer).pathname));
    }
    if (path.isAbsolute(importer)) {
      return path.dirname(importer);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * The shared clinical engine uses ESM `.js` import specifiers (for Node
 * compatibility). Vitest/Vite needs to resolve those to the actual `.ts`
 * source files. This plugin rewrites `.js` → `.ts` when the `.ts` file
 * exists and the `.js` file does not.
 */
function tsExtensionResolution() {
  return {
    name: 'ts-extension-resolution',
    enforce: 'pre' as const,
    resolveId(source: string, importer: string | undefined) {
      if (!importer) return null;
      if (!source.endsWith('.js')) return null;
      if (!source.startsWith('.') && !path.isAbsolute(source)) return null;
      const dir = toDir(importer);
      if (!dir) return null;
      const resolved = path.resolve(dir, source);
      const tsCandidate = resolved.replace(/\.js$/, '.ts');
      if (fs.existsSync(tsCandidate) && !fs.existsSync(resolved)) {
        return tsCandidate;
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [tsExtensionResolution()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false,
  },
});