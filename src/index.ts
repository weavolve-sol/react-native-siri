import { Linking } from 'react-native';

import type {
  DonateUserActivityOptions,
  IntentLaunchEvent,
  IntentListenerSubscription,
  SiriEntityRecord,
} from './ReactNativeSiri.types';
import ReactNativeSiriModule from './ReactNativeSiriModule';

export * from './ReactNativeSiri.types';

/**
 * Writes `items` into the App Group shared store under `collection` (as JSON)
 * and asks App Intents to re-register App Shortcut phrase parameters.
 *
 * Call this whenever the data backing your Siri entities changes. The
 * generated Swift `AppEntity` reads exactly this collection, so Siri answers
 * with whatever was synced most recently — even when the app is not running.
 */
export async function syncEntities(collection: string, items: SiriEntityRecord[]): Promise<void> {
  const normalized = items.map((item) => {
    const record: Record<string, string> = {};
    for (const [key, value] of Object.entries(item)) {
      if (value !== null && value !== undefined) {
        record[key] = String(value);
      }
    }
    return record;
  });
  return ReactNativeSiriModule.syncEntities(collection, normalized);
}

/**
 * Reads a raw string value from the App Group shared store.
 * Useful for values written natively (or via {@link setSharedData}).
 */
export async function getSharedData(key: string): Promise<string | null> {
  return ReactNativeSiriModule.getSharedData(key);
}

/**
 * Writes a raw string value into the App Group shared store, readable from
 * both JS and the generated Swift intents. Pass `null` to delete the key.
 */
export async function setSharedData(key: string, value: string | null): Promise<void> {
  return ReactNativeSiriModule.setSharedData(key, value);
}

/**
 * Default shared-data key the generated Swift reads request headers from;
 * mirrors `DEFAULT_REMOTE_HEADERS_KEY` in the config plugin.
 */
const REMOTE_HEADERS_KEY = 'siri_remote_headers';

/**
 * Stores the HTTP headers (e.g. `{ Authorization: 'Bearer …' }`) that the
 * generated intents attach when fetching the plugin's `remote.url` at intent
 * time. Call it on login and whenever the token rotates; pass `null` to
 * clear. Use a custom `key` only if you changed `remote.headersKey` in the
 * plugin config.
 */
export async function setRemoteHeaders(
  headers: Record<string, string> | null,
  key: string = REMOTE_HEADERS_KEY
): Promise<void> {
  return setSharedData(key, headers === null ? null : JSON.stringify(headers));
}

/**
 * Manually re-registers App Shortcut phrase parameters
 * (`AppShortcutsProvider.updateAppShortcutParameters()`).
 * {@link syncEntities} already does this for you.
 */
export async function updateShortcuts(): Promise<void> {
  return ReactNativeSiriModule.updateShortcuts();
}

/**
 * Donates an `NSUserActivity` describing what the user is looking at right
 * now (use case: "follow *this* train"). Siri and Shortcuts use donations to
 * suggest and predict actions; on iOS 18+ with Apple Intelligence the current
 * activity also powers on-screen awareness.
 */
export async function donateUserActivity(options: DonateUserActivityOptions): Promise<void> {
  return ReactNativeSiriModule.donateUserActivity({
    activityType: options.activityType,
    title: options.title,
    userInfo: options.userInfo ?? {},
    keywords: options.keywords ?? [],
    persistentIdentifier: options.persistentIdentifier ?? null,
    eligibleForSearch: options.eligibleForSearch ?? true,
    eligibleForPrediction: options.eligibleForPrediction ?? true,
  });
}

/**
 * Resigns the currently donated user activity (e.g. when the screen that
 * donated it disappears).
 */
export async function clearUserActivity(): Promise<void> {
  return ReactNativeSiriModule.clearUserActivity();
}

/**
 * Returns the App Group identifier the config plugin wrote into Info.plist,
 * or `null` when the plugin is not configured (useful as a sanity check).
 */
export function getAppGroup(): string | null {
  return ReactNativeSiriModule.getAppGroup();
}

/**
 * Listens for the app being opened by a generated `action` intent (which
 * opens the app through its configured `deepLink`). Also delivers the
 * initial URL when the app was cold-started by an intent.
 *
 * The listener receives every deep link the app is opened with; check
 * `event.scheme` / `event.host` to route.
 */
export function addIntentListener(
  listener: (event: IntentLaunchEvent) => void
): IntentListenerSubscription {
  const subscription = Linking.addEventListener('url', ({ url }) => {
    listener(parseIntentUrl(url));
  });
  Linking.getInitialURL().then((url) => {
    if (url) {
      listener(parseIntentUrl(url));
    }
  });
  return {
    remove() {
      subscription.remove();
    },
  };
}

/**
 * Parses a deep link URL into its parts without relying on the `URL` global
 * (which is incomplete on Hermes).
 */
export function parseIntentUrl(url: string): IntentLaunchEvent {
  const match = url.match(/^([^:]+):\/\/([^/?#]*)([^?#]*)(?:\?([^#]*))?/);
  const params: Record<string, string> = {};
  if (match?.[4]) {
    for (const pair of match[4].split('&')) {
      if (!pair) {
        continue;
      }
      const [rawKey, rawValue = ''] = pair.split('=');
      try {
        params[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue);
      } catch {
        params[rawKey] = rawValue;
      }
    }
  }
  return {
    url,
    scheme: match?.[1] ?? null,
    host: match?.[2] || null,
    path: match?.[3] ? match[3].replace(/^\//, '') || null : null,
    params,
  };
}
