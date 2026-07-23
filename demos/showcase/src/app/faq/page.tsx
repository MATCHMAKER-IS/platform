"use client";
/** この基盤についてのよくある質問（FAQ）。カテゴリ別アコーディオン＋キーワード絞り込み。 */
import * as React from "react";
import { Button, Input } from "@platform/ui";
import Link from "next/link";

type QA = { q: string; a: string };
const FAQ: { cat: string; items: QA[] }[] = [
  { cat: "全体像", items: [
    { q: "この基盤（プラットフォーム）とは何ですか？", a: "再利用できる部品（packages/ の @platform/… パッケージ群）と、業務アプリ（apps/）を1つにまとめたモノレポです。部品を組み合わせて、速く・同じ作法でアプリを作ります。このデモサイトはその部品の“動く実例集”です。" },
    { q: "なぜ共通基盤を作るのですか？", a: "属人化とブラックボックス化を防ぎ、生産性・品質を上げ、コストを抑えるためです。同じ処理を各アプリで再発明せず、作法（失敗の扱い・ログ・設定・認可）を1か所に集約します。" },
    { q: "基盤（packages）とアプリ（apps）の役割の違いは？", a: "packages/ は再利用できる部品と作法（ロジックの土台）、apps/ は業務ロジックと画面です。業務固有の判断は apps 側に置き、基盤には汎用的な部品だけを置きます。" },
    { q: "どこから始めればいいですか？", a: "pnpm install → pnpm doctor で環境確認 → pnpm dev で起動、が基本です。まずトップページの『開発の流れ』と、/core（作法）・/ui（部品）・/master（CRUDの実例）を見るのがおすすめです。" },
  ] },
  { cat: "作法・ルール", items: [
    { q: "なぜ生の HTML タグを使わず @platform/ui を使うのですか？", a: "サイズ・色がテーマ（スキン）に追従し、フォーカスリングやアクセシビリティの修正が全アプリに一括で反映されるためです。生タグ＋直書きだと、各アプリで少しずつズレて属人化します。" },
    { q: "なぜ例外を投げず Result を返すのですか？", a: "外部連携など『失敗が想定内』の処理では、例外だと握りつぶされがちです。ok() / err(AppError) で戻すと、呼ぶ側が if (!res.ok) で必ず分岐でき、抜け漏れが減ります。詳細は /core を参照。" },
    { q: "console.log は使ってはいけませんか？", a: "はい。@platform/logger で構造化ログを出します。password や token などは自動でマスクされ、requestId で1リクエストを追えます。" },
    { q: "process.env を直接読んではいけないのはなぜ？", a: "設定ミス（必須値の欠落）を実行時の謎バグにしないためです。@platform/env が起動時に一度だけ検証し、欠けていれば即座に起動失敗（fail-fast）します。/env を参照。" },
    { q: "業務ロジックはどこに書きますか？", a: "apps/ 側です。packages/ には特定業務に依存しない再利用部品だけを置きます。" },
  ] },
  { cat: "開発の進め方", items: [
    { q: "新しい画面を作るには？", a: "apps/ に Next.js の画面を追加し、@platform/ui で組み立てます。データは memory＋prisma の両実装ストア、API は『認可＋観測＋監査』でラップ、確認を tools/smoke.mjs に1本足す、が定石です。" },
    { q: "基盤（packages）に機能を足したいときは？", a: "既存を壊さないよう『追加のみ（additive）』で実装し、api-surface チェックで破壊的変更がないことを確認します。破壊的変更が必要なら影響範囲を明示して合意を取ります。" },
    { q: "変更の確認はどうやりますか？", a: "pnpm check（型＋lint＋smoke）でローカルの最終確認。pnpm test でユニット、pnpm gen:all で生成物の drift ゼロを確認します。迷ったら pnpm doctor。" },
    { q: "勤怠や有給の計算は基盤にありますか？", a: "あります。@platform/attendance が打刻から実労働・残業・深夜・休日・遅刻・早退を集計し、その結果をそのまま @platform/payroll に渡して金額にできます（時間の区分は勤怠、金額は給与、と役割を分けています）。有給は法定の付与日数・時効2年・古い付与からの消化・年5日の取得義務までを扱います。古い付与から消化するのは、新しい分から使うと古い分が時効で消えて実質的に日数を捨てることになるためです。動作は /attendance で確認できます。" },
    { q: "本番稼働したらDBのスキーマ変更はどうしますか？", a: "開発中は db push（履歴なし）ですが、本番にデータが入ったら『baseline』方式でマイグレーションへ切り替えます。migrate dev は既存DBのリセットを促すため本番では使わず、migrate diff で初期SQLを作り migrate resolve --applied で適用済みとして登録します。手順は docs/adr/0014-migration-baseline-on-production.md。" },
    { q: "バックアップは取れていますか？", a: "取得手順に加えて『戻せること』を重視しています。RPO 24時間・RTO 4時間を目標に、半年に1回の復元訓練を行い ops/drills/restore-drill.json に記録します。node tools/check-drill.mjs が間隔を見張り、未実施や期限切れを警告します。詳細は docs/ops/BACKUP_RESTORE.md。" },
    { q: "DB はどう扱いますか？", a: "多くのストアは memory 実装と prisma 実装の両方を持ちます。開発・テストは memory、本番は prisma に差し替えます。このデモサイトは DB を持たず、メモリ・モックで動きます。" },
    { q: "新しく入った人はどう学べばいいですか？", a: "トップページの『開発の流れ』を読み、docs/ops/ONBOARDING_TASK.md の実地課題（備品貸出の画面を1つ作る）に取り組みます。詰まった箇所は本人の理解不足ではなく基盤側の欠陥として扱い、手順書やエラーメッセージを直します。" },
    { q: "AI に開発を手伝ってもらえますか？", a: "はい。CLAUDE.md と docs/ai/patterns.md に作法・実装パターンがあり、基盤の検索用に MCP カタログも用意されています。" },
  ] },
  { cat: "認証・セキュリティ・運用", items: [
    { q: "退職者の権限はどう管理しますか？", a: "ADR 0017 で方針を定めています。退職・異動は最終出社日のうちに停止し、順序はセッション無効化→ログイン停止→権限削除です（権限だけ消してもセッションが生きていれば操作できるため）。半年に1回の棚卸しでは、業務を知る人が要否を判定し、判定者と日付を記録します。@platform/access-review の reviewAccess() が退職者に残った権限・期限切れ・期限の無い強い権限を一覧にします。「*」や pii:unmask のような強い権限は恒久的に付けず、必ず期限を決めます。" },
    { q: "認証・権限はどうしますか？", a: "@platform/auth が RBAC（ロールベースの権限）を提供し、API ルートは『認可（currentUser）＋観測（withApiObservability）＋監査（audit）』でラップします。実例は /login・/security・/audit。" },
    { q: "Slack で承認できるようにしたいのですが", a: "/approval の「Slackで承認」タブが実例です。buildApprovalBlocks で承認/却下ボタン付きの通知を作り、parseInteraction で押下を受け取ります。要点は「押した人が承認してよいか」を必ず確かめることです（Slackの利用者IDを社内利用者に突き合わせ、@platform/auth の can で権限を判定）。これを省くとチャンネルにいる人なら誰でも承認できてしまいます。受信口では署名検証も必須で、Slackは3秒で切断するため重い処理はジョブキューへ回します。" },
    { q: "Slack や Notion とも連携できますか？", a: "できます。Slack は用途で使い分けます——通知を送るだけなら @platform/notify の createSlackChannel（Incoming Webhook）、スレッド返信やメッセージ更新、Slack からの受信が必要なら @platform/slack（Web API）です。受信は署名検証が必須で、生ボディのまま検証します（パースして戻すと一致しません）。Notion は @platform/notion がデータベース照会・ページ作成・本文取得に対応し、入れ子の深いプロパティを平たい値にして返します。連携したいページを Notion 側でインテグレーションに共有し忘れると 404 になるので、その旨をエラーメッセージで示唆します。" },
    { q: "Microsoft 365 と連携できますか？", a: "できます。@platform/microsoft が Entra ID(旧 Azure AD)の OAuth と Microsoft Graph を扱います。Outlook のメール送信、予定の作成・参照、Teams 会議リンク、社員情報の取得に対応しています。テナントは必ず自社の ID を指定してください（common にすると他社のアカウントでもログインできてしまいます）。リフレッシュトークンは更新のたびに回転するため、onRefresh で保存し直す必要があります。疎通は /connect で確認できます。" },
    { q: "外部サービスの連携に何が必要か分かりません", a: "/connect（接続チェック）を開いてください。freee・Google・Stripe・PayPal・LINE・Slack・Zoho・Resend・Meilisearch など11サービスについて、必要な値・入手先・必要な権限を示し、その場で疎通テストができます。セッション鍵など自分で用意する秘密の生成もここで行えます。" },
    { q: "SSO（シングルサインオン）で気をつけることは？", a: "署名が正しいトークンでも、中身を見ないと通ってしまう攻撃があります。@platform/auth の verifyIdTokenClaims() が、宛先(aud・別アプリ向けの流用を防ぐ)・発行者(iss)・期限(exp)・テナント(tid・他社アカウントを防ぐ)・nonce・メール確認済みを検証します。署名の検証は別途必要です。利用者の識別にはメールではなく iss+sub を使ってください（メールは結婚や異動で変わり、退職者のメールが再利用されると別人に繋がります）。SAML は現時点で未対応です（OIDCで足りているため）。" },
    { q: "2要素認証やパスワード再設定はありますか？", a: "あります。/login のタブで試せます。2要素認証は TOTP（認証アプリの6桁コード）と予備コード（1回ずつ使える逃げ道）に対応し、端末の時計ずれは±30秒まで許容します。パスワード再設定は使い捨てリンク方式で、保存するのはハッシュだけ・30分で失効・1回だけ有効・未登録アドレスでも同じ応答（登録の有無を漏らさない）にしています。再設定後は既存セッションを無効化します。" },
    { q: "個人情報の削除を求められたら、帳簿はどうしますか？", a: "ADR 0018 で方針を定めています。法令の保存義務（会計帳簿は電子帳簿保存法で7年、賃金台帳は労基法で5年）が削除要求に優先しますが、黙って残さず本人に説明します。@platform/pii の decideErasure() が「法令の義務 → 自社の保持期間 → 削除可」の順で判断し、explainErasure() が説明文を作ります。説明には何件消して何件残したか、残した根拠、いつ消せるかを必ず含めます（「消せません」だけでは納得が得られないため）。全部消すのも全部残すのも、どちらかの違反になります。" },
    { q: "秘密情報（マイナンバー・鍵）の扱いは？", a: "@platform/crypto で AES-256-GCM 暗号化、パスワードは scrypt でハッシュ化します。鍵やソルトは @platform/env 経由で環境変数から読み、コードに直書きしません。" },
    { q: "障害調査・デバッグは？", a: "サーバ側は @platform/debug（CakePHP DebugKit 相当）で、1リクエストの SQL/API/AI の本数・所要時間や N+1 を可視化します（本番は enabled:false で無効）。このサイトでは左下の🐞パネルからクライアント側の情報を確認できます。" },
    { q: "生タグを使わないルールは、どう守らせていますか？", a: "node tools/check-app-rules.mjs が検出します。ただし既存コードには多数残っているため、現在の箇所数を上限として記録し（tools/ui-raw-tag-limit.json）、増えたら失敗する『ラチェット』方式にしています。減らしたら --set-limit で上限を下げます。こうすると数は一方向にしか動きません。実際にこの仕組みで 715 箇所から 44 箇所まで減らしました（button・textarea・checkbox はほぼ全廃）。残りは file 入力・radio・数値 value や filter を含む select で、機械的な置換だと壊れるため、画面を動かしながら1つずつ対応します。" },
    { q: "アクセシビリティはどう担保していますか？", a: "@platform/ui の部品側でフォーカスやラベルを面倒みるほか、node tools/check-a11y.mjs が preflight で走ります。alt 無しの画像・クリックできる div・正の tabIndex・名前の無いアイコンボタンなどを、ブラウザを起動せず検出します。" },
    { q: "社内向けのチャットボットは作れますか？", a: "/chatbot がその実例です。@platform/ui の ChatWindow で会話し、発言のたびに社内資料を検索して回答します。毎回引き直すので会話が長くなっても入力トークンが膨らまず、履歴も直近だけを送るため費用が際限なく伸びません。回答には根拠の資料パスを添えます（裏取りできない回答は業務では使えないため）。AIの鍵が無い環境では資料の抜粋を返します。" },
    { q: "社内のやり方を調べたいときは？", a: "/assistant（社内資料アシスタント）で質問すると、手順書・規約・設計判断(ADR)から該当箇所を探して文脈を組み立てます。検索はブラウザ内で完結するため鍵は不要です。AIの鍵を設定していれば、その文脈をもとに回答まで生成します（@platform/ai のゲートウェイ経由なので費用も記録されます）。AIアシスタントからは MCP の search_docs で同じ資料を引けます。" },
    { q: "外部SaaSのAPIが変わったら気づけますか？", a: "tests/contracts/ に『こちらが依存しているフィールド』を契約として書き、node tools/check-contract.mjs で実装とのズレを検査します。週次CI(contract.yml)が本物のAPIに問い合わせて記録を更新するため、相手の変更を利用者より先に検知できます。手順は docs/ops/CONTRACT_TESTING.md。" },
    { q: "エラー画面は用意されていますか？", a: "@platform/status-page が 401/403/404/429/500/503・メンテナンス等の画面を提供します。プレビューは /error-pages。" },
  ] },
  { cat: "このデモサイトについて", items: [
    { q: "このサイトは本番アプリですか？", a: "いいえ。基盤の使い方と業務アプリの画面を『動く実例』として見せるショーケースです。DB を持たず、メモリ・モックデータで動くため単体でデプロイできます。" },
    { q: "パッケージが多すぎませんか？", a: "関心ごとに小さく分けているためです。発見性のために、横断検索（⌘K）や MCP カタログで目的の部品を探せます。粒度が細かすぎる箇所は統廃合の対象として随時見直します。" },
    { q: "Android や iOS のアプリは作れますか？", a: "PWA として、ホーム画面のアイコンから起動できるようにできます（@platform/mobile）。manifest とサービスワーカーを生成し、オフラインでも画面が出るようにします。カメラ・バーコード読取・Bluetooth・位置情報は Web の API で扱えます。ただし iOS は自動でインストールを促せないため「共有→ホーム画面に追加」の手順案内が要り、通知もホーム画面に追加してからでないと使えません（installGuidance と pushAvailability が端末別に判定します）。バックグラウンドでの常時位置取得など Web でできないことが必要になったときに、初めてネイティブを検討してください。" },
    { q: "デモの一部が『シミュレーション』なのはなぜ？", a: "Redis や外部SaaSなど、ブラウザ単体では動かせない依存を、意図が伝わるようローカルで模擬しているためです。実アプリでは本物の実装に差し替えます。" },
  ] },
];

