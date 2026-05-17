package com.xukunyao.soma

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.AlarmManagerCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar
import kotlin.math.max
import kotlin.math.roundToInt

object SomaReminderScheduler {
  private const val PREFS_NAME = "soma_reminders"
  private const val CHANNEL_ID = "water-reminders-v2"
  private const val REQUEST_CODE = 19060
  private const val SNOOZE_REQUEST_CODE = 19062
  private const val PAUSE_TODAY_REQUEST_CODE = 19063
  private const val NOTIFICATION_ID = 19061
  private const val DEFAULT_QUIET_START = "22:00"
  private const val DEFAULT_QUIET_END = "08:00"
  private const val SNOOZE_MINUTES = 15

  const val ACTION_REMIND = "com.xukunyao.soma.action.WATER_REMINDER"
  const val ACTION_RESCHEDULE = "com.xukunyao.soma.action.RESCHEDULE_REMINDERS"
  const val ACTION_SNOOZE = "com.xukunyao.soma.action.SNOOZE_REMINDER"
  const val ACTION_PAUSE_TODAY = "com.xukunyao.soma.action.PAUSE_TODAY"

  fun schedule(context: Context, optionsJson: String) {
    val options = JSONObject(optionsJson)
    val prefs = prefs(context)
    val wasEnabled = prefs.getBoolean("enabled", false)
    val intervalMinutes = max(1, options.optDouble("intervalMinutes", 60.0).roundToInt())
    val reminderTimes = options.optJSONArray("reminderTimes")?.toString() ?: "[]"
    val language = options.optString("language", "zh")
    val quietStart = options.optString("quietStart", DEFAULT_QUIET_START)
    val quietEnd = options.optString("quietEnd", DEFAULT_QUIET_END)
    val cadenceChanged = !wasEnabled ||
      prefs.getInt("intervalMinutes", -1) != intervalMinutes ||
      prefs.getString("reminderTimes", "[]") != reminderTimes ||
      prefs.getString("quietStart", DEFAULT_QUIET_START) != quietStart ||
      prefs.getString("quietEnd", DEFAULT_QUIET_END) != quietEnd
    val needsInitialAnchor = prefs.getLong("lastTriggeredAt", 0L) <= 0L && parseReminderTimes(reminderTimes).isEmpty()

    val editor = prefs.edit()
      .putBoolean("enabled", true)
      .putInt("intervalMinutes", intervalMinutes)
      .putString("reminderTimes", reminderTimes)
      .putString("language", language)
      .putString("quietStart", quietStart)
      .putString("quietEnd", quietEnd)

    if (cadenceChanged || needsInitialAnchor) {
      editor.putLong("lastTriggeredAt", System.currentTimeMillis())
    }

    editor.apply()

    ensureChannel(context)
    scheduleNext(context)
  }

  fun cancel(context: Context) {
    prefs(context).edit().putBoolean("enabled", false).apply()
    cancelAlarm(context)
    NotificationManagerCompat.from(context).cancelAll()
  }

  fun snooze(context: Context) {
    val prefs = prefs(context)
    if (!prefs.getBoolean("enabled", false)) {
      return
    }

    prefs.edit()
      .putLong("snoozeUntil", System.currentTimeMillis() + SNOOZE_MINUTES * 60_000L)
      .apply()
    NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
    scheduleNext(context)
  }

  fun pauseToday(context: Context) {
    val prefs = prefs(context)
    if (!prefs.getBoolean("enabled", false)) {
      return
    }

    val tomorrow = Calendar.getInstance().apply {
      add(Calendar.DATE, 1)
      set(Calendar.HOUR_OF_DAY, 0)
      set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }

    prefs.edit()
      .putLong("pauseUntil", tomorrow.timeInMillis)
      .putLong("snoozeUntil", 0L)
      .apply()
    NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
    scheduleNext(context)
  }

  fun handleReminder(context: Context) {
    val prefs = prefs(context)
    if (!prefs.getBoolean("enabled", false)) {
      cancelAlarm(context)
      return
    }

    ensureChannel(context)

    val now = Calendar.getInstance()
    val pauseUntil = prefs.getLong("pauseUntil", 0L)
    if (pauseUntil > System.currentTimeMillis()) {
      scheduleNext(context)
      return
    }

    val nowMinute = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)
    if (!isWithinQuietWindow(nowMinute, prefs)) {
      showNotification(context, prefs)
      prefs.edit().putLong("lastTriggeredAt", System.currentTimeMillis()).apply()
    }

