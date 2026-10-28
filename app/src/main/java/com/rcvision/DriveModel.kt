package com.rcvision

import android.app.Application
import android.os.SystemClock
import androidx.compose.runtime.*
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.rcvision.core.*
import com.rcvision.data.DemoSource
import com.rcvision.domain.SynthEngine
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class DriveModel(application: Application) : AndroidViewModel(application) {
    private val prefs = application.getSharedPreferences("demo-settings", 0)
    private val source = DemoSource()
    var controller = LapController(); private set
    var telemetry by mutableStateOf(Telemetry()); private set
    var elapsed by mutableLongStateOf(0); private set
    var active by mutableStateOf(false); private set
    var seen by mutableStateOf(false); private set
    var laps by mutableStateOf<List<Lap>>(emptyList()); private set
    var muted by mutableStateOf(true)
    var volume by mutableFloatStateOf(prefs.getFloat("volume", 0.6f))
    var profile by mutableIntStateOf(prefs.getInt("profile", 0))
    var screen by mutableStateOf("Drive")
    var enlarged by mutableStateOf(false)
    var foreground by mutableStateOf(false)
    var audioGranted by mutableStateOf(false)
    private var synth: SynthEngine? = null
    private var started = 0L
    private var step = -1L
    val best get() = laps.filter { it.valid }.minByOrNull { it.durationMs }
    val current get() = controller.lapStartMs?.let { (elapsed - it).coerceAtLeast(0) }
    init {
        viewModelScope.launch {
            while (true) {
                if (active) {
                    elapsed = SystemClock.elapsedRealtime() - started
                    telemetry = source.sample(elapsed)
                    while (step < elapsed / 100) { step++; controller.observe(source.observation(step)) }
                    seen = source.observation(step).text != null
                    laps = controller.laps.toList()
                }
                synth?.apply { volume = if (!muted && foreground && audioGranted && active) this@DriveModel.volume else 0f; profile = this@DriveModel.profile; update(telemetry, active && foreground) }
                delay(33)
            }
        }
    }
    fun start() { controller = LapController(); laps = emptyList(); elapsed = 0; step = -1; started = SystemClock.elapsedRealtime(); active = true }
    fun end() { active = false; seen = false }
    fun enableAudio() { if (synth == null) synth = SynthEngine() }
    fun saveSettings() { prefs.edit().putFloat("volume", volume).putInt("profile", profile).apply() }
    override fun onCleared() { synth?.close() }
}
