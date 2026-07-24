package expo.modules.reactnativesiri

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Siri App Intents are an iOS-only feature. This stub keeps the JS API safe
 * to call on Android: every function resolves as a no-op.
 */
class ReactNativeSiriModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ReactNativeSiri")

    Function("getAppGroup") {
      null
    }

    AsyncFunction("syncEntities") { _: String, _: List<Map<String, String>> ->
      null
    }

    AsyncFunction("getSharedData") { _: String ->
      null
    }

    AsyncFunction("setSharedData") { _: String, _: String? ->
      null
    }

    AsyncFunction("updateShortcuts") {
      null
    }

    AsyncFunction("donateUserActivity") { _: Map<String, Any?> ->
      null
    }

    AsyncFunction("clearUserActivity") {
      null
    }
  }
}
