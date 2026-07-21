"use client";
/**
 * 定期実行(cron)のデモ。
 *
 * **cron 式の解析(croner)とファイルロックはサーバ側の話**なので、ここでは扱わない。
 * import は `@platform/cron/browser`(node: に依存しない入口)から。
 * ブラウザで見せられるのは `createGuardedJob` の中身 —— 多重実行防止・分散ロック・統計。
 * そちらが「各アプリで自作すると事故る」部分で、cron 式は薄い皮でしかない。
 */
import * as React from "react";
import { Button, Checkbox, Slider } from "@platform/ui";
// ★ バレル(@platform/cron)ではなく /browser から取る。
// バレルは lock-file.ts(node:fs)を再 export するので、client から import すると
// Turbopack が `node:fs` を解決できずビルドが落ちる。
import { createGuardedJob, createMemoryLockStore, type JobResult, type JobStats } from "@platform/cron/browser";

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 12 };

const OUTCOME_LABEL: Record<JobResult["outcome"], string> = {
  success: "成功",
  failure: "失敗",
  skipped: "スキップ",
};

const OUTCOME_COLOR: Record<JobResult["outcome"], string> = {
  success: "var(--color-success)",
  failure: "var(--color-danger)",
  skipped: "var(--color-warning)",
};

const REASON_LABEL: Record<string, string> = {
  overlap: "前回がまだ動いている",
  lock: "他のインスタンスが実行中",
};

/** cron 式の例。croner はサーバ側で解釈するので、ここでは説明のみ。 */
const SCHEDULES = [
  { expr: "0 9 * * *", desc: "毎日 9:00" },
  { expr: "*/15 * * * *", desc: "15 分ごと" },
  { expr: "0 2 1 * *", desc: "毎月 1 日 2:00" },
  { expr: "0 18 * * 5", desc: "毎週金曜 18:00" },
  { expr: "0 0 1 4 *", desc: "毎年 4/1 0:00(年度はじめ)" },
];

const EMPTY: JobStats = { runs: 0, successes: 0, failures: 0, skipped: 0 };

