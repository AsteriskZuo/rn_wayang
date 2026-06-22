package com.rn_wayang

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "rn_wayang"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      object : DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled) {
        override fun getLaunchOptions(): Bundle {
          val options = Bundle()
          val extras = intent?.extras ?: return options

          extras.getString("relayHost")?.takeIf { it.isNotBlank() }?.let {
            options.putString("relayHost", it)
          }
          if (extras.containsKey("relayPort")) {
            options.putInt("relayPort", extras.getInt("relayPort"))
          }
          extras.getString("relayTopic")?.takeIf { it.isNotBlank() }?.let {
            options.putString("relayTopic", it)
          }
          if (extras.containsKey("autoStart")) {
            options.putBoolean("autoStart", extras.getBoolean("autoStart"))
          }
          if (extras.containsKey("rawLog")) {
            options.putBoolean("rawLog", extras.getBoolean("rawLog"))
          }
          if (extras.containsKey("jsonLog")) {
            options.putBoolean("jsonLog", extras.getBoolean("jsonLog"))
          }

          return options
        }
      }
}
