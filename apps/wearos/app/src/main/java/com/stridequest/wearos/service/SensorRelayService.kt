package com.stridequest.wearos.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.health.services.client.HealthServices
import androidx.health.services.client.PassiveListenerCallback
import androidx.health.services.client.data.DataPointContainer
import androidx.health.services.client.data.DataType
import androidx.health.services.client.data.PassiveListenerConfig
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import org.json.JSONObject

class SensorRelayService : Service() {

    companion object {
        private const val TAG = "SensorRelayService"
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "SensorRelayChannel"
        private const val MESSAGE_PATH = "/stridequest/sensors"
    }

    private val serviceScope = CoroutineScope(Dispatchers.IO + Job())
    private var tickerJob: Job? = null

    private var sessionStartSteps: Long? = null
    private var currentSteps: Long? = null
    private var currentHeartRate: Double? = null

    private var hasBodySensorsPermission = false
    private var hasActivityRecognitionPermission = false

    private val passiveListenerCallback = object : PassiveListenerCallback {
        override fun onNewDataPointsReceived(dataPoints: DataPointContainer) {
            // Extract Heart Rate
            val hrDataPoints = dataPoints.getData(DataType.HEART_RATE_BPM)
            if (hrDataPoints.isNotEmpty()) {
                currentHeartRate = hrDataPoints.last().value
            }

            // Extract Steps
            val stepDataPoints = dataPoints.getData(DataType.STEPS_DAILY)
            if (stepDataPoints.isNotEmpty()) {
                val latestSteps = stepDataPoints.last().value
                if (sessionStartSteps == null) {
                    sessionStartSteps = latestSteps
                    Log.d(TAG, "Captured initial steps: $sessionStartSteps")
                }
                currentSteps = latestSteps
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "SensorRelayService created")
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "SensorRelayService starting")
        startForegroundService()
        checkPermissions()
        registerPassiveListener()
        startTicker()
        return START_STICKY
    }

    private fun startForegroundService() {
        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("StrideQuest Relay")
            .setContentText("Relay active: Broadcasting sensors to phone")
            .setSmallIcon(android.R.drawable.ic_menu_compass) // Replace with your app icon
            .setOngoing(true)
            .build()

        // Android 14+ requires specifying foreground service type
        try {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH)
        } catch (e: NoSuchMethodError) {
            // Fallback for older Android versions
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Sensor Relay Service",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Maintains connection with the phone for sensor relay"
        }
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(channel)
    }

    private fun checkPermissions() {
        hasBodySensorsPermission = ContextCompat.checkSelfPermission(
            this, android.Manifest.permission.BODY_SENSORS
        ) == PackageManager.PERMISSION_GRANTED

        hasActivityRecognitionPermission = ContextCompat.checkSelfPermission(
            this, android.Manifest.permission.ACTIVITY_RECOGNITION
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun registerPassiveListener() {
        val healthClient = HealthServices.getClient(this)
        val passiveMonitoringClient = healthClient.passiveMonitoringClient

        val dataTypes = mutableSetOf<DataType<*, *>>()
        if (hasBodySensorsPermission) {
            dataTypes.add(DataType.HEART_RATE_BPM)
        }
        if (hasActivityRecognitionPermission) {
            dataTypes.add(DataType.STEPS_DAILY)
        }

        if (dataTypes.isEmpty()) {
            Log.w(TAG, "No sensor permissions granted. Broadcasting nulls.")
            return
        }

        val config = PassiveListenerConfig.builder()
            .setDataTypes(dataTypes)
            .build()

        passiveMonitoringClient.setPassiveListenerCallback(
            config,
            passiveListenerCallback
        )
    }

    private fun startTicker() {
        tickerJob?.cancel()
        tickerJob = serviceScope.launch {
            while (isActive) {
                broadcastSensors()
                delay(1000) // 1-second coroutine ticker
            }
        }
    }

    private fun broadcastSensors() {
        // Calculate step delta
        val stepDelta: Long? = if (currentSteps != null && sessionStartSteps != null) {
            currentSteps!! - sessionStartSteps!!
        } else {
            null
        }

        val payload = JSONObject().apply {
            // Nulls will be handled if sensor is unsupported or permission denied
            put("heartRate", if (hasBodySensorsPermission) currentHeartRate else null)
            put("steps", if (hasActivityRecognitionPermission) stepDelta else null)
        }.toString()

        val messageClient = Wearable.getMessageClient(this)

        serviceScope.launch {
            try {
                // Determine nodes to send to (usually the paired phone)
                val nodeClient = Wearable.getNodeClient(this@SensorRelayService)
                val nodes = nodeClient.connectedNodes.await()
                
                for (node in nodes) {
                    messageClient.sendMessage(node.id, MESSAGE_PATH, payload.toByteArray())
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to broadcast sensors", e)
            }
        }
    }

    override fun onDestroy() {
        Log.d(TAG, "SensorRelayService destroying")
        // Clean up ticker
        tickerJob?.cancel()
        serviceScope.cancel()

        // Unregister listener
        try {
            val healthClient = HealthServices.getClient(this)
            healthClient.passiveMonitoringClient.clearPassiveListenerCallbackAsync()
        } catch (e: Exception) {
            Log.e(TAG, "Error unregistering listener", e)
        }

        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null // We are using a started service, not bounded
    }
}
