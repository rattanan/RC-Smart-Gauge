"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import Gauge from "./gauge";
import { useEngineSound } from "./audio";
import {
  demoPacket,
  simulatedDrive,
  STALE_MS,
  type Reading,
} from "@/lib/telemetry";
import { demoTiming, formatTime } from "@/lib/demo";
const DriveScene = dynamic(() => import("./drive-scene"), {
  ssr: false,
  loading: () => <div className="scene loading">Preparing 3D scene…</div>,
});
type Tab = "Drive" | "Telemetry" | "Sounds" | "Devices";
export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("Drive");
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [tick, setTick] = useState(0);
  const startTime = useRef(0);
  const [enlarged, setEnlarged] = useState(false);
  const [profile, setProfile] = useState(0);
  const [volume, setVolume] = useState(0.6);
  const [signedIn, setSignedIn] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [login, setLogin] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [live, setLive] = useState<{
    reading: Reading | null;
    age: number;
    at: number;
  } | null>(null);
  const [connectionError, setConnectionError] = useState("");
  const [storage, setStorage] = useState("");
  const [deviceId, setDeviceId] = useState("rc-01");
  const [endpoint, setEndpoint] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setEndpoint(`${window.location.origin}/api/ingest`);
    try {
      const saved = JSON.parse(localStorage.getItem("rcsg-audio") || "{}");
      if (typeof saved.volume === "number")
        setVolume(Math.max(0, Math.min(1, saved.volume)));
      if ([0, 1, 2].includes(saved.profile)) setProfile(saved.profile);
    } catch {
      /* use safe defaults */
    }
    fetch("/api/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((s) => {
        setSignedIn(s.signedIn);
        setConfigured(s.configured);
      })
      .catch(() => {});
    const interval = window.setInterval(() => {
      setTick(performance.now());
    }, 50);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    if (running) setElapsed(Math.max(0, tick - startTime.current));
  }, [tick, running]);
  useEffect(() => {
    if (!signedIn) return;
    const controller = new AbortController();
    fetch("/api/device", { signal: controller.signal, cache: "no-store" })
      .then((r) => r.json())
      .then((s) => {
        if (s.deviceId) setDeviceId(s.deviceId);
        if (s.storage) setStorage(s.storage);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [signedIn]);
  useEffect(() => {
    if (mode !== "live" || !signedIn) return;
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;
    let request: AbortController | null = null;
    const poll = async () => {
      if (cancelled) return;
      if (document.hidden) {
        timeout = setTimeout(poll, 1000);
        return;
      }
      request = new AbortController();
      const deadline = setTimeout(() => request?.abort(), 5000);
      const started = performance.now();
      try {
        const response = await fetch("/api/state", {
          cache: "no-store",
          signal: request.signal,
        });
        const data = await response.json();
        if (!response.ok) {
          if (response.status === 401) setSignedIn(false);
          throw new Error(data.error || "Connection unavailable");
        }
        if (!cancelled) {
          setLive({
            reading: data.reading,
            age: data.reading
              ? Math.max(0, data.serverNow - data.reading.receivedAt) +
                performance.now() -
                started
              : Infinity,
            at: performance.now(),
          });
          setStorage(data.storage);
          setConnectionError("");
        }
      } catch (error) {
        if (!cancelled)
          setConnectionError(
            error instanceof Error ? error.message : "Connection unavailable",
          );
      } finally {
        clearTimeout(deadline);
        if (!cancelled) timeout = setTimeout(poll, 500);
      }
    };
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      request?.abort();
    };
  }, [mode, signedIn]);
  const age = live ? live.age + Math.max(0, tick - live.at) : Infinity;
  const fresh =
    mode === "demo"
      ? running
      : !!live?.reading?.packet.signal_valid &&
        age < STALE_MS &&
        !connectionError &&
        signedIn;
  const packet =
    mode === "demo" ? demoPacket(elapsed) : (live?.reading?.packet ?? null);
  const drive = simulatedDrive(packet?.throttle ?? 0);
  const timing = demoTiming(elapsed);
  const audio = useEngineSound(drive.rpm, fresh && running, volume, profile);
  const changeMode = (next: "demo" | "live") => {
    if (next === mode) return;
    if (next === "live" && !signedIn) {
      setLogin(true);
      return;
    }
    setMode(next);
    setRunning(false);
    setElapsed(0);
    setLive(null);
    setConnectionError("");
  };
  const saveAudio = (v: number, p: number) => {
    setVolume(v);
    setProfile(p);
    localStorage.setItem(
      "rcsg-audio",
      JSON.stringify({ volume: v, profile: p }),
    );
  };
  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setLoginBusy(true);
    setLoginError("");
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setPassword("");
      setSignedIn(true);
      setConfigured(true);
      setLogin(false);
      setMode("live");
      setRunning(false);
      setElapsed(0);
    } catch (error) {
      setLoginError(
        error instanceof Error ? error.message : "Sign-in unavailable",
      );
    } finally {
      setLoginBusy(false);
    }
  }
  const signOut = async () => {
    await fetch("/api/session", { method: "DELETE" });
    setSignedIn(false);
    setLive(null);
    setMode("demo");
    setRunning(false);
    setElapsed(0);
  };
  const sensor = (value: number | null | undefined, unit: string, scale = 1) =>
    value == null ? (
      <>
        <b>—</b>
        <small>{unit}</small>
      </>
    ) : (
      <>
        <b>{(value * scale).toFixed(1)}</b>
        <small>{unit}</small>
      </>
    );
  const presets = (
    <div className="preset-buttons">
      {["TURBO I6", "V12", "ROTARY"].map((name, i) => (
        <button
          key={name}
          className={profile === i ? "selected" : ""}
          onClick={() => saveAudio(volume, i)}
          aria-pressed={profile === i}
        >
          <span className="wave">▂▆▃▇▃▆▂</span>
          {name}
        </button>
      ))}
    </div>
  );
  return (
    <main className="dashboard">
      <header className="topbar">
        <a href="/" className="brand">
          RC <span>SMART GAUGE</span>
          <i>DRIFT TELEMETRY SYSTEM</i>
        </a>
        <div className="mode-switch" aria-label="Data source">
          <button
            className={mode === "demo" ? "selected" : ""}
            onClick={() => changeMode("demo")}
          >
            DEMO
          </button>
          <button
            className={mode === "live" ? "selected" : ""}
            onClick={() => changeMode("live")}
          >
            LIVE <span>↗</span>
          </button>
        </div>
        <div className="connection">
          <span className={`dot ${fresh ? "online" : ""}`} />
          <span>
            {mode === "demo"
              ? "RX SIMULATED"
              : fresh
                ? "RX CONNECTED"
                : "RX OFFLINE"}
          </span>
        </div>
        <div className="vision-status">
          <span className="dot" />
          VISION {mode === "demo" ? "SIM" : "—"}
        </div>
        <button
          className="settings"
          onClick={() => setTab("Devices")}
          aria-label="Open device settings"
        >
          ⚙
        </button>
      </header>
      <section className="timing-strip" aria-label="Session timing">
        <div>
          <label>SESSION</label>
          <strong>{formatTime(elapsed)}</strong>
          <small>{running ? "RUNNING" : "READY"}</small>
        </div>
        <div>
          <label>LAPS COMPLETED</label>
          <strong>{mode === "demo" ? timing.laps.length : "—"}</strong>
          <small>
            {mode === "demo" ? "SIGN-SIGHTING DEMO" : "VISION NOT CONNECTED"}
          </small>
        </div>
        <div>
          <label>CURRENT LAP</label>
          <strong>{formatTime(mode === "demo" ? timing.current : null)}</strong>
          <small>{mode === "demo" ? "CURRENT ATTEMPT" : "NOT AVAILABLE"}</small>
        </div>
        <div className="best-timing">
          <label>◇ BEST LAP</label>
          <strong>
            {formatTime(
              mode === "demo" ? (timing.best?.duration ?? null) : null,
            )}
          </strong>
          <small>COMPLETED LAPS ONLY</small>
        </div>
      </section>
      {connectionError && mode === "live" && (
        <div role="status" className="notice">
          {connectionError} · displayed telemetry is stale
        </div>
      )}
      {mode === "live" && packet?.source === "demo" && (
        <div className="notice">
          ESP32 DEMO SOURCE · These values are synthetic, not receiver
          measurements.
        </div>
      )}
      {tab === "Drive" ? (
        <section className={`drive-layout ${enlarged ? "enlarged" : ""}`}>
          <DriveScene
            steering={packet?.steering ?? 0}
            active={fresh}
            demo={mode === "demo"}
            enlarged={enlarged}
            onEnlarge={() => setEnlarged(!enlarged)}
            startSeen={mode === "demo" && running && timing.seen}
          />
          {!enlarged && (
            <aside className="instruments">
              <section className="gauge-panel panel">
                <div className="panel-heading">
                  <h1>
                    <em>SMART</em> GAUGE
                  </h1>
                  <span>RC DRIFT</span>
                </div>
                <div className="gauge-row">
                  <Gauge rpm={drive.rpm} gear={drive.gear} active={fresh} />
                  <div className="sensors">
                    <div>
                      <label>◴ SPEED</label>
                      <p>{sensor(packet?.speed_mps, "km/h", 3.6)}</p>
                    </div>
                    <div>
                      <label>▯ BATTERY</label>
                      <p>{sensor(packet?.battery_v, "V")}</p>
                    </div>
                    <div>
                      <label>♧ MOTOR</label>
                      <p>{sensor(packet?.motor_temp_c, "°C")}</p>
                    </div>
                  </div>
                </div>
                <TelemetryBar
                  label="THROTTLE"
                  value={packet?.throttle ?? 0}
                  active={fresh}
                />
                <TelemetryBar
                  label="STEERING"
                  value={packet?.steering ?? 0}
                  active={fresh}
                  centered
                />
                <div className="gauge-footnote">
                  {mode === "demo"
                    ? "SYNTHETIC TELEMETRY"
                    : "SERVER RECEIPT AGE"}
                  <span>
                    {mode === "demo"
                      ? "OFFLINE DEMO"
                      : Number.isFinite(age)
                        ? `${Math.floor(age)} ms`
                        : "NO PACKETS"}
                  </span>
                </div>
              </section>
              <section className="history-panel panel">
                <div className="history-title">
                  <h2>LAP HISTORY</h2>
                  <span>
                    {mode === "demo"
                      ? `${timing.laps.length} COMPLETED`
                      : "VISION OFFLINE"}
                  </span>
                </div>
                <div className="lap-list">
                  {mode === "demo" && timing.laps.length ? (
                    [...timing.laps].reverse().map((lap) => (
                      <div
                        key={lap.index}
                        className={`lap ${lap.index === timing.best?.index ? "best" : ""}`}
                      >
                        <span>LAP {String(lap.index).padStart(2, "0")}</span>
                        <strong>{formatTime(lap.duration)}</strong>
                        <small>
                          {lap.index === timing.best?.index
                            ? "◇ BEST"
                            : "VALID"}
                        </small>
                      </div>
                    ))
                  ) : (
                    <p className="empty-history">
                      {mode === "demo"
                        ? "Start a session. First lap completes at 00:31.2."
                        : "Live lap timing needs camera/START integration."}
                    </p>
                  )}
                </div>
                {!running &&
                  elapsed > 0 &&
                  mode === "demo" &&
                  timing.current !== null && (
                    <small>
                      Unfinished lap: {formatTime(timing.current)} · excluded
                      from best
                    </small>
                  )}
              </section>
            </aside>
          )}
        </section>
      ) : (
        <section className="detail-page panel">
          {tab === "Telemetry" && (
            <>
              <div className="eyebrow">DATA / DIAGNOSTICS</div>
              <h1>Know what the car is saying.</h1>
              <p className="muted">
                Raw normalized commands. Cosmetic RPM and gear are always marked
                SIM.
              </p>
              <div className="metrics-grid">
                <Metric
                  name="SOURCE"
                  value={
                    mode === "demo"
                      ? "Browser demo"
                      : packet?.source === "demo"
                        ? "ESP32 demo"
                        : "Receiver"
                  }
                />
                <Metric
                  name="THROTTLE"
                  value={
                    fresh && packet
                      ? `${(packet.throttle * 100).toFixed(1)}%`
                      : "—"
                  }
                />
                <Metric
                  name="STEERING"
                  value={
                    fresh && packet
                      ? `${(packet.steering * 100).toFixed(1)}%`
                      : "—"
                  }
                />
                <Metric
                  name="DEVICE"
                  value={
                    mode === "demo"
                      ? "browser-demo"
                      : (packet?.device_id ?? "—")
                  }
                />
                <Metric
                  name="SEQUENCE"
                  value={packet ? String(packet.seq) : "—"}
                />
                <Metric
                  name="STORAGE"
                  value={mode === "demo" ? "Browser only" : storage || "—"}
                />
              </div>
              <p>
                Internet telemetry uses server receipt freshness. Device capture
                time is retained, but clocks are not mapped; this does not
                provide verified capture latency or race timing.
              </p>
              <pre>{JSON.stringify(packet, null, 2)}</pre>
              <p className="muted">
                Live telemetry stores the latest packet for 24 hours. Browser
                demo session history resets on reload. Export and durable
                session history are not implemented in this web version.
              </p>
            </>
          )}
          {tab === "Sounds" && (
            <>
              <div className="eyebrow">SYNTHETIC AUDIO / LOCAL PLAYBACK</div>
              <h1>Give the drive a voice.</h1>
              <p className="muted">
                Procedural engine presets driven by throttle. No recorded engine
                assets.
              </p>
              {presets}
              <div className="sound-cards">
                {["Turbo inline-six", "V12", "Rotary"].map((name, i) => (
                  <button
                    key={name}
                    className={
                      profile === i ? "sound-card selected" : "sound-card"
                    }
                    onClick={() => saveAudio(volume, i)}
                  >
                    <span className="sound-number">0{i + 1}</span>
                    <h2>{name}</h2>
                    <p>
                      {
                        [
                          "A smooth, low pulse. Three firing pulses per virtual revolution.",
                          "A tighter, higher pulse. Six firing pulses per virtual revolution.",
                          "A bright sawtooth character. Two pulses per virtual revolution.",
                        ][i]
                      }
                    </p>
                    <span>
                      {profile === i ? "SELECTED" : "SELECT PRESET"} ↗
                    </span>
                  </button>
                ))}
              </div>
              <p>
                Start a session and press Unmute to hear the current source.
                Stale receiver input fades to silence. Switching tabs/windows
                mutes playback.
              </p>
            </>
          )}
          {tab === "Devices" && (
            <>
              <div className="eyebrow">CONNECT / ESP32 → WI-FI → INTERNET</div>
              <h1>Your car. Anywhere online.</h1>
              <p className="muted">
                Configure the ESP32 uploader once, then open Live from any
                signed-in browser.
              </p>
              <div className="device-grid">
                <section className="setup-card">
                  <span className="step-label">01 / DESTINATION</span>
                  <h2>Telemetry endpoint</h2>
                  <label htmlFor="endpoint">
                    Paste this URL into ESP32 Setup
                  </label>
                  <div className="copy-row">
                    <input id="endpoint" value={endpoint} readOnly />
                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(endpoint);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        } catch {
                          setCopied(false);
                        }
                      }}
                    >
                      {copied ? "Copied" : "Copy URL"}
                    </button>
                  </div>
                  <p>
                    Deployed endpoint must begin with HTTPS. The ESP32 setup
                    form lets you change the complete destination URL.
                  </p>
                  <div className="setup-status">
                    <span className={`dot ${configured ? "online" : ""}`} />
                    {configured
                      ? "Server configured"
                      : "Server setup required for Live"}
                  </div>
                </section>
                <section className="setup-card">
                  <span className="step-label">02 / CREDENTIALS</span>
                  <h2>Pair the ESP32</h2>
                  <p>
                    Connect to its setup Wi-Fi using the temporary password
                    printed in Serial Monitor. Open <code>192.168.4.1</code>.
                  </p>
                  <ul>
                    <li>Your Wi-Fi name and password</li>
                    <li>Destination URL from this page</li>
                    <li>
                      Device ID: <code>{deviceId}</code>
                    </li>
                    <li>
                      Your private <code>DEVICE_SECRET</code>
                    </li>
                    <li>Trusted root CA certificate for HTTPS</li>
                  </ul>
                  <p className="muted">
                    The device secret stays on the server and ESP32. This page
                    never returns it.
                  </p>
                </section>
                <section className="setup-card">
                  <span className="step-label">03 / VERCEL</span>
                  <h2>Server environment</h2>
                  <p>
                    Import the GitHub repository with Root Directory set to{" "}
                    <code>web</code>. Connect Upstash Redis, then set:
                  </p>
                  <code className="env-list">
                    DASHBOARD_PASSWORD
                    <br />
                    SESSION_SECRET
                    <br />
                    DEVICE_SECRET
                    <br />
                    DEVICE_ID
                    <br />
                    UPSTASH_REDIS_REST_URL
                    <br />
                    UPSTASH_REDIS_REST_TOKEN
                  </code>
                  <p className="muted">
                    Use the project&apos;s deployment guide to generate secrets
                    locally. They must never use a NEXT_PUBLIC_ prefix.
                  </p>
                </section>
                <section className="setup-card">
                  <span className="step-label">04 / LIVE VIEW</span>
                  <h2>Ready to connect</h2>
                  <p>
                    ESP32 firmware initially sends explicitly labeled synthetic
                    data. Receiver input needs confirmed board, signal protocol
                    and voltage before wiring.
                  </p>
                  <p>
                    Live Drive shows command gauges and an illustrative own-car
                    pose. Camera images, START recognition and lead-car
                    detection are not part of this uploader.
                  </p>
                  <button
                    className="primary"
                    onClick={() =>
                      signedIn ? changeMode("live") : setLogin(true)
                    }
                  >
                    {signedIn ? "Open Live Drive" : "Sign in to Live"} ↗
                  </button>
                  {signedIn && (
                    <button className="text-button" onClick={signOut}>
                      Sign out
                    </button>
                  )}
                </section>
              </div>
            </>
          )}
        </section>
      )}
      <footer className="controls">
        <button
          className={`session-button ${running ? "running" : ""}`}
          onClick={() => {
            if (running) setRunning(false);
            else {
              startTime.current = performance.now();
              setElapsed(0);
              setRunning(true);
            }
          }}
        >
          {running ? "■ End Session" : "▶ Start Session"}
        </button>
        <span className="audio-label">
          ENGINE SOUND<small>SYNTHETIC</small>
        </span>
        {presets}
        <label className="volume-control">
          VOLUME
          <input
            aria-label="Engine volume"
            type="range"
            min="0"
            max="1"
            step=".01"
            value={volume}
            onChange={(event) => saveAudio(Number(event.target.value), profile)}
          />
          <strong>{Math.round(volume * 100)}%</strong>
        </label>
        <button
          className={`mute ${!audio.muted ? "selected" : ""}`}
          onClick={audio.toggle}
        >
          {audio.muted ? "Unmute" : "Mute"}
        </button>
      </footer>
      {audio.error && (
        <p role="status" className="audio-error">
          {audio.error}
        </p>
      )}
      <nav className="navigation" aria-label="Main navigation">
        {(["Drive", "Telemetry", "Sounds", "Devices"] as Tab[]).map(
          (name, i) => (
            <button
              key={name}
              className={tab === name ? "active" : ""}
              onClick={() => setTab(name)}
              aria-current={tab === name ? "page" : undefined}
            >
              <span>{["◉", "▥", "♫", "⌁"][i]}</span>
              {name}
              <i>{String(i + 1).padStart(2, "0")}</i>
            </button>
          ),
        )}
      </nav>
      <div className="bottom-caption">
        <span>
          RC SMART GAUGE <b>/</b> WEB COMPANION
        </span>
        <span>
          {mode === "demo"
            ? "OFFLINE DEMO · NO HARDWARE REQUIRED"
            : "INTERNET TELEMETRY · REMOTE CONTROL STAYS ON YOUR TRANSMITTER"}
        </span>
      </div>
      {login && (
        <div
          className="modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setLogin(false);
              setPassword("");
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-title"
            className="login-dialog"
          >
            <button
              className="dialog-close"
              aria-label="Close sign in"
              onClick={() => {
                setLogin(false);
                setPassword("");
              }}
            >
              ×
            </button>
            <div className="eyebrow">PRIVATE LIVE TELEMETRY</div>
            <h2 id="login-title">Connect to your drive.</h2>
            <p>
              Enter the dashboard password configured on your Vercel server.
              This is separate from the ESP32 device secret.
            </p>
            <form onSubmit={signIn}>
              <label htmlFor="password">Dashboard password</label>
              <input
                id="password"
                autoFocus
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={128}
                required
              />
              <button className="primary" disabled={loginBusy}>
                {loginBusy ? "Connecting…" : "Open Live Drive ↗"}
              </button>
            </form>
            {loginError && (
              <p role="alert" className="login-error">
                {loginError}
              </p>
            )}
            <button
              className="text-button"
              onClick={() => {
                setLogin(false);
                setTab("Devices");
              }}
            >
              View server setup instructions
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
function TelemetryBar({
  label,
  value,
  active,
  centered = false,
}: {
  label: string;
  value: number;
  active: boolean;
  centered?: boolean;
}) {
  const v = Math.max(centered ? -1 : 0, Math.min(1, value));
  return (
    <div className="telemetry-bar">
      <div>
        <label>{label}</label>
        <strong>{active ? `${Math.round(value * 100)}%` : "—"}</strong>
      </div>
      <div className="bar-track">
        <i
          style={{
            left: centered ? `${50 + Math.min(0, v) * 50}%` : 0,
            width: active ? `${Math.abs(v) * (centered ? 50 : 100)}%` : 0,
          }}
        />
        {centered && <span />}
      </div>
    </div>
  );
}
function Metric({ name, value }: { name: string; value: string }) {
  return (
    <div className="metric">
      <label>{name}</label>
      <strong>{value}</strong>
    </div>
  );
}
