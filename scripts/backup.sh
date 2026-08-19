#!/usr/bin/env bash
# 日次バックアップ。**cron から呼ぶ**ことを想定している。
#
#   bash scripts/backup.sh            # 取得して古い世代を消す
#   bash scripts/backup.sh --dry-run  # 何をするか出すだけ
#
# 【なぜスクリプトにするか】
# `docs/ops/BACKUP_RESTORE.md` に手順は書いてあったが、
# **実際に毎日回す仕組みが無かった**(2026-08)。
# 手順書だけがある状態は、**取れているつもりで取れていない**のと同じ。
#
# 【この形にした理由】
#
# - **世代を持つ**。上書き 1 世代だと、「壊れたデータを含んだバックアップ」で
#   上書きしてしまったときに戻せない
# - **成功も失敗も通知する**。**静かに失敗し続けるのが最悪**——
#   「毎日メールが来る」状態にしておくと、来なくなったことに気づける
# - **別の場所へ写す**。同じディスクに置いたバックアップは、
#   ディスク故障で本体と一緒に消える
#
# 【設定(環境変数)】
#   DATABASE_URL       … 必須
#   BACKUP_DIR         … 保存先(既定 ~/backups)
#   BACKUP_KEEP_DAYS   … 何日分残すか(既定 14)
#   BACKUP_NOTIFY_URL  … 結果を POST する先(Slack の Incoming Webhook など。任意)
#   BACKUP_REMOTE      … 別の場所への写し先(`rsync` の宛先。任意)
#
# 【cron への入れ方】
#   crontab -e
#   # 毎日 3:05(JST)。**業務時間を避ける**
#   5 3 * * * cd ~/app && bash scripts/backup.sh >> ~/backup.log 2>&1
set -euo pipefail

DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M)"
FILE="$BACKUP_DIR/backup-$STAMP.dump"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# **失敗を黙らせない。** 通知先が無ければ標準出力に出す
notify() {
  local status="$1" message="$2"
  log "$status: $message"
  if [ -n "${BACKUP_NOTIFY_URL:-}" ]; then
    curl -fsS -X POST -H 'Content-Type: application/json' \
      -d "{\"text\":\"[バックアップ $status] $message\"}" \
      "$BACKUP_NOTIFY_URL" >/dev/null || log "通知の送信に失敗しました"
  fi
}

# **エラーで終わったら必ず知らせる。** cron は黙って失敗する
trap 'notify "失敗" "backup.sh が異常終了しました(直前のログを確認してください)"' ERR

if [ -z "${DATABASE_URL:-}" ]; then
  # `.env` から読む(compose と同じ場所を想定)
  if [ -f .env ]; then
    DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | tail -1 | cut -d= -f2-)"
  fi
fi
if [ -z "${DATABASE_URL:-}" ]; then
  notify "失敗" "DATABASE_URL が設定されていません"
  exit 1
fi

log "保存先: $BACKUP_DIR / 保持 $KEEP_DAYS 日"

if [ "$DRY_RUN" -eq 1 ]; then
  log "(--dry-run) 取得する: $FILE"
  log "(--dry-run) $KEEP_DAYS 日より古い backup-*.dump を削除する"
  [ -n "${BACKUP_REMOTE:-}" ] && log "(--dry-run) $BACKUP_REMOTE へ写す"
  exit 0
fi

mkdir -p "$BACKUP_DIR"

# **ホストに pg_dump が無くてもよい。** DB を Docker で動かしているので、
# 無ければコンテナ側の pg_dump を使う(BACKUP_RESTORE.md と同じ考え方)
if command -v pg_dump >/dev/null 2>&1; then
  pg_dump "$DATABASE_URL" -Fc -f "$FILE"
else
  log "ホストに pg_dump が無いため、コンテナ経由で取得します"
  docker compose -f docker-compose.prod.yml exec -T db \
    pg_dump "$DATABASE_URL" -Fc > "$FILE"
fi

SIZE="$(du -h "$FILE" | cut -f1)"

# **中身が空でないことを確かめる。** 0 バイトのファイルが毎日増えるのが
# 「取れているつもり」の典型。**戻せることの確認は `pnpm drill`** で別途行う
BYTES="$(stat -c%s "$FILE" 2>/dev/null || stat -f%z "$FILE")"
if [ "$BYTES" -lt 1024 ]; then
  notify "失敗" "取得したファイルが小さすぎます($BYTES バイト)。中身を確認してください"
  exit 1
fi

# 別の場所へ写す(同じディスクに置いたままでは、ディスク故障で一緒に消える)
if [ -n "${BACKUP_REMOTE:-}" ]; then
  log "写します: $BACKUP_REMOTE"
  rsync -a "$FILE" "$BACKUP_REMOTE/"
fi

# 古い世代を消す
DELETED="$(find "$BACKUP_DIR" -name 'backup-*.dump' -mtime "+$KEEP_DAYS" -print -delete | wc -l | tr -d ' ')"

trap - ERR
notify "成功" "$(basename "$FILE") ($SIZE) を取得しました。古い世代 $DELETED 件を削除"
