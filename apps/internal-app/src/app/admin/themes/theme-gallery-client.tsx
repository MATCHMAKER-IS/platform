"use client";
/**
 * テーマギャラリー。標準スキンを一覧・切り替えし、選んだテーマで UI プレビューを見せる。
 * SkinProvider がスキンを <html> に適用するので、data-skin に対応した CSS 変数で全体が変わる。
 * ここではプレビュー領域にインラインで CSS 変数を当て、選択スキンの見た目を局所的に示す。
 */
import * as React from "react";
import { createThemeRegistry, builtInThemes, themeToCssVars, deriveTheme, checkTheme, type ThemeMode, type Theme } from "@platform/theme";
import { SkinProvider, useSkin, SkinSelector } from "@platform/ui";

// 標準テーマを登録したレジストリ(アプリ起動時に1回作る。独自テーマはここに register で足せる)。
const registry = createThemeRegistry({ themes: builtInThemes });

// スキンごとのプレビュー色(セレクタのスウォッチ用)。
function swatches(id: string): string[] {
  const theme = registry.get(id);
  if (!theme) return [];
  const t = theme.modes.light;
  return [t.primary, t.accent, t.surface, t.border];
}

function Preview({ mode }: { mode: ThemeMode }) {
  const { skin } = useSkin();
  const vars = themeToCssVars(skin, mode) as React.CSSProperties;
  return (
    <div style={{ ...vars, background: "var(--color-bg)", color: "var(--color-fg)", borderRadius: "var(--radius)", border: "1px solid var(--color-border)", fontFamily: "var(--font-family)", overflow: "hidden" }}>
      <div style={{ fontSize: 11, color: "var(--color-muted)", padding: "6px 12px", borderBottom: "1px solid var(--color-border)" }}>{mode === "light" ? "ライト" : "ダーク"}モード</div>

      {/* ナビバー */}
      <div style={{ background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)", padding: "8px 12px", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: "var(--color-primary)" }}>社内アプリ</span>
        <span style={{ fontSize: 11 }}>ホーム</span>
        <span style={{ fontSize: 11, color: "var(--color-muted)" }}>申請</span>
        <span style={{ fontSize: 11, color: "var(--color-muted)" }}>設定</span>
      </div>

      <div style={{ padding: 12 }}>
        {/* カード + フォーム */}
        <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius)", padding: 12, boxShadow: "var(--shadow)", marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>新規申請</div>
          <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 4 }}>件名</div>
          <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius)", padding: "6px 8px", fontSize: 12, background: "var(--color-bg)", marginBottom: 8 }}>備品購入の稟議</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button style={{ background: "var(--color-primary)", color: "var(--color-primary-fg)", border: "none", borderRadius: "var(--radius)", padding: "6px 14px", fontSize: 12 }}>申請する</button>
            <button style={{ background: "transparent", color: "var(--color-primary)", border: "1px solid var(--color-primary)", borderRadius: "var(--radius)", padding: "6px 14px", fontSize: 12 }}>下書き保存</button>
          </div>
        </div>

        {/* テーブル */}
        <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius)", overflow: "hidden", boxShadow: "var(--shadow)" }}>
          <div style={{ display: "flex", fontSize: 11, fontWeight: 600, color: "var(--color-muted)", padding: "6px 10px", borderBottom: "1px solid var(--color-border)" }}>
            <span style={{ flex: 2 }}>件名</span><span style={{ flex: 1 }}>状態</span>
          </div>
          {[["交通費精算", "success", "承認"], ["備品購入", "warning", "確認中"], ["経費申請", "danger", "差戻し"]].map(([name, kind, label], i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", fontSize: 12, padding: "6px 10px", borderBottom: i < 2 ? "1px solid var(--color-border)" : "none" }}>
              <span style={{ flex: 2 }}>{name}</span>
              <span style={{ flex: 1 }}><span style={{ background: `var(--color-${kind})`, color: "var(--color-surface, #fff)", borderRadius: 999, padding: "2px 8px", fontSize: 10 }}>{label}</span></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CustomThemeMaker({ onCreated }: { onCreated: (id: string) => void }) {
  const { setSkin } = useSkin();
  const [name, setName] = React.useState("自社ブランド");
  const [primary, setPrimary] = React.useState("#e60033");
  const [accent, setAccent] = React.useState("#0088cc");
  const [base, setBase] = React.useState<"light" | "warm" | "cool">("light");
  const [radius, setRadius] = React.useState(8);
  const [msg, setMsg] = React.useState("");

  // 入力からプレビュー用テーマを即時生成
  const preview = React.useMemo(() => {
    const id = "custom-" + (name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "brand");
    return deriveTheme({ id, name: name.trim() || "カスタム", primary, accent, base, shape: { radius } });
  }, [name, primary, accent, base, radius]);

  const a11y = React.useMemo(() => checkTheme(preview), [preview]);
  const btnFail = a11y.some((r) => r.checks.find((c) => c.label.includes("主ボタン"))?.level === "fail");

  const create = async () => {
    setMsg("");
    // DB に保存(組織で共有・再訪時も残る)
    const r = await fetch("/api/admin/theme/custom", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ theme: preview }),
    });
    const d = (await r.json()) as { error?: string };
    if (!r.ok) { setMsg(d.error ?? "保存に失敗しました"); return; }
    registry.register(preview);
    onCreated(preview.id);
    setSkin(preview.id);
    setMsg(`「${preview.name}」を保存し、適用しました（組織で共有されます）。`);
  };

  const lp = preview.modes.light;
  const swatch = (color: string, set: (v: string) => void, label: string) => (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
      <span style={{ color: "var(--color-muted, #666)" }}>{label}</span>
      <input type="color" value={color} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set(e.target.value)} style={{ width: 48, height: 32, border: "1px solid var(--color-border, #ddd)", borderRadius: 6, padding: 0, cursor: "pointer" }} />
    </label>
  );

  return (
    <div style={{ background: "var(--color-surface, #fff)", border: "1px solid var(--color-border, #e5e7eb)", borderRadius: "var(--radius, 10px)", padding: 16, marginTop: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>自社ブランドテーマを作る</div>
      <p style={{ fontSize: 12, color: "var(--color-muted, #6b7280)", marginTop: 0 }}>主色などを選ぶと、light/dark 両モードのスキンを自動生成します（<code>deriveTheme</code>）。作成すると即座に一覧へ追加され、適用されます。</p>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
          <span style={{ color: "var(--color-muted, #666)" }}>テーマ名</span>
          <input value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} style={{ padding: "6px 8px", border: "1px solid var(--color-border, #ddd)", borderRadius: 6, fontSize: 13 }} />
        </label>
        {swatch(primary, setPrimary, "主色")}
        {swatch(accent, setAccent, "アクセント")}
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
          <span style={{ color: "var(--color-muted, #666)" }}>ベース</span>
          <select value={base} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBase(e.target.value as "light" | "warm" | "cool")} style={{ padding: "6px 8px", border: "1px solid var(--color-border, #ddd)", borderRadius: 6, fontSize: 13 }}>
            <option value="light">標準（白）</option>
            <option value="warm">暖色（クリーム）</option>
            <option value="cool">寒色（青み）</option>
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
          <span style={{ color: "var(--color-muted, #666)" }}>角丸 {radius}px</span>
          <input type="range" min={0} max={24} value={radius} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRadius(Number(e.target.value))} />
        </label>
      </div>

      {/* ミニプレビュー(生成テーマの色で) */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", padding: 12, borderRadius: radius, background: lp.bg, border: `1px solid ${lp.border}`, marginBottom: 8 }}>
        <button style={{ background: lp.primary, color: lp.primaryFg, border: "none", borderRadius: radius, padding: "6px 14px", fontSize: 13 }}>主ボタン</button>
        <span style={{ background: lp.accent, color: "var(--color-surface, #fff)", borderRadius: 999, padding: "2px 10px", fontSize: 12 }}>アクセント</span>
        <span style={{ color: lp.fg, fontSize: 13 }}>本文テキスト</span>
        <span style={{ color: lp.muted, fontSize: 12 }}>補助テキスト</span>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button onClick={() => void create()} style={{ background: "var(--color-primary, #2563eb)", color: "var(--color-surface, #fff)", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>保存して適用</button>
        {btnFail && <span style={{ fontSize: 12, color: "var(--color-warning, #d97706)" }}>⚠ 主色と文字色のコントラストが低めです（読みにくい可能性）。</span>}
        {msg && <span style={{ fontSize: 12, color: "var(--color-success, #16a34a)" }}>{msg}</span>}
      </div>
    </div>
  );
}

function CustomThemeManager({ custom, onChanged }: { custom: Theme[]; onChanged: () => void }) {
  const [msg, setMsg] = React.useState("");

  const remove = async (id: string) => {
    setMsg("");
    const r = await fetch(`/api/admin/theme/custom?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const d = (await r.json()) as { error?: string };
    if (r.ok) { setMsg(`「${id}」を削除しました。`); onChanged(); }
    else setMsg(d.error ?? "削除に失敗しました");
  };

  const exportJson = () => {
    if (typeof window !== "undefined") window.open("/api/admin/theme/custom?export=1", "_blank");
  };

  const importJson = async (file: File) => {
    setMsg("");
    const json = await file.text();
    const r = await fetch("/api/admin/theme/custom", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ json }) });
    const d = (await r.json()) as { imported?: number; skipped?: string[]; error?: string };
    if (!r.ok) { setMsg(d.error ?? "取り込みに失敗しました"); return; }
    const skippedNote = d.skipped && d.skipped.length > 0 ? `（${d.skipped.length} 件スキップ: ${d.skipped[0]}）` : "";
    setMsg(`${d.imported} 件を取り込みました${skippedNote}`);
    onChanged();
  };

  const btn: React.CSSProperties = { padding: "6px 12px", border: "1px solid var(--color-border, #ddd)", borderRadius: 8, background: "var(--color-surface, #fff)", color: "var(--color-fg, #111)", fontSize: 12, cursor: "pointer" };

  return (
    <div style={{ background: "var(--color-surface, #fff)", border: "1px solid var(--color-border, #e5e7eb)", borderRadius: "var(--radius, 10px)", padding: 16, marginTop: 12 }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>保存済みのカスタムテーマ（{custom.length}）</div>
      <p style={{ fontSize: 12, color: "var(--color-muted, #6b7280)", marginTop: 0 }}>組織で共有されます。JSON で書き出し・取り込みでき、他の環境へ持ち運べます。</p>

      {custom.length === 0 && <p style={{ fontSize: 12, color: "var(--color-muted, #999)" }}>まだありません。上のフォームから作成できます。</p>}
      {custom.map((t) => (
        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--color-border, #f3f4f6)" }}>
          <span style={{ width: 16, height: 16, borderRadius: 4, background: t.modes.light.primary, border: "1px solid rgba(0,0,0,.15)" }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</span>
          <code style={{ fontSize: 11, color: "var(--color-muted, #999)" }}>{t.id}</code>
          <button onClick={() => void remove(t.id)} style={{ ...btn, marginLeft: "auto", color: "var(--color-danger, #c00)", fontSize: 11 }}>削除</button>
        </div>
      ))}

      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={exportJson} style={btn}>JSON で書き出し</button>
        <label style={{ ...btn, background: "var(--color-bg, #f9fafb)" }}>
          JSON を取り込み
          <input type="file" accept=".json,application/json" style={{ display: "none" }} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) void importJson(f); }} />
        </label>
        {msg && <span style={{ fontSize: 12, color: msg.includes("失敗") ? "var(--color-danger, #c00)" : "var(--color-success, #16a34a)" }}>{msg}</span>}
      </div>
    </div>
  );
}

function ThemeHistory() {
  const [history, setHistory] = React.useState<{ at: string; actor: string; action: string; target: string; note?: string }[]>([]);
  const [shown, setShown] = React.useState(false);

  const load = async () => {
    const r = await fetch("/api/admin/theme?history=1");
    if (!r.ok) return;
    const d = (await r.json()) as { history: typeof history };
    setHistory(d.history);
    setShown(true);
  };

  const label = (action: string) =>
    action === "default-changed" ? "組織デフォルト変更" : action === "custom-saved" ? "テーマ保存" : action === "custom-deleted" ? "テーマ削除" : action;

  return (
    <div style={{ background: "var(--color-surface, #fff)", border: "1px solid var(--color-border, #e5e7eb)", borderRadius: "var(--radius, 10px)", padding: 16, marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>変更履歴</div>
        <button onClick={() => void load()} style={{ padding: "6px 12px", border: "1px solid var(--color-border, #ddd)", borderRadius: 8, background: "var(--color-surface, #fff)", color: "var(--color-fg, #111)", fontSize: 12, cursor: "pointer" }}>履歴を表示</button>
      </div>
      {shown && (
        <div style={{ marginTop: 8 }}>
          {history.length === 0 && <p style={{ fontSize: 12, color: "var(--color-muted, #999)" }}>まだ変更履歴がありません。</p>}
          {history.map((e, i) => (
            <div key={i} style={{ fontSize: 12, padding: "4px 0", borderBottom: "1px solid var(--color-border, #f5f5f5)", display: "flex", gap: 8, alignItems: "baseline" }}>
              <span style={{ color: "var(--color-muted, #999)", minWidth: 130 }}>{new Date(e.at).toLocaleString("ja-JP")}</span>
              <span style={{ color: "var(--color-primary, #4338ca)", minWidth: 110 }}>{label(e.action)}</span>
              <code>{e.target}</code>
              {e.note && <span style={{ color: "var(--color-muted, #666)" }}>{e.note}</span>}
              <span style={{ marginLeft: "auto", color: "var(--color-muted, #999)" }}>{e.actor}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Inner() {
  const { skin } = useSkin();
  const [saveMsg, setSaveMsg] = React.useState("");
  const [, forceUpdate] = React.useState(0);
  const [custom, setCustom] = React.useState<Theme[]>([]);

  // 保存済みカスタムテーマを読み、レジストリへ反映する
  const reloadCustom = React.useCallback(async () => {
    const r = await fetch("/api/admin/theme/custom");
    if (!r.ok) return;
    const d = (await r.json()) as { themes: Theme[] };
    setCustom(d.themes);
    for (const t of d.themes) {
      try { registry.register(t); } catch { /* 壊れたテーマは無視 */ }
    }
    forceUpdate((n) => n + 1);
  }, []);

  React.useEffect(() => { void reloadCustom(); }, [reloadCustom]);

  const saveAsDefault = async () => {
    setSaveMsg("");
    const r = await fetch("/api/admin/theme", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ skinId: skin.id, mode: "system" }) });
    const d = await r.json();
    setSaveMsg(r.ok ? `「${skin.name}」を組織デフォルトに設定しました。` : (d.error ?? "保存に失敗しました"));
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22 }}>テーマギャラリー</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted, #666)", lineHeight: 1.6 }}>
        WordPress のテーマのように、色・フォント・角丸・余白をまとめた「スキン」を切り替えられます。
        選択は保存され、次回も同じテーマで表示されます。テーマは後から追加できます（<code>registry.register()</code>）。
      </p>

      <div style={{ marginTop: 16 }}>
        <SkinSelector variant="grid" swatches={swatches} />
      </div>

      <CustomThemeMaker onCreated={() => void reloadCustom()} />
      <CustomThemeManager custom={custom} onChanged={() => void reloadCustom()} />
      <ThemeHistory />

      <div style={{ marginTop: 20, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: "#444" }}>選択中: <strong>{skin.name}</strong>（フォント: {skin.shape.fontFamily.split(",")[0]} / 角丸 {skin.shape.radius}px）</div>
        <button onClick={saveAsDefault} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #2563eb", background: "var(--color-primary, #2563eb)", color: "var(--color-surface, #fff)", fontSize: 13, cursor: "pointer" }}>組織デフォルトに設定（管理者）</button>
        {saveMsg && <span style={{ fontSize: 12, color: saveMsg.includes("設定しました") ? "var(--color-success, #16a34a)" : "var(--color-danger, #c00)" }}>{saveMsg}</span>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
        <Preview mode="light" />
        <Preview mode="dark" />
      </div>
    </div>
  );
}

export function ThemeGalleryClient({ initialCustom = [] }: { initialCustom?: Theme[] }) {
  // 保存済みカスタムテーマをレジストリに反映(初回のみ)
  React.useMemo(() => {
    for (const t of initialCustom) {
      try { registry.register(t); } catch { /* 壊れたテーマは無視 */ }
    }
  }, [initialCustom]);

  return (
    <SkinProvider registry={registry} mode="light">
      <Inner />
    </SkinProvider>
  );
}