export default function Page() {
  // ── ① 多重実行防止 ──
  const [preventOverlap, setPreventOverlap] = React.useState(true);
  const [durationMs, setDurationMs] = React.useState(1500);
  const [shouldFail, setShouldFail] = React.useState(false);
  const [log, setLog] = React.useState<JobResult[]>([]);
  const [stats, setStats] = React.useState<JobStats>(EMPTY);
  const [running, setRunning] = React.useState(0);

  // 設定を ref で読む(ジョブを作り直さずに挙動を変えられるように)
  const cfg = React.useRef({ durationMs, shouldFail });
  cfg.current = { durationMs, shouldFail };

  const job = React.useMemo(() => {
    const j = createGuardedJob({
      name: "daily-report",
      preventOverlap,
      handler: async () => {
        setRunning((n) => n + 1);
        try {
          await new Promise((r) => setTimeout(r, cfg.current.durationMs));
          if (cfg.current.shouldFail) throw new Error("集計元の DB に接続できません");
        } finally {
          setRunning((n) => n - 1);
        }
      },
      onResult: (r) => {
        setLog((prev) => [r, ...prev].slice(0, 8));
        setStats(j.stats());
      },
    });
    return j;
  }, [preventOverlap]);

  React.useEffect(() => {
    setLog([]);
    setStats(EMPTY);
  }, [preventOverlap]);

  // ── ② 分散ロック(2 インスタンス) ──
  const lockStore = React.useMemo(() => createMemoryLockStore(), []);
  const [lockLog, setLockLog] = React.useState<{ who: string; r: JobResult }[]>([]);

  const instances = React.useMemo(() => {
    const make = (who: string) =>
      createGuardedJob({
        name: "nightly-batch",
        lock: { store: lockStore, ttlMs: 3000, key: "nightly-batch" },
        handler: async () => {
          await new Promise((r) => setTimeout(r, 800));
        },
        onResult: (r) => setLockLog((prev) => [{ who, r }, ...prev].slice(0, 8)),
      });
    return { a: make("インスタンス A"), b: make("インスタンス B") };
  }, [lockStore]);

  async function fireBoth() {
    setLockLog([]);
    await Promise.all([instances.a.run(), instances.b.run()]);
  }

  return (
    <main style={{ maxWidth: 900, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>定期実行（cron）</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        <strong>難しいのは cron 式ではありません。</strong>「前回がまだ終わっていないのに次が始まる」
        「サーバを 2 台に増やしたら夜間バッチが 2 回走った」——ここが事故ります。
        <code>@platform/cron</code> はその防御を持っており、<strong>下のボタンで実際に試せます</strong>。
      </p>

      <div style={{ ...box, background: "var(--color-bg)", borderStyle: "dashed" }}>
        <div style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.9 }}>
          <strong>このページで動かしているもの</strong>
          <br />
          <code>createGuardedJob()</code> と <code>createMemoryLockStore()</code> ——{" "}
          <strong>依存ゼロなのでブラウザでそのまま動きます</strong>。
          <br />
          <strong>cron 式の解析（croner）はサーバ側</strong>なので、ここでは扱いません。
          「毎日 9:00」の代わりに、下のボタンを 9:00 だと思ってください。
        </div>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>① 多重実行防止</h2>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 12, lineHeight: 1.8 }}>
          日次集計が 15 分かかるのに 5 分ごとに起動したら、<strong>3 つ同時に走って DB が悲鳴を上げます</strong>。
          <code>preventOverlap</code> は「前回が動いていたら今回は捨てる」だけの単純な仕組みですが、
          <strong>これを各アプリで書くと必ずどこかが抜けます</strong>。
        </p>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <Checkbox checked={preventOverlap} onCheckedChange={(v) => setPreventOverlap(!!v)} />
            <code>preventOverlap</code>
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <Checkbox checked={shouldFail} onCheckedChange={(v) => setShouldFail(!!v)} />
            わざと失敗させる
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--color-muted)" }}>
            処理時間
            <Slider value={[durationMs]} min={300} max={3000} step={100} onValueChange={([v]) => setDurationMs(v ?? 300)} style={{ width: 140 }} />
            <span style={{ ...mono, width: 52, textAlign: "right" }}>{durationMs}ms</span>
          </label>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
          <Button onClick={() => void job.run()}>実行する（= 9:00 になった）</Button>
          <span style={{ fontSize: 12, color: running > 0 ? "var(--color-primary)" : "var(--color-muted)" }}>
            {running > 0 ? `実行中 ${running} 件…` : "待機中"}
          </span>
        </div>

        <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 12 }}>
          <strong>実行中にもう一度押してください。</strong>
          {preventOverlap
            ? "「スキップ（前回がまだ動いている）」になります。"
            : "チェックを外しているので、そのまま二重に走ります（これが事故です）。"}
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
          {[
            { k: "実行", v: stats.runs, c: "var(--color-fg)" },
            { k: "成功", v: stats.successes, c: "var(--color-success)" },
            { k: "失敗", v: stats.failures, c: "var(--color-danger)" },
            { k: "スキップ", v: stats.skipped, c: "var(--color-warning)" },
          ].map((s) => (
            <div key={s.k} style={{ textAlign: "center", padding: 8, background: "var(--color-bg)", borderRadius: "var(--radius)" }}>
              <div style={{ fontSize: 11, color: "var(--color-muted)" }}>{s.k}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.c }}>{s.v}</div>
            </div>
          ))}
        </div>

        {stats.lastError !== undefined && (
          <p style={{ fontSize: 12, color: "var(--color-danger)", marginBottom: 8 }}>
            直近のエラー: {stats.lastError}
          </p>
        )}

        {log.length > 0 && (
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--color-muted)" }}>
                <th style={{ padding: 4 }}>結果</th>
                <th style={{ padding: 4 }}>所要</th>
                <th style={{ padding: 4 }}>理由 / エラー</th>
              </tr>
            </thead>
            <tbody>
              {log.map((r, i) => (
                <tr key={i} style={{ borderTop: "1px solid var(--color-border)" }}>
                  <td style={{ padding: 4, fontWeight: 700, color: OUTCOME_COLOR[r.outcome] }}>{OUTCOME_LABEL[r.outcome]}</td>
                  <td style={{ padding: 4, ...mono }}>{r.durationMs}ms</td>
                  <td style={{ padding: 4, color: "var(--color-muted)" }}>
                    {r.reason !== undefined ? REASON_LABEL[r.reason] ?? r.reason : (r.error ?? "—")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          <strong>「わざと失敗させる」を入れても、スキップは失敗になりません。</strong>
          <code>skipped</code> は<strong>正常な動作</strong>で、アラートを鳴らす対象ではありません。
          ここを区別せず「実行されなかった＝異常」と扱うと、夜中に無駄な電話が鳴ります。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>② 分散ロック（サーバが 2 台のとき）</h2>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 12, lineHeight: 1.8 }}>
          <strong>可用性のためにサーバを 2 台にした瞬間、夜間バッチが 2 回走ります。</strong>
          請求書を 2 通送る、在庫を 2 回引く。<code>preventOverlap</code> は
          <strong>同一プロセス内しか見ない</strong>ので、これでは防げません。
          <br />
          分散ロックは「先に取れた方だけが実行する」——本番は Redis、ここはメモリ実装です。
        </p>

        <Button onClick={() => void fireBoth()} style={{ marginBottom: 12 }}>
          2 台同時に 2:00 になった
        </Button>

        {lockLog.length > 0 && (
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--color-muted)" }}>
                <th style={{ padding: 4 }}>どのサーバ</th>
                <th style={{ padding: 4 }}>結果</th>
                <th style={{ padding: 4 }}>理由</th>
              </tr>
            </thead>
            <tbody>
              {lockLog.map((x, i) => (
                <tr key={i} style={{ borderTop: "1px solid var(--color-border)" }}>
                  <td style={{ padding: 4 }}>{x.who}</td>
                  <td style={{ padding: 4, fontWeight: 700, color: OUTCOME_COLOR[x.r.outcome] }}>{OUTCOME_LABEL[x.r.outcome]}</td>
                  <td style={{ padding: 4, color: "var(--color-muted)" }}>
                    {x.r.reason !== undefined ? REASON_LABEL[x.r.reason] ?? x.r.reason : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          <strong>片方だけが実行され、もう片方はスキップされます。</strong>
          何度押しても結果は同じです（先に取った方が変わることはあります）。
          <br />
          本番では <code>createRedisLockStore()</code> に差し替えるだけで、
          <strong>アプリのコードは 1 行も変わりません</strong>。
          サーバ 1 台のうちはメモリ実装でも動くので、増やしたときに初めて事故る——
          <strong>だから最初からロックを書ける形にしておく</strong>のが基盤の役割です。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>③ cron 式（サーバ側）</h2>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 10, lineHeight: 1.8 }}>
          実際の起動は <code>createScheduler()</code> がサーバで行います。
          タイムゾーンは既定で <strong>Asia/Tokyo</strong> です（UTC のままだと日次バッチが 9 時間ずれます）。
        </p>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <tbody>
            {SCHEDULES.map((s) => (
              <tr key={s.expr} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ padding: 5, ...mono, width: 130 }}>{s.expr}</td>
                <td style={{ padding: 5, color: "var(--color-muted)" }}>{s.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <pre style={{ ...mono, background: "var(--color-bg)", padding: 12, borderRadius: "var(--radius)", marginTop: 12, marginBottom: 0, lineHeight: 1.7, overflowX: "auto" }}>
{`import { createScheduler, createRedisLockStore } from "@platform/cron";

const scheduler = createScheduler(
  [{
    name: "daily-report",
    schedule: "0 9 * * *",          // 毎日 9:00 (Asia/Tokyo)
    preventOverlap: true,            // 同一プロセスの多重防止
    lock: { store: createRedisLockStore(redis), ttlMs: 600_000 },  // 複数台の多重防止
    jitterMs: 30_000,                // 同時発火の平準化
    handler: async () => { await buildReport(); },
  }],
  (name, err) => log.error({ name, err }, "cron失敗"),
);
scheduler.start();`}
        </pre>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          <code>jitterMs</code> は<strong>同時発火の平準化</strong>です。9:00 ちょうどに全ジョブが
          一斉に DB を叩くと詰まるので、0〜30 秒のランダム遅延を入れて散らします。
          <br />
          エラーは <code>onError</code> に渡され、<strong>握り潰されません</strong>。
          cron の失敗が黙って消えると、「バッチが動いていなかった」と月末に気づくことになります。
          <code>/observability</code> のメトリクスへ流すのが定石です。
        </p>
      </div>
    </main>
  );
}
