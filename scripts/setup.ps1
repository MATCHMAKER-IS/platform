#Requires -Version 5.1
<#
============================================================================
 開発環境セットアップ（Windows / PowerShell 版・setup.sh と同等）。冪等・再実行安全。

   pwsh scripts/setup.ps1              # フルセットアップ
   pwsh scripts/setup.ps1 -Check       # 前提条件の確認のみ（何も変更しない）
   pwsh scripts/setup.ps1 -SkipDocker  # Docker 起動を省略（DB を自前用意した場合）
   pwsh scripts/setup.ps1 -SkipDb      # スキーマ適用（prisma db push）を省略

 やること: 前提確認 → .env 準備 → Docker（PostgreSQL+Mailpit）起動 → アプリ別DB作成
           → pnpm install → prisma generate ×3 → prisma db push ×3 → スモーク検証
 詳細: docs/ops/SETUP.md

 Windows 前提: Node.js 22+（https://nodejs.org）、Docker Desktop、PowerShell 5.1+ か PowerShell 7+。
 Windows PowerShell 5.1 で実行不可の場合は「PowerShell を管理者で起動 →
   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned」を一度実行してください。
============================================================================
#>
[CmdletBinding()]
param(
  [switch]$Check,
  [switch]$SkipDocker,
  [switch]$SkipDb
)

$ErrorActionPreference = "Stop"
# リポジトリルートへ移動（このスクリプトの1つ上）
Set-Location (Join-Path $PSScriptRoot "..")

function Step($m) { Write-Host "`n▶ $m" -ForegroundColor White }
function OK($m)   { Write-Host "  ✓ $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  ! $m" -ForegroundColor Yellow }
function Fail($m) { Write-Host "  ✗ $m" -ForegroundColor Red }

function Test-Command($name) {
  $null = Get-Command $name -ErrorAction SilentlyContinue
  return $?
}

# アプリ別 DB（docker-compose.yml の資格情報 app/app に合わせる）
$Apps = @("internal-app", "crud-template", "equipment-app")
function DbName($app) {
  switch ($app) {
    "internal-app"  { "app" }
    "crud-template" { "app_crud" }
    "equipment-app" { "app_equipment" }
  }
}

# ─────────────────────────────── 1. 前提確認 ───────────────────────────────
Step "前提条件の確認"
$PrereqNg = $false

if (Test-Command node) {
  $nodeVer = (node -v)
  $nodeMajor = [int]($nodeVer -replace '^v','' -split '\.')[0]
  if ($nodeMajor -ge 22) { OK "Node.js $nodeVer（22 以上）" }
  else { Fail "Node.js $nodeVer — 22 以上が必要（https://nodejs.org）"; $PrereqNg = $true }
} else {
  Fail "Node.js が見つかりません（22 以上を導入）"; $PrereqNg = $true
}

if (Test-Command corepack) {
  OK "corepack あり（pnpm は package.json の packageManager 指定版を自動使用）"
} else {
  Warn "corepack なし — 手動で pnpm を導入してください（npm i -g pnpm）"
}

if (Test-Command pnpm) { OK "pnpm $(pnpm -v)" }
else { Warn "pnpm 未有効 — 後段で corepack enable を試みます" }

if (-not $SkipDocker) {
  if ((Test-Command docker) -and ($(docker compose version 2>$null; $?))) {
    if ($(docker info 2>$null; $?)) { OK "Docker + compose（デーモン稼働中）" }
    else { Fail "Docker はあるがデーモン未起動（Docker Desktop を起動）"; $PrereqNg = $true }
  } else {
    Fail "Docker / docker compose が見つかりません（-SkipDocker で省略可）"; $PrereqNg = $true
  }
}

foreach ($port in @(5432, 1025, 8025)) {
  $inUse = $null
  try { $inUse = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue } catch {}
  if ($inUse) { Warn "ポート $port が使用中 — 既存の compose なら問題なし。別プロセスなら停止してください" }
}

if ($Check) {
  Write-Host ""
  if (-not $PrereqNg) { Write-Host "前提 OK。pwsh scripts/setup.ps1 でセットアップできます。" }
  else { Write-Host "上記 ✗ を解消してから再実行してください。" }
  exit 0
}
if ($PrereqNg) { Write-Host ""; Write-Host "前提条件を満たしていません（-Check で確認）。中断します。"; exit 1 }

