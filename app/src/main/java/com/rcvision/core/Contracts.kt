package com.rcvision.core

import kotlinx.coroutines.flow.StateFlow

data class Telemetry(val throttle: Float = 0f, val steering: Float = 0f, val rpm: Float = 900f,
    val gear: Int = 1, val speed: Float? = null, val battery: Float? = null, val temperature: Float? = null)
data class Frame(val sequence: Long, val captureMs: Long, val jpeg: ByteArray)
data class TextObservation(val sequence: Long, val captureMs: Long, val text: String?, val fresh: Boolean = true)
data class Scene(val steering: Float, val leadVisible: Boolean, val demo: Boolean)
interface MonotonicClock { fun nowMs(): Long }
interface TelemetrySource { fun sample(elapsedMs: Long): Telemetry }
interface FrameSource { val frames: StateFlow<Frame?> }
interface TextRecognizer { suspend fun recognize(frame: Frame): TextObservation }
interface VehicleDetector { suspend fun detect(frame: Frame): Boolean }
interface SceneMapper { fun map(telemetry: Telemetry, leadDetected: Boolean): Scene }
interface EngineSoundEngine { fun update(telemetry: Telemetry, fresh: Boolean); fun close() }
interface SessionRepository { suspend fun save(snapshot: SessionSnapshot) }
data class SessionSnapshot(val elapsedMs: Long, val laps: List<Lap>, val interrupted: Boolean)
data class Lap(val index: Int, val startMs: Long, val endMs: Long, val valid: Boolean = true) {
    val durationMs: Long get() = endMs - startMs
}

/** Capture-derived events; a missing camera observation is never evidence of absence. */
class LapController(private val minimumLapMs: Long = 10_000) {
    enum class State { WAITING_FOR_START, DISARMED_VISIBLE, WAITING_TO_REARM, ARMED }
    var state = State.WAITING_FOR_START; private set
    var lapStartMs: Long? = null; private set
    val laps = mutableListOf<Lap>()
    private var lastSequence = -1L
    private var lastTime = -1L
    private val positives = ArrayDeque<Long>()
    private var absentSince: Long? = null
    var unverified = false; private set
    val best: Lap? get() = laps.filter { it.valid }.minByOrNull { it.durationMs }
    fun observe(observation: TextObservation) {
        val o = observation
        if (o.sequence <= lastSequence || o.captureMs < lastTime) return
        if (!o.fresh || (lastTime >= 0 && o.captureMs - lastTime > 1000)) {
            unverified = lapStartMs != null
            positives.clear(); absentSince = null
            if (lapStartMs != null) state = State.DISARMED_VISIBLE
        }
        lastSequence = o.sequence; lastTime = o.captureMs
        if (!o.fresh) return
        val seen = o.text?.trim()?.uppercase() == "START"
        if (!seen) {
            positives.clear()
            if (absentSince == null) absentSince = o.captureMs
            if (state != State.WAITING_FOR_START && o.captureMs - absentSince!! >= 1500) {
                state = State.WAITING_TO_REARM
                if (o.captureMs - (lapStartMs ?: o.captureMs) >= minimumLapMs) state = State.ARMED
            }
            return
        }
        absentSince = null
        if (state == State.WAITING_TO_REARM) state = State.DISARMED_VISIBLE
        positives.addLast(o.captureMs)
        while (positives.isNotEmpty() && o.captureMs - positives.first() > 500) positives.removeFirst()
        if (positives.size < 3) return
        val eventMs = positives.first()
        if (state == State.WAITING_FOR_START || state == State.ARMED) {
            lapStartMs?.let { laps.add(Lap(laps.size + 1, it, eventMs, !unverified)) }
            lapStartMs = eventMs; unverified = false; state = State.DISARMED_VISIBLE
        }
    }
}
