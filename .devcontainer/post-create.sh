#!/usr/bin/env bash
# devcontainer 初期化: .env(ホスト名を db/mailhog に置換)→ install → prisma → smoke
set -euo pipefail
echo "▶ devcontainer post-create(ネットワーク内ホスト: db / mailhog)"

corepack enable

for app in internal-app public-site crud-template equipment-app; do
  ex="apps/$app/.env.example"; dst="apps/$app/.env"
  if [ -f "$ex" ] && [ ! -f "$dst" ]; then
    sed -e 's/@localhost:5432/@db:5432/g' -e 's/^SMTP_HOST=localhost/SMTP_HOST=mailhog/' "$ex" > "$dst"
    echo "  ✓ $dst を作成(db/mailhog 向け)"
  fi
done

pnpm install

for app in internal-app crud-template equipment-app; do
  pnpm --filter @platform/db exec prisma generate --schema="../../apps/$app/prisma/schema.prisma" >/dev/null
  echo "  ✓ prisma generate: $app"
done

# DB 到達確認(depends_on healthy が基本。念のため TCP でも待つ)
for i in $(seq 1 30); do (echo > /dev/tcp/db/5432) >/dev/null 2>&1 && break; sleep 2; done

# アプリ別 DB を冪等作成(既存ボリューム対策)→ スキーマ適用
node tools/create-app-dbs.mjs
node tools/db.mjs push all

pnpm smoke >/dev/null && echo "  ✓ スモーク all pass"

cat <<'DONE'
✅ devcontainer 準備完了
   pnpm dev:crud       → 3002 / pnpm dev:equipment → 3003(admin@example.com / admin1234)
   pnpm dev:internal   → 3000 / メール確認 → forwarded 8025(Mailpit)
DONE
