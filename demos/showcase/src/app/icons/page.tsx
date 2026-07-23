"use client";
/**
 * アイコン一覧のデモ。
 *
 * **名前をベタ書きしない。** lucide は改名が多く(`Home`→`House` など)、存在しない名前を
 * 渡すと `Icon` は黙って null を返す = 画面に空白が出るだけで誰も気づかない。
 * ここでは基盤の `hasIcon()` で実在を確かめ、**実在するものだけ**を出す。
 * 候補に旧名/新名の両方を並べておけば、lucide を上げても下げても壊れない。
 *
 * lucide-react は **直接 import しない**(`.npmrc` が巻き上げを抑えているので解決できないし、
 * packages/ui/README.md が「アプリは lucide を直接依存に持たない」と定めている)。
 */
import * as React from "react";
import { Button, Icon, Input, hasIcon, iconNames } from "@platform/ui";

/**
 * 業務アプリでよく使うアイコンの候補(カテゴリ別)。
 * 改名されたものは **旧名・新名の両方**を候補に入れてある。実在する方だけが表示される。
 */
const CANDIDATES: Record<string, string[]> = {
  "ナビゲーション": [
    "Home", "House", "Search", "Menu", "ChevronLeft", "ChevronRight", "ChevronDown", "ChevronUp",
    "ArrowLeft", "ArrowRight", "ExternalLink", "MoreHorizontal", "Ellipsis", "MoreVertical", "EllipsisVertical",
  ],
  "操作": ["Plus", "Minus", "X", "Check", "Pencil", "Trash2", "Copy", "Save", "RefreshCw", "Undo2", "Redo2", "Send"],
  "ファイル": ["File", "FileText", "FileSpreadsheet", "Folder", "FolderOpen", "Upload", "Download", "Paperclip", "Image", "Printer", "Archive", "Files"],
  "ユーザー・権限": ["User", "Users", "UserPlus", "UserMinus", "UserCheck", "Lock", "Unlock", "LockOpen", "Key", "Shield", "ShieldCheck", "LogIn", "LogOut"],
  "状態・通知": [
    "Bell", "BellOff", "Info", "AlertCircle", "CircleAlert", "AlertTriangle", "TriangleAlert",
    "CheckCircle2", "CircleCheck", "XCircle", "CircleX", "HelpCircle", "CircleHelp", "Loader", "Clock", "Star", "Heart",
  ],
  "業務": ["Calendar", "CalendarDays", "Building2", "Briefcase", "Receipt", "CreditCard", "Wallet", "Banknote", "ShoppingCart", "Package", "Truck", "ClipboardList"],
  "データ・分析": [
    // lucide の新しい名前に統一(BarChart3 などの旧名は削除された)
    "ChartColumn", "LineChart", "ChartLine", "PieChart", "ChartPie",
    "TrendingUp", "TrendingDown", "Table", "Database", "Filter", "ArrowUpDown", "ListFilter", "Calculator", "Percent",
  ],
  "通信": ["Mail", "MessageSquare", "Phone", "Share2", "Link", "Wifi", "Rss", "AtSign"],
  "設定・システム": ["Settings", "SlidersHorizontal", "Cog", "Terminal", "Code", "Bug", "Server", "Cloud", "HardDrive", "Cpu", "Activity", "Power"],
  "その他": ["Eye", "EyeOff", "MapPin", "Globe", "Sun", "Moon", "Palette", "Languages", "QrCode", "Camera", "Mic", "Bot"],
};

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

