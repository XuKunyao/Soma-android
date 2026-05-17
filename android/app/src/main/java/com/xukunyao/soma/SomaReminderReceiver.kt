package com.xukunyao.soma

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class SomaReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      SomaReminderScheduler.ACTION_REMIND -> SomaReminderScheduler.handleReminder(context)
      SomaReminderScheduler.ACTION_SNOOZE -> SomaReminderScheduler.snooze(context)
      SomaReminderScheduler.ACTION_PAUSE_TODAY -> SomaReminderScheduler.pauseToday(context)
      Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_MY_PACKAGE_REPLACED,
      Intent.ACTION_TIME_CHANGED,
      Intent.ACTION_TIMEZONE_CHANGED,
      SomaReminderScheduler.ACTION_RESCHEDULE -> SomaReminderScheduler.scheduleNext(context)
    }
  }
}
