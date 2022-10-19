import {
  EMOJI_DEPRECATED,
  EMOJI_FIXABLE,
  EMOJI_HAS_SUGGESTIONS,
  EMOJI_CONFIG,
  EMOJI_REQUIRES_TYPE_CHECKING,
  EMOJI_TYPE,
} from './emojis.js';
import { COLUMN_TYPE, ConfigEmojis, Plugin } from './types.js';
import { RULE_TYPE_MESSAGES_LEGEND, RULE_TYPES } from './rule-type.js';

/**
 * An object containing the legends for each column (as a string or function to generate the string).
 */
const LEGENDS: {
  [key in COLUMN_TYPE]:
    | string
    | undefined // For no legend.
    | ((data: {
        plugin: Plugin;
        configEmojis: ConfigEmojis;
        ignoreConfig: string[];
        urlConfigs?: string;
      }) => string[]);
} = {
  // Legends are included for each config. A generic config legend is also included if there are multiple configs.
  [COLUMN_TYPE.CONFIGS]: ({
    plugin,
    configEmojis,
    urlConfigs,
    ignoreConfig,
  }: {
    plugin: Plugin;
    configEmojis: ConfigEmojis;
    ignoreConfig: string[];
    urlConfigs?: string;
  }) => {
    /* istanbul ignore next -- this shouldn't happen */
    if (!plugin.configs) {
      throw new Error(
        'Should not be attempting to display configs column when there are no configs.'
      );
    }
    const configNames = Object.keys(plugin.configs);

    // Add link to configs documentation if provided.
    const configsLinkOrWord = urlConfigs
      ? `[Configurations](${urlConfigs})`
      : 'Configurations';
    const configLinkOrWord = urlConfigs
      ? `[configuration](${urlConfigs})`
      : 'configuration';

    const configNamesWithoutIgnored = configNames.filter(
      (configName) => !ignoreConfig?.includes(configName)
    );

    const legends = [];
    if (
      configNamesWithoutIgnored.length > 1 ||
      !configEmojis.find((configEmoji) =>
        configNamesWithoutIgnored?.includes(configEmoji.config)
      )?.emoji
    ) {
      // Generic config emoji will be used if the plugin has multiple configs or the sole config has no emoji.
      legends.push(`${EMOJI_CONFIG} ${configsLinkOrWord} enabled in.`);
    }
    legends.push(
      ...configNamesWithoutIgnored.flatMap((configName) => {
        const emoji = configEmojis.find(
          (configEmoji) => configEmoji.config === configName
        )?.emoji;
        if (!emoji) {
          // No legend for this config as it has no emoji.
          return [];
        }
        return [
          `${emoji} Enabled in the \`${configName}\` ${configLinkOrWord}.`,
        ];
      })
    );
    return legends;
  },

  // Legends are included for each rule type present.
  [COLUMN_TYPE.TYPE]: ({ plugin }: { plugin: Plugin }) => {
    /* istanbul ignore next -- this shouldn't happen */
    if (!plugin.rules) {
      throw new Error(
        'Should not be attempting to display type column when there are no rules.'
      );
    }
    const rules = plugin.rules;

    const legends: string[] = [];

    let hasAnyRuleType = false;
    for (const ruleType of RULE_TYPES) {
      const hasThisRuleType = Object.values(rules).some(
        (rule) => typeof rule === 'object' && rule.meta.type === ruleType
      );
      if (hasThisRuleType) {
        if (!hasAnyRuleType) {
          hasAnyRuleType = true;
          // Add general rule type emoji first.
          legends.push(`${EMOJI_TYPE} The type of rule.`);
        }
        legends.push(RULE_TYPE_MESSAGES_LEGEND[ruleType]);
      }
    }

    return legends;
  },

  // Simple strings.
  [COLUMN_TYPE.DEPRECATED]: `${EMOJI_DEPRECATED} Deprecated.`,
  [COLUMN_TYPE.DESCRIPTION]: undefined,
  [COLUMN_TYPE.FIXABLE]: `${EMOJI_FIXABLE} Automatically fixable by the [\`--fix\` CLI option](https://eslint.org/docs/user-guide/command-line-interface#--fix).`,
  [COLUMN_TYPE.HAS_SUGGESTIONS]: `${EMOJI_HAS_SUGGESTIONS} Manually fixable by [editor suggestions](https://eslint.org/docs/developer-guide/working-with-rules#providing-suggestions).`,
  [COLUMN_TYPE.NAME]: undefined,
  [COLUMN_TYPE.REQUIRES_TYPE_CHECKING]: `${EMOJI_REQUIRES_TYPE_CHECKING} Requires type information.`,
};

export function generateLegend(
  columns: Record<COLUMN_TYPE, boolean>,
  plugin: Plugin,
  configEmojis: ConfigEmojis,
  ignoreConfig: string[],
  urlConfigs?: string
) {
  return (Object.entries(columns) as [COLUMN_TYPE, boolean][])
    .flatMap(([columnType, enabled]) => {
      if (!enabled) {
        // This column is turned off.
        return [];
      }
      const legendStrOrFn = LEGENDS[columnType];
      if (!legendStrOrFn) {
        // No legend specified for this column.
        return [];
      }
      return typeof legendStrOrFn === 'function'
        ? legendStrOrFn({
            plugin,
            configEmojis,
            urlConfigs,
            ignoreConfig,
          })
        : [legendStrOrFn];
    })
    .join('\\\n'); // Back slash ensures these end up displayed on separate lines.
}
