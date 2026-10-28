# Decisions — Phase 0–1

- Native Kotlin + Compose, ViewModel and coroutines. Single app module with replaceable source/domain/render packages for the initial vertical slice.
- Use the supported pinned AGP 8.9.x toolchain, not dynamic versions. Compatibility verified against https://developer.android.com/build/releases/agp-8-9-0-release-notes . Compose library mapping: https://developer.android.com/develop/ui/compose/bom/bom-mapping . These are established stable versions, not a claim to use the newest releases.
- Renderer spike: direct OpenGL ES 2.0 provides real perspective/depth/meshes without a third-party renderer dependency. Shared cube buffer and transforms build owned low-poly cars, track and symbolic START sign. GLSurfaceView follows activity lifecycle. Filament/lighting upgrade should follow target-tablet profiling.
- Android elapsedRealtime drives durations; deterministic 100 ms observations are generated independently from renderer frame rate. First qualifying observation timestamps consecutive laps without gaps. Best excludes invalid/unfinished laps and retains the earliest equal best.
- Lap controller rejects duplicated/reordered observations and does not equate data gaps with sign absence. A gap invalidates the current lap; fresh absence and a new sighting are required. Actual reboot/clock mapping and bounding-box consistency are deferred with the live camera adapter.
- Synthetic PCM runs on a dedicated audio thread, maintains oscillator phase and smooths gain/frequency. Focus loss/backgrounding mutes; stale samples fade. Audio is lazily initialized when explicitly enabled. No latency or authentic-sound claims.
- SharedPreferences holds only Phase 1 volume/preset; DataStore and Room/session interruption recovery are Phase 2. No fake Live source or wiring assignments.
- `core/Contracts.kt` defines TelemetrySource, FrameSource, TextRecognizer, VehicleDetector, SceneMapper, LapController, EngineSoundEngine, SessionRepository and MonotonicClock. Frame/vision/repository interfaces have no fake implementations. The demo uses the Android monotonic clock directly in its ViewModel; clock injection can accompany replay/persistence work.

## Future receiver contract

Use the handoff's schema 1 packets: device_id, boot_id, seq, t_capture_us, throttle [-1,1], steering [-1,1], steering_source, signal_valid, optional speed_mps/battery_v/motor_temp_c. Null sensors stay absent. Reject malformed/out-of-range/stale/reordered samples before state updates. Map device clocks and retain uncertainty before capture-derived timing. No firmware pin table until receiver voltage/protocol, ESC/gyro wiring, ESP32 board/camera, power and tablet details are confirmed.