export default function Page() {
  const [query, setQuery] = React.useState("");
  const [copied, setCopied] = React.useState("");
  const [size, setSize] = React.useState(22);

  // 実在するものだけに絞る(存在しない名前は静かに落とす)
  const catalog = React.useMemo(() => {
    const out: { category: string; names: string[] }[] = [];
    for (const [category, candidates] of Object.entries(CANDIDATES)) {
      // hasIcon で実在を確かめる。ここが 0 件になるときは
      // lucide の取り込みに失敗している(版によって形が変わるため)
      const names = candidates.filter((n) => hasIcon(n));
      if (names.length > 0) out.push({ category, names });
    }
    return out;
  }, []);

  const total = React.useMemo(() => catalog.reduce((s, c) => s + c.names.length, 0), [catalog]);
  const allCount = React.useMemo(() => iconNames().length, []);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === "") return catalog;
    return catalog
      .map((c) => ({ category: c.category, names: c.names.filter((n) => n.toLowerCase().includes(q)) }))
      .filter((c) => c.names.length > 0);
  }, [catalog, query]);

  const hitCount = filtered.reduce((s, c) => s + c.names.length, 0);

  async function copy(name: string) {
    const snippet = `<Icon name="${name}" size={${size}} />`;
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(name);
      setTimeout(() => setCopied(""), 1200);
    } catch {
      setCopied("");
    }
  }

  return (
    <main style={{ maxWidth: 980, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>アイコン</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 16 }}>
        <code>&lt;Icon name=&quot;Home&quot; /&gt;</code> のように<strong>名前で指定</strong>できます（Font Awesome ライク）。
        中身は lucide で、<strong>{allCount.toLocaleString()} 種類すべてが使えます</strong>。
        ここでは業務アプリでよく使う <strong>{total} 種類</strong>を並べています。
        アイコンをクリックするとコードがコピーされます。
      </p>

      <div style={box}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="名前で絞り込み（例: chart, user, file）"
            style={{
              flex: 1,
              minWidth: 220,
              height: 36,
              padding: "0 12px",
              borderRadius: "var(--radius)",
              border: "1px solid var(--color-border)",
              background: "var(--color-bg)",
              color: "var(--color-fg)",
              fontSize: 13,
            }}
          />
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--color-muted)" }}>
            サイズ
            <Input type="range" min={14} max={40} value={size} onChange={(e) => setSize(Number(e.target.value))} />
            <span style={{ width: 34, textAlign: "right", fontFamily: "monospace" }}>{size}px</span>
          </label>
          <span style={{ fontSize: 12, color: "var(--color-muted)" }}>{hitCount} 件</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ ...box, textAlign: "center", color: "var(--color-muted)", fontSize: 13 }}>
          この一覧には該当がありません。
          <br />
          <strong>ここに無いだけで、lucide の {allCount.toLocaleString()} 種類はすべて使えます。</strong>
          下のリンクから探してください。
        </div>
      ) : (
        filtered.map((c) => (
          <div key={c.category} style={box}>
            <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
              {c.category}
              <span style={{ fontSize: 11, fontWeight: 400, color: "var(--color-muted)", marginLeft: 8 }}>{c.names.length} 件</span>
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 6 }}>
              {c.names.map((n) => (
                <Button
                  key={n}
                  onClick={() => void copy(n)}
                  title={`<Icon name="${n}" /> をコピー`}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    // Button は既定で高さが固定(h-9 = 36px)。
                    // アイコンと名前を縦に並べると入りきらず、**アイコンが見えなくなる**。
                    height: "auto",
                    minHeight: 0,
                    padding: "12px 4px",
                    borderRadius: "var(--radius)",
                    border: "1px solid",
                    borderColor: copied === n ? "var(--color-success)" : "var(--color-border)",
                    background: copied === n ? "color-mix(in srgb, var(--color-success) 10%, transparent)" : "var(--color-bg)",
                    color: "var(--color-fg)",
                    cursor: "pointer",
                    transition: "border-color .15s",
                  }}
                >
                  <Icon name={n as never} size={size} />
                  <span style={{ fontSize: 10, color: "var(--color-muted)", wordBreak: "break-all", lineHeight: 1.3, textAlign: "center" }}>
                    {copied === n ? "コピーしました" : n}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        ))
      )}

      <div style={box}>
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>参考サイト</h2>
        <ul style={{ fontSize: 13, lineHeight: 2, margin: 0, paddingLeft: "1.2em" }}>
          <li>
            <a href="https://lucide.dev/icons/" target="_blank" rel="noreferrer" style={{ color: "var(--color-primary)" }}>
              lucide.dev/icons
            </a>{" "}
            — <strong>全 {allCount.toLocaleString()} 種類を検索できる公式サイト。</strong>ここで見つけた名前を
            そのまま <code>&lt;Icon name=&quot;…&quot; /&gt;</code> に書けます
          </li>
          <li>
            <a href="https://lucide.dev/guide/design/icon-design-guide" target="_blank" rel="noreferrer" style={{ color: "var(--color-primary)" }}>
              Icon Design Guide
            </a>{" "}
            — 自前でアイコンを足すときの指針（24×24 グリッド・2px ストローク）
          </li>
          <li>
            <a href="https://github.com/lucide-icons/lucide/releases" target="_blank" rel="noreferrer" style={{ color: "var(--color-primary)" }}>
              リリースノート
            </a>{" "}
            — <strong>改名を確認するとき用。</strong>lucide は改名が多く、
            <code>Home</code>→<code>House</code>、<code>AlertCircle</code>→<code>CircleAlert</code>、
            <code>BarChart3</code>→<code>ChartColumn</code> のように変わっています
          </li>
        </ul>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 12, lineHeight: 1.8 }}>
          <strong>名前を間違えると <code>Icon</code> は静かに <code>null</code> を返します</strong>
          （エラーにならず、空白が出るだけ）。lucide.dev で確認してから書いてください。
          <br />
          このページ自体も、<strong>候補に旧名と新名の両方を並べて、実在するものだけを表示</strong>しています。
          そうしないと lucide を上げ下げしたときに、一覧に穴が空いても誰も気づけません。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>使い方</h2>
        <pre style={{ fontSize: 12, fontFamily: "monospace", background: "var(--color-bg)", padding: 12, borderRadius: "var(--radius)", margin: 0, lineHeight: 1.8, overflowX: "auto" }}>
{`// 名前で指定（Font Awesome ライク。全 ${allCount.toLocaleString()} 種類）
import { Icon } from "@platform/ui";
<Icon name="Home" size={20} />
<Icon name="Trash2" color="var(--color-danger)" />

// 個別 import（バンドルサイズを絞りたい箇所はこちら）
import { Home, Search } from "@platform/ui/icons";
<Home className="h-5 w-5" />`}
        </pre>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          <strong>名前指定は全アイコンをバンドルに含めます。</strong>管理画面など内部向けなら問題ありませんが、
          公開サイトのように初回表示を詰めたい場所では <code>@platform/ui/icons</code> からの個別 import を使ってください。
          <br />
          色は既定で <code>currentColor</code> なので、親のテキスト色を継承します。スキンを切り替えると一緒に変わります。
        </p>
      </div>
    </main>
  );
}
