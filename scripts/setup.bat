@echo off
REM ============================================================================
REM  開発環境セットアップ（Windows バッチ・ダブルクリック / cmd 用ラッパー）。
REM  中身は scripts\setup.ps1 を実行ポリシー回避で呼ぶだけ。
REM
REM    scripts\setup.bat              フルセットアップ
REM    scripts\setup.bat --check      前提確認のみ
REM    scripts\setup.bat --skip-docker  Docker 省略
REM    scripts\setup.bat --skip-db    スキーマ適用を省略
REM
REM  PowerShell 7 (pwsh) があればそれを、無ければ Windows PowerShell を使います。
REM ============================================================================
setlocal

REM 引数を PowerShell のスイッチに変換
set "PSARGS="
:parse
if "%~1"=="" goto run
if /I "%~1"=="--check"       set "PSARGS=%PSARGS% -Check"
if /I "%~1"=="--skip-docker" set "PSARGS=%PSARGS% -SkipDocker"
if /I "%~1"=="--skip-db"     set "PSARGS=%PSARGS% -SkipDb"
if /I "%~1"=="-Check"        set "PSARGS=%PSARGS% -Check"
if /I "%~1"=="-SkipDocker"   set "PSARGS=%PSARGS% -SkipDocker"
if /I "%~1"=="-SkipDb"       set "PSARGS=%PSARGS% -SkipDb"
shift
goto parse

:run
set "SCRIPT=%~dp0setup.ps1"

where pwsh >nul 2>nul
if %ERRORLEVEL%==0 (
  pwsh -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%"%PSARGS%
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%"%PSARGS%
)

endlocal
exit /b %ERRORLEVEL%
