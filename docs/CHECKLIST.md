# Delivery checklist

## Phase 0
- [x] Inspect repository and supplied handoff; preserve reference files.
- [x] Create native Android project, version catalog, wrapper and build helper.
- [x] Record architecture and hardware boundaries.
- [x] Build debug APK and launch on an Android 11 emulator; see TEST-REPORT.

## Phase 1
- [x] Landscape Drive layout, timing strip, gauge, throttle/centered steering, lap history.
- [x] True 3D rear camera scene, procedural own/lead car, course and symbolic sign.
- [x] Deterministic offline telemetry/START demo, lap controller, best/unfinished handling.
- [x] Start/End, scene enlargement, navigation, preset/volume/mute, audio focus/lifecycle.
- [x] Missing sensor values and explicit DEMO/SIM labeling.
- [x] Meaningful lap-engine tests.
- [x] Debug APK, eight passing unit tests, zero lint errors and runtime checks at 16:10 and 16:9; see TEST-REPORT.

## Later phases (not claimed complete)
- [ ] Phase 2: Room, DataStore, interrupted recovery, CSV, actual OCR/replay fixtures.
- [ ] Phases 3–4: confirmed hardware, calibrated receiver input, timestamped camera, clock mapping.
- [ ] Phase 5: sound quality evaluation and measured latency.
- [ ] Phase 6: evaluated RC-car detector and live symbolic lead.
- [ ] Phase 7: physical tablet performance, radio coexistence, sustained 20-minute field test.
