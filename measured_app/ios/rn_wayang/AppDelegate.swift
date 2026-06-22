import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "rn_wayang",
      in: window,
      initialProperties: launchConfigInitialProperties(),
      launchOptions: launchOptions
    )

    return true
  }

  private func launchConfigInitialProperties() -> [String: Any] {
    let argumentKeys = [
      "--relayHost": "relayHost",
      "--relayPort": "relayPort",
      "--relayTopic": "relayTopic",
      "--autoStart": "autoStart",
      "--rawLog": "rawLog",
      "--jsonLog": "jsonLog",
    ]
    let arguments = ProcessInfo.processInfo.arguments
    var initialProperties: [String: Any] = [:]
    var index = 0

    while index < arguments.count {
      let argument = arguments[index]
      guard let propertyName = argumentKeys[argument],
            index + 1 < arguments.count
      else {
        index += 1
        continue
      }

      let value = arguments[index + 1]
      switch propertyName {
      case "relayPort":
        if let port = Int(value), port > 0 {
          initialProperties[propertyName] = port
        }
      case "autoStart", "rawLog", "jsonLog":
        if let boolValue = parseBool(value) {
          initialProperties[propertyName] = boolValue
        }
      default:
        if !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
          initialProperties[propertyName] = value
        }
      }

      index += 2
    }

    return initialProperties
  }

  private func parseBool(_ value: String) -> Bool? {
    switch value.lowercased() {
    case "true", "1", "yes":
      return true
    case "false", "0", "no":
      return false
    default:
      return nil
    }
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
