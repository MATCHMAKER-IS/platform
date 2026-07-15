"use client";
/** 動画/音声要素の再生状態を扱う内部フック。 */
import * as React from "react";

export function useMediaElement(ref: React.RefObject<HTMLMediaElement | null>) {
  const [playing, setPlaying] = React.useState(false);
  const [current, setCurrent] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [volume, setVolume] = React.useState(1);
  const [muted, setMuted] = React.useState(false);
  const [rate, setRate] = React.useState(1);

  const toggle = () => {
    const el = ref.current; if (!el) return;
    if (el.paused) void el.play(); else el.pause();
  };
  const seek = (t: number) => { if (ref.current) ref.current.currentTime = t; setCurrent(t); };
  const changeVolume = (v: number) => { if (ref.current) { ref.current.volume = v; ref.current.muted = v === 0; } setVolume(v); setMuted(v === 0); };
  const toggleMute = () => { const el = ref.current; if (!el) return; el.muted = !el.muted; setMuted(el.muted); };
  const changeRate = (r: number) => { if (ref.current) ref.current.playbackRate = r; setRate(r); };

  const bind = {
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
    onTimeUpdate: (e: React.SyntheticEvent<HTMLMediaElement>) => setCurrent(e.currentTarget.currentTime),
    onLoadedMetadata: (e: React.SyntheticEvent<HTMLMediaElement>) => setDuration(e.currentTarget.duration),
    onVolumeChange: (e: React.SyntheticEvent<HTMLMediaElement>) => { setVolume(e.currentTarget.volume); setMuted(e.currentTarget.muted); },
  };

  return { playing, current, duration, volume, muted, rate, toggle, seek, changeVolume, toggleMute, changeRate, bind };
}