    scheduleNext(context)
  }

  fun scheduleNext(context: Context) {
    val prefs = prefs(context)
    if (!prefs.getBoolean("enabled", false)) {
      cancelAlarm(context)
      return
    }

    val nextTriggerAt = nextTriggerAtMillis(prefs)
    if (nextTriggerAt == null) {
      cancelAlarm(context)
      return
    }
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val operation = reminderPendingIntent(context)

    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager.canScheduleExactAlarms()) {
      AlarmManagerCompat.setExactAndAllowWhileIdle(
        alarmManager,
        AlarmManager.RTC_WAKEUP,
        nextTriggerAt,
        operation
      )
    } else {
      AlarmManagerCompat.setAndAllowWhileIdle(
        alarmManager,
        AlarmManager.RTC_WAKEUP,
        nextTriggerAt,
        operation
      )
    }
  }

  fun canScheduleExactAlarms(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      return true
    }

    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    return alarmManager.canScheduleExactAlarms()
  }

  private fun nextTriggerAtMillis(prefs: SharedPreferences): Long? {
    val nowMillis = System.currentTimeMillis()
    val pauseUntil = prefs.getLong("pauseUntil", 0L)
    if (pauseUntil > nowMillis) {
      return pauseUntil
    }

    val snoozeUntil = prefs.getLong("snoozeUntil", 0L)
    if (snoozeUntil > nowMillis) {
      return snoozeUntil
    }

    val exactTimes = parseReminderTimes(prefs.getString("reminderTimes", "[]"))
    return if (exactTimes.isNotEmpty()) {
      nextExactTriggerAtMillis(exactTimes, prefs)
    } else {
      nextIntervalTriggerAtMillis(prefs)
    }
  }

  private fun nextExactTriggerAtMillis(exactTimes: List<Int>, prefs: SharedPreferences): Long? {
    val now = Calendar.getInstance()
    val quietFilteredTimes = exactTimes.filter { !isWithinQuietWindow(it, prefs) }
    if (quietFilteredTimes.isEmpty()) {
      return null
    }

    for (dayOffset in 0..1) {
      quietFilteredTimes.forEach { minuteOfDay ->
        val candidate = Calendar.getInstance()
        candidate.add(Calendar.DATE, dayOffset)
        candidate.set(Calendar.HOUR_OF_DAY, minuteOfDay / 60)
        candidate.set(Calendar.MINUTE, minuteOfDay % 60)
        candidate.set(Calendar.SECOND, 0)
        candidate.set(Calendar.MILLISECOND, 0)

        if (candidate.after(now)) {
          return candidate.timeInMillis
        }
      }
    }

    return null
  }

  private fun nextIntervalTriggerAtMillis(prefs: SharedPreferences): Long {
    val intervalMillis = max(1, prefs.getInt("intervalMinutes", 60)) * 60_000L
    val lastTriggeredAt = prefs.getLong("lastTriggeredAt", 0L)
    val nowMillis = System.currentTimeMillis()
    var next = if (lastTriggeredAt > 0L) {
      max(lastTriggeredAt + intervalMillis, nowMillis + 1_000L)
    } else {
      nowMillis + intervalMillis
    }

    val nextCalendar = Calendar.getInstance().apply { timeInMillis = next }
    val nextMinute = nextCalendar.get(Calendar.HOUR_OF_DAY) * 60 + nextCalendar.get(Calendar.MINUTE)
    if (isWithinQuietWindow(nextMinute, prefs)) {
      next = nextQuietEndMillis(prefs)
    }

    return next
  }

  private fun nextQuietEndMillis(prefs: SharedPreferences): Long {
    val quietEnd = parseTimeToMinutes(prefs.getString("quietEnd", DEFAULT_QUIET_END), DEFAULT_QUIET_END)
    val candidate = Calendar.getInstance()
    candidate.set(Calendar.HOUR_OF_DAY, quietEnd / 60)
    candidate.set(Calendar.MINUTE, quietEnd % 60)
    candidate.set(Calendar.SECOND, 0)
    candidate.set(Calendar.MILLISECOND, 0)

    if (!candidate.after(Calendar.getInstance())) {
      candidate.add(Calendar.DATE, 1)
    }

    return candidate.timeInMillis
  }

  private fun showNotification(context: Context, prefs: SharedPreferences) {
    if (
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
      context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
    ) {
      return
    }

    val language = prefs.getString("language", "zh") ?: "zh"
    val notificationIndex = prefs.getInt("notificationIndex", 0)
    val message = reminderMessage(language, notificationIndex)
    prefs.edit().putInt("notificationIndex", notificationIndex + 1).apply()

    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
      ?: Intent(context, MainActivity::class.java)
    val contentIntent = PendingIntent.getActivity(
      context,
      0,
      launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle(message.first)
      .setContentText(message.second)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setCategory(NotificationCompat.CATEGORY_REMINDER)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setAutoCancel(true)
      .setSound(android.provider.Settings.System.DEFAULT_NOTIFICATION_URI)
      .setVibrate(longArrayOf(0, 180, 120, 180))
      .setContentIntent(contentIntent)
      .addAction(
        context.applicationInfo.icon,
        if (language == "en") "In 15 min" else "15 分钟后",
        actionPendingIntent(context, ACTION_SNOOZE, SNOOZE_REQUEST_CODE)
      )
      .addAction(
        context.applicationInfo.icon,
        if (language == "en") "Pause today" else "今天暂停",
        actionPendingIntent(context, ACTION_PAUSE_TODAY, PAUSE_TODAY_REQUEST_CODE)
      )
      .build()

    NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
  }

  private fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }

    val channel = NotificationChannel(
      CHANNEL_ID,
      "Water reminders",
      NotificationManager.IMPORTANCE_HIGH
    ).apply {
      description = "Soma hydration reminders"
      enableVibration(true)
      vibrationPattern = longArrayOf(0, 180, 120, 180)
      lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
    }

    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.createNotificationChannel(channel)
  }

  private fun cancelAlarm(context: Context) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    alarmManager.cancel(reminderPendingIntent(context))
  }

  private fun reminderPendingIntent(context: Context): PendingIntent {
    val intent = Intent(context, SomaReminderReceiver::class.java).setAction(ACTION_REMIND)
    return PendingIntent.getBroadcast(
      context,
      REQUEST_CODE,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  private fun actionPendingIntent(context: Context, action: String, requestCode: Int): PendingIntent {
    val intent = Intent(context, SomaReminderReceiver::class.java).setAction(action)
    return PendingIntent.getBroadcast(
      context,
      requestCode,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  private fun prefs(context: Context): SharedPreferences =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  private fun parseReminderTimes(rawTimes: String?): List<Int> {
    val result = mutableSetOf<Int>()
    val array = try {
      JSONArray(rawTimes ?: "[]")
    } catch (_: Exception) {
      JSONArray()
    }

    for (index in 0 until array.length()) {
      val value = array.optString(index)
      if (Regex("^([01]\\d|2[0-3]):[0-5]\\d$").matches(value)) {
        result.add(parseTimeToMinutes(value, "00:00"))
      }
    }

    return result.toList().sorted()
  }

  private fun isWithinQuietWindow(minuteOfDay: Int, prefs: SharedPreferences): Boolean {
    val quietStartValue = prefs.getString("quietStart", DEFAULT_QUIET_START)
    val quietEndValue = prefs.getString("quietEnd", DEFAULT_QUIET_END)
    if (quietStartValue.isNullOrBlank() || quietEndValue.isNullOrBlank()) {
      return false
    }

    val quietStart = parseTimeToMinutes(quietStartValue, DEFAULT_QUIET_START)
    val quietEnd = parseTimeToMinutes(quietEndValue, DEFAULT_QUIET_END)
    if (quietStart == quietEnd) {
      return false
    }

    return if (quietStart < quietEnd) {
      minuteOfDay >= quietStart && minuteOfDay < quietEnd
    } else {
      minuteOfDay >= quietStart || minuteOfDay < quietEnd
    }
  }

  private fun parseTimeToMinutes(value: String?, fallback: String): Int {
    val candidate = if (Regex("^([01]\\d|2[0-3]):[0-5]\\d$").matches(value ?: "")) {
      value!!
    } else {
      fallback
    }
    val parts = candidate.split(":")
    return parts[0].toInt() * 60 + parts[1].toInt()
  }

  private fun reminderMessage(language: String, index: Int): Pair<String, String> {
    val zh = listOf(
      "该喝水啦" to "照顾好自己，喝杯水吧",
      "温馨提醒" to "放下手里的事，慢慢喝一口水",
      "补充水分" to "给身体一点清爽的照顾",
      "喝水时间" to "小小一杯水，也是在照顾今天的自己",
      "休息一下" to "起身活动一下，顺便喝杯水吧",
      "轻轻提醒" to "如果方便，现在可以喝几口水",
      "给自己一杯水" to "不急，慢慢喝就好",
      "保持水分" to "今天也记得温柔地照顾自己"
    )
    val en = listOf(
      "Time for water" to "Take a quiet moment and drink a glass",
      "A gentle pause" to "Set things down and take a few sips",
      "Hydration reminder" to "A small glass now helps the day feel easier",
      "Water break" to "Give yourself a glass of water and breathe",
      "Kind reminder" to "A few sips would be good right now",
      "Stay hydrated" to "Care for yourself in this small way",
      "A glass for you" to "No rush. Drink slowly",
      "Gentle hydration" to "Your body may appreciate a little water"
    )
    val messages = if (language == "en") en else zh
    return messages[index % messages.size]
  }
}
