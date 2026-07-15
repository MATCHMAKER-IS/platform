#!/usr/bin/env bash
# ============================================================================
# 開発環境セットアップ(clone 直後 → apps 開発可能な状態まで)。冪等・再実行安全。
#
#   bash scripts/setup.sh              # フルセットアップ
#   bash scripts/setup.sh --check      # 前提条件の確認のみ(何も変更しない)
#   bash scripts/setup.sh --skip-docker  # Docker 起動を省略(DB を自前用意した場合)
#   bash scripts/setup.sh --skip-db      # スキーマ適用(prisma db push)を省略
#
# やること: 前提確認 → .env 準備 → Docker(PostgreSQL+Mailpit)起動 → アプリ別DB作成
#           → pnpm install → prisma generate ×3 → prisma db push ×3 → スモーク検証
# 詳細: docs/ops/SETUP.md
# ============================================================================
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

CHECK_ONLY=0; SKIP_DOCKER=0; SKIP_DB=0
for arg in "$@"; do
  case "$arg" in
    --check) CHECK_ONLY=1 ;;
    --skip-docker) SKIP_DOCKER=1 ;;
    --skip-db) SKIP_DB=1 ;;
    --help|-h) sed -n '2,14p' "$0"; exit 0 ;;
    *) echo "未知のオプション: $arg(--help を参照)"; exit 1 ;;
  esac
done

step() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$1"; }

# アプリ別 DB(名前は docker-compose.yml の資格情報 app/app に合わせる)
APPS=(internal-app crud-template equipment-app)
db_name() { case "$1" in internal-app) echo app ;; crud-template) echo app_crud ;; equipment-app) echo app_equipment ;; esac; }

# ─────────────────────────────── 1. 前提確認 ───────────────────────────────
step "前提条件の確認"
PREREQ_NG=0

if command -v node >/dev/null 2>&1; then
  NODE_MAJOR=$(node -v | sed 's/^v//' | cut -d. -f1)
  if [ "$NODE_MAJOR" -ge 22 ]; then ok "Node.js $(node -v)(22 以上)"; else fail "Node.js $(node -v) — 22 以上が必要(https://nodejs.org)"; PREREQ_NG=1; fi
else
  fail "Node.js が見つかりません(22 以上を導入)"; PREREQ_NG=1
fi

if command -v corepack >/dev/null 2>&1; then
  ok "corepack あり(pnpm は package.json の packageManager 指定版を自動使用)"
else
  warn "corepack なし — 手動で pnpm@9 を導入してください(npm i -g pnpm@9)"
fi

if command -v pnpm >/dev/null 2>&1; then
  ok "pnpm $(pnpm -v)"
else
  warn "pnpm 未有効 — 後段で corepack enable を試みます"
fi

if [ "$SKIP_DOCKER" -eq 0 ]; then
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    if docker info >/dev/null 2>&1; then ok "Docker + compose(デーモン稼働中)"; else fail "Docker はあるがデーモン未起動(Docker Desktop を起動)"; PREREQ_NG=1; fi
  else
    fail "Docker / docker compose が見つかりません(--skip-docker で省略可)"; PREREQ_NG=1
  fi
fi

for port in 5432 1025 8025; do
  if command -v lsof >/dev/null 2>&1 && lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    warn "ポート $port が使用中 — 既存の compose なら問題なし。別プロセスなら停止してください"
  fi
done

if [ "$CHECK_ONLY" -eq 1 ]; then
  echo ""
  [ "$PREREQ_NG" -eq 0 ] && echo "前提 OK。bash scripts/setup.sh でセットアップできます。" || echo "上記 ✗ を解消してから再実行してください。"
  exit 0
fi
[ "$PREREQ_NG" -eq 1 ] && { echo ""; echo "前提条件を満たしていません(--check で確認)。中断します。"; exit 1; }

# ─────────────────────────────── 2. .env 準備 ───────────────────────────────
step ".env の準備(.env.example → .env。既存は上書きしない)"
for app in "${APPS[@]}" public-site; do
  src="apps/$app/.env.example"; dst="apps/$app/.env"
  if [ -f "$src" ]; then
    if [ -f "$dst" ]; then ok "$dst(既存を維持)"; else cp "$src" "$dst"; ok "$dst を作成"; fi
  fi
