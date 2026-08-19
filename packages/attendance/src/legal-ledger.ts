/**
 * 法定三帳簿（労働者名簿・賃金台帳・出勤簿）。
 *
 * **労働基準法で備え付けが義務**。労働基準監督署の調査では最初に見られる。
 * 無い・不備がある場合は 30 万円以下の罰金（法第120条）。
 *
 * 【3 つの帳簿】
 *   - **労働者名簿**（法第107条）… 誰を雇っているか
 *   - **賃金台帳**（法第108条）… いくら払ったか
 *   - **出勤簿**（法第109条の解釈）… いつ働いたか
 *
 * 【保存期間】
 * **5 年**（当分の間は 3 年でよいとされているが、5 年に統一するのが安全）。
 * 起算日が帳簿ごとに違う:
 *   - 労働者名簿 … **退職・解雇・死亡の日**から
 *   - 賃金台帳 … **最後に記入した日**から
 *   - 出勤簿 … **最後の出勤日**から
 *
 * 「退職から 5 年」ではないものがあるので、一律で消すと違反になる。
 *
 * 【この基盤が扱う範囲】
 * **記載事項が揃っているかの確認**と、**保存期間の管理**。
 * データそのものは既存のパッケージが持つ（給与は `@platform/payroll`、
 * 勤怠は `@platform/attendance` の `core`）。
 *
 * @packageDocumentation
 */

/** 労働者名簿の記載事項（法第107条・施行規則第53条）。 */
/**
 * 「今」を **JST の日付**として UTC 0 時に正規化する。
 *
 * **`new Date()` をそのまま使わない。** UTC で動くサーバ(クラウドの既定)では
 * JST の 00:00〜08:59 が前日として扱われ、**判定が 1 日ずれる**。
 * `@platform/datetime` に依存を増やさないための最小実装
 * (9 時間ずらして UTC として読むだけ。`formatDateJst` と同じ計算)。
 */
function todayUtcFromJst(now: Date = new Date()): Date {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return new Date(`${jst}T00:00:00.000Z`);
}

export interface WorkerRecord {
  /** 氏名。 */
  name: string;
  /** 生年月日（YYYY-MM-DD）。 */
  birthDate: string;
  /** 履歴（職歴・社内での異動）。 */
  history: string;
  /** 性別。 */
  gender: string;
  /** 住所。 */
  address: string;
  /** 従事する業務の種類（**常時 30 人未満の事業場は省略可**）。 */
  jobType?: string;
  /** 雇入れの年月日（YYYY-MM-DD）。 */
  hiredOn: string;
  /** 退職・解雇・死亡の年月日（YYYY-MM-DD。在職中は未指定）。 */
  leftOn?: string;
  /** 退職・解雇の事由（**解雇の場合はその理由も**）。 */
  leftReason?: string;
}

/** 賃金台帳の記載事項（法第108条・施行規則第54条）。 */
export interface WageLedgerEntry {
  /** 氏名。 */
  name: string;
  /** 性別。 */
  gender: string;
  /** 賃金計算期間（YYYY-MM）。 */
  period: string;
  /** 労働日数。 */
  workDays: number;
  /** 労働時間数。 */
  workHours: number;
  /** 時間外労働の時間数。 */
  overtimeHours: number;
  /** 深夜労働の時間数。 */
  nightHours: number;
  /** 休日労働の時間数。 */
  holidayHours: number;
  /** 基本給・手当の内訳（**種類ごとに分けて記載する**）。 */
  payments: { name: string; amount: number }[];
  /** 控除の内訳（**種類ごとに分けて記載する**）。 */
  deductions: { name: string; amount: number }[];
}

/** 出勤簿の 1 日分。 */
export interface AttendanceRecord {
  /** 日付（YYYY-MM-DD）。 */
  date: string;
  /** 始業時刻（HH:MM。休みなら未指定）。 */
  startTime?: string;
  /** 終業時刻（HH:MM）。 */
  endTime?: string;
  /** 休憩時間（分）。 */
  breakMinutes?: number;
  /** 休日・欠勤などの区分。 */
  dayType?: string;
}

/** 不備 1 件。 */
export interface LedgerIssue {
  /** どの帳簿か。 */
  ledger: "worker" | "wage" | "attendance";
  /** 対象（氏名や年月）。 */
  target: string;
  /** 何が足りないか。 */
  message: string;
  /** 根拠となる条文。 */
  law: string;
}

