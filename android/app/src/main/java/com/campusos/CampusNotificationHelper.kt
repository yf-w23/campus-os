package com.campusos

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build

object CampusNotificationHelper {
  const val CHANNEL_WORKFLOW = "campus_workflow_alerts"
  const val GROUP_WORKFLOW = "com.campusos.WORKFLOW_ALERTS"
  const val PREFS = "campus_notifications"

  const val KEY_SCHEDULER_ENABLED = "workflow_scheduler_enabled"
  const val KEY_INTERVAL_MINUTES = "workflow_interval_minutes"
  const val KEY_LAST_SCHEDULED_AT = "workflow_last_scheduled_at"
  const val KEY_LAST_STARTED_AT = "workflow_last_started_at"
  const val KEY_LAST_FINISHED_AT = "workflow_last_finished_at"
  const val KEY_LAST_ERROR = "workflow_last_error"
  const val KEY_LAST_RESULT_STATUS = "workflow_last_result_status"
  const val KEY_LAST_TRIGGERED_COUNT = "workflow_last_triggered_count"
  const val KEY_LAST_CHECKED_COUNT = "workflow_last_checked_count"
  const val KEY_LAST_RESULT_MESSAGE = "workflow_last_result_message"

  private const val SUMMARY_ID = 41001

  fun prefs(context: Context) =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun ensureChannels(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }
    val manager = context.getSystemService(NotificationManager::class.java)
    val channel = NotificationChannel(
      CHANNEL_WORKFLOW,
      "Campus OS workflow alerts",
      NotificationManager.IMPORTANCE_DEFAULT,
    ).apply {
      description = "Background monitor results from Campus OS"
      setShowBadge(true)
    }
    manager.createNotificationChannel(channel)
  }

  fun areNotificationsEnabled(context: Context): Boolean {
    val manager = context.getSystemService(NotificationManager::class.java)
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      manager.areNotificationsEnabled()
    } else {
      true
    }
  }

  fun recordScheduled(context: Context, enabled: Boolean, intervalMinutes: Long) {
    prefs(context).edit()
      .putBoolean(KEY_SCHEDULER_ENABLED, enabled)
      .putLong(KEY_INTERVAL_MINUTES, intervalMinutes)
      .putLong(KEY_LAST_SCHEDULED_AT, System.currentTimeMillis())
      .remove(KEY_LAST_ERROR)
      .apply()
  }

  fun recordWorkerStarted(context: Context) {
    prefs(context).edit()
      .putLong(KEY_LAST_STARTED_AT, System.currentTimeMillis())
      .remove(KEY_LAST_ERROR)
      .apply()
  }

  fun recordWorkerError(context: Context, error: Throwable) {
    prefs(context).edit()
      .putLong(KEY_LAST_FINISHED_AT, System.currentTimeMillis())
      .putString(KEY_LAST_RESULT_STATUS, "error")
      .putString(KEY_LAST_ERROR, error.message ?: error.javaClass.simpleName)
      .apply()
  }

  fun recordJsResult(
    context: Context,
    status: String,
    triggeredCount: Int,
    checkedCount: Int,
    message: String?,
  ) {
    prefs(context).edit()
      .putLong(KEY_LAST_FINISHED_AT, System.currentTimeMillis())
      .putString(KEY_LAST_RESULT_STATUS, status)
      .putInt(KEY_LAST_TRIGGERED_COUNT, triggeredCount)
      .putInt(KEY_LAST_CHECKED_COUNT, checkedCount)
      .putString(KEY_LAST_RESULT_MESSAGE, message ?: "")
      .remove(KEY_LAST_ERROR)
      .apply()
  }

  fun showWorkflowNotification(context: Context, title: String, body: String) {
    ensureChannels(context)
    if (!areNotificationsEnabled(context)) {
      return
    }
    val manager = context.getSystemService(NotificationManager::class.java)
    val id = (System.currentTimeMillis() % Int.MAX_VALUE).toInt()
    manager.notify(id, buildNotification(context, title, body, false))
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      manager.notify(
        SUMMARY_ID,
        buildNotification(context, "Campus OS", "Background monitor alerts", true),
      )
    }
  }

  private fun buildNotification(
    context: Context,
    title: String,
    body: String,
    summary: Boolean,
  ): Notification {
    val openIntent = Intent(context, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
    }
    val pendingIntent = PendingIntent.getActivity(
      context,
      0,
      openIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(context, CHANNEL_WORKFLOW)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(context)
    }
    return builder
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(Notification.BigTextStyle().bigText(body))
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentIntent(pendingIntent)
      .setAutoCancel(true)
      .setGroup(GROUP_WORKFLOW)
      .setGroupSummary(summary)
      .build()
  }
}