done

# ─────────────────────────── 3. Docker インフラ起動 ───────────────────────────
if [ "$SKIP_DOCKER" -eq 0 ]; then
  step "PostgreSQL + Mailpit を起動(docker-compose.yml の db / mailhog)"
  docker compose up -d db mailhog
  printf '  DB の起動待ち'
  for i in $(seq 1 30); do
    if docker compose exec -T db pg_isready -U app >/dev/null 2>&1; then echo ""; ok "PostgreSQL 準備完了"; break; fi
    printf '.'; sleep 2
    [ "$i" -eq 30 ] && { echo ""; fail "DB が起動しません(docker compose logs db を確認)"; exit 1; }
  done

  step "アプリ別データベースの作成(冪等)"
  for app in "${APPS[@]}"; do
    db="$(db_name "$app")"
    if docker compose exec -T db psql -U app -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$db'" | grep -q 1; then
      ok "$db(既存)"
    else
      docker compose exec -T db psql -U app -d postgres -c "CREATE DATABASE $db" >/dev/null
      ok "$db を作成"
    fi
  done
else
  warn "Docker 起動を省略(--skip-docker)。DATABASE_URL の DB が疎通することを確認してください"
fi

# ─────────────────────────────── 4. 依存の導入 ───────────────────────────────
step "pnpm install(初回は数分)"
command -v pnpm >/dev/null 2>&1 || corepack enable
pnpm install

# ─────────────────────────── 5. Prisma generate ───────────────────────────
step "Prisma クライアント生成(3 アプリ分。初回はエンジンを DL)"
for app in "${APPS[@]}"; do
  pnpm --filter @platform/db exec prisma generate --schema="../../apps/$app/prisma/schema.prisma" >/dev/null
  ok "$app"
done

# ─────────────────────────── 6. スキーマ適用(db push) ───────────────────────────
if [ "$SKIP_DB" -eq 0 ]; then
  step "スキーマ適用(prisma db push。履歴管理する場合は migrate を使用 → SETUP.md)"
  for app in "${APPS[@]}"; do
    url=$(grep -E '^DATABASE_URL=' "apps/$app/.env" 2>/dev/null | tail -1 | cut -d= -f2- || true)
    [ -z "$url" ] && url="postgresql://app:app@localhost:5432/$(db_name "$app")"
    DATABASE_URL="$url" pnpm --filter @platform/db exec prisma db push --schema="../../apps/$app/prisma/schema.prisma" --skip-generate >/dev/null
    ok "$app → $(db_name "$app")"
  done
else
  warn "スキーマ適用を省略(--skip-db)"
fi

# ─────────────────────────────── 7. 検証 ───────────────────────────────
step "検証(依存不要スモーク + 依存境界)"
pnpm smoke >/dev/null && ok "スモーク all pass" || { fail "スモーク失敗(pnpm smoke で詳細)"; exit 1; }
node tools/check-deps.mjs >/dev/null && ok "循環依存・層破りなし"

# ─────────────────────────────── 完了 ───────────────────────────────
cat <<'DONE'

============================================================
 セットアップ完了。次のコマンドで開発を始められます:
------------------------------------------------------------
  pnpm --filter crud-template dev    # テンプレ     http://localhost:3002
  pnpm --filter equipment-app dev    # 備品管理     http://localhost:3003
                                     #   ログイン: admin@example.com / admin1234
  pnpm --filter platform-portal dev  # 基盤ポータル http://localhost:3005
  pnpm --filter internal-app dev     # 社内アプリ   http://localhost:3000
  pnpm --filter public-site dev -- -p 3004   # 公開サイト http://localhost:3004

  メール確認(Mailpit UI):           http://localhost:8025
  検証:  pnpm smoke / node tools/check-deps.mjs
  新アプリの作り方: apps/crud-template/README.md(コピーして開始)
  詳細:  docs/ops/SETUP.md
============================================================
DONE