/** 値が入っているか（空文字・空白のみは未記載とみなす）。 */
function filled(v: string | undefined): boolean {
  return v !== undefined && v.trim() !== "";
}

/**
 * 労働者名簿の記載事項が揃っているかを確認する。
 *
 * **「従事する業務の種類」は常時 30 人未満の事業場では省略できる**。
 * それ以外は全員分が必要。
 *
 * @param records 労働者名簿
 * @param employeeCount 常時使用する労働者数（30 人未満なら業務の種類を省略可）
 * @returns 不備の一覧
 *
 * @example
 * ```ts
 * const issues = checkWorkerRecords(records, 45);
 * if (issues.length > 0) console.log("労基署の調査で指摘されます");
 * ```
 */
export function checkWorkerRecords(
  records: readonly WorkerRecord[],
  employeeCount: number,
): LedgerIssue[] {
  const out: LedgerIssue[] = [];
  const law = "労働基準法 第107条・施行規則第53条";

  for (const r of records) {
    const label = filled(r.name) ? r.name : "(氏名なし)";
    const required: [string, string | undefined][] = [
      ["氏名", r.name],
      ["生年月日", r.birthDate],
      ["履歴", r.history],
      ["性別", r.gender],
      ["住所", r.address],
      ["雇入れの年月日", r.hiredOn],
    ];
    // **30 人以上なら業務の種類も必要**
    if (employeeCount >= 30) required.push(["従事する業務の種類", r.jobType]);

    for (const [field, value] of required) {
      if (!filled(value)) {
        out.push({ ledger: "worker", target: label, message: `${field} が記載されていません`, law });
      }
    }

    // **退職したら事由も要る**（解雇なら理由まで）
    if (filled(r.leftOn) && !filled(r.leftReason)) {
      out.push({
        ledger: "worker", target: label,
        message: "退職しているのに事由が記載されていません（解雇の場合はその理由も必要）",
        law,
      });
    }
  }
  return out;
}

/**
 * 賃金台帳の記載事項が揃っているかを確認する。
 *
 * **手当と控除は種類ごとに分けて記載する**（「その他 50,000 円」のようにまとめると不備）。
 * 給与明細をそのまま台帳にできるが、**時間数の記載が抜けやすい**。
 *
 * @param entries 賃金台帳
 * @returns 不備の一覧
 */
export function checkWageLedger(entries: readonly WageLedgerEntry[]): LedgerIssue[] {
  const out: LedgerIssue[] = [];
  const law = "労働基準法 第108条・施行規則第54条";

  for (const e of entries) {
    const label = `${e.name} (${e.period})`;

    if (!filled(e.name)) out.push({ ledger: "wage", target: e.period, message: "氏名が記載されていません", law });
    if (!filled(e.gender)) out.push({ ledger: "wage", target: label, message: "性別が記載されていません", law });

    // **時間数は 4 つとも要る**（0 でも「0」と記載する。未記載とは違う）
    const hours: [string, number][] = [
      ["労働日数", e.workDays],
      ["労働時間数", e.workHours],
      ["時間外労働の時間数", e.overtimeHours],
      ["深夜労働の時間数", e.nightHours],
      ["休日労働の時間数", e.holidayHours],
    ];
    for (const [field, value] of hours) {
      if (!Number.isFinite(value) || value < 0) {
        out.push({ ledger: "wage", target: label, message: `${field} が正しく記載されていません`, law });
      }
    }

    if (e.payments.length === 0) {
      out.push({ ledger: "wage", target: label, message: "賃金の内訳がありません", law });
    }
    // **「その他」でまとめるのは不備**。種類ごとに分ける
    for (const p of e.payments) {
      if (!filled(p.name) || /^その他$|^諸手当$/.test(p.name.trim())) {
        out.push({
          ledger: "wage", target: label,
          message: `賃金の種類が「${p.name}」とまとめられています。**種類ごとに分けて記載**してください`,
          law,
        });
      }
    }
    for (const d of e.deductions) {
      if (!filled(d.name) || /^その他$/.test(d.name.trim())) {
        out.push({
          ledger: "wage", target: label,
          message: `控除の種類が「${d.name}」とまとめられています。**種類ごとに分けて記載**してください`,
          law,
        });
      }
    }
  }
  return out;
}

