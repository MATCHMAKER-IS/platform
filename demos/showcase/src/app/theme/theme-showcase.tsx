"use client";
/**
 * テーマ機構(@platform/theme)のショーケース。
 *
 * 11 スキンの一覧・トークン・WCAG 検査に加え、**ブランド色 1 色からの生成**、
 * CSS の書き出し、JSON の入出力・検証を見せる。
 *
 * UI は **@platform/ui の部品だけ**で組む(CLAUDE.md「UI 部品は @platform/ui を使う」)。
 */
import * as React from "react";
import {
  builtInThemes,
  checkTheme,
  checkThemeContrast,
  findContrastIssues,
  deriveTheme,
  themeToCssBlock,
  buildThemeStylesheet,
  validateTheme,
  themeToJson,
  themesFromJson,
  isValidThemeId,
  type Theme,
  type ThemeMode,
  type ThemeSeed,
} from "@platform/theme";
import { useSkin, SkinSelector, Button, Input, Textarea, Badge, Alert, Separator, ColorPicker } from "@platform/ui";

const box: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  padding: 12,
};

const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 11, wordBreak: "break-all" };

const code: React.CSSProperties = {
  ...mono,
  display: "block",
  background: "var(--color-bg)",
  border: "1px solid var(--color-border)",
  borderRadius: 4,
  padding: "8px 10px",
  lineHeight: 1.7,
  whiteSpace: "pre-wrap",
  maxHeight: 200,
  overflow: "auto",
};

function swatches(id: string): string[] {
  const t = builtInThemes.find((x) => x.id === id);
  if (!t) return [];
  const m = t.modes.light;
  return [m.primary, m.accent, m.surface, m.border];
}

