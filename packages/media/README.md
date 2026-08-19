# @platform/media

音声・動画の変換（形式変換・切り出し）。**外部ツールを呼びます**。

## これは何のためか

**ブラウザで録った音声は、そのままでは使えない**ためのものです。

録音は `webm` で返りますが、
**LINE は m4a、文字起こしは別の形式**を求めます。

## 使う前に知っておくこと

| | |
|---|---|
| **時間切れで必ず止める** | 変換は**終わらないことがあります**——放っておくと**プロセスが溜まって落ちます** |
| **外部ツール（ffmpeg）が要ります** | **Dockerfile に入れて**ください——開発機にあっても、**本番のコンテナには無い**ことがあります |
| **変換は重い** | 1 時間の音声は**数分**かかります——**画面から直接呼ばず、ジョブに回して**ください |
| **元のファイルを消さない** | 変換に失敗したときに、**やり直せなくなります** |

## よく使うもの

```ts
import { createMediaProcessor } from "@platform/media";
import { createMediaProcessor } from "@platform/media";
const media = createMediaProcessor();

const info = await media.probe("/uploads/movie.mov");      // 長さ・解像度・コーデック
await media.thumbnail("/uploads/movie.mov", "/out/thumb.jpg", 3);
await media.extractAudio("/uploads/movie.mov", "/out/audio.mp3");
await media.trim("/uploads/movie.mov", "/out/clip.mp4", 10, 15);
```

- ffmpeg/ffprobe のバイナリは ffmpeg-static / ffprobe-static で同梱されます。
- 重い処理なので `@platform/jobs`(BullMQ)の非同期ジョブでの実行を推奨します。
- 失敗は Result で返ります。
