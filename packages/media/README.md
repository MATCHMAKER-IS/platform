# @platform/media

動画・音声の処理(ffmpeg ラッパー)。メタ情報取得・変換・音声抽出・サムネイル・トリミング。

```ts
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
