# 最初の1時間

**この 1 枚だけで動くところまで行きます。** 規約(`CLAUDE.md`)は今日は読まなくて大丈夫です
——あれは「過去に踏んだ地雷の一覧」なので、**手を動かした後の方が頭に入ります**。

## 1. 用意する(15分)

Node.js 22 以上と Docker Desktop を入れます。手順が要るなら
[GETTING_STARTED.md](GETTING_STARTED.md)(Windows / Mac 別に全部書いてあります)。

```bash
corepack enable
pnpm install
```

## 2. 触る(20分)

**DB もログインも要りません。**

```bash
pnpm dev:demos     # → http://localhost:3001
```

基盤 114 個の使い方が、動く画面で並んでいます。**目次を上から順に見るより、
自分の仕事に近そうなものを 3 つ開く**方が掴めます(帳票・勤怠・CSV 取込 など)。

## 3. 壊れていないことを確かめる(5分)

```bash
pnpm smoke         # 依存もDBも要らない。10秒
```

`1570 passed, 0 failed` のように出れば正常です。**これが緑なら、あなたの環境は正しい。**
以降で何か動かなくなったら、まずこれを流して切り分けます。

## 4. 部品を探せるようにする(20分)

これから何を書くにしても、**まず「基盤に既にあるか」を探します**。探し方は3つ:

| 方法 | いつ使うか |
|---|---|
| `pnpm dev:portal`(:3005) | 画面で探したいとき |
| [docs/ai/module-list.md](../ai/module-list.md) | 一覧をざっと見たいとき |
| MCP の `search_platform("csv 出力")` | Claude / Cursor から。最速 |

試しに「CSV を出したい」「郵便番号から住所を引きたい」を探してみてください。
**両方あります。** この感覚が付けば、この基盤の使い方は 8 割わかったことになります。

## つまずいたら

| 症状 | 対処 |
|---|---|
| 何かがおかしい | `pnpm doctor`(環境診断。Node/pnpm/Docker/.env を見ます) |
| Windows で `pnpm dev:turbo` が無言で落ちた | **既知の未解決問題**です。`pnpm dev` を使ってください |
| `.ps1` が「デジタル署名されていません」 | `powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1` |
| `bash scripts/setup.sh` で WSL のエラーが大量に出た | Windows では `.ps1` を使います(WSL は不要) |
| パスが長すぎるとエラー(Windows) | `LongPathsEnabled=1`(管理者権限・要再起動) |
| 上記で直らない | [GETTING_STARTED_2.md](GETTING_STARTED_2.md#困ったときは) |

## 次に読むもの

明日以降、**アプリを書く段になってから**次を読んでください。

1. [`CLAUDE.md`](../../CLAUDE.md) — 作法と、その理由(**これが本体**)
2. [NEW_APP.md](NEW_APP.md) — 新しいアプリの作り方
3. [ONBOARDING_TASK.md](ONBOARDING_TASK.md) — 半日の実地課題
