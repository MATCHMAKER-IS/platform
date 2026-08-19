"use client";
/**
 * メディア処理のデモ。
 *
 * 実処理（変換・音声抽出・トリミング）はサーバの ffmpeg が必要なので、
 * **メタ情報はサーバの ffprobe に読ませる**(`/api/media-probe` → `@platform/media`)。
 * ブラウザの `<video>` では長さと解像度しか分からず、コーデック・ビットレート・
 * 音声トラックが取れない。
 *
 * サムネイルの切り出しは canvas で完結するので、そのままブラウザで行う
 * (「ブラウザでできること」と「サーバが要ること」の対比になっている)。
 * ファイルはどこにも送信されず、この画面の中だけで処理される。
 * 併せて、実基盤 @platform/media でどう書くかと、対応する ffmpeg コマンドを示す。
 */
import * as React from "react";
import { Badge, Alert, Button, Input, FileInput } from "@platform/ui";

const box: React.CSSProperties = { border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: 16, marginBottom: 16 };
const mono: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 12 };

/** サーバの ffprobe が返すメタ情報(**ブラウザだけでは分からない項目を含む**)。 */
interface ProbeInfo {
  durationSec: number;
  format: string;
  bitrate: number;
  video?: { codec: string; width: number; height: number; fps: number };
  audio?: { codec: string; sampleRate: number; channels: number };
}
type Probe = { name: string; sizeMB: string; info: ProbeInfo };
type Op = { method: string; desc: string; ffmpeg: string };

const OPS: Op[] = [
  { method: "probe(path)", desc: "長さ・解像度・コーデック・ビットレートを取得", ffmpeg: "ffprobe -v quiet -print_format json -show_format -show_streams in.mp4" },
  { method: "thumbnail(path, atSec)", desc: "指定秒のサムネイル画像を生成", ffmpeg: "ffmpeg -ss 5 -i in.mp4 -frames:v 1 -vf scale=320:-1 thumb.jpg" },
  { method: "extractAudio(path)", desc: "動画から音声トラックを抽出", ffmpeg: "ffmpeg -i in.mp4 -vn -acodec copy audio.m4a" },
  { method: "trim(path, startSec, endSec)", desc: "指定区間を切り出し", ffmpeg: "ffmpeg -ss 10 -to 25 -i in.mp4 -c copy clip.mp4" },
  { method: "transcode(path, format)", desc: "別フォーマット／解像度へ変換", ffmpeg: "ffmpeg -i in.mp4 -c:v libvpx-vp9 -b:v 1M out.webm" },
];

const fmt = (sec: number) => {
  const s = Math.floor(sec % 60), m = Math.floor(sec / 60) % 60, h = Math.floor(sec / 3600);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
};

