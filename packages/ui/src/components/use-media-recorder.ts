"use client";
/** MediaRecorder を扱う内部フック(録音・録画共通)。 */
import * as React from "react";

export interface UseMediaRecorderOptions {
  audio?: boolean;
  video?: boolean;
}

export function useMediaRecorder({ audio = true, video = false }: UseMediaRecorderOptions) {
  const [recording, setRecording] = React.useState(false);
  const [seconds, setSeconds] = React.useState(0);
  const [url, setUrl] = React.useState<string | null>(null);
  const [blob, setBlob] = React.useState<Blob | null>(null);
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const start = async () => {
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio, video });
      setStream(s);
      chunksRef.current = [];
      const rec = new MediaRecorder(s);
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = () => {
        const b = new Blob(chunksRef.current, { type: rec.mimeType });
        setBlob(b);
        setUrl(URL.createObjectURL(b));
        s.getTracks().forEach((t) => t.stop());
        setStream(null);
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((n) => n + 1), 1000);
    } catch (e) {
      setError("マイク/カメラにアクセスできませんでした");
    }
  };

  const stop = () => {
    recorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  React.useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  return { recording, seconds, url, blob, stream, error, start, stop };
}
