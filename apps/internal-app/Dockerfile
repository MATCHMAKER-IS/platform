# syntax=docker/dockerfile:1
# internal-app 本番イメージ(Next.js standalone / pnpm monorepo)。
# ビルド: docker build -f apps/internal-app/Dockerfile .   ← context はリポジトリルート(release.yml と同じ)
# ⚠ 未検証: 作成環境では docker が使えないため、初回は手元 or CI で要ビルド確認(docs/ops/CI_FIRST_RUN.md の Docker 節)。
# 前提: pnpm-lock.yaml がコミット済みであること(CI_FIRST_RUN 手順1)。

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

# 依存の先行取得(lockfile のみでキャッシュが効く)
FROM base AS fetch
COPY pnpm-lock.yaml ./
RUN pnpm fetch

# ビルド(ソース全体 + オフライン install + prisma generate + next build)
FROM base AS build
# pnpm fetch は仮想ストア(/pnpm)を作る。node_modules は作らないので、
# ストアだけ持ち込み、この後の `pnpm install --offline` がストアから node_modules を復元する。
COPY --from=fetch /pnpm /pnpm
COPY . .
RUN pnpm install --frozen-lockfile --offline
# `--schema` は Prisma 7 の設定ファイルと併用できない(拒否される)。環境変数で渡す
RUN PRISMA_SCHEMA=../../apps/internal-app/prisma/schema.prisma pnpm --filter @platform/db exec prisma generate
ENV NEXT_TELEMETRY_DISABLED=1

# **コンテナの時刻を JST にする。** 既定は UTC で、
# `new Date().getHours()` などが **9 時間ずれます**。
#
# 日付の表示は `formatDateJst` を通しているので画面は正しく出ますが、
# **サーバ側でローカル時刻を使う箇所**(`check-server-localtime` が
# 上限 25 件で管理)が UTC で動いてしまいます
# ——「今日の分」を数える処理が、**JST の 09:00 で日付が変わる**ことになる。
#
# `tzdata` を入れないと `TZ` を指定しても効きません。
ENV TZ=Asia/Tokyo
# env.ts の fail-fast(zod 必須値)対策: ビルド時のみのダミー値(実行時は env_file で上書き)
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build \
    MAIL_FROM=build@example.com \
    SESSION_SECRET=build-only-secret \
    pnpm --filter internal-app build

# 実行(standalone 出力のみの薄いイメージ)
FROM node:22-bookworm-slim AS runner

# **日本語フォントを入れる。** slim イメージには 1 つも入っていない。
#
# 無いと PDF・画像出力の日本語がすべて □(豆腐)になる。
# 画面(ブラウザ)は利用者の端末のフォントで描くので**開発中は気づけず**、
# サーバ側で描く帳票・グラフ・OGP 画像だけが壊れる。
# しかも文字化けではなく「□が並ぶ」ので、原因がフォントだと分かりにくい。
#
# `fonts-noto-cjk` は Noto Sans CJK JP を含む(約 100MB)。
# 帳票を出さないアプリでは不要なので、他の Dockerfile には入れていない。
RUN apt-get update \
    && apt-get install -y --no-install-recommends fonts-noto-cjk tzdata \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
# monorepo の standalone はリポジトリ構造を保つ(apps/internal-app/server.js が入口)
COPY --from=build /repo/apps/internal-app/.next/standalone ./
COPY --from=build /repo/apps/internal-app/.next/static ./apps/internal-app/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/internal-app/server.js"]
