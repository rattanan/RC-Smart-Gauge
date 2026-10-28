"use client";
import { useEffect, useRef, useState } from "react";
export function useEngineSound(
  rpm: number,
  active: boolean,
  volume: number,
  profile: number,
) {
  const [muted, setMuted] = useState(true);
  const [error, setError] = useState("");
  const graph = useRef<{
    context: AudioContext;
    osc: OscillatorNode;
    gain: GainNode;
  } | null>(null);
  useEffect(() => {
    const mute = () => setMuted(true);
    window.addEventListener("blur", mute);
    document.addEventListener("visibilitychange", mute);
    return () => {
      window.removeEventListener("blur", mute);
      document.removeEventListener("visibilitychange", mute);
      graph.current?.context.close();
      graph.current = null;
    };
  }, []);
  useEffect(() => {
    const g = graph.current;
    if (!g) return;
    g.osc.frequency.setTargetAtTime(
      (rpm / 60) * [3, 6, 2][profile],
      g.context.currentTime,
      0.06,
    );
    g.gain.gain.setTargetAtTime(
      !muted && active ? volume * 0.12 : 0,
      g.context.currentTime,
      0.05,
    );
    g.osc.type = profile === 2 ? "sawtooth" : "triangle";
  }, [rpm, active, muted, volume, profile]);
  const toggle = async () => {
    if (!muted) {
      setMuted(true);
      return;
    }
    try {
      if (!graph.current) {
        const context = new AudioContext();
        const osc = context.createOscillator();
        const gain = context.createGain();
        gain.gain.value = 0;
        osc.connect(gain);
        gain.connect(context.destination);
        osc.start();
        graph.current = { context, osc, gain };
      }
      await graph.current.context.resume();
      setMuted(false);
      setError("");
    } catch {
      setError("Audio unavailable in this browser");
      setMuted(true);
    }
  };
  return { muted, toggle, error };
}
