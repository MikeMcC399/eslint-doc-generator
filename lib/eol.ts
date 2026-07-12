import { EOL } from 'node:os';
import { dirname, resolve } from 'node:path';
import editorconfig from 'editorconfig';

/** Memoize by directory — rule docs share a folder. */
const configuredEndOfLineCache = new Map<
  string,
  Promise<'\n' | '\r\n' | undefined>
>();

/**
 * Resolve an explicitly configured end of line for the given file path.
 * Only EditorConfig `end_of_line` and an explicitly set Prettier `endOfLine`
 * (`lf` or `crlf`) count as configured. A Prettier config without `endOfLine`
 * (or with `auto`) does not imply LF — returns undefined so callers can fall
 * through to per-file detection.
 */
export async function getConfiguredEndOfLine(
  filePath: string,
): Promise<'\n' | '\r\n' | undefined> {
  const absolutePath = resolve(filePath);
  const cacheKey = dirname(absolutePath);

  let cached = configuredEndOfLineCache.get(cacheKey);
  if (!cached) {
    cached = resolveConfiguredEndOfLine(absolutePath);
    configuredEndOfLineCache.set(cacheKey, cached);
  }
  const result = await cached;
  return result;
}

async function resolveConfiguredEndOfLine(
  absolutePath: string,
): Promise<'\n' | '\r\n' | undefined> {
  const fromEditorConfig = await getEndOfLineFromEditorConfig(absolutePath);
  if (fromEditorConfig !== undefined) {
    return fromEditorConfig;
  }
  return getEndOfLineFromPrettierConfig(absolutePath);
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

async function getEndOfLineFromPrettierConfig(
  filePath: string,
): Promise<'\n' | '\r\n' | undefined> {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports -- prettier is an optional peer dependency, must be dynamically imported
  let prettier: typeof import('prettier') | undefined;
  try {
    prettier = await import('prettier');
  } catch {
    /* istanbul ignore next */
    return undefined;
  }

  const prettierOptions = await prettier.resolveConfig(filePath);

  if (prettierOptions === null) {
    return undefined;
  }

  if (prettierOptions.endOfLine === 'lf') {
    return '\n';
  }

  if (prettierOptions.endOfLine === 'crlf') {
    return '\r\n';
  }

  // Unset or `auto` — not an explicit end of line; fall through to detection.
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
