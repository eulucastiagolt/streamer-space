import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

const DEFAULT_TOKEN_FILE = join(process.cwd(), 'data', 'overlay-token.txt');

/**
 * Returns the persistent overlay token.
 * Reads from OVERLAY_TOKEN env, or reads from disk (data/overlay-token.txt),
 * or generates a new secure random 32-hex-character token and persists it.
 */
export function getOrCreateOverlayToken(customPath?: string): string {
  if (process.env.OVERLAY_TOKEN && process.env.OVERLAY_TOKEN.trim().length >= 16) {
    return process.env.OVERLAY_TOKEN.trim();
  }

  const filePath = customPath || DEFAULT_TOKEN_FILE;

  if (existsSync(filePath)) {
    try {
      const content = readFileSync(filePath, 'utf-8').trim();
      if (content && content.length >= 16) {
        return content;
      }
    } catch {
      // Ignore read errors and regenerate
    }
  }

  const newToken = randomBytes(16).toString('hex');
  try {
    const dir = join(filePath, '..');
    mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, newToken, 'utf-8');
  } catch {
    // If writing fails (e.g. read-only system), return in-memory token
  }

  return newToken;
}
