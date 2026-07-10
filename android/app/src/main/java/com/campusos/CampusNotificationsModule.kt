package com.campusos

import android.content.Intent
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequest
import androidx.work.PeriodicWorkRequest
import androidx.work.WorkManager
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.concurrent.TimeUnit

class CampusNotificationsModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "CampusNotifications"

  @ReactMethod
  fun ensureNotificationChannel(promise: Promise) {
    try {
      CampusNotificationHelper.ensureChannels(reactContext)
      promise.resolve(true)
    } catch (error: Throwable) {
      promise.reject("CHANNEL_ERROR", error)
    }
  }

  @ReactMethod
  fun areNotificationsEnabled(promise: Promise) {
    try {
      CampusNotificationHelper.ensureChannels(reactContext)
      promise.resolve(CampusNotificationHelper.areNotificationsEnabled(reactContext))
    } catch (error: Throwable) {
      promise.reject("NOTIFICATION_STATUS_ERROR", error)
    }
  }

  @ReactMethod
  fun showWorkflowNotification(title: String, body: String, promise: Promise) {
    try {
      CampusNotificationHelper.showWorkflowNotification(reactContext, title, body)
      promise.resolve(true)
    } catch (error: Throwable) {
      promise.reject("SHOW_NOTIFICATION_ERROR", error)
    }
  }

  @ReactMethod
  fun scheduleWorkflowChecks(enabled: Boolean, intervalMinutes: Double, promise: Promise) {
    try {
      val workManager = WorkManager.getInstance(reactContext)
      if (!enabled) {
        workManager.cancelUniqueWork(WORK_NAME)
        CampusNotificationHelper.recordScheduled(reactContext, false, 0)
        promise.resolve(getStatusMap())
        return
      }

      val minutes = intervalMinutes.toLong().coerceAtLeast(15)
      val constraints = Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .build()
      val request = PeriodicWorkRequest.Builder(
        CampusWorkflowWorker::class.java,
        minutes,
        TimeUnit.MINUTES,
      )
        .setConstraints(constraints)
        .addTag(WORK_NAME)
        .build()

      workManager.enqueueUniquePeriodicWork(
        WORK_NAME,
        ExistingPeriodicWorkPolicy.UPDATE,
        request,
      )
      CampusNotificationHelper.recordScheduled(reactContext, true, minutes)
      promise.resolve(getStatusMap())
    } catch (error: Throwable) {
      promise.reject("SCHEDULE_WORKFLOW_ERROR", error)
    }
  }

  @ReactMethod
  fun enqueueWorkflowCheck(promise: Promise) {
    try {
      val request = OneTimeWorkRequest.Builder(CampusWorkflowWorker::class.java)
        .setConstraints(
          Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build(),
        )
        .addTag(WORK_NAME)
        .build()
      WorkManager.getInstance(reactContext).enqueue(request)
      promise.resolve(true)
    } catch (error: Throwable) {
      promise.reject("ENQUEUE_WORKFLOW_ERROR", error)
    }
  }

  @ReactMethod
  fun runHeadlessWorkflowNow(promise: Promise) {
    try {
      val intent = Intent(reactContext, CampusWorkflowHeadlessService::class.java).apply {
        putExtra("source", "manual")
        putExtra("scheduledAt", System.currentTimeMillis())
      }
      HeadlessJsTaskService.acquireWakeLockNow(reactContext)
      reactContext.startService(intent)
      promise.resolve(true)
    } catch (error: Throwable) {
      promise.reject("RUN_HEADLESS_WORKFLOW_ERROR", error)
    }
  }

  @ReactMethod
  fun recordWorkflowRunResult(
    status: String,
    triggeredCount: Double,
    checkedCount: Double,
    message: String?,
    promise: Promise,
  ) {
    try {
      CampusNotificationHelper.recordJsResult(
        reactContext,
        status,
        triggeredCount.toInt(),
        checkedCount.toInt(),
        message,
      )
      promise.resolve(getStatusMap())
    } catch (error: Throwable) {
      promise.reject("RECORD_WORKFLOW_RESULT_ERROR", error)
    }
  }

  @ReactMethod
  fun getWorkflowBackgroundStatus(promise: Promise) {
    try {
      promise.resolve(getStatusMap())
    } catch (error: Throwable) {
      promise.reject("WORKFLOW_STATUS_ERROR", error)
    }
  }

  private fun getStatusMap() = Arguments.createMap().apply {
    val prefs = CampusNotificationHelper.prefs(reactContext)
    putBoolean(
      "notificationsEnabled",
      CampusNotificationHelper.areNotificationsEnabled(reactContext),
    )
    putBoolean(
      "schedulerEnabled",
      prefs.getBoolean(CampusNotificationHelper.KEY_SCHEDULER_ENABLED, false),
    )
    putDouble(
      "intervalMinutes",
      prefs.getLong(CampusNotificationHelper.KEY_INTERVAL_MINUTES, 0).toDouble(),
    )
    putDouble(
      "lastScheduledAt",
      prefs.getLong(CampusNotificationHelper.KEY_LAST_SCHEDULED_AT, 0).toDouble(),
    )
    putDouble(
      "lastStartedAt",
      prefs.getLong(CampusNotificationHelper.KEY_LAST_STARTED_AT, 0).toDouble(),
    )
    putDouble(
      "lastFinishedAt",
      prefs.getLong(CampusNotificationHelper.KEY_LAST_FINISHED_AT, 0).toDouble(),
    )
    putString(
      "lastError",
      prefs.getString(CampusNotificationHelper.KEY_LAST_ERROR, null),
    )
    putString(
      "lastResultStatus",
      prefs.getString(CampusNotificationHelper.KEY_LAST_RESULT_STATUS, null),
    )
    putDouble(
      "lastTriggeredCount",
      prefs.getInt(CampusNotificationHelper.KEY_LAST_TRIGGERED_COUNT, 0).toDouble(),
    )
    putDouble(
      "lastCheckedCount",
      prefs.getInt(CampusNotificationHelper.KEY_LAST_CHECKED_COUNT, 0).toDouble(),
    )
    putString(
      "lastResultMessage",
      prefs.getString(CampusNotificationHelper.KEY_LAST_RESULT_MESSAGE, null),
    )
  }

  companion object {
    private const val WORK_NAME = "campus_workflow_periodic"
  }
}
