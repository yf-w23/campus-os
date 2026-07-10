package com.campusos

import android.content.Context
import android.content.Intent
import androidx.work.Worker
import androidx.work.WorkerParameters
import com.facebook.react.HeadlessJsTaskService

class CampusWorkflowWorker(
  context: Context,
  params: WorkerParameters,
) : Worker(context, params) {
  override fun doWork(): Result {
    CampusNotificationHelper.recordWorkerStarted(applicationContext)
    return try {
      val intent = Intent(applicationContext, CampusWorkflowHeadlessService::class.java).apply {
        putExtra("source", "workmanager")
        putExtra("scheduledAt", System.currentTimeMillis())
      }
      HeadlessJsTaskService.acquireWakeLockNow(applicationContext)
      applicationContext.startService(intent)
      Result.success()
    } catch (error: Throwable) {
      CampusNotificationHelper.recordWorkerError(applicationContext, error)
      Result.retry()
    }
  }
}
