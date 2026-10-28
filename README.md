# RC Smart Gauge — Android + Next.js web companion

The **Next.js web app and ESP32 internet uploader** are in [web/](web/README.md) and [firmware/wifi-telemetry/](firmware/wifi-telemetry/README.md). The web version targets Vercel + Upstash Redis, with configurable ESP32 Wi-Fi/HTTPS URL/secret, protected Live telemetry, an offline Demo and a detailed original 3D drift coupe. See [web verification](docs/WEB-TEST-REPORT.md).

## Native Android demo

Landscape Kotlin / Jetpack Compose tablet companion for an RC drift car. Phase 0–1 uses **offline deterministic Demo** data. The original screenshot is visual direction; it is not used as a UI bitmap.

## Build

Pinned toolchain: JDK 17, Gradle 8.11.1, Android Gradle Plugin 8.9.2, Kotlin/Compose compiler 2.0.21, Compose BOM 2025.04.01, Android SDK/build tools 35/35.0.0. Minimum Android 8.0 (API 26).

Open this directory in Android Studio, install SDK 35, and select JDK 17. Or set `JAVA_HOME` and `ANDROID_HOME`, then run:

```powershell
& 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -NoProfile -ExecutionPolicy Bypass -File .\tools\build.ps1
```

The helper detects the project-local `.tools` toolchain when available. That directory is ignored by Git. APK: `app/build/outputs/apk/debug/app-debug.apk`. Unit results: `app/build/reports/tests/testDebugUnitTest/index.html`. Lint: `app/build/reports/lint-results-debug.html`.

For an already running emulator or your explicitly selected Android device:

```powershell
adb install -r app\build\outputs\apk\debug\app-debug.apk
adb shell am start -n com.rcvision/.MainActivity
```

## Run the demo

1. Open RC Smart Gauge, press **Start Session**. Permanent DEMO and RX/VISION SIM indicators identify synthetic data.
2. The first sign sighting at 2 seconds starts lap 1. Confirmation requires 3 observations; the timestamp is the first observation.
3. Subsequent sightings at 31, 59 and 89 seconds yield 29, 28 and 30 second laps. Lap 2 becomes BEST. The sequence repeats every 87 seconds.
4. Tap the 3D scene to enlarge/restore. Connection and timing remain visible.
5. Select Turbo I6, V12 or Rotary and **Unmute** for procedural sound. Startups and resumes are muted. Volume/preset preferences persist locally.
6. **End Session** freezes the total and unfinished lap time. **Start Session** starts a fresh deterministic run. There is no Pause.
7. Telemetry, Sounds and Devices explain current demo values and unavailable later-phase functions.

## Limits

No physical receiver/camera connection, live OCR, measured speed/battery/temperature, real engine recordings, Room/CSV export or firmware is delivered in Phase 1. The device and diagnostic screens state these limits. Current session data is in memory and survives configuration changes through ViewModel, but is discarded after process death; it never silently resumes. Durable interrupted-session recovery is Phase 2.

The true 3D scene uses owned procedural geometry and OpenGL ES 2.0. It is intentionally stylized; it does not match the reference's detailed coupe asset or lighting. Demo steering controls cosmetic car yaw, not measured drift. Gears/RPM are SIM, sensor values remain absent. No camera/radio permissions or cloud services are requested.

See `docs/ARCHITECTURE.md`, `docs/CHECKLIST.md` and `docs/TEST-REPORT.md` for decisions and actual verification.

Actual emulator captures: [16:10](docs/screenshots/drive-16x10.png) · [16:9](docs/screenshots/drive-16x9.png).
