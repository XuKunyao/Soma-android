package com.xukunyao.soma

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class SomaReminderModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "SomaReminderModule"

  @ReactMethod
  fun schedule(optionsJson: String, promise: Promise) {
    try {
      SomaReminderScheduler.schedule(reactContext.applicationContext, optionsJson)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("SOMA_REMINDER_SCHEDULE_FAILED", error)
    }
  }

  @ReactMethod
  fun cancel(promise: Promise) {
    try {
      SomaReminderScheduler.cancel(reactContext.applicationContext)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("SOMA_REMINDER_CANCEL_FAILED", error)
    }
  }

  @ReactMethod
  fun canScheduleExactAlarms(promise: Promise) {
    try {
      promise.resolve(SomaReminderScheduler.canScheduleExactAlarms(reactContext.applicationContext))
    } catch (error: Exception) {
      promise.reject("SOMA_REMINDER_EXACT_ALARM_CHECK_FAILED", error)
    }
  }
}
