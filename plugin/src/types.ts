export type SiriEntityConfig = {
  /** PascalCase entity name, e.g. `Train`. Used for generated Swift type names. */
  name: string;
  /**
   * The collection key your JS code syncs with `syncEntities(collection, items)`.
   * Defaults to the lowercased entity name plus `s`, e.g. `trains`.
   */
  collection?: string;
  /** String fields every record carries (besides the implicit `id`). */
  fields: string[];
  /** Field used as the spoken/visible title. Defaults to `name` if present, else the first field. */
  titleField?: string;
  /** Optional field shown as subtitle in Siri/Shortcuts UI. */
  subtitleField?: string;
  /** Human-readable type name shown in Shortcuts, defaults to `name`. */
  typeDisplayName?: string;
};

type BaseIntentConfig = {
  /** PascalCase unique intent name, e.g. `FindTrains`. Becomes `<name>Intent` in Swift. */
  name: string;
  /** Title shown in the Shortcuts app. Defaults to the name split on capitals. */
  title?: string;
  /** Description shown in the Shortcuts app. */
  description?: string;
  /**
   * Siri invocation phrases. Every phrase must contain `${appName}` and may
   * contain at most one `${param}` placeholder (the intent's parameter).
   */
  phrases: string[];
};

export type QueryIntentConfig = BaseIntentConfig & {
  type: 'query';
  /** Entity field to filter on, e.g. `destination`. */
  matchField: string;
  /**
   * Spoken result. Tokens: `${value}` (the matched field value),
   * `${results}` (comma-separated entity titles), `${count}`.
   */
  dialog: string;
  /** Spoken when nothing matches. Tokens: `${value}`. */
  emptyDialog?: string;
};

export type GetIntentConfig = BaseIntentConfig & {
  type: 'get';
  /**
   * Spoken result. Tokens: `${<field>}` for any entity field or `${id}`,
   * e.g. `Train ${name} arrives at ${arrivalTime}`.
   */
  dialog: string;
};

export type ActionIntentConfig = BaseIntentConfig & {
  type: 'action';
  /**
   * Deep link used to open the app, with `${id}` / `${<field>}` tokens,
   * e.g. `trains://follow?id=${id}`. Handle it in JS with `addIntentListener`.
   */
  deepLink: string;
  /** Optional spoken confirmation. Tokens: `${<field>}`, `${id}`. */
  dialog?: string;
};

export type SiriIntentConfig = QueryIntentConfig | GetIntentConfig | ActionIntentConfig;

export type SiriPluginOptions = {
  /** App Group identifier, e.g. `group.com.example.app`. Must be registered with Apple. */
  appGroup: string;
  /** The entity your intents expose. */
  entity: SiriEntityConfig;
  /** Declarative intents generated into the main app target. */
  intents: SiriIntentConfig[];
  /**
   * Escape hatch: project-relative paths (or `dir/*.swift` globs) of custom
   * Swift files copied verbatim into the generated SiriIntents group.
   */
  customSwiftFiles?: string[];
  /** Info.plist NSSiriUsageDescription. */
  siriUsageDescription?: string;
  /**
   * NSUserActivity types registered in Info.plist for `donateUserActivity`.
   * Defaults to `<bundleIdentifier>.viewing`.
   */
  userActivityTypes?: string[];
};

export type ResolvedEntity = Required<Omit<SiriEntityConfig, 'subtitleField'>> & {
  subtitleField?: string;
};

export function resolveEntity(entity: SiriEntityConfig): ResolvedEntity {
  return {
    name: entity.name,
    collection: entity.collection ?? `${entity.name.toLowerCase()}s`,
    fields: entity.fields,
    titleField: entity.titleField ?? (entity.fields.includes('name') ? 'name' : entity.fields[0]),
    subtitleField: entity.subtitleField,
    typeDisplayName: entity.typeDisplayName ?? entity.name,
  };
}