const SHORTCUTS: [string, string][] = [["/core", "作法(Result/AppError)"], ["/ui", "UI 部品"], ["/master", "CRUD の実例"], ["/error-pages", "エラー画面"]];

export default function Page() {
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState<Set<string>>(new Set());
  const t = q.trim().toLowerCase();
  const groups = React.useMemo(() => FAQ.map((g) => ({ ...g, items: t ? g.items.filter((it) => (it.q + it.a).toLowerCase().includes(t)) : g.items })).filter((g) => g.items.length > 0), [t]);
  const toggle = (k: string) => setOpen((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const total = FAQ.reduce((s, g) => s + g.items.length, 0);

  return (
    <main style={{ maxWidth: 820, margin: "2rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.6rem", fontWeight: 700, marginBottom: 6 }}>よくある質問（FAQ）</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 16 }}>この基盤（@platform/… とアプリ）についての Q&amp;A です。全 {total} 問。キーワードで絞り込めます。</p>

      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="キーワードで検索（例: Result, ログ, 権限, DB）"
        style={{ width: "100%", padding: "10px 14px", fontSize: 14, borderRadius: 10, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-fg)", marginBottom: 20, boxSizing: "border-box" }} />

      {groups.length === 0 && <div style={{ fontSize: 13, color: "var(--color-muted)", padding: "16px 0" }}>該当する質問が見つかりませんでした。</div>}

      {groups.map((g) => (
        <section key={g.cat} style={{ marginBottom: 22 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--color-muted)", margin: "0 0 8px", paddingBottom: 6, borderBottom: "1px solid var(--color-border)" }}>{g.cat}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {g.items.map((it) => {
              const k = g.cat + it.q;
              const isOpen = open.has(k) || t !== "";
              return (
                <div key={k} style={{ border: "1px solid var(--color-border)", borderRadius: 10, background: "var(--color-surface)", overflow: "hidden" }}>
                  <Button type="button" onClick={() => toggle(k)}
                    style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "12px 14px", border: "none", background: "transparent", color: "var(--color-fg)", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
                    <span style={{ flexShrink: 0, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s", color: "var(--color-muted)" }}>▶</span>
                    {it.q}
                  </Button>
                  {isOpen && <div style={{ padding: "0 14px 14px 36px", fontSize: 13, lineHeight: 1.9, color: "var(--color-muted)" }}>{it.a}</div>}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <div style={{ marginTop: 12, paddingTop: 16, borderTop: "1px solid var(--color-border)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>関連リンク</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Link href="/" style={{ fontSize: 12.5, padding: "6px 12px", borderRadius: 999, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-fg)", textDecoration: "none" }}>← トップ（開発の流れ）</Link>
          {SHORTCUTS.map(([href, label]) => (
            <Link key={href} href={href} style={{ display: "inline-flex", gap: 6, fontSize: 12.5, padding: "6px 12px", borderRadius: 999, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-fg)", textDecoration: "none" }}>
              <code style={{ color: "var(--color-primary)" }}>{href}</code><span style={{ color: "var(--color-muted)" }}>{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
