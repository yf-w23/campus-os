package com.campusos

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

class CampusWorkflowHeadlessService : HeadlessJsTaskService() {
  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig {
    val data = Arguments.createMap().apply {
      putString("source", intent?.getStringExtra("source") ?: "workmanager")
      putDouble(
        "scheduledAt",
        (intent?.getLongExtra("scheduledAt", System.currentTimeMillis())
          ?: System.currentTimeMillis()).toDouble(),
      )
    }
    return HeadlessJsTaskConfig(
      "CampusWorkflowBackgroundTask",
      data,
      120000,
      true,
    )
  }
}
