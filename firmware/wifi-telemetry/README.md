# ESP32 Wi-Fi → internet uploader (prototype)

The firmware configures Wi-Fi, full HTTPS destination URL, secret, device ID, trusted root CA and upload interval through a temporary local setup page. Settings persist in Preferences/NVS. **The current `readTelemetry()` emits labeled synthetic data and never touches receiver/servo/ESC GPIO.**

## Compile

Install PlatformIO Core 6.1.19 and run from this folder:

```text
pio run
```

Pinned platform: espressif32 6.12.0, reference target `esp32dev`, Arduino core 2.0.17, ArduinoJson 7.4.2. The reference target verifies generic ESP32 compilation only; it does not identify the user's actual board or prove camera-board compatibility. No upload/flash action was performed. Confirm the board before selecting an upload environment.

On this Windows host, the legacy GCC command exceeded path limits under long SDK directories. Building with verified Windows 8.3 paths for the project and `PLATFORMIO_CORE_DIR` worked; all toolchain files remain under the workspace `.tools` directory. No virtual drives or global toolchain changes were made.

## Configure after a separately authorized hardware flash

1. Open Serial Monitor at 115200 baud. On first boot with no settings, a temporary `RC-Smart-Gauge-…` Wi-Fi network starts.
2. Use its randomly generated Wi-Fi password printed in Serial Monitor. This password protects setup access; it is separate from the stored device secret.
3. Open `http://192.168.4.1`, enter your normal Wi-Fi SSID/password, production `https://…/api/ingest` URL, device ID, server `DEVICE_SECRET`, CA PEM and interval (200–10000 ms; default 250 ms).
4. Save and restart. NTP must synchronize before uploading. The board verifies the HTTPS hostname/certificate, refuses redirects and never calls `setInsecure()`.
5. Open the production web dashboard, select Live and login with its separate dashboard password. Synthetic ESP packets show an **ESP32 DEMO SOURCE** notice. No measured sensor values are invented.
6. To change the destination/secret/Wi-Fi later, type `setup` followed by newline in Serial Monitor. Blank saved Wi-Fi password/secret/CA fields retain the previous value; changing the SSID with an empty Wi-Fi password chooses an open network. Setup closes after 15 minutes and must be reopened using Serial.

HTTP 401/403 stops uploads until configuration is reviewed; other failures use bounded retry backoff. Frames are captured fresh per attempt and not queued for reconnect replay. The upload interval is measured after each response, so actual rate depends on internet/TLS latency. Payloads and device secrets are never printed to Serial.

NVS encryption is not enabled in this prototype. A person with physical flash/debug access may recover stored Wi-Fi and device credentials. This is an explicitly local provisioning portal protected by the temporary AP password and a random form token; it is not a general internet administration server.

## Obtain the correct public root CA

The root depends on the actual domain's certificate chain. From the repository root on Windows:

```powershell
& 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -NoProfile -ExecutionPolicy Bypass -File .\tools\export-telemetry-ca.ps1 -Url 'https://YOUR-PRODUCTION-DOMAIN/api/ingest'
```

The helper keeps normal hostname/chain verification enabled and exports only the verified public root to `.tools/certs/telemetry-root-ca.pem`. Paste the PEM into setup. Confirm it against the certificate chain visible in your browser, especially on a corporate network with TLS interception. If the deployment changes certificate issuer, update the board's trusted CA. Do not use a leaf certificate as a permanent root or disable validation to bypass an error.

## Before real receiver input

Need the exact ESP32/camera board, receiver protocol and signal voltage, ESC/gyro wiring and power/BEC details. Only then implement calibrated telemetry input in `readTelemetry()` and set `source="receiver"`. This module does not assign pins, supply voltage, actual wheel angle, speed, battery or motor temperature.
