import { EOL } from 'node:os';
import { dirname, resolve } from 'node:path';
import editorconfig from 'editorconfig';

/** Memoize by directory — rule docs share a folder. */
const configuredEndOfLineCache = new Map<
  string,
  Promise<'\n' | '\r\n' | undefined>
>();

/**
 * Resolve an explicitly configured end of line for the given file path from
 * EditorConfig `end_of_line`. Returns undefined when unset so callers can fall
 * through to per-file detection.
 *
 * Prettier config is intentionally not read here — run Prettier via
 * `postprocess` (or a follow-up script) instead of interpreting its options.
 */
export async function getConfiguredEndOfLine(
  filePath: string,
): Promise<'\n' | '\r\n' | undefined> {
  const absolutePath = resolve(filePath);
  const cacheKey = dirname(absolutePath);

  let cached = configuredEndOfLineCache.get(cacheKey);
  if (!cached) {
    cached = getEndOfLineFromEditorConfig(absolutePath);
    configuredEndOfLineCache.set(cacheKey, cached);
  }
  const result = await cached;
  return result;
}

async function getEndOfLineFromEditorConfig(
  filePath: string,
): Promise<'\n' | '\r\n' | undefined> {
  const editorConfigProps = await editorconfig.parse(filePath);

  if (editorConfigProps.end_of_line === 'lf') {
    return '\n';
  }

  if (editorConfigProps.end_of_line === 'crlf') {
    return '\r\n';
  }

  return undefined;
}

/**
 * Detect the predominant end of line in the given file contents.
 * Returns undefined if the contents have no line breaks.
 */
export function detectEndOfLine(contents: string): '\n' | '\r\n' | undefined {
  const crlfCount = contents.match(/\r\n/gu)?.length ?? 0;
  const lfCount = contents.match(/(?<!\r)\n/gu)?.length ?? 0;

  if (crlfCount === 0 && lfCount === 0) {
    return undefined;
  }

  return crlfCount > lfCount ? '\r\n' : '\n';
}

/**
 * Convert all line endings in the given contents to the given end of line.
 */
export function normalizeEndOfLine(
  contents: string,
  endOfLine: string,
): string {
  return contents.replaceAll(/\r\n|[\r\n]/gu, endOfLine);
}

/** Fallback when there is no explicit config and no detectable end of line. */
export function getFallbackEndOfLine(): '\n' | '\r\n' {
  return getNodeEOL();
}

/* istanbul ignore next */
/** `EOL` is typed as `string`, so we perform run-time validation to be safe. */
function getNodeEOL(): '\n' | '\r\n' {
  if (EOL === '\n' || EOL === '\r\n') {
    return EOL;
  }

  throw new Error(
    `Failed to detect the end-of-line constant from the JavaScript runtime: ${EOL}`,
  );
}