/**
 * 出勤簿の記載が揃っているかを確認する。
 *
 * **始業・終業の時刻が要る**。「出勤」「欠勤」だけの記録では足りない
 * （何時間働いたかが分からず、割増賃金の計算根拠にならない）。
 *
 * @param records 出勤簿（1 か月分）
 * @param name 対象者の氏名
 * @returns 不備の一覧
 */
export function checkAttendanceRecords(
  records: readonly AttendanceRecord[],
  name: string,
): LedgerIssue[] {
  const out: LedgerIssue[] = [];
  const law = "労働基準法 第109条（記録の保存）・第108条の解釈";

  for (const r of records) {
    // 休日・欠勤なら時刻は不要
    if (filled(r.dayType) && !filled(r.startTime) && !filled(r.endTime)) continue;

    if (!filled(r.startTime) || !filled(r.endTime)) {
      out.push({
        ledger: "attendance", target: `${name} (${r.date})`,
        // **「出勤」だけでは足りない**。時刻が無いと割増賃金を計算できない
        message: "始業・終業の時刻が記録されていません（「出勤」だけでは割増賃金の根拠になりません）",
        law,
      });
    }
  }
  return out;
}

/** 帳簿の種類。 */
export type LedgerKind = "worker" | "wage" | "attendance";

/** 保存期間の判定結果。 */
export interface RetentionStatus {
  /** 帳簿の種類。 */
  kind: LedgerKind;
  /** 対象（氏名など）。 */
  target: string;
  /** 起算日（YYYY-MM-DD）。 */
  startsOn: string;
  /** 保存期限（YYYY-MM-DD。この日まで保存する）。 */
  keepUntil: string;
  /** まだ保存義務があるか。 */
  mustKeep: boolean;
  /** 期限までの日数（過ぎていれば負）。 */
  daysLeft: number;
}

/** 保存期間（年）。**当分の間は 3 年でよいとされているが、5 年に統一するのが安全**。 */
export const RETENTION_YEARS = 5;

/**
 * 帳簿の保存期限を判定する。
 *
 * **起算日が帳簿ごとに違う**のが要点:
 *   - 労働者名簿 … **退職・解雇・死亡の日**から
 *   - 賃金台帳 … **最後に記入した日**から
 *   - 出勤簿 … **最後の出勤日**から
 *
 * 「退職から 5 年」で一律に消すと、賃金台帳や出勤簿を早く消してしまう。
 *
 * @param input.kind 帳簿の種類
 * @param input.target 対象（氏名など）
 * @param input.startsOn 起算日（YYYY-MM-DD）
 * @param today 基準日（テスト注入用）
 * @param years 保存年数（既定 5）
 * @returns 保存期限と、まだ義務があるか
 *
 * @example
 * ```ts
 * const s = checkRetention({ kind: "worker", target: "山田", startsOn: "2020-03-31" });
 * if (!s.mustKeep) console.log("保存期間を過ぎています。破棄できます");
 * ```
 */
export function checkRetention(
  input: { kind: LedgerKind; target: string; startsOn: string },
  today: Date = todayUtcFromJst(),
  years: number = RETENTION_YEARS,
): RetentionStatus {
  const start = new Date(`${input.startsOn}T00:00:00Z`);
  const until = new Date(start);
  until.setUTCFullYear(until.getUTCFullYear() + years);
  // 起算日から N 年後の前日まで
  until.setUTCDate(until.getUTCDate() - 1);

  const keepUntil = until.toISOString().slice(0, 10);
  const daysLeft = Math.floor((until.getTime() - today.getTime()) / 86_400_000);
  return {
    kind: input.kind,
    target: input.target,
    startsOn: input.startsOn,
    keepUntil,
    mustKeep: daysLeft >= 0,
    daysLeft,
  };
}

/**
 * 労働者名簿から、保存期限の判定に使う起算日を取り出す。
 *
 * **在職中は起算しない**（退職するまで保存し続ける）。
 *
 * @param record 労働者名簿
 * @returns 起算日。**在職中なら undefined**
 */
export function retentionStartForWorker(record: WorkerRecord): string | undefined {
  return filled(record.leftOn) ? record.leftOn : undefined;
}
