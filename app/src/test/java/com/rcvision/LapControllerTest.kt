package com.rcvision

import com.rcvision.core.*
import com.rcvision.data.DemoSource
import org.junit.Assert.*
import org.junit.Test

class LapControllerTest {
    private fun feed(engine: LapController, from: Long, to: Long, text: String?) {
        for(t in from..to step 100) engine.observe(TextObservation(t,t,text))
    }
    @Test fun continuousSignDoesNotCountRepeatedLaps() {
        val e=LapController(); feed(e,0,20000,"START")
        assertEquals(0,e.laps.size); assertEquals(0L,e.lapStartMs)
    }
    @Test fun completeWordAndCaseNormalization() {
        val e=LapController(); feed(e,0,1000,"RESTART"); assertNull(e.lapStartMs)
        feed(e,1100,1400," start "); assertEquals(1100L,e.lapStartMs)
    }
    @Test fun earlyReturnRequiresNewAbsence() {
        val e=LapController(); feed(e,0,400,"START"); feed(e,500,2400,null)
        feed(e,2500,11000,"START"); assertTrue(e.laps.isEmpty())
        feed(e,11100,13000,null); feed(e,13100,13500,"START")
        assertEquals(1,e.laps.size); assertEquals(13100L,e.laps[0].durationMs)
    }
    @Test fun outageCannotCountReliableLapAndReplayIsIgnored() {
        val e=LapController(); feed(e,0,300,"START"); feed(e,400,11000,null)
        e.observe(TextObservation(14000,14000,"START")); feed(e,14100,15000,"START")
        assertTrue(e.laps.isEmpty()); assertTrue(e.unverified)
        feed(e,15100,17000,null); feed(e,17100,17500,"START")
        assertEquals(1,e.laps.size); assertFalse(e.laps.first().valid); assertNull(e.best)
        e.observe(TextObservation(17100,17100,"START")); assertEquals(1,e.laps.size)
    }
    @Test fun deterministicDemoProducesExpectedLapsAndBest() {
        val e=LapController(); val source=DemoSource()
        for(step in 0L..900L) e.observe(source.observation(step))
        assertEquals(listOf(29000L,28000L,30000L),e.laps.map { it.durationMs })
        assertEquals(2,e.best?.index)
        assertEquals(89000L,e.lapStartMs)
        assertNull(source.sample(1000).speed); assertNull(source.sample(1000).battery)
    }
    @Test fun intermittentMissesCannotRearm() {
        val e=LapController(); feed(e,0,500,"START")
        for(t in 600L..15000L step 100) e.observe(TextObservation(t,t,if(t%1000<300) "START" else null))
        assertTrue(e.laps.isEmpty())
    }
    @Test fun equalBestRetainsEarliestAndUnfinishedIsExcluded() {
        val e=LapController(); feed(e,0,400,"START"); feed(e,500,10900,null)
        feed(e,11000,11400,"START"); feed(e,11500,21900,null); feed(e,22000,22400,"START")
        assertEquals(2,e.laps.size); assertEquals(1,e.best?.index); assertEquals(22000L,e.lapStartMs)
    }
    @Test fun outOfOrderTimestampAndDuplicateSequenceDoNotStart() {
        val e=LapController()
        e.observe(TextObservation(5,500,"START"))
        e.observe(TextObservation(5,600,"START")); e.observe(TextObservation(6,400,"START"))
        assertNull(e.lapStartMs)
        e.observe(TextObservation(7,700,"START")); e.observe(TextObservation(8,800,"START"))
        assertEquals(500L,e.lapStartMs)
    }
}
