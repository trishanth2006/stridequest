package com.stridequest.wearos.presentation

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import android.Manifest
import android.content.Intent
import android.os.Build
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import com.stridequest.wearos.service.SensorRelayService
import androidx.wear.compose.material.*

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            StrideQuestWearTheme {
                RunScreen()
            }
        }
    }
}

@Composable
fun StrideQuestWearTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colors = Colors(
            primary = Color(0xFF00FF00), // Neon Green
            background = Color.Black,
            onBackground = Color.White
        ),
        content = content
    )
}

@Composable
fun RunScreen() {
    val context = LocalContext.current
    var isRunning by remember { mutableStateOf(false) }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        // Wear OS can sometimes split permission requests or silently deny non-critical ones.
        // The SensorRelayService is designed to gracefully degrade if a specific sensor permission is missing.
        val hasAnySensor = permissions[Manifest.permission.BODY_SENSORS] == true || 
                           permissions[Manifest.permission.ACTIVITY_RECOGNITION] == true
                           
        if (hasAnySensor) {
            isRunning = true
            val intent = Intent(context, SensorRelayService::class.java)
            ContextCompat.startForegroundService(context, intent)
        } else {
            Toast.makeText(context, "At least one sensor permission is required", Toast.LENGTH_SHORT).show()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colors.background),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // Dummy GPS / Signal Indicator
            Text(
                text = if (isRunning) "RELAY ACTIVE" else "GPS: READY",
                color = if (isRunning) Color.Red else Color.Gray,
                fontSize = 10.sp
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Main Stat (Distance)
            Text(
                text = "0.00",
                color = Color.White,
                fontSize = 32.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "KILOMETERS",
                color = MaterialTheme.colors.primary,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Start Button
            Button(
                onClick = {
                    if (isRunning) {
                        isRunning = false
                        val intent = Intent(context, SensorRelayService::class.java)
                        context.stopService(intent)
                    } else {
                        val permissions = mutableListOf(
                            Manifest.permission.BODY_SENSORS,
                            Manifest.permission.ACTIVITY_RECOGNITION
                        )
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
                        }
                        permissionLauncher.launch(permissions.toTypedArray())
                    }
                },
                modifier = Modifier.size(ButtonDefaults.LargeButtonSize),
                colors = ButtonDefaults.primaryButtonColors(
                    backgroundColor = if (isRunning) Color.Red else MaterialTheme.colors.primary
                )
            ) {
                Text(text = if (isRunning) "STOP" else "GO", color = Color.Black, fontWeight = FontWeight.Bold)
            }
        }
    }
}