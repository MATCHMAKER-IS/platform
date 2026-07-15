/**
 * 一括画像処理 × 進捗通知(notify連携)の例。
 *   node tools/image-batch-notify.mjs
 */
import { runBatch } from "@platform/image";
import { createNotifier, createSlackChannel, crossedMilestones } from "@platform/notify";

// 通知先(例: Slack)。デモではコンソール出力チャネルでも可。
const notifier = createNotifier([/* createSlackChannel(process.env.SLACK_WEBHOOK_URL) */
  { async send(m) { console.log(`[notify:${m.level ?? "info"}] ${m.text}`); } },
]);

const files = Array.from({ length: 8 }, (_v, i) => ({ name: `photo-${i + 1}.jpg` }));

let prev = 0;
await runBatch(files, async (f) => {
  await new Promise((r) => setTimeout(r, 100)); // 実際は image.normalizeUpload(...)
  return f.name;
}, {
  concurrency: 3,
  onProgress: async ({ done, total }) => {
    for (const m of crossedMilestones(prev, done, total, 25)) {
      await notifier.notify({ text: `画像一括処理 ${m}% 完了(${done}/${total})`, level: m === 100 ? "info" : "info" });
    }
    prev = done;
  },
});
console.log("done.");