# ─────────────────────────────── 2. .env 準備 ───────────────────────────────
Step ".env の準備（.env.example → .env。既存は上書きしない）"
foreach ($app in ($Apps + "public-site")) {
  $src = "apps/$app/.env.example"; $dst = "apps/$app/.env"
  if (Test-Path $src) {
    if (Test-Path $dst) { OK "$dst（既存を維持）" }
    else { Copy-Item $src $dst; OK "$dst を作成" }
  }
}

# ─────────────────────────── 3. Docker インフラ起動 ───────────────────────────
if (-not $SkipDocker) {
  Step "PostgreSQL + Mailpit を起動（docker-compose.yml の db / mailhog）"
  docker compose up -d db mailhog
  Write-Host "  DB の起動待ち" -NoNewline
  $ready = $false
  for ($i = 1; $i -le 30; $i++) {
    docker compose exec -T db pg_isready -U app 2>$null | Out-Null
    if ($?) { Write-Host ""; OK "PostgreSQL 準備完了"; $ready = $true; break }
    Write-Host "." -NoNewline; Start-Sleep -Seconds 2
  }
  if (-not $ready) { Write-Host ""; Fail "DB が起動しません（docker compose logs db を確認）"; exit 1 }

  Step "アプリ別データベースの作成（冪等）"
  foreach ($app in $Apps) {
    $db = DbName $app
    $exists = docker compose exec -T db psql -U app -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$db'"
    if ($exists -match "1") { OK "$db（既存）" }
    else {
      docker compose exec -T db psql -U app -d postgres -c "CREATE DATABASE $db" | Out-Null
      OK "$db を作成"
    }
  }
} else {
  Warn "Docker 起動を省略（-SkipDocker）。DATABASE_URL の DB が疎通することを確認してください"
}

# ─────────────────────────────── 4. 依存の導入 ───────────────────────────────
Step "pnpm install（初回は数分）"
if (-not (Test-Command pnpm)) { corepack enable }
pnpm install

# ─────────────────────────── 5. Prisma generate ───────────────────────────
Step "Prisma クライアント生成（3 アプリ分。初回はエンジンを DL）"
foreach ($app in $Apps) {
  pnpm --filter @platform/db exec prisma generate --schema="../../apps/$app/prisma/schema.prisma" | Out-Null
  OK "$app"
}

# ─────────────────────────── 6. スキーマ適用（db push） ───────────────────────────
if (-not $SkipDb) {
  Step "スキーマ適用（prisma db push。履歴管理する場合は migrate を使用 → SETUP.md）"
  foreach ($app in $Apps) {
    $url = $null
    $envFile = "apps/$app/.env"
    if (Test-Path $envFile) {
      $line = Select-String -Path $envFile -Pattern '^DATABASE_URL=' | Select-Object -Last 1
      if ($line) { $url = ($line.Line -replace '^DATABASE_URL=', '') }
    }
    if (-not $url) { $url = "postgresql://app:app@localhost:5432/$(DbName $app)" }
    $env:DATABASE_URL = $url
    pnpm --filter @platform/db exec prisma db push --schema="../../apps/$app/prisma/schema.prisma" --skip-generate | Out-Null
    OK "$app → $(DbName $app)"
  }
  Remove-Item Env:\DATABASE_URL -ErrorAction SilentlyContinue
} else {
  Warn "スキーマ適用を省略（-SkipDb）"
}

# ─────────────────────────────── 7. 検証 ───────────────────────────────
Step "検証（依存不要スモーク + 依存境界）"
pnpm smoke | Out-Null
if ($?) { OK "スモーク all pass" } else { Fail "スモーク失敗（pnpm smoke で詳細）"; exit 1 }
node tools/check-deps.mjs | Out-Null
if ($?) { OK "循環依存・層破りなし" }

# ─────────────────────────────── 完了 ───────────────────────────────
Write-Host @"

============================================================
 セットアップ完了。次のコマンドで開発を始められます:
------------------------------------------------------------
  pnpm --filter crud-template dev    # テンプレ     http://localhost:3002
  pnpm --filter equipment-app dev    # 備品管理     http://localhost:3003
                                     #   ログイン: admin@example.com / admin1234
  pnpm --filter platform-portal dev  # 基盤ポータル http://localhost:3005
  pnpm --filter internal-app dev     # 社内アプリ   http://localhost:3000
  pnpm --filter public-site dev -- -p 3004   # 公開サイト http://localhost:3004

  メール確認（Mailpit UI）:           http://localhost:8025
  検証:  pnpm smoke / node tools/check-deps.mjs
  新アプリの作り方: apps/crud-template/README.md（コピーして開始）
============================================================
"@
