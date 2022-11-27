import type { RuleDocTitleFormat } from './rule-doc-title-format.js';
import type { TSESLint, JSONSchema } from '@typescript-eslint/utils';

// Standard ESLint types.

export type RuleModule = TSESLint.RuleModule<string, unknown[]>;

export type Rules = TSESLint.Linter.RulesRecord;

export type RuleSeverity = TSESLint.Linter.RuleLevel;

export type Config = TSESLint.Linter.Config;

export type Plugin = TSESLint.Linter.Plugin;

// Custom types.

export const SEVERITY_ERROR = new Set<RuleSeverity>([2, 'error']);
export const SEVERITY_WARN = new Set<RuleSeverity>([1, 'warn']);
export const SEVERITY_OFF = new Set<RuleSeverity>([0, 'off']);

export enum SEVERITY_TYPE {
  'error' = 'error',
  'warn' = 'warn',
  'off' = 'off',
}

export const SEVERITY_TYPE_TO_SET: {
  [key in SEVERITY_TYPE]: Set<TSESLint.Linter.RuleLevel>;
} = {
  [SEVERITY_TYPE.error]: SEVERITY_ERROR,
  [SEVERITY_TYPE.warn]: SEVERITY_WARN,
  [SEVERITY_TYPE.off]: SEVERITY_OFF,
};

export type ConfigsToRules = Record<string, Rules>;

export interface RuleDetails {
  name: string;
  description?: string; // Rule might not have a description.
  fixable: boolean;
  hasSuggestions: boolean;
  requiresTypeChecking: boolean;
  deprecated: boolean;
  schema: JSONSchema.JSONSchema4;
  type?: string; // Rule might not have a type.
}

/**
 * Some configs may have an emoji defined.
 */
export type ConfigEmojis = { config: string; emoji: string }[];

/**
 * Rule doc notices.
 */
export enum NOTICE_TYPE {
  CONFIGS = 'configs',
  DEPRECATED = 'deprecated',
  FIXABLE = 'fixable',
  FIXABLE_AND_HAS_SUGGESTIONS = 'fixableAndHasSuggestions', // Consolidated notice for space-saving.
  HAS_SUGGESTIONS = 'hasSuggestions',
  OPTIONS = 'options',
  REQUIRES_TYPE_CHECKING = 'requiresTypeChecking',
  TYPE = 'type',
}

/**
 * Rule list columns.
 */
export enum COLUMN_TYPE {
  CONFIGS_ERROR = 'configsError',
  CONFIGS_OFF = 'configsOff',
  CONFIGS_WARN = 'configsWarn',
  DEPRECATED = 'deprecated',
  DESCRIPTION = 'description',
  FIXABLE = 'fixable',
  FIXABLE_AND_HAS_SUGGESTIONS = 'fixableAndHasSuggestions', // Consolidated column for space-saving.
  HAS_SUGGESTIONS = 'hasSuggestions',
  NAME = 'name',
  OPTIONS = 'options',
  REQUIRES_TYPE_CHECKING = 'requiresTypeChecking',
  TYPE = 'type',
}

export enum OPTION_TYPE {
  CHECK = 'check',
  CONFIG_EMOJI = 'configEmoji',
  IGNORE_CONFIG = 'ignoreConfig',
  IGNORE_DEPRECATED_RULES = 'ignoreDeprecatedRules',
  INIT_RULE_DOCS = 'initRuleDocs',
  PATH_RULE_DOC = 'pathRuleDoc',
  PATH_RULE_LIST = 'pathRuleList',
  RULE_DOC_NOTICES = 'ruleDocNotices',
  RULE_DOC_SECTION_EXCLUDE = 'ruleDocSectionExclude',
  RULE_DOC_SECTION_INCLUDE = 'ruleDocSectionInclude',
  RULE_DOC_SECTION_OPTIONS = 'ruleDocSectionOptions',
  RULE_DOC_TITLE_FORMAT = 'ruleDocTitleFormat',
  RULE_LIST_COLUMNS = 'ruleListColumns',
  SPLIT_BY = 'splitBy',
  URL_CONFIGS = 'urlConfigs',
  URL_RULE_DOC = 'urlRuleDoc',
  POSTPROCESS = 'postprocess',
}

