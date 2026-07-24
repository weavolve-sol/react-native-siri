import {
  ConfigPlugin,
  IOSConfig,
  createRunOncePlugin,
  withDangerousMod,
  withEntitlementsPlist,
  withInfoPlist,
  withXcodeProject,
} from 'expo/config-plugins';
import * as fs from 'fs';
import * as path from 'path';

import { generateSwiftFiles } from './swiftCodegen';
import { SiriPluginOptions, validateOptions } from './types';

const pkg = require('../../package.json') as { name: string; version: string };

const SHARED_TEMPLATE_NAME = 'ReactNativeSiriShared.swift';
const GENERATED_DIR_NAME = 'SiriIntents';

function sharedTemplatePath(): string {
  // Compiled to plugin/build/index.js; the template lives in plugin/swift.
  return path.join(__dirname, '..', 'swift', SHARED_TEMPLATE_NAME);
}

/**
 * Resolves the `customSwiftFiles` option (plain paths or `dir/*.swift` globs)
 * into absolute paths.
 */
function resolveCustomSwiftFiles(options: SiriPluginOptions, projectRoot: string): string[] {
  const resolved: string[] = [];
  for (const entry of options.customSwiftFiles ?? []) {
    const absolute = path.join(projectRoot, entry);
    const base = path.basename(absolute);
    if (base.includes('*')) {
      const dir = path.dirname(absolute);
      if (!fs.existsSync(dir)) {
        throw new Error(`[react-native-siri] customSwiftFiles: directory not found: ${dir}`);
      }
      const pattern = new RegExp(`^${base.split('*').map(escapeRegExp).join('.*')}$`);
      for (const file of fs.readdirSync(dir).sort()) {
        if (pattern.test(file)) {
          resolved.push(path.join(dir, file));
        }
      }
    } else {
      if (!fs.existsSync(absolute)) {
        throw new Error(`[react-native-siri] customSwiftFiles: file not found: ${absolute}`);
      }
      resolved.push(absolute);
    }
  }
  return resolved;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Deterministic list of every Swift filename that ends up in
 * `ios/<AppName>/SiriIntents/` — used by both the file-writing mod and the
 * pbxproj registration mod so they can never disagree.
 */
function getAllSwiftFileNames(options: SiriPluginOptions, projectRoot: string): string[] {
  const names = [
    SHARED_TEMPLATE_NAME,
    ...generateSwiftFiles(options).map((file) => file.filename),
    ...resolveCustomSwiftFiles(options, projectRoot).map((file) => path.basename(file)),
  ];
  const seen = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) {
      throw new Error(
        `[react-native-siri] Duplicate Swift file name "${name}" — rename the conflicting custom Swift file or intent.`
      );
    }
    seen.add(name);
  }
  return names;
}

/** App Group + Siri entitlements. */
const withSiriEntitlements: ConfigPlugin<SiriPluginOptions> = (config, options) => {
  return withEntitlementsPlist(config, (config) => {
    const groups = (config.modResults['com.apple.security.application-groups'] as string[]) ?? [];
    if (!groups.includes(options.appGroup)) {
      groups.push(options.appGroup);
    }
    config.modResults['com.apple.security.application-groups'] = groups;
    config.modResults['com.apple.developer.siri'] = true;
    return config;
  });
};

/** Usage description, the App Group handle for the native module, and NSUserActivity types. */
const withSiriInfoPlist: ConfigPlugin<SiriPluginOptions> = (config, options) => {
  return withInfoPlist(config, (config) => {
    config.modResults.NSSiriUsageDescription =
      options.siriUsageDescription ??
      (config.modResults.NSSiriUsageDescription as string | undefined) ??
      'Siri is used to answer questions about your data in this app.';
    // Both the pod and the generated intents read the App Group from here.
    config.modResults.ReactNativeSiriAppGroup = options.appGroup;

    const bundleIdentifier = config.ios?.bundleIdentifier;
    const activityTypes =
      options.userActivityTypes ?? (bundleIdentifier ? [`${bundleIdentifier}.viewing`] : []);
    if (activityTypes.length > 0) {
      const existing = (config.modResults.NSUserActivityTypes as string[]) ?? [];
      config.modResults.NSUserActivityTypes = [...new Set([...existing, ...activityTypes])];
    }
    return config;
  });
};

/**
 * Writes the generated Swift into `ios/<AppName>/SiriIntents/`.
 *
 * The files intentionally live in the main app target (not the pod): Apple
 * requires intents that back App Shortcuts to be compiled directly into the
 * app target, and the `AppShortcutsProvider` must live there too.
 */
const withSiriSwiftFiles: ConfigPlugin<SiriPluginOptions> = (config, options) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const projectName =
        config.modRequest.projectName ?? IOSConfig.XcodeUtils.getProjectName(projectRoot);
      const destinationDir = path.join(
        config.modRequest.platformProjectRoot,
        projectName,
        GENERATED_DIR_NAME
      );

      fs.rmSync(destinationDir, { recursive: true, force: true });
      fs.mkdirSync(destinationDir, { recursive: true });

      fs.copyFileSync(sharedTemplatePath(), path.join(destinationDir, SHARED_TEMPLATE_NAME));

      for (const file of generateSwiftFiles(options)) {
        fs.writeFileSync(path.join(destinationDir, file.filename), file.contents);
      }

      for (const customFile of resolveCustomSwiftFiles(options, projectRoot)) {
        fs.copyFileSync(customFile, path.join(destinationDir, path.basename(customFile)));
      }

      return config;
    },
  ]);
};

/** Registers every generated file in the app target's Sources build phase. */
const withSiriXcodeProject: ConfigPlugin<SiriPluginOptions> = (config, options) => {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const projectRoot = config.modRequest.projectRoot;
    const projectName =
      config.modRequest.projectName ?? IOSConfig.XcodeUtils.getProjectName(projectRoot);
    const groupPath = `${projectName}/${GENERATED_DIR_NAME}`;

    IOSConfig.XcodeUtils.ensureGroupRecursively(project, groupPath);

    for (const filename of getAllSwiftFileNames(options, projectRoot)) {
      // Expo templates keep app groups virtual (name-only), so file reference
      // paths must be relative to the ios/ source root, like the template's
      // own `<AppName>/AppDelegate.swift`.
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath: `${projectName}/${GENERATED_DIR_NAME}/${filename}`,
        groupName: groupPath,
        project,
      });
    }
    return config;
  });
};

const withSiri: ConfigPlugin<SiriPluginOptions> = (config, options) => {
  validateOptions(options);
  config = withSiriEntitlements(config, options);
  config = withSiriInfoPlist(config, options);
  config = withSiriSwiftFiles(config, options);
  config = withSiriXcodeProject(config, options);
  return config;
};

export default createRunOncePlugin(withSiri, pkg.name, pkg.version);
