import ExpoModulesCore

internal final class MissingAppGroupException: Exception {
  override var reason: String {
    "No App Group is configured. Add the `react-native-siri` config plugin to your app config " +
    "with an `appGroup` option and rebuild the app (the plugin writes the group identifier " +
    "into Info.plist under the `ReactNativeSiriAppGroup` key)."
  }
}

internal final class AppGroupUnavailableException: GenericException<String> {
  override var reason: String {
    "Could not open the shared UserDefaults suite for App Group '\(param)'. " +
    "Make sure the App Group capability is registered for your bundle identifier."
  }
}

internal struct DonateUserActivityOptions: Record {
  @Field var activityType: String = ""
  @Field var title: String = ""
  @Field var userInfo: [String: String] = [:]
  @Field var keywords: [String] = []
  @Field var persistentIdentifier: String?
  @Field var eligibleForSearch: Bool = true
  @Field var eligibleForPrediction: Bool = true
}

public class ReactNativeSiriModule: Module {
  private static let collectionKeyPrefix = "ReactNativeSiri.collection."
  private static let dataKeyPrefix = "ReactNativeSiri.data."

  // NSUserActivity must stay alive for the system to consider it current.
  private static var currentActivity: NSUserActivity?

  public func definition() -> ModuleDefinition {
    Name("ReactNativeSiri")

    Function("getAppGroup") { () -> String? in
      return Self.configuredAppGroup()
    }

    AsyncFunction("syncEntities") { (collection: String, items: [[String: String]]) in
      let defaults = try Self.sharedDefaults()
      let data = try JSONSerialization.data(withJSONObject: items, options: [])
      defaults.set(String(data: data, encoding: .utf8), forKey: Self.collectionKeyPrefix + collection)
      Self.refreshAppShortcutParameters()
    }

    AsyncFunction("getSharedData") { (key: String) -> String? in
      let defaults = try Self.sharedDefaults()
      return defaults.string(forKey: Self.dataKeyPrefix + key)
    }

    AsyncFunction("setSharedData") { (key: String, value: String?) in
      let defaults = try Self.sharedDefaults()
      if let value {
        defaults.set(value, forKey: Self.dataKeyPrefix + key)
      } else {
        defaults.removeObject(forKey: Self.dataKeyPrefix + key)
      }
    }

    AsyncFunction("updateShortcuts") {
      Self.refreshAppShortcutParameters()
    }

    AsyncFunction("donateUserActivity") { (options: DonateUserActivityOptions) in
      let activity = NSUserActivity(activityType: options.activityType)
      activity.title = options.title
      if !options.userInfo.isEmpty {
        activity.addUserInfoEntries(from: options.userInfo)
      }
      activity.isEligibleForSearch = options.eligibleForSearch
      activity.isEligibleForPrediction = options.eligibleForPrediction
      activity.keywords = Set(options.keywords)
      if let persistentIdentifier = options.persistentIdentifier {
        activity.persistentIdentifier = persistentIdentifier
      }
      Self.currentActivity?.resignCurrent()
      Self.currentActivity = activity
      activity.becomeCurrent()
    }.runOnQueue(.main)

    AsyncFunction("clearUserActivity") {
      Self.currentActivity?.resignCurrent()
      Self.currentActivity = nil
    }.runOnQueue(.main)
  }

  // MARK: - App Group storage

  private static func configuredAppGroup() -> String? {
    return Bundle.main.object(forInfoDictionaryKey: "ReactNativeSiriAppGroup") as? String
  }

  private static func sharedDefaults() throws -> UserDefaults {
    guard let appGroup = configuredAppGroup(), !appGroup.isEmpty else {
      throw MissingAppGroupException()
    }
    guard let defaults = UserDefaults(suiteName: appGroup) else {
      throw AppGroupUnavailableException(appGroup)
    }
    return defaults
  }

  // MARK: - App Shortcuts refresh

  /// The App Intents (and the `AppShortcutsProvider`) are compiled into the
  /// main app target by the config plugin — this pod cannot import them.
  /// The generated code exposes an `@objc(ReactNativeSiriShortcutsHelper)`
  /// class that we reach through the Objective-C runtime.
  private static func refreshAppShortcutParameters() {
    guard #available(iOS 16.0, *) else {
      return
    }
    guard let helperClass = NSClassFromString("ReactNativeSiriShortcutsHelper") as? NSObject.Type else {
      return
    }
    let selector = NSSelectorFromString("updateAppShortcutParameters")
    if helperClass.responds(to: selector) {
      _ = helperClass.perform(selector)
    }
  }
}
