# 定期実行(cron)が必要な API

**このアプリは自分でスケジューラを持たない。** 外部の cron(GitHub Actions
の `schedule`、Vercel Cron、社内の cron サーバなど)が、下の一覧を
定期的に `POST` で叩く必要がある。

## なぜこの一覧が要るか

2026-08、`bookings/remind-scan` を実装したときに気づいた——
**「どの scan API を、どのくらいの頻度で叩くべきか」を一覧できる
ドキュメントが存在しなかった。** 認証の仕組み(`CRON_TOKEN` /
`isCronAuthorized`)は各 route のコメントに書かれているが、
**運用者向けの一覧が無いと、新しい scan を追加しても
誰にも気づかれず定期実行されないまま埋もれる**(実装したのに
動いていない、という今回まさに踏みかけた状態)。

**新しい `*/scan` エンドポイントを追加したら、ここに 1 行足すこと。**

## 認証

すべて `X-Cron-Token` ヘッダ(環境変数 `CRON_TOKEN` と一致)、または
管理者セッションで実行できる。`CRON_TOKEN` が未設定だと本番では
起動時に弾かれる(`isCronAuthorized` の実装を参照)。

## 一覧

| エンドポイント | 頻度の目安 | 何をするか |
|---|---|---|
| `POST /api/admin/system-alerts/scan` | **5〜10 分おき** | メトリクスを評価し、状態が変わったときだけ通知する。異常への気づきが遅れると影響が広がる |
| `POST /api/admin/audit-alerts/scan` | **15〜30 分おき** | 監査ログの異常を検出し、重複を抑制して通知する(TTL 6 時間) |
| `POST /api/bookings/remind-scan` | **30〜60 分おき** | 予約の前日・1 時間前に push で知らせる(TTL 90 分。取りこぼしを防ぐには発火間隔よりこまめに) |
| `POST /api/surveys/remind-scan` | **1 日 1 回** | 締切 3 日以内の未回答者へリマインド(TTL 20 時間、同日の再実行で二重送信しない) |
| `POST /api/notifications/digest-scan` | **1 日 1 回**(利用者の頻度設定に応じて内部で間引く) | 未読通知のまとめをメール送信 |
| `POST /api/admin/report-scan` | **1 日 1 回** | 期限が来たレポートを生成し配信 |
| `POST /api/admin/export-scan` | **1 日 1 回** | 期限が来たスケジュールのエクスポートを実行 |
| `POST /api/admin/business-metrics/scan` | **1 日 1 回** | 業務の異常を数えてメトリクスに載せる(分単位で変わるものではない) |

## 頻度を決める考え方

**通知の TTL(重複抑制の時間)より短い間隔で叩くこと。** 間隔が TTL より
長いと、発火のタイミングを取りこぼす(例: TTL 90 分の予約リマインダーを
2 時間おきにしか叩かないと、90 分の猶予をすり抜ける予約が出る)。

**「異常への気づきの速さ」が要る scan ほど頻度を上げる。** システム
アラートは分単位で困るが、日次のレポート配信は数分の遅れで困らない。

## 設定例(GitHub Actions)

```yaml
on:
  schedule:
    - cron: "*/10 * * * *"  # system-alerts/scan 用
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -X POST https://internal-app.example.com/api/admin/system-alerts/scan \
            -H "X-Cron-Token: ${{ secrets.CRON_TOKEN }}"
```

複数の scan を 1 つの workflow にまとめず、**頻度ごとに分ける**こと。
5 分おきの scan と 1 日 1 回の scan を同じ schedule に混ぜると、
どちらかの頻度が実態と合わなくなる。
