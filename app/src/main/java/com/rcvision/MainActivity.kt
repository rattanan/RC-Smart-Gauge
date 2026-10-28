package com.rcvision

import android.media.*
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.*
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.view.WindowCompat
import com.rcvision.render.ChaseScene
import java.util.Locale
import kotlin.math.*

private val Cyan = Color(0xFF00DCEB)
private val Navy = Color(0xFF071725)
private val Border = Color(0xFF23485D)
private val Pale = Color(0xFF91CBE1)
private val LocalControlScale = staticCompositionLocalOf { 1f }
private fun time(ms: Long?): String = if (ms == null) "—" else String.format(Locale.US,"%02d:%04.1f",ms/60000,(ms%60000)/1000.0)

class MainActivity : ComponentActivity() {
    private val model: DriveModel by viewModels()
    private lateinit var audio: AudioManager
    private lateinit var request: AudioFocusRequest
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        WindowCompat.getInsetsController(window, window.decorView).apply {
            hide(androidx.core.view.WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = androidx.core.view.WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
        window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        audio = getSystemService(AudioManager::class.java)
        request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
            .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME).build())
            .setOnAudioFocusChangeListener { focus -> model.audioGranted = focus == AudioManager.AUDIOFOCUS_GAIN; if (!model.audioGranted) model.muted = true }.build()
        setContent {
            MaterialTheme(colorScheme = darkColorScheme(primary=Cyan, surface=Navy, background=Color(0xFF020C14))) {
                Dashboard(model) {
                    if (!model.muted) { model.muted = true; audio.abandonAudioFocusRequest(request); model.audioGranted = false }
                    else { model.audioGranted = audio.requestAudioFocus(request) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED; model.enableAudio(); model.muted = !model.audioGranted }
                }
            }
        }
    }
    override fun onResume() { super.onResume(); model.foreground = true }
    override fun onPause() { model.foreground = false; model.muted = true; audio.abandonAudioFocusRequest(request); super.onPause() }
}

