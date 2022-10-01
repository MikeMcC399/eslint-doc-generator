import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import prettier from 'prettier'; // eslint-disable-line node/no-extraneous-import -- prettier is included by eslint-plugin-square
import { getAllNamedOptions, hasOptions } from './rule-options.js';
import {
  loadPlugin,
  getPluginPrefix,
  getPluginPrettierConfig,
} from './package-json.js';
import { updateRulesList } from './rule-list.js';
import { generateRuleHeaderLines } from './rule-notices.js';
import { END_RULE_HEADER_MARKER } from './markers.js';
import type { RuleModule, RuleDetails } from './types.js';

function format(str: string, pluginPath: string): string {
  return prettier.format(str, {
    ...getPluginPrettierConfig(pluginPath),
    parser: 'markdown',
  });
}

/**
 * Replace the header of a doc up to and including the specified marker.
 * Insert at beginning if header doesn't exist.
 * @param lines - lines of doc
 * @param newHeaderLines - lines of new header including marker
 * @param marker - marker to indicate end of header
 */
function replaceOrCreateHeader(
  lines: string[],
  newHeaderLines: string[],
  marker: string
) {
  const markerLineIndex = lines.indexOf(marker);

  if (markerLineIndex === -1 && lines.length > 0 && lines[0].startsWith('# ')) {
    // No marker present so delete any existing title before we add the new one.
    lines.splice(0, 1);
  }

  // Replace header section (or create at top if missing).
  lines.splice(0, markerLineIndex + 1, ...newHeaderLines);
}

/**
 * Ensure a rule doc contains (or doesn't contain) some particular content.
 * Upon failure, output the failure and set a failure exit code.
 * @param ruleName - which rule we are checking
 * @param contents - the rule doc's contents
 * @param content - the content we are checking for
 * @param expected - whether the content should be present or not present
 */
function expectContent(
  ruleName: string,
  contents: string,
  content: string,
  expected: boolean
) {
  if (contents.includes(content) !== expected) {
    console.error(
      `\`${ruleName}\` rule doc should ${
        expected ? '' : 'not '
      }have included: ${content}`
    );
    process.exitCode = 1;
  }
}

export async function generate(path: string) {
  const plugin = await loadPlugin(path);
  const pluginPrefix = getPluginPrefix(path);

  const pathTo = {
    readme: resolve(path, 'README.md'),
    rules: resolve(path, 'src', 'rules'),
    docs: resolve(path, 'docs'),
  };

  // Gather details about rules.
  const details: RuleDetails[] = Object.entries(plugin.rules)
    .filter((nameAndRule): nameAndRule is [string, Required<RuleModule>] =>
      Boolean(nameAndRule[1].meta)
    )
    .map(
      ([name, rule]): RuleDetails => ({
        name,
        description: rule.meta.docs.description,
        fixable: rule.meta.fixable
          ? ['code', 'whitespace'].includes(rule.meta.fixable)
          : false,
        hasSuggestions: rule.meta.hasSuggestions ?? false,
        requiresTypeChecking: rule.meta.docs.requiresTypeChecking ?? false,
        deprecated: rule.meta.deprecated ?? false,
        schema: rule.meta.schema,
      })
    );

  // Update rule doc for each rule.
  for (const { name, description, schema } of details) {
    const pathToDoc = join(pathTo.docs, 'rules', `${name}.md`);
    const contents = readFileSync(pathToDoc).toString();
    const lines = contents.split('\n');

    // Regenerate the header (title/notices) of each rule doc.
    const newHeaderLines = generateRuleHeaderLines(
      description,
      name,
      plugin,
      pluginPrefix
    );

    replaceOrCreateHeader(lines, newHeaderLines, END_RULE_HEADER_MARKER);

    writeFileSync(pathToDoc, format(lines.join('\n'), path));

    // Check for potential issues with the rule doc.

    // "Options" section.
    expectContent(name, contents, '## Options', hasOptions(schema));
    for (const namedOption of getAllNamedOptions(schema)) {
      expectContent(name, contents, namedOption, true); // Each rule option is mentioned.
    }
  }

  // Update the rules list in the README.
  let readme = readFileSync(pathTo.readme, 'utf8');
  readme = updateRulesList(details, readme, plugin, pluginPrefix);
  writeFileSync(pathTo.readme, format(readme, path), 'utf8');
}