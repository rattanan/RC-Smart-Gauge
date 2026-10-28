package com.rcvision.domain

import android.media.*
import com.rcvision.core.*
import kotlin.concurrent.thread
import kotlin.math.*

/** Phase-continuous PCM, independent from the UI/vision thread. */
class SynthEngine : EngineSoundEngine {
    @Volatile private var running = true
    @Volatile private var rpm = 900f
    @Volatile var volume = 0f
    @Volatile var profile = 0
    @Volatile private var fresh = false
    @Volatile private var updatedAt = 0L
    private val worker = thread(name = "RCVision-PCM") {
        android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_AUDIO)
        val rate = 44100
        val track = AudioTrack.Builder().setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
            .setAudioFormat(AudioFormat.Builder().setSampleRate(rate).setEncoding(AudioFormat.ENCODING_PCM_16BIT).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
            .setBufferSizeInBytes(max(4096, AudioTrack.getMinBufferSize(rate, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT))).build()
        var phase = 0.0; var gain = 0.0; var frequency = 45.0
        try {
            track.play()
            val samples = ShortArray(512)
            while (running) {
                val target = if (fresh && android.os.SystemClock.elapsedRealtime() - updatedAt < 300) volume.toDouble() * 0.2 else 0.0
                for (i in samples.indices) {
                    gain += (target - gain) * 0.001
                    val desired = rpm / 60.0 * when (profile) { 1 -> 6.0; 2 -> 2.0; else -> 3.0 }
                    frequency += (desired - frequency) * 0.0005
                    phase = (phase + 2 * PI * frequency / rate) % (2 * PI)
                    val wave = sin(phase) + 0.35 * sin(2 * phase) + (if (profile == 2) 0.3 else 0.15) * sin(3 * phase)
                    samples[i] = (wave * gain * 24000).toInt().coerceIn(-32767, 32767).toShort()
                }
                track.write(samples, 0, samples.size)
            }
        } finally { track.stop(); track.release() }
    }
    override fun update(telemetry: Telemetry, fresh: Boolean) {
        rpm = telemetry.rpm; this.fresh = fresh; updatedAt = android.os.SystemClock.elapsedRealtime()
    }
    override fun close() { running = false }
}
