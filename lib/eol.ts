import { EOL } from 'node:os';
import { resolve } from 'node:path';
import editorconfig from 'editorconfig';
import type { Cache as EditorConfigCache } from 'editorconfig';

type EndOfLine = '\n' | '\r\n';

type PrettierEndOfLineResult =
  | { kind: 'explicit'; value: EndOfLine }
  | { kind: 'implicit' }
  | { kind: 'none' };

export type EndOfLineResolver = {
  /**
   * Explicit config only: EditorConfig `end_of_line`, then Prettier
   * `endOfLine` set to `lf`/`crlf`. `auto`/unset Prettier → undefined.
   */
  getExplicitEndOfLine: (filePath: string) => Promise<EndOfLine | undefined>;
  /**
   * #803 back-compat: Prettier config is resolvable but `endOfLine` is unset
   * or `auto` → LF. Deprecated; planned for removal in the next major.
   */
  getImplicitEndOfLine: (filePath: string) => Promise<'\n' | undefined>;
  /**
   * Write-time precedence: explicit → detect(contents) → implicit → os.EOL.
   * New/empty docs pass `contents` as undefined (skip detection).
   */
  resolve: (
    filePath: string,
    contents: string | undefined,
  ) => Promise<EndOfLine>;
};

/**
 * Create a memoized end-of-line resolver scoped to one `generate()` run.
 * Cache keys are absolute file paths so sibling `.md`/`.mdx` files can differ.
 */
export function createEndOfLineResolver(): EndOfLineResolver {
  const explicitCache = new Map<string, Promise<EndOfLine | undefined>>();
  const implicitCache = new Map<string, Promise<'\n' | undefined>>();
  const prettierCache = new Map<string, Promise<PrettierEndOfLineResult>>();
  /** Shared across files so EditorConfig does not re-read the same files. */
  const editorConfigFileCache: EditorConfigCache = new Map();

  async function getExplicitEndOfLine(
    filePath: string,
  ): Promise<EndOfLine | undefined> {
    const absolutePath = resolve(filePath);
    let cached = explicitCache.get(absolutePath);
    if (!cached) {
      cached = resolveExplicitEndOfLine(absolutePath);
      explicitCache.set(absolutePath, cached);
    }
    const result = await cached;
    return result;
  }

  async function getImplicitEndOfLine(
    filePath: string,
  ): Promise<'\n' | undefined> {
    const absolutePath = resolve(filePath);
    let cached = implicitCache.get(absolutePath);
    if (!cached) {
      cached = resolveImplicitEndOfLine(absolutePath);
      implicitCache.set(absolutePath, cached);
    }
    const result = await cached;
    return result;
  }

  async function resolveExplicitEndOfLine(
    absolutePath: string,
  ): Promise<EndOfLine | undefined> {
    const fromEditorConfig = await getEndOfLineFromEditorConfig(
      absolutePath,
      editorConfigFileCache,
    );
    if (fromEditorConfig !== undefined) {
      return fromEditorConfig;
    }

    const prettier = await getPrettierEndOfLine(absolutePath, prettierCache);
    return prettier.kind === 'explicit' ? prettier.value : undefined;
  }

  async function resolveImplicitEndOfLine(
    absolutePath: string,
  ): Promise<'\n' | undefined> {
    // Explicit EditorConfig already handled at the explicit tier; do not treat
    // it as an implicit Prettier default.
    const fromEditorConfig = await getEndOfLineFromEditorConfig(
      absolutePath,
      editorConfigFileCache,
    );
    if (fromEditorConfig !== undefined) {
      return undefined;
    }

    const prettier = await getPrettierEndOfLine(absolutePath, prettierCache);
    return prettier.kind === 'implicit' ? '\n' : undefined;
  }

  async function resolveFileEndOfLine(
    filePath: string,
    contents: string | undefined,
  ): Promise<EndOfLine> {
    return (
      (await getExplicitEndOfLine(filePath)) ??
      (contents === undefined ? undefined : detectEndOfLine(contents)) ??
      (await getImplicitEndOfLine(filePath)) ??
      getFallbackEndOfLine()
    );
  }

  return {
    getExplicitEndOfLine,
    getImplicitEndOfLine,
    resolve: resolveFileEndOfLine,
  };
}

async function getEndOfLineFromEditorConfig(
  filePath: string,
  cache: EditorConfigCache,
): Promise<EndOfLine | undefined> {
  const editorConfigProps = await editorconfig.parse(filePath, { cache });

  if (editorConfigProps.end_of_line === 'lf') {
    return '\n';
  }

  if (editorConfigProps.end_of_line === 'crlf') {
    return '\r\n';
  }

  return undefined;
}

async function getPrettierEndOfLine(
  filePath: string,
  cache: Map<string, Promise<PrettierEndOfLineResult>>,
): Promise<PrettierEndOfLineResult> {
  let cached = cache.get(filePath);
  if (!cached) {
    cached = resolvePrettierEndOfLine(filePath);
    cache.set(filePath, cached);
  }
  const result = await cached;
  return result;
}

async function resolvePrettierEndOfLine(
  filePath: string,
): Promise<PrettierEndOfLineResult> {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports -- prettier is an optional peer dependency, must be dynamically imported
  let prettier: typeof import('prettier') | undefined;
  try {
    prettier = await import('prettier');
  } catch {
    /* istanbul ignore next */
    return { kind: 'none' };
  }

  const prettierOptions = await prettier.resolveConfig(filePath);

  if (prettierOptions === null) {
    return { kind: 'none' };
  }

  if (prettierOptions.endOfLine === 'lf') {
    return { kind: 'explicit', value: '\n' };
  }

  if (prettierOptions.endOfLine === 'crlf') {
    return { kind: 'explicit', value: '\r\n' };
  }

  // Config present but endOfLine unset or `auto` — #803 implicit LF default.
  return { kind: 'implicit' };
}

/**
 * Detect the predominant end of line in the given file contents.
 * Returns undefined if the contents have no line breaks.
 */
export function detectEndOfLine(contents: string): EndOfLine | undefined {
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

/** Fallback when there is no config and no detectable end of line. */
export function getFallbackEndOfLine(): EndOfLine {
  return getNodeEOL();
}

/* istanbul ignore next */
/** `EOL` is typed as `string`, so we perform run-time validation to be safe. */
function getNodeEOL(): EndOfLine {
  if (EOL === '\n' || EOL === '\r\n') {
    return EOL;
  }

  throw new Error(
    `Failed to detect the end-of-line constant from the JavaScript runtime: ${EOL}`,
  );
}