// JSDocs for options should be kept in sync with README.md and the CLI runner in cli.ts.

/** The type for the config file (e.g. `.eslint-doc-generatorrc.js`) and internal `generate()` function. */
export type GenerateOptions = {
  /** Whether to check for and fail if there is a diff. No output will be written. Typically used during CI. Default: `false`. */
  check?: boolean;
  /**
   * List of configs and their associated emojis.
   * Format is `config-name,emoji`.
   * Default emojis are provided for common configs.
   * To remove a default emoji and rely on a badge instead, provide the config name without an emoji.
   */
  configEmoji?: string[];
  /** Configs to ignore from being displayed. Often used for an `all` config. */
  ignoreConfig?: string[];
  /** Whether to ignore deprecated rules from being checked, displayed, or updated. Default: `false`. */
  ignoreDeprecatedRules?: boolean;
  /** Whether to create rule doc files if they don't yet exist. Default: `false`. */
  initRuleDocs?: boolean;
  /** Path to markdown file for each rule doc. Use `{name}` placeholder for the rule name. Default: `docs/rules/{name}.md`. */
  pathRuleDoc?: string;
  /** Path to markdown file(s) where the rules table list should live. Default: `README.md`. */
  pathRuleList?: string | string[];
  /**
   * Function to be called with the generated content and file path for each processed file.
   * Useful for applying custom transformations such as formatting with tools like prettier.
   */
  postprocess?: (
    content: string,
    pathToFile: string
  ) => string | Promise<string>;
  /**
   * Ordered, comma-separated list of notices to display in rule doc.
   * Non-applicable notices will be hidden.
   * Choices: `configs`, `deprecated`, `fixable` (off by default), `fixableAndHasSuggestions`, `hasSuggestions` (off by default), `options` (off by default), `requiresTypeChecking`, `type` (off by default).
   * Default: `deprecated,configs,fixableAndHasSuggestions,requiresTypeChecking`.
   */
  ruleDocNotices?: string;
  /** Disallowed sections in each rule doc. Exit with failure if present. */
  ruleDocSectionExclude?: string[];
  /** Required sections in each rule doc. Exit with failure if missing. */
  ruleDocSectionInclude?: string[];
  /** Whether to require an "Options" or "Config" rule doc section and mention of any named options for rules with options. Default: `true`. */
  ruleDocSectionOptions?: boolean;
  /** The format to use for rule doc titles. Default: `desc-parens-prefix-name`. */
  ruleDocTitleFormat?: RuleDocTitleFormat;
  /**
   * Ordered, comma-separated list of columns to display in rule list.
   * Empty columns will be hidden.
   * Choices: `configsError`, `configsOff`, `configsWarn`, `deprecated`, `description`, `fixable`, `fixableAndHasSuggestions` (off by default), `hasSuggestions`, `name`, `options` (off by default), `requiresTypeChecking`, `type` (off by default).
   * Default: `name,description,configsError,configsWarn,configsOff,fixable,hasSuggestions,requiresTypeChecking,deprecated`.
   */
  ruleListColumns?: string;
  /**
   * Rule property to split the rules list by.
   * A separate list and header will be created for each value.
   * Example: `meta.type`.
   */
  splitBy?: string;
  /** Link to documentation about the ESLint configurations exported by the plugin. */
  urlConfigs?: string;
  /**
   * Link to documentation for each rule.
   * Useful when it differs from the rule doc path on disk (e.g. custom documentation site in use).
   * Use `{name}` placeholder for the rule name.
   */
  urlRuleDoc?: string;
};
