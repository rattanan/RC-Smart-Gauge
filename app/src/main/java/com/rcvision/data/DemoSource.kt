package com.rcvision.data

import com.rcvision.core.*
import kotlin.math.sin

/** Fixed 29/28/30 second passes. Independent of rendering FPS. */
class DemoSource : TelemetrySource {
    override fun sample(elapsedMs: Long): Telemetry {
        val t = elapsedMs / 1000.0
        val throttle = (0.42 + 0.27 * sin(t * 0.7)).toFloat()
        val rpm = 900 + throttle * 6800
        return Telemetry(throttle, (sin(t * 0.43) * 0.85).toFloat(), rpm, (rpm / 2000).toInt().coerceIn(1, 4))
    }
    fun observation(step: Long): TextObservation {
        val ms = step * 100
        val inCycle = (ms - 2000).mod(87000)
        val visible = ms >= 2000 && (inCycle < 800 || inCycle in 29000..29799 || inCycle in 57000..57799)
        return TextObservation(step, ms, if (visible) "START" else null)
    }
}