@Composable private fun Label(text: String, size: Int = 14, color: Color = Color.White, bold: Boolean = false, modifier: Modifier = Modifier) {
    BasicText(text, modifier, style = TextStyle(color=color,fontSize=size.sp,fontWeight=if(bold) FontWeight.Bold else FontWeight.Medium,fontFamily=FontFamily.SansSerif))
}
@Composable private fun Panel(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Column(modifier.clip(RoundedCornerShape(12.dp)).background(Navy).border(1.dp,Border,RoundedCornerShape(12.dp)).padding(12.dp),content=content)
}
@Composable private fun Action(text: String, selected: Boolean = false, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Box(modifier.heightIn(min=(48f / LocalControlScale.current).dp).widthIn(min=(48f / LocalControlScale.current).dp).clip(RoundedCornerShape(7.dp)).background(if(selected) Color(0xFF073D50) else Navy)
        .border(1.dp,if(selected) Cyan else Border,RoundedCornerShape(7.dp)).clickable(onClick=onClick).padding(horizontal=14.dp,vertical=10.dp),contentAlignment=Alignment.Center) {
        Label(text,14,if(selected) Cyan else Color.White,true)
    }
}
@Composable private fun Dashboard(m: DriveModel, toggleAudio: () -> Unit) {
    BoxWithConstraints(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFF071B29),Color(0xFF010910))))) {
        // Scale density so common tablet sizes retain the same readable hierarchy.
        val scale = (maxWidth.value / 1280f).coerceIn(0.65f,1.6f)
        CompositionLocalProvider(LocalDensity provides Density(LocalDensity.current.density*scale, LocalDensity.current.fontScale), LocalControlScale provides scale) {
            Column(Modifier.fillMaxSize().padding(12.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
                Row(Modifier.fillMaxWidth().height(48.dp),verticalAlignment=Alignment.CenterVertically) {
                    Label("RC ",26,bold=true); Label("SMART GAUGE",26,Cyan,true)
                    Spacer(Modifier.width(16.dp)); Label(" DEMO ",14,Pale,true,Modifier.border(1.dp,Border,RoundedCornerShape(5.dp)).padding(6.dp))
                    Spacer(Modifier.weight(1f)); Label("● RX SIM   |   ● VISION SIM",13,Cyan)
                    Spacer(Modifier.width(16.dp)); Action("Settings") { m.screen="Devices" }
                }
                Panel(Modifier.fillMaxWidth()) {
                    Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceEvenly) {
                        Timing("SESSION",time(m.elapsed)); Timing("LAPS COMPLETED",m.laps.size.toString()); Timing("CURRENT LAP",time(m.current)); Timing("BEST LAP",time(m.best?.durationMs),true)
                    }
                }
                if (m.screen == "Drive") {
                    Row(Modifier.weight(1f),horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                        ScenePanel(m,Modifier.weight(if(m.enlarged) 1f else 0.63f).fillMaxHeight())
                        if (!m.enlarged) Column(Modifier.weight(0.37f),verticalArrangement=Arrangement.spacedBy(8.dp)) {
                            Gauge(m,Modifier.weight(0.72f))
                            History(m,Modifier.weight(0.28f))
                        }
                    }
                } else {
                    Panel(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState())) {
                        when(m.screen) {
                            "Telemetry" -> {
                                Label("TELEMETRY / DEMO SOURCE",22,Cyan,true)
                                Spacer(Modifier.height(18.dp))
                                Label("Synthetic throttle: ${(m.telemetry.throttle*100).toInt()}%    Steering: ${(m.telemetry.steering*100).toInt()}%",20)
                                Label("SIM RPM: ${m.telemetry.rpm.toInt()}    SIM GEAR: ${m.telemetry.gear}",20)
                                Label("Speed: —    Battery: —    Motor temperature: —",20)
                                Spacer(Modifier.height(16.dp)); Label("Lap state: ${m.controller.state} • 100 ms deterministic observation steps",16,Pale)
                                Label("No receiver or camera connected. Demo events use the same lap controller interface as future replay/live sources.",16,Pale)
                                Label("Passes: 00:02 → 00:31 → 00:59 → 01:29 • completed laps: 29s, 28s, 30s",16,Pale)
                                Spacer(Modifier.height(16.dp)); Label("Session records / CSV export arrive in Phase 2. Current demo history lasts while this process is open.",16,Pale)
                            }
                            "Sounds" -> {
                                Label("SYNTHETIC ENGINE LAB",22,Cyan,true)
                                Label("Procedural PCM presets • cosmetic RPM and gears • muted on startup",16,Pale)
                                Spacer(Modifier.height(20.dp)); Presets(m)
                                Spacer(Modifier.height(20.dp)); Label("Start a Demo Session and enable audio below to hear the throttle sweep.",18)
                                Label("Turbo I6: three firing pulses/rev • V12: six • Rotary: two with stronger third harmonic",16,Pale)
                                Label("Audio fades to silence after stale input; backgrounding or audio-focus loss mutes playback.",16,Pale)
                            }
                            else -> {
                                Label("DEVICES & SETTINGS",22,Cyan,true)
                                Spacer(Modifier.height(16.dp)); Label("SOURCE: OFFLINE DEMO",20)
                                Label("Receiver: simulated     Camera: simulated START observations",18,Pale)
                                Label("Live connection, endpoint setup and calibration are planned for Phases 3–4.",16,Pale)
                                Spacer(Modifier.height(20.dp)); Label("Before wiring: receiver model/protocol/voltage, ESC and gyro wiring, ESP32/camera board, BEC supply and tablet model are required.",18)
                                Spacer(Modifier.height(20.dp)); Action("Reset demo session") { m.start(); m.screen="Drive" }
                            }
                        }
                    }
                }
                Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(10.dp)) {
                    Action(if(m.active) "End Session" else "Start Session",true) { if(m.active) m.end() else m.start() }
                    Presets(m,Modifier.weight(1f))
                    Label("VOLUME",12,Pale)
                    Slider(value=m.volume,onValueChange={m.volume=it},onValueChangeFinished={m.saveSettings()},modifier=Modifier.width(140.dp))
                    Label("${(m.volume*100).toInt()}%",13)
                    Action(if(m.muted) "Unmute" else "Mute",!m.muted,onClick=toggleAudio)
                }
                Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                    listOf("Drive","Telemetry","Sounds","Devices").forEach { screen -> Action(screen,m.screen==screen,Modifier.weight(1f)) { m.screen=screen } }
                }
            }
        }
    }
}
@Composable private fun RowScope.Timing(title: String, value: String, accent: Boolean = false) {
    Column(Modifier.weight(1f),horizontalAlignment=Alignment.CenterHorizontally) {
        Label(title,13,if(accent) Cyan else Pale,true); Label(value,34,if(accent) Cyan else Color.White,true)
    }
}
@Composable private fun Presets(m: DriveModel, modifier: Modifier = Modifier) {
    Row(modifier,horizontalArrangement=Arrangement.spacedBy(6.dp)) {
        listOf("TURBO I6","V12","ROTARY").forEachIndexed { index, text -> Action(text,m.profile==index,Modifier.weight(1f)) { m.profile=index; m.saveSettings() } }
    }
}
@Composable private fun ScenePanel(m: DriveModel,modifier: Modifier) {
    Box(modifier.clip(RoundedCornerShape(12.dp)).background(Color(0xFFE9ECEF)).clickable { m.enlarged=!m.enlarged }) {
        val lifecycle = androidx.lifecycle.compose.LocalLifecycleOwner.current.lifecycle
        val view = remember { mutableStateOf<ChaseScene?>(null) }
        AndroidView(factory={ context -> ChaseScene(context).also { view.value=it } },modifier=Modifier.fillMaxSize(),update={ it.scene.steering=m.telemetry.steering; it.scene.elapsed=m.elapsed/1000f })
        DisposableEffect(lifecycle) {
            val observer = androidx.lifecycle.LifecycleEventObserver { _,event ->
                if(event == androidx.lifecycle.Lifecycle.Event.ON_RESUME) view.value?.onResume()
                if(event == androidx.lifecycle.Lifecycle.Event.ON_PAUSE) view.value?.onPause()
            }
            lifecycle.addObserver(observer)
            onDispose { lifecycle.removeObserver(observer); view.value?.onPause() }
        }
        Row(Modifier.align(Alignment.TopStart).padding(14.dp),horizontalArrangement=Arrangement.spacedBy(8.dp)) {
            Label("DEMO SCENE",13,Navy,true,Modifier.background(Color(0xFFB7DAF9),RoundedCornerShape(6.dp)).padding(10.dp))
            if(m.seen) Label("✓ START DETECTED",13,Navy,true,Modifier.background(Cyan,RoundedCornerShape(6.dp)).padding(10.dp))
        }
        Column(Modifier.align(Alignment.BottomStart).padding(14.dp)) {
            Label(if(m.active) "SYNTHETIC COURSE • TAP TO ${if(m.enlarged) "RESTORE" else "ENLARGE"}" else "START SESSION TO RUN DEMO",12,Navy,true)
            Label("Procedural 3D • simulated cars • sign-sighting timing",12,Navy)
        }
    }
}
@Composable private fun Gauge(m: DriveModel,modifier: Modifier) {
    Panel(modifier.fillMaxWidth()) {
        Label("SMART GAUGE",24,Cyan,true)
        Row(Modifier.weight(1f).fillMaxWidth(),verticalAlignment=Alignment.CenterVertically) {
            Box(Modifier.weight(0.73f).fillMaxHeight(),contentAlignment=Alignment.Center) {
                Canvas(Modifier.fillMaxSize().padding(10.dp)) {
                    val radius = min(size.width,size.height)*0.46f
                    val center = Offset(size.width/2,size.height/2)
                    val origin = Offset(center.x-radius,center.y-radius)
                    val arcSize = androidx.compose.ui.geometry.Size(radius*2,radius*2)
                    drawArc(Color(0xFF163B50),135f,270f,false,origin,arcSize,style=Stroke(12f))
                    for(i in 0..64) {
                        val a = (135+i*270.0/64)*PI/180
                        val outer = Offset(center.x+cos(a).toFloat()*radius,center.y+sin(a).toFloat()*radius)
                        val inner = Offset(center.x+cos(a).toFloat()*radius*(if(i%8==0) 0.88f else 0.94f),center.y+sin(a).toFloat()*radius*(if(i%8==0) 0.88f else 0.94f))
                        drawLine(if(i<36) Cyan else if(i<49) Color(0xFFB064F2) else Color(0xFFFF315B),inner,outer,if(i%8==0) 4f else 2f)
                    }
                    val a = (135 + m.telemetry.rpm.coerceIn(0f,8000f)/8000*270)*PI/180
                    drawLine(Cyan,center,Offset(center.x+cos(a).toFloat()*radius*0.8f,center.y+sin(a).toFloat()*radius*0.8f),5f)
                    drawCircle(Cyan,6f,center)
                }
                BoxWithConstraints(Modifier.fillMaxSize()) {
                    val rpmTextSize = if(maxHeight < 210.dp) 24 else 32
                    for(i in 0..4) {
                        val a = (135+i*67.5)*PI/180
                        val r = min(maxWidth.value,maxHeight.value)*0.34
                        Label("${i*2}",15,bold=true,modifier=Modifier.offset((maxWidth.value/2+cos(a)*r-5).dp,(maxHeight.value/2+sin(a)*r-10).dp))
                    }
                    Column(Modifier.align(Alignment.BottomCenter).padding(bottom=12.dp),horizontalAlignment=Alignment.CenterHorizontally) {
                        Label(String.format(Locale.US,"%,d",m.telemetry.rpm.toInt()),rpmTextSize,Cyan,true)
                        Label("SIM RPM",11,Cyan,true); Label("${m.telemetry.gear}  SIM GEAR",15,Cyan,true)
                    }
                }
            }
            Column(Modifier.weight(0.27f).fillMaxHeight(),verticalArrangement=Arrangement.SpaceEvenly) {
                listOf("SPEED" to "km/h","BATTERY" to "V","MOTOR" to "°C").forEach { (name,unit) ->
                    Column {
                        Label(name,10,Pale)
                        Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(6.dp)) {
                            Label("—",23,bold=true); Label(unit,10,Pale)
                        }
                    }
                }
            }
        }
        Bar("THROTTLE",m.telemetry.throttle,false)
        Spacer(Modifier.height(6.dp)); Bar("STEERING",m.telemetry.steering,true)
    }
}
@Composable private fun Bar(title: String, value: Float, centered: Boolean) {
    Column {
        Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween) { Label(title,12,Pale,true); Label("${(value*100).toInt()}%",13,bold=true) }
        Canvas(Modifier.fillMaxWidth().height(15.dp)) {
            drawRoundRect(Color(0xFF14374B),cornerRadius=androidx.compose.ui.geometry.CornerRadius(8f,8f))
            val v = value.coerceIn(if(centered) -1f else 0f,1f)
            val x = if(centered) size.width/2 else 0f
            val end = if(centered) x+v*size.width/2 else v*size.width
            drawRect(Cyan,Offset(min(x,end),0f),androidx.compose.ui.geometry.Size(abs(end-x),size.height))
            if(centered) drawLine(Color.White,Offset(x,0f),Offset(x,size.height),3f)
        }
    }
}
@Composable private fun History(m: DriveModel,modifier: Modifier) {
    Panel(modifier.fillMaxWidth()) {
        Label("LAP HISTORY",16,Pale,true)
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
            if(m.laps.isEmpty()) Label("Awaiting first completed lap",13,Pale)
            m.laps.asReversed().forEach { lap ->
                val best = lap == m.best
                Row(Modifier.fillMaxWidth().padding(vertical=5.dp),horizontalArrangement=Arrangement.SpaceBetween) {
                    Label("LAP %02d".format(lap.index),14,if(best) Cyan else Color.White,true)
                    Label(time(lap.durationMs),14,if(best) Cyan else Color.White,true)
                    Label(if(best) "BEST" else if(!lap.valid) "INVALID" else "",11,Cyan)
                }
            }
            if(!m.active && m.current != null) Label("Unfinished: ${time(m.current)}",12,Pale)
        }
    }
}
