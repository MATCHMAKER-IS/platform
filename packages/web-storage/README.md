# @platform/web-storage

ブラウザの保存領域（localStorage の安全な包み）。

## これは何のためか

**`localStorage` は例外を投げます。**

プライベートモード、容量オーバー、設定で無効——
**書けない環境が普通にあります**。

## 使う前に知っておくこと

| | |
|---|---|
| **書けなくても落ちません** | 静かに失敗します——**保存できたか確かめたいなら戻り値を見て**ください |
| **壊れた JSON でも落ちません** | 既定値を返します——**手で書き換えられる**ためです |
| **秘密を入れない** | **JavaScript から読めます**——トークンやパスワードは置かないでください |
| **消えることがあります** | ブラウザの掃除、容量不足——**消えて困るものは置かないで**ください |
| **artifacts では使えません** | Claude の成果物では**動きません**——メモリ実装を使ってください |

## よく使うもの

```ts
import { createWebStorage, createMemoryWebStorage } from "@platform/web-storage";
import { createWebStorage } from "@platform/web-storage";

type Theme = "light" | "dark" | "system";
const themeStore = createWebStorage<Theme>({
  key: "theme",
  fallback: "system",
  validate: (v): v is Theme => v === "light" || v === "dark" || v === "system",
  namespace: "internal-app",
});

const theme = themeStore.get();          // サーバ側でも安全("system" が返る)
const saved = themeStore.set("dark");
if (!saved.ok) toast.error("設定を保存できませんでした(空き容量を確認してください)");
```

## なぜ基盤に置くか

`localStorage.getItem()` は 1 行で書けますが、**素で書くと必ず同じ 4 つを踏みます**。
実際この基盤でも 28 ファイルが個別に書いており、対処の抜けが場所ごとに違っていました。

| 踏むもの | 何が起きるか |
|---|---|
| **サーバ側には存在しない** | Next.js はコンポーネントをサーバでも実行する。素で書くと `ReferenceError` で画面が落ちる |
| **書き込みは失敗しうる** | Safari のプライベートモードは `setItem` で例外。容量(概ね 5MB)超過も例外。**設定を保存しようとしただけでアプリが止まる** |
| **入っている JSON が古い形** | 型を変えて再デプロイしても、利用者の端末には前の形が残る。`as T` で信じると「昨日まで動いていた人だけが落ちる」 |
| **同じオリジンで鍵がぶつかる** | 複数アプリを同じドメインに載せると `"theme"` のような鍵は取り合いになる |

## 設計の立場

**読み取りは例外を投げません**(取れなければ `fallback`)。描画中に読むものなので、
失敗で描画を止める価値がありません。取れない理由(サーバ側 / 未保存 / JSON が壊れている /
形が違う / TTL 切れ)は呼び出し側が区別する必要がまず無いので分けていません。

**書き込みは `Result` を返します。** 容量超過は利用者に伝えるべき失敗で、
黙って捨てると「保存したのに消えている」になります。

## できること

| API | 用途 |
|---|---|
| `createWebStorage(options)` | 鍵ひとつ分のストア。`get` / `set` / `remove` / `subscribe` |
| `clearNamespace(ns)` | 接頭辞が合う鍵をまとめて消す(**ログアウト時**)。`clear()` は他アプリの分まで消すので使わない |
| `createMemoryWebStorage()` | テスト・SSR 用のメモリ実装。`storage` に注入する |

- **鍵には接頭辞と版が付きます**(`key: "theme"` → `"internal-app:v1:theme"`)。
  `version` を上げると古い鍵は読まれなくなるので、`validate` を書きにくい複雑な形の逃げ道になります。
- `ttlMs` を渡すと、保存から一定時間で無効になります(下書きの保持)。
- `kind: "session"` でタブを閉じると消える保存先に切り替わります。
- `subscribe` は **他のタブでの変更**を受け取ります。テーマを 1 つのタブで変えたとき、
  他のタブが古い表示のまま残るのを防げます。イベントの無い環境でも
  「何もしない解除関数」を返すので、呼ぶ側に分岐が要りません。

```ts
// React から使う(他タブと同期する)
React.useEffect(() => themeStore.subscribe(setTheme), []);

// ログアウト時に下書きごと消す
clearNamespace("internal-app");
```

## 保存してよいもの / いけないもの

| ✅ 置いてよい | ❌ 置いてはいけない |
|---|---|
| 表示の設定(テーマ・言語・列の並び) | **トークン・セッション ID**(XSS で読める。Cookie の `HttpOnly` を使う) |
| 入力の下書き(`ttlMs` 付き) | 個人情報・機微情報 |
| 直前に開いていたタブ・折りたたみ状態 | **サーバと同期すべき設定**(別の PC では引き継がれない) |

端末ごとの値なので、**別の PC では引き継がれません**。ユーザーに紐づけたい設定は
サーバへ保存してください(`@platform/ui` の `createFetchLayoutStore` が例)。
