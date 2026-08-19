# @platform/attendance

勤怠の記録・集計と年次有給休暇。**深夜と日跨ぎの夜勤**に対応しています。

## これは何のためか

**打刻の集計は「1 日」の切り方で結果が変わります。**

UTC で切ると、**JST の 0 時〜9 時の打刻が前日**になります——
**深夜勤務の人だけ、毎回ずれる**という形で表に出ます。

## 使う前に知っておくこと

| | |
|---|---|
| **日付は JST で切ります** | `formatDateJst` を使ってください——**UTC で切ると深夜の打刻が前日**になります |
| **退勤が出勤より前なら翌日** | 夜勤の扱いです。**24 時間を超える勤務は表現できません**（労基法上あり得ないため） |
| **休日勤務では遅刻・早退を判定しません** | **所定の始業が無い**ためです |
| **保存は 5 年** | 労働者名簿・賃金台帳は労働基準法で**5 年**です |
| **本番では DB 実装を** | メモリ実装は**再起動で消えます** |

## よく使うもの

```ts
import { toDay, summarize, createMemoryAttendanceStore } from "@platform/attendance";
import { createMemoryAttendanceStore, summarize } from "@platform/attendance";

const store = createMemoryAttendanceStore({ start: "09:00", end: "18:00", graceMinutes: 5 });
await store.record("u1", { date: "2026-07-22", clockIn: "09:15", clockOut: "20:00", breakMinutes: 60 });
const month = await store.monthly("u1", "2026-07");   // → payroll へ渡せる形
```

## 有給休暇

法律で付与日数と時効が決まっているため、ここに持っています（会社ごとに作り直すものではないため）。

```ts
import { grantsSinceHire, leaveBalance, mandatoryLeaveStatus } from "@platform/attendance";

const grants = grantsSinceHire("2024-04-01", today);           // 6か月後→10日、以降1年ごと
const balance = leaveBalance(grants, taken, today);            // 古い付与から消化・時効2年
const duty = mandatoryLeaveStatus(grants.at(-1), taken, today); // 年5日の取得義務の不足
```

| 押さえている点 | 内容 |
|---|---|
| **古い付与から消化** | 新しい分から使うと、古い分が時効で消える＝日数を捨てることになる |
| **時効は 2 年** | 付与から 2 年で失効。`nextExpiry` で次に消える分が分かる |
| **年 5 日の取得義務** | 10 日以上付与された人は 1 年以内に 5 日。満たせないと**会社側の違反** |
| **休日は遅刻判定しない** | 所定の始業が存在しないため |
| **夜勤に対応** | 退勤が出勤より前なら翌日にまたいだ勤務として扱う |

## 扱わないこと

- **取得の申請と承認** … 業務の流れなので `@platform/workflow` の担当
- **比例付与**（週の所定労働日数が少ない場合）… 会社の制度によるため、必要なら呼び出し側で調整
- **基準日を統一する運用**（全社員 4/1 付与など）… `grantsSinceHire` を使わず付与記録を直接持つ