export default function Page() {
  const [probe, setProbe] = React.useState<Probe | null>(null);
  const [thumb, setThumb] = React.useState<string | null>(null);
  const [at, setAt] = React.useState(1);
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  /**
   * メタ情報は**サーバの ffprobe** に読ませる(`/api/media-probe`)。
   * ブラウザの `<video>` では長さと解像度しか分からず、コーデック・
   * ビットレート・音声トラックが取れない。
   */
  const onPick = async (file: File) => {
    setErr(""); setThumb(null); setProbe(null); setBusy(true);

    // サムネイル抽出はブラウザで完結するので、その準備だけ先にしておく
    const v = document.createElement("video");
    v.preload = "metadata";
    v.src = URL.createObjectURL(file);
    videoRef.current = v;

    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/media-probe", { method: "POST", body: form });
    const json = (await res.json()) as { info?: ProbeInfo; error?: string };
    if (json.error !== undefined || json.info === undefined) {
      setErr(json.error ?? "解析できませんでした");
    } else {
      setProbe({ name: file.name, sizeMB: (file.size / 1024 / 1024).toFixed(2), info: json.info });
    }
    setBusy(false);
  };

  const capture = () => {
    const v = videoRef.current;
    if (!v || v.videoWidth === 0) { setErr("先に動画を選んでください（音声のみのファイルは画像を作れません）"); return; }
    setErr("");
    v.currentTime = Math.min(Math.max(0, at), Math.max(0, v.duration - 0.1));
    v.onseeked = () => {
      const c = document.createElement("canvas");
      const w = 320, h = Math.round((v.videoHeight / v.videoWidth) * 320);
      c.width = w; c.height = h;
      c.getContext("2d")?.drawImage(v, 0, 0, w, h);
      setThumb(c.toDataURL("image/jpeg", 0.8));
    };
  };

  return (
    <main style={{ maxWidth: 860, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 6 }}>メディア処理（動画・音声）</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 16 }}>
        ブラウザだけでできる範囲（メタ情報の取得・サムネイル生成）を実際に動かせます。
        選んだファイルはどこにも送信されず、この画面の中だけで処理されます。
      </p>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>ファイルを選ぶ</div>
        <FileInput
          accept="video/*,audio/*"
          aria-label="動画または音声ファイルを選ぶ"
          onSelect={(files) => { const f = files[0]; if (f) void onPick(f); }}
          style={{ fontSize: 13 }}
        />
        {busy && <p style={{ fontSize: 12, color: "var(--color-muted)" }}>サーバで解析しています…</p>}
        {err !== "" && <div style={{ marginTop: 10 }}><Alert variant="danger">{err}</Alert></div>}

        {probe && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
              probe() の結果（サーバの ffprobe）
            </div>
            <table style={{ borderCollapse: "collapse", fontSize: 12.5 }}>
              <tbody>
                {[
                  ["ファイル名", probe.name],
                  ["サイズ", `${probe.sizeMB} MB`],
                  ["コンテナ形式", probe.info.format],
                  ["長さ", `${fmt(probe.info.durationSec)}（${probe.info.durationSec.toFixed(1)} 秒）`],
                  ["ビットレート", `${Math.round(probe.info.bitrate / 1000).toLocaleString("ja-JP")} kbps`],
                  ["映像", probe.info.video
                    ? `${probe.info.video.codec} / ${probe.info.video.width}×${probe.info.video.height} / ${probe.info.video.fps.toFixed(1)} fps`
                    : "（なし・音声のみ）"],
                  ["音声", probe.info.audio
                    ? `${probe.info.audio.codec} / ${probe.info.audio.sampleRate.toLocaleString("ja-JP")} Hz / ${probe.info.audio.channels} ch`
                    : "（なし）"],
                ].map(([k, v]) => (
                  <tr key={k}><td style={{ padding: "3px 10px 3px 0", color: "var(--color-muted)" }}>{k}</td><td style={{ ...mono, padding: "3px 0" }}>{v}</td></tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 8 }}>
              <strong>コーデック・ビットレート・音声トラックはブラウザだけでは分かりません。</strong>
              サーバの ffprobe に読ませています（<code>@platform/media</code> の <code>probe()</code>）。
            </p>
          </div>
        )}
      </div>

      {/* 映像が無い(音声のみ)ファイルではサムネイルを作れないので、video の有無で判定する */}
      {probe && probe.info.video !== undefined && probe.info.video.width > 0 && (
        <div style={box}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>thumbnail() 相当</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "var(--color-muted)" }}>何秒地点
              <Input type="number" min={0} max={Math.floor(probe.info.durationSec)} value={at} onChange={(e) => setAt(Number(e.target.value) || 0)} style={{ width: 100 }} />
            </label>
            <Button size="sm" onClick={capture}>この秒で切り出す</Button>
          </div>
          {thumb !== null && (
            <div>
              {/* 生成した静止画（data URL）。外部への送信は行っていない */}
              <img src={thumb} alt={`${at} 秒地点のサムネイル`} style={{ maxWidth: 320, borderRadius: 6, border: "1px solid var(--color-border)" }} />
            </div>
          )}
        </div>
      )}

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
          操作カタログ <Badge variant="secondary">サーバ側</Badge>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {OPS.map((o) => (
            <div key={o.method} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius)", padding: 12, background: "var(--color-bg)" }}>
              <code style={{ ...mono, fontWeight: 700 }}>{o.method}</code>
              <div style={{ fontSize: 12, color: "var(--color-muted)", margin: "4px 0 6px" }}>{o.desc}</div>
              <div style={{ fontSize: 11, color: "var(--color-muted)" }}>内部で実行される ffmpeg:</div>
              <div style={{ ...mono, color: "var(--color-fg)", wordBreak: "break-all" }}>{o.ffmpeg}</div>
            </div>
          ))}
        </div>
      </div>

      <Alert variant="info" title="実基盤では">
        <code>@platform/media</code> は fluent-ffmpeg と同梱バイナリ（ffmpeg-static）で、
        メタ取得・変換・音声抽出・サムネイル・トリミングを共通化します。
        処理は重く、時間もかかるため、<code>@platform/jobs</code> の裏側実行（キュー）と組み合わせるのが基本です。
        アップロードの受け口は <code>@platform/upload</code>、保存先の抽象化は <code>@platform/storage</code> が担当します。
      </Alert>
    </main>
  );
}
