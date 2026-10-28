# RC Smart Gauge — Phase 0–1 verification

Date: 28 October 2026 (Asia/Bangkok).

## Build and automated checks

Command: `:app:assembleDebug :app:testDebugUnitTest :app:lintDebug` using pinned Gradle/JDK/SDK in README.

- Debug APK builds successfully.
- Delivery APK: `dist/RC-Smart-Gauge-demo.apk` (9,775,851 bytes). APK Signature Scheme v2 verification passes. SHA-256: `c093ca5788b17427a6fc05adbe99e6f035ac4eb5160779c7192f9e5338646017`.
- 8 JVM tests pass, zero failures/errors/skips: continuous START visibility, complete-word/case normalization, early return, outage/controlled rearm, deterministic lap durations/best, intermittent misses, equal-best retention/unfinished exclusion, duplicate/out-of-order rejection.
- Android lint completes with zero errors. Remaining warnings concern pinned older dependencies, a Compose modifier convention, landscape orientation, backup extraction metadata and a SharedPreferences KTX suggestion. No warnings are suppressed to make the report pass.

Machine-readable results remain in `app/build/test-results/testDebugUnitTest/`; HTML results are in `app/build/reports/`.

## Actual emulator execution

Android 11 / API 30 x86_64 emulator, Windows Hypervisor Platform, SwiftShader software graphics, density 160. Tested at 1280×800 (16:10) and 1280×720 (16:9).

- Installed the APK and launched the native activity. No app AndroidRuntime crash appeared during the checks.
- Start Session advances total/current timers and synthetic gauges; first START begins an unfinished lap without incrementing completed count.
- Observed an actual 125-second demo run: four completed laps of 29, 28, 30 and 29 seconds; BEST = 28 seconds (lap 2); unfinished lap = 7 seconds. End Session freezes the 125-second total. This agrees with the independent unit fixture.
- Drive, Telemetry, Sounds and Devices navigation opens the corresponding content. Demo-only availability is explained on device/diagnostic screens.
- Tapping the scene enlarges/restores it while preserving DEMO, source status and timing strip.
- Enabled audio: Android audio-focus dump shows RC Smart Gauge with GAIN and a started AudioTrack. This verifies focus/PCM startup, not audible fidelity or measured latency. Background/resume check returned the UI to Unmute; saved preferences contained volume 0.30882353 and preset index 1 after changing the controls.
- Inspected rendered screenshots at both aspect ratios. Fixed compact sensor-column clipping discovered at 16:9 and reduced compact RPM typography.

Screenshots in `docs/screenshots/` are captured from the app, not design mockups.

## Environment notes

The host initially had no JDK/SDK. Build tools were downloaded into ignored `.tools/`. The long sandbox TEMP path broke JDK Unix-domain wakeup sockets; the build helper specifies a shorter project-local socket directory. The emulator's initial empty userdata template did not boot; an isolated 512 MB ext4 data image was created with SDK mke2fs. Downloaded system-image compression reclaimed disk space. No unrelated user files or device settings were changed.

## Unverified / later phases

- No physical tablet or RC hardware test, radio coexistence, real receiver input, camera stream, live OCR, vehicle detector or wiring.
- No claims about FPS, actual camera accuracy, sign timing error, audio latency, audible quality, heat or 20-minute endurance. Emulator software rendering provides functional checks only.
- Current demo history is in memory. Room/DataStore, interrupted-session persistence, CSV and real OCR replay are Phase 2.
- The stylized procedural 3D cars and flat lighting are simpler than the reference image. A licensed detailed coupe/lighting pass can improve visual fidelity later without changing functional controls.