function TokenTable({ theme, mode }: { theme: Theme; mode: ThemeMode }) {
  const entries = Object.entries(theme.modes[mode]);
  return (
    <div style={box}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{mode === "light" ? "ライト" : "ダーク"}トークン</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
        {entries.map(([k, v]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
            <span style={{ width: 14, height: 14, borderRadius: 3, background: v, border: "1px solid rgba(0,0,0,.15)", flexShrink: 0 }} />
            <code>{k}</code>
            <span style={{ color: "var(--color-muted)" }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function A11yReport({ theme }: { theme: Theme }) {
  const reports = checkTheme(theme);
  return (
    <div style={box}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>アクセシビリティ（WCAG コントラスト）</div>
      {reports.map((rep) => (
        <div key={rep.mode} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 4 }}>
            {rep.mode === "light" ? "ライト" : "ダーク"}（{rep.passesAA ? "AA 達成" : "★一部 AA 未達"}・最小 {rep.minRatio.toFixed(2)}:1）
          </div>
          {rep.checks.map((c, i) => {
            const color = c.level === "fail" ? "var(--color-danger)" : c.level === "AAA" ? "var(--color-success)" : "var(--color-warning)";
            return (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "2px 0" }}>
                <span>{c.label}</span>
                <span style={{ color }}>
                  {c.ratio}:1 {c.level}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function ThemeShowcase() {
  const { skin } = useSkin();

  // ── ブランド色から生成 ──
  const [primary, setPrimary] = React.useState("#0057b8");
  const [base, setBase] = React.useState<"light" | "warm" | "cool">("cool");
  const [brandId, setBrandId] = React.useState("my-brand");
  const [radius, setRadius] = React.useState(8);

  // ── JSON 入出力 ──
  const [json, setJson] = React.useState("");
  const [imported, setImported] = React.useState<Theme[] | null>(null);
  const [importErr, setImportErr] = React.useState("");

  const seed: ThemeSeed = React.useMemo(
    () => ({ id: isValidThemeId(brandId) ? brandId : "invalid", name: "自社ブランド", description: "コーポレートカラーから生成", primary, base, shape: { radius } }),
    [brandId, primary, base, radius],
  );
  const derived = React.useMemo(() => deriveTheme(seed), [seed]);
  const derivedReport = checkThemeContrast(derived, "light");
  const issues = React.useMemo(() => findContrastIssues(builtInThemes), []);
  const validation = validateTheme(derived);

  function doImport() {
    setImportErr("");
    try {
      setImported(themesFromJson(json));
    } catch (e) {
      setImported(null);
      setImportErr(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24, background: "var(--color-bg)", color: "var(--color-fg)", minHeight: "100vh" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>テーマ機構（@platform/theme）</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.7, marginBottom: 16 }}>
        色・フォント・角丸・余白を <strong>1 セットにして切り替える</strong>仕組み（明暗と直交）。
        <strong>アプリのコードに色を書かない</strong>ので、あとから会社の色に合わせられます。
      </p>

      <div style={{ margin: "16px 0" }}>
        <SkinSelector variant="grid" swatches={swatches} />
      </div>

      <div style={{ fontSize: 13, marginBottom: 12 }}>
        選択中: <strong>{skin.name}</strong> — {skin.description}
        <span style={{ color: "var(--color-muted)" }}>
          （フォント {skin.shape.fontFamily.split(",")[0]} / 角丸 {skin.shape.radius}px / 余白 {skin.shape.spacing}px）
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <TokenTable theme={skin} mode="light" />
        <TokenTable theme={skin} mode="dark" />
      </div>
      <A11yReport theme={skin} />

      {/* ── 組込スキンの検査 ── */}
      <div style={{ ...box, marginTop: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
          組込 11 スキンの一括検査
          <Badge variant={issues.length > 0 ? "warning" : "success"} style={{ marginLeft: 8 }}>
            {issues.length} 件で AA 未達
          </Badge>
        </div>
        {issues.length > 0 && (
          <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--color-muted)" }}>
                <th style={{ padding: 3 }}>スキン</th>
                <th style={{ padding: 3, width: 60 }}>モード</th>
                <th style={{ padding: 3, width: 70 }}>最小比</th>
                <th style={{ padding: 3 }}>該当</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((i, k) => (
                <tr key={k} style={{ borderTop: "1px solid var(--color-border)" }}>
                  <td style={{ padding: 3 }}>{i.themeId}</td>
                  <td style={{ padding: 3, color: "var(--color-muted)" }}>{i.mode}</td>
                  <td style={{ padding: 3, color: "var(--color-danger)" }}>{i.minRatio.toFixed(2)}:1</td>
                  <td style={{ padding: 3, color: "var(--color-muted)" }}>{i.checks.filter((c) => c.level === "fail").map((c) => c.label).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Alert variant="warning" title="見た目を優先したスキンは、コントラストで不利になります" style={{ marginTop: 10 }}>
          <span style={{ fontSize: 11.5, lineHeight: 1.8 }}>
            <code>soft</code> / <code>cute</code> / <code>warm</code> / <code>chic</code> の
            <strong>「補助テキスト」が AA（4.5:1）に届きません</strong>——淡い色を使っているためです。
            <br />
            <strong>これを検査で可視化できるのが要点です。</strong>
            「なんとなく読みにくい」ではなく<strong>数字で言えます</strong>。
            社外向けサイトや、公共調達が絡む案件では <code>highContrast</code> を使ってください。
          </span>
        </Alert>
      </div>

      {/* ── ブランド色から生成 ── */}
      <div style={{ ...box, marginTop: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>ブランド色 1 色からスキンを作る（deriveTheme）</div>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 10, lineHeight: 1.7 }}>
          <strong>会社のコーポレートカラーを入れるだけ</strong>で、light / dark 両方の全トークンが生成されます。
          「11 スキンのどれも自社の色じゃない」を解決します。
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
          <label style={{ fontSize: 11 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>ブランド主色</div>
            <ColorPicker value={primary} onChange={setPrimary} />
          </label>
          <label style={{ fontSize: 11 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>スキン ID</div>
            <Input value={brandId} onChange={(e) => setBrandId(e.target.value)} style={{ width: 130 }} />
          </label>
          <div>
            <div style={{ marginBottom: 4, fontSize: 11, color: "var(--color-muted)" }}>ベースの明るさ</div>
            <div style={{ display: "flex", gap: 4 }}>
              {(["light", "warm", "cool"] as const).map((b) => (
                <Button key={b} size="sm" variant={base === b ? "primary" : "secondary"} onClick={() => setBase(b)}>
                  {b === "light" ? "白基調" : b === "warm" ? "クリーム" : "青み"}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ marginBottom: 4, fontSize: 11, color: "var(--color-muted)" }}>角丸</div>
            <div style={{ display: "flex", gap: 4 }}>
              {[0, 4, 8, 16].map((r) => (
                <Button key={r} size="sm" variant={radius === r ? "primary" : "secondary"} onClick={() => setRadius(r)}>
                  {r}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
          <Badge variant={isValidThemeId(brandId) ? "success" : "danger"}>ID: {isValidThemeId(brandId) ? "OK" : "英数字とハイフンのみ"}</Badge>
          <Badge variant={derivedReport.passesAA ? "success" : "danger"}>
            {derivedReport.passesAA ? "AA 合格" : "AA 未達"}（最小 {derivedReport.minRatio.toFixed(2)}:1）
          </Badge>
          <Badge variant={validation.length === 0 ? "success" : "danger"}>{validation.length === 0 ? "検証 OK" : `${validation.length} 件の不備`}</Badge>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <TokenTable theme={derived} mode="light" />
          <TokenTable theme={derived} mode="dark" />
        </div>

        {/* 生成したテーマのプレビュー(CSS 変数を直接あてる) */}
        <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 4 }}>プレビュー（生成したトークンを直接あてています）</div>
        <div
          style={{
            background: derived.modes.light.bg,
            color: derived.modes.light.fg,
            border: `1px solid ${derived.modes.light.border}`,
            borderRadius: derived.shape.radius,
            padding: 14,
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{derived.name}</div>
          <div style={{ fontSize: 12, color: derived.modes.light.muted, marginBottom: 10 }}>補助テキストはこの色になります</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ background: derived.modes.light.primary, color: derived.modes.light.primaryFg, borderRadius: derived.shape.radius, padding: "6px 14px", fontSize: 13 }}>
              主ボタン
            </span>
            <span style={{ background: derived.modes.light.surface, border: `1px solid ${derived.modes.light.border}`, borderRadius: derived.shape.radius, padding: "6px 14px", fontSize: 13 }}>
              サーフェス
            </span>
            <span style={{ background: derived.modes.light.accent, color: "#fff", borderRadius: derived.shape.radius, padding: "6px 14px", fontSize: 13 }}>
              アクセント
            </span>
          </div>
        </div>

        <Alert variant="success" title="どんな色を入れても AA に落ちません" style={{ marginBottom: 10 }}>
          <span style={{ fontSize: 11.5, lineHeight: 1.8 }}>
            <strong>薄い黄色（#ffe066）でも、薄いグレー（#cccccc）でも合格します。</strong>
            <code>readableTextColor()</code> が<strong>文字色を自動で選ぶ</strong>ためです——
            主色が明るければ黒、暗ければ白。
            <br />
            <strong>組込スキンより、生成したスキンの方が安全</strong>という結果になります
            （上の表で 11 中 7 件が AA 未達）。手で色を決めると、必ずどこかで見落とします。
          </span>
        </Alert>

        <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 4 }}>
          <code>themeToCssBlock(theme, &quot;light&quot;, &apos;[data-skin=&quot;{brandId}&quot;]&apos;)</code>
        </div>
        <span style={code}>{themeToCssBlock(derived, "light", `[data-skin="${isValidThemeId(brandId) ? brandId : "invalid"}"]`)}</span>

        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <Button size="sm" variant="secondary" onClick={() => setJson(themeToJson(derived))}>
            JSON に書き出す
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setJson(buildThemeStylesheet([derived]))}>
            スタイルシートを書き出す
          </Button>
        </div>
      </div>

      {/* ── JSON 入出力 ── */}
      <div style={{ ...box, marginTop: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>テーマの受け渡し（JSON）</div>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 10, lineHeight: 1.7 }}>
          <strong>デザイナーが作ったテーマを JSON で受け取る</strong>——コードを触らずにスキンを追加できます。
          ただし<strong>外から来た JSON は必ず検証</strong>してください。
        </p>
        <Textarea
          value={json}
          onChange={(e) => setJson(e.target.value)}
          rows={5}
          placeholder="上のボタンで書き出すか、JSON を貼ってください"
          style={{ ...mono, marginBottom: 8 }}
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Button size="sm" onClick={doImport}>
            読み込む（themesFromJson）
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setJson('[{"id":"broken","name":"壊れたテーマ"}]')}>
            壊れた JSON を入れる
          </Button>
          {imported !== null && <Badge variant="success">{imported.length} 件を読み込みました</Badge>}
        </div>

        {importErr !== "" && (
          <Alert variant="danger" title="読み込めません" style={{ marginTop: 10 }}>
            <span style={{ fontSize: 11.5, lineHeight: 1.8 }}>
              {importErr}
              <br />
              <strong>これが要点です。</strong><code>parseTheme()</code> / <code>themesFromJson()</code> は
              <strong>不備を見つけたら例外を投げます</strong>——
              検証せずに <code>applySkin()</code> すると、
              <strong>色が undefined になって画面が真っ白になります</strong>。
            </span>
          </Alert>
        )}

        {imported !== null && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            {imported.map((t) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, border: "1px solid var(--color-border)", borderRadius: 4, padding: "4px 8px" }}>
                <span style={{ width: 12, height: 12, borderRadius: 2, background: t.modes.light.primary }} />
                {t.name}
                <Badge variant={checkThemeContrast(t, "light").passesAA ? "success" : "warning"}>
                  {checkThemeContrast(t, "light").passesAA ? "AA" : "未達"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ ...box, marginTop: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>アプリへの組み込み</div>
        <span style={code}>
{`// ① 生成したテーマを登録する
import { createThemeRegistry, builtInThemes, deriveTheme } from "@platform/theme";

const registry = createThemeRegistry({
  themes: [...builtInThemes, deriveTheme({ id: "acme", name: "ACME", primary: "#0057b8" })],
});

// ② 画面にあてる(CSS 変数を書き換える)
import { applySkin } from "@platform/theme";
applySkin(theme, "dark");

// ③ ビルド時にスタイルシートを出す(SSR で FOUC を防ぐ)
import { buildThemeStylesheet } from "@platform/theme";
const css = buildThemeStylesheet(registry.list());   // [data-skin="acme"] { --color-primary: ... }`}
        </span>
        <Separator style={{ margin: "12px 0" }} />

        {/* 横の案内(サイドバー)の見え方。テーマを切り替えると色が変わる */}
        <div style={{ fontSize: 13, fontWeight: 700, margin: "16px 0 8px" }}>横の案内(サイドバー)</div>
        <p style={{ fontSize: 11.5, color: "var(--color-muted)", lineHeight: 1.8, margin: "0 0 10px" }}>
          テーマが <code>sidebarBg</code> を持つ場合だけ、案内の色が変わります(ネイビーサイド・フォレストサイド・ワインサイド)。
          持たないテーマでは <code>surface</code> のまま——<strong>これまでと同じ見た目</strong>です。
        </p>
        <div style={{ display: "flex", border: "1px solid var(--color-border)", borderRadius: "var(--radius)", overflow: "hidden", minHeight: 180 }}>
          <div
            style={{
              width: 170, padding: 12, flexShrink: 0,
              background: "var(--color-sidebar-bg, var(--color-surface))",
              color: "var(--color-sidebar-fg, var(--color-fg))",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, opacity: 0.85 }}>社内システム</div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 2 }}>
              {[
                { label: "ダッシュボード", active: false },
                { label: "経費申請", active: true },
                { label: "勤怠", active: false },
                { label: "請求", active: false },
                { label: "設定", active: false },
              ].map((it) => (
                <li
                  key={it.label}
                  style={{
                    fontSize: 12.5, padding: "7px 10px", borderRadius: "var(--radius)",
                    ...(it.active
                      ? {
                          background: "var(--color-sidebar-active-bg, color-mix(in srgb, currentColor 12%, transparent))",
                          color: "var(--color-sidebar-active-fg, inherit)",
                          fontWeight: 600,
                        }
                      : { opacity: 0.75 }),
                  }}
                >
                  {it.label}
                </li>
              ))}
            </ul>
          </div>
          <div style={{ flex: 1, padding: 16, background: "var(--color-bg)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>経費申請</div>
            <p style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.9, margin: 0 }}>
              本文は明るいまま、案内だけ濃くする型です。境目がはっきりするので、
              画面が広くても<strong>今どこにいるか</strong>を見失いにくくなります。
            </p>
          </div>
        </div>

        <Separator style={{ margin: "16px 0 12px" }} />
        <p style={{ fontSize: 11.5, color: "var(--color-muted)", lineHeight: 1.8, margin: 0 }}>
          <strong>アプリのコードに色を書かない</strong>のが要点です。
          <code>bg-neutral-900</code> と直書きすると、<strong>スキンを切り替えても変わりません</strong>——
          これは実際に起きた問題で、<code>CLAUDE.md</code> の「UI 部品は @platform/ui を使う」規約の理由の 1 つです。
          <br />
          <code>buildThemeStylesheet()</code> は<strong>全スキンの CSS を 1 枚にまとめます</strong>。
          SSR で先に配れば、<strong>読み込み時に色がチラつきません</strong>（FOUC）。
        </p>
      </div>
    </div>
  );
}
