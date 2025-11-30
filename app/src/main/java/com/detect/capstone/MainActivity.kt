package com.detect.capstone

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Bundle
import android.webkit.GeolocationPermissions
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat

class MainActivity : AppCompatActivity(), SensorEventListener {

    private lateinit var webView: WebView

    // SAF-export folder
    var exportFolderUri: Uri? = null
    private val REQUEST_EXPORT_FOLDER = 9911

    // Bridge for JS <-> Android
    lateinit var androidBridge: AndroidBridge

    // Compass sensor fields
    private lateinit var sensorManager: SensorManager
    private var rotationVectorSensor: Sensor? = null
    private val rotationMatrix = FloatArray(9)
    private val orientation = FloatArray(3)

    // For RELATIVE heading (0° at app boot orientation)
    private var baseHeadingDeg: Float? = null

    private val GEO_PERMISSION = 111

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // ----- Location permissions -----
        if (ActivityCompat.checkSelfPermission(
                this,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                ),
                GEO_PERMISSION
            )
        }

        // ----- WebView setup -----
        webView = findViewById(R.id.webview)
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.allowFileAccess = true
        settings.allowFileAccessFromFileURLs = true
        settings.allowUniversalAccessFromFileURLs = true

        webView.webViewClient = WebViewClient()
        webView.webChromeClient = object : WebChromeClient() {
            override fun onGeolocationPermissionsShowPrompt(
                origin: String?,
                callback: GeolocationPermissions.Callback?
            ) {
                callback?.invoke(origin, true, false)
            }
        }

        // JS bridge (export, etc.)
        androidBridge = AndroidBridge(this)
        webView.addJavascriptInterface(androidBridge, "AndroidBridge")

        webView.loadUrl("file:///android_asset/www/index.html")

        // ----- Compass / heading sensor -----
        sensorManager = getSystemService(SENSOR_SERVICE) as SensorManager
        rotationVectorSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
    }

    // SAF folder picker – called from AndroidBridge
    fun pickExportFolder() {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE)
        intent.addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION or
                    Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
                    Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
        )
        startActivityForResult(intent, REQUEST_EXPORT_FOLDER)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)

        if (requestCode == REQUEST_EXPORT_FOLDER && resultCode == Activity.RESULT_OK) {
            data?.data?.let { uri ->
                contentResolver.takePersistableUriPermission(
                    uri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION or
                            Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                )

                exportFolderUri = uri
                Toast.makeText(this, "Folder selected!", Toast.LENGTH_LONG).show()

                // Continue any pending export
                androidBridge.exportPendingFiles()
            }
        }
    }

    // ---- Sensor lifecycle ----
    override fun onResume() {
        super.onResume()
        rotationVectorSensor?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME)
        }
    }

    override fun onPause() {
        super.onPause()
        sensorManager.unregisterListener(this)
    }

    // ---- Sensor callback: compute RELATIVE heading and send to JS ----
    override fun onSensorChanged(event: SensorEvent) {
        if (event.sensor.type == Sensor.TYPE_ROTATION_VECTOR) {
            SensorManager.getRotationMatrixFromVector(rotationMatrix, event.values)
            SensorManager.getOrientation(rotationMatrix, orientation)

            val azimuthRad = orientation[0]
            var azimuthDeg = Math.toDegrees(azimuthRad.toDouble()).toFloat()
            if (azimuthDeg < 0) azimuthDeg += 360f  // 0..360 absolute

            // Set base heading once at startup to define "0°"
            if (baseHeadingDeg == null) {
                baseHeadingDeg = azimuthDeg
            }

            val base = baseHeadingDeg ?: azimuthDeg
            var relative = azimuthDeg - base
            if (relative < 0f) relative += 360f
            if (relative >= 360f) relative -= 360f

            // Debug in Logcat
            println("RAW HEADING: $azimuthDeg  RELATIVE: $relative")

            val js = "window.updateHeadingFromNative(${relative});"
            webView.post {
                webView.evaluateJavascript(js, null)
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
        // no-op
    }
}