export function validateOptions(options: SiriPluginOptions): void {
  if (!options || typeof options !== 'object') {
    throw new Error(
      '[react-native-siri] Plugin options are required. See the README for the app.json shape.'
    );
  }
  if (!options.appGroup || !options.appGroup.startsWith('group.')) {
    throw new Error(
      `[react-native-siri] "appGroup" must be an App Group identifier starting with "group.", got: ${JSON.stringify(options.appGroup)}`
    );
  }
  const entity = options.entity;
  if (!entity?.name || !/^[A-Za-z][A-Za-z0-9]*$/.test(entity.name)) {
    throw new Error(
      '[react-native-siri] "entity.name" must be an alphanumeric identifier, e.g. "Train".'
    );
  }
  if (!Array.isArray(entity.fields) || entity.fields.length === 0) {
    throw new Error(
      '[react-native-siri] "entity.fields" must be a non-empty array of field names.'
    );
  }
  for (const field of entity.fields) {
    if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(field) || field === 'id') {
      throw new Error(
        `[react-native-siri] Invalid entity field "${field}". Fields must be alphanumeric identifiers and "id" is implicit.`
      );
    }
  }
  const resolved = resolveEntity(entity);
  if (!entity.fields.includes(resolved.titleField)) {
    throw new Error(
      `[react-native-siri] "entity.titleField" (${resolved.titleField}) must be one of "entity.fields".`
    );
  }
  if (resolved.subtitleField && !entity.fields.includes(resolved.subtitleField)) {
    throw new Error(
      `[react-native-siri] "entity.subtitleField" (${resolved.subtitleField}) must be one of "entity.fields".`
    );
  }
  if (!Array.isArray(options.intents) || options.intents.length === 0) {
    throw new Error('[react-native-siri] "intents" must be a non-empty array.');
  }
  const seenNames = new Set<string>();
  for (const intent of options.intents) {
    if (!intent.name || !/^[A-Za-z][A-Za-z0-9]*$/.test(intent.name)) {
      throw new Error(
        `[react-native-siri] Intent name "${intent.name}" must be an alphanumeric identifier, e.g. "FindTrains".`
      );
    }
    if (seenNames.has(intent.name)) {
      throw new Error(`[react-native-siri] Duplicate intent name "${intent.name}".`);
    }
    seenNames.add(intent.name);
    if (!['query', 'get', 'action'].includes(intent.type)) {
      throw new Error(
        `[react-native-siri] Intent "${intent.name}" has unknown type "${(intent as { type: string }).type}". Expected "query", "get" or "action".`
      );
    }
    if (!Array.isArray(intent.phrases) || intent.phrases.length === 0) {
      throw new Error(`[react-native-siri] Intent "${intent.name}" needs at least one phrase.`);
    }
    for (const phrase of intent.phrases) {
      if (!phrase.includes('${appName}')) {
        throw new Error(
          `[react-native-siri] Phrase "${phrase}" of intent "${intent.name}" must contain \${appName} — Apple requires the app name in every App Shortcut phrase.`
        );
      }
      const paramCount = phrase.split('${param}').length - 1;
      if (paramCount > 1) {
        throw new Error(
          `[react-native-siri] Phrase "${phrase}" of intent "${intent.name}" uses \${param} more than once — Apple allows at most one parameter per phrase.`
        );
      }
    }
    if (intent.type === 'query') {
      if (!intent.matchField || !entity.fields.includes(intent.matchField)) {
        throw new Error(
          `[react-native-siri] Query intent "${intent.name}" needs a "matchField" that is one of entity.fields.`
        );
      }
      if (!intent.dialog) {
        throw new Error(`[react-native-siri] Query intent "${intent.name}" needs a "dialog".`);
      }
    }
    if (intent.type === 'get' && !intent.dialog) {
      throw new Error(`[react-native-siri] Get intent "${intent.name}" needs a "dialog".`);
    }
    if (intent.type === 'action' && !intent.deepLink) {
      throw new Error(`[react-native-siri] Action intent "${intent.name}" needs a "deepLink".`);
    }
  }
}
