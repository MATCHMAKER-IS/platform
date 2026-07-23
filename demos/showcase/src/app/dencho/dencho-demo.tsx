"use client";
/** 電子帳簿保存法のデモ: ハッシュチェーンによる改ざん検知・検索要件・保存期間・タイムスタンプ。 */
import * as React from "react";
import { Button, Input } from "@platform/ui";
import {
  appendEvidence,
  verifyEvidenceChain,
  searchTransactions,
  meetsSearchRequirements,
  retentionDeadline,
  isWithinRetention,
  daysUntilRetentionEnd,
  DEFAULT_RETENTION_YEARS,
  createTimestampToken,
  verifyTimestampToken,
  sha256Hex,
  type EvidenceRecord,
  type TransactionRecord,
  type TransactionQuery,
} from "@platform/dencho";

interface Tx extends TransactionRecord {
  id: string;
  transactionDate: string;
  amount: number;
  counterparty: string;
  note: string;
}

const TXS: Tx[] = [
  { id: "t1", transactionDate: "2026-04-12", amount: 385400, counterparty: "株式会社サンプル商事", note: "サーバ購入" },
  { id: "t2", transactionDate: "2026-05-08", amount: 12000, counterparty: "サンプル文具", note: "事務用品" },
  { id: "t3", transactionDate: "2026-06-30", amount: 1200000, counterparty: "テスト工業株式会社", note: "設備一式" },
  { id: "t4", transactionDate: "2026-07-15", amount: 58000, counterparty: "株式会社サンプル商事", note: "保守費用" },
];

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

const field: React.CSSProperties = {
  padding: "5px 8px",
  borderRadius: 4,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-fg)",
  fontSize: 12,
};

const yen = (n: number) => `¥${n.toLocaleString()}`;
const short = (h: string) => `${h.slice(0, 10)}…`;

/** 初期チェーンを作る（取引を順に記録した状態）。 */
function buildChain(): EvidenceRecord[] {
  const chain: EvidenceRecord[] = [];
  for (const t of TXS) {
    chain.push(appendEvidence(chain, t, `${t.transactionDate}T09:00:00Z`));
  }
  return chain;
}

export function DenchoDemo() {
  const [chain, setChain] = React.useState<EvidenceRecord[]>(() => buildChain());
  const [query, setQuery] = React.useState<TransactionQuery>({ dateFrom: "2026-04-01", dateTo: "2027-03-31", counterparty: "サンプル" });
  const [startDate, setStartDate] = React.useState("2026-07-17");
  const [now, setNow] = React.useState("2026-07-17");
  const [secret] = React.useState("demo-timestamp-secret");

  const verification = React.useMemo(() => verifyEvidenceChain(chain), [chain]);
  const found = React.useMemo(() => searchTransactions(TXS, query), [query]);
  const requirements = meetsSearchRequirements(query);

  const start = new Date(`${startDate}T00:00:00`);
  const nowDate = new Date(`${now}T00:00:00`);
  const validStart = !Number.isNaN(start.getTime());
  const validNow = !Number.isNaN(nowDate.getTime());
  const deadline = validStart ? retentionDeadline(start, DEFAULT_RETENTION_YEARS) : null;
  const within = validStart && validNow ? isWithinRetention(start, DEFAULT_RETENTION_YEARS, nowDate) : false;
  const restDays = validStart && validNow ? daysUntilRetentionEnd(start, DEFAULT_RETENTION_YEARS, nowDate) : 0;

  /** 記録済みデータを書き換える（＝改ざん）。ハッシュは元のまま。 */
  function tamper(seq: number) {
    setChain((prev) =>
      prev.map((r) => {
        if (r.seq !== seq) return r;
        const data = r.data as Tx;
        return { ...r, data: { ...data, amount: data.amount + 100000 } };
      }),
    );
  }

  const token = createTimestampToken(sha256Hex(JSON.stringify(TXS[0])), secret, new Date("2026-07-17T00:00:00Z"));
  const tokenOk = verifyTimestampToken(token, secret, sha256Hex(JSON.stringify(TXS[0])));

  return (
    <>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>電子帳簿保存法</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        電子取引データの保存には法律上の要件があります。<strong>真実性の確保（改ざんできないこと）</strong>、
        <strong>検索要件（日付・金額・取引先で引けること）</strong>、<strong>保存期間</strong>の 3 つが柱です。
        <code>@platform/dencho</code> はそれぞれに対応する部品を持っています。
      </p>

      <div style={box}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>① 真実性の確保（ハッシュチェーン）</h2>
          <Button
            onClick={() => setChain(buildChain())}
            style={{ padding: "5px 14px", borderRadius: "var(--radius)", border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-fg)", cursor: "pointer", fontSize: 12 }}
          >
            チェーンを作り直す
          </Button>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 10, lineHeight: 1.8 }}>
          各レコードのハッシュに<strong>直前のハッシュを含めます</strong>。だから 1 件でも書き換えると、
          そこから後ろが全部繋がらなくなり、<strong>どこが改ざんされたかまで分かります</strong>。
          「改ざん」ボタンで金額を +100,000 してみてください。
        </p>

        <div
          style={{
            padding: "8px 12px",
            borderRadius: "var(--radius)",
            marginBottom: 12,
            fontSize: 13,
            fontWeight: 700,
            color: verification.valid ? "var(--color-success)" : "var(--color-danger)",
            border: `1px solid ${verification.valid ? "var(--color-success)" : "var(--color-danger)"}`,
          }}
        >
          {verification.valid
            ? "○ チェーンは正しい（改ざんなし）"
            : `× 改ざんを検知しました — seq ${verification.brokenAt} 以降が壊れています${verification.reason !== undefined ? `（${verification.reason}）` : ""}`}
        </div>

        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--color-muted)" }}>
              <th style={{ padding: 4 }}>seq</th>
              <th style={{ padding: 4 }}>取引</th>
              <th style={{ padding: 4, textAlign: "right" }}>金額</th>
              <th style={{ padding: 4 }}>prevHash</th>
              <th style={{ padding: 4 }}>hash</th>
              <th style={{ padding: 4 }}></th>
            </tr>
          </thead>
          <tbody>
            {chain.map((r) => {
              const t = r.data as Tx;
              const broken = verification.brokenAt !== undefined && r.seq >= verification.brokenAt;
              return (
                <tr key={r.seq} style={{ borderTop: "1px solid var(--color-border)", background: broken ? "color-mix(in srgb, var(--color-danger) 8%, transparent)" : "transparent" }}>
                  <td style={{ padding: 4 }}>{r.seq}</td>
                  <td style={{ padding: 4 }}>
                    {t.counterparty}
                    <span style={{ color: "var(--color-muted)", marginLeft: 6 }}>{t.note}</span>
                  </td>
                  <td style={{ padding: 4, textAlign: "right" }}>{yen(t.amount)}</td>
                  <td style={{ padding: 4, fontFamily: "monospace", color: "var(--color-muted)" }}>{short(r.prevHash)}</td>
                  <td style={{ padding: 4, fontFamily: "monospace", color: "var(--color-muted)" }}>{short(r.hash)}</td>
                  <td style={{ padding: 4 }}>
                    <Button
                      onClick={() => tamper(r.seq)}
                      style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, border: "1px solid var(--color-danger)", background: "transparent", color: "var(--color-danger)", cursor: "pointer" }}
                    >
                      改ざん
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>② 検索要件</h2>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 10, lineHeight: 1.8 }}>
          電帳法は<strong>「取引年月日・取引金額・取引先」で検索できること</strong>、
          かつ<strong>日付と金額は範囲指定できること</strong>、<strong>2 つ以上の条件を組み合わせられること</strong>を求めます。
          <code>meetsSearchRequirements()</code> が、条件が要件を満たすかを判定します。
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: "var(--color-muted)" }}>
            日付 <Input type="date" value={query.dateFrom ?? ""} onChange={(e) => setQuery({ ...query, dateFrom: e.target.value })} style={field} />
          </label>
          <label style={{ fontSize: 11, color: "var(--color-muted)" }}>
            〜 <Input type="date" value={query.dateTo ?? ""} onChange={(e) => setQuery({ ...query, dateTo: e.target.value })} style={field} />
          </label>
          <label style={{ fontSize: 11, color: "var(--color-muted)" }}>
            金額 <Input type="number" placeholder="下限" value={query.amountMin ?? ""} onChange={(e) => setQuery({ ...query, amountMin: e.target.value === "" ? undefined : Number(e.target.value) })} style={{ ...field, width: 90 }} />
          </label>
          <label style={{ fontSize: 11, color: "var(--color-muted)" }}>
            〜 <Input type="number" placeholder="上限" value={query.amountMax ?? ""} onChange={(e) => setQuery({ ...query, amountMax: e.target.value === "" ? undefined : Number(e.target.value) })} style={{ ...field, width: 90 }} />
          </label>
          <label style={{ fontSize: 11, color: "var(--color-muted)" }}>
            取引先 <Input value={query.counterparty ?? ""} onChange={(e) => setQuery({ ...query, counterparty: e.target.value })} style={{ ...field, width: 130 }} />
          </label>
        </div>

        <div style={{ fontSize: 12, marginBottom: 10, color: requirements.ok ? "var(--color-success)" : "var(--color-warning)" }}>
          {requirements.ok ? "○ 検索要件を満たしています" : `△ 不足: ${requirements.missing.join(" / ")}`}
        </div>

        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--color-muted)" }}>
              <th style={{ padding: 4 }}>取引年月日</th>
              <th style={{ padding: 4 }}>取引先</th>
              <th style={{ padding: 4, textAlign: "right" }}>金額</th>
              <th style={{ padding: 4 }}>摘要</th>
            </tr>
          </thead>
          <tbody>
            {found.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 8, color: "var(--color-muted)" }}>
                  該当なし
                </td>
              </tr>
            ) : (
              found.map((t) => (
                <tr key={t.id} style={{ borderTop: "1px solid var(--color-border)" }}>
                  <td style={{ padding: 4 }}>{t.transactionDate}</td>
                  <td style={{ padding: 4 }}>{t.counterparty}</td>
                  <td style={{ padding: 4, textAlign: "right" }}>{yen(t.amount)}</td>
                  <td style={{ padding: 4, color: "var(--color-muted)" }}>{(t as Tx).note}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 8 }}>
          {TXS.length} 件中 <b>{found.length}</b> 件。取引先は部分一致（大小文字を区別しません）、複数条件は AND です。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>③ 保存期間</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: "var(--color-muted)" }}>
            起算日 <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={field} />
          </label>
          <label style={{ fontSize: 11, color: "var(--color-muted)" }}>
            今日 <Input type="date" value={now} onChange={(e) => setNow(e.target.value)} style={field} />
          </label>
        </div>
        <div style={{ fontSize: 13, lineHeight: 2 }}>
          <div>
            保存期限（{DEFAULT_RETENTION_YEARS} 年）: <b>{deadline ? deadline.toISOString().slice(0, 10) : "-"}</b>
          </div>
          <div style={{ color: within ? "var(--color-success)" : "var(--color-danger)" }}>
            {within ? `○ 保存期間内（残り ${restDays} 日）` : "× 保存期間を過ぎています（破棄可）"}
          </div>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 8 }}>
          「今日」を 2034 年などにすると期限切れになります。捨ててよい書類を機械的に判定できるので、
          ストレージの棚卸しに使えます。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>④ タイムスタンプ</h2>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 8, lineHeight: 1.8 }}>
          「その時刻にそのデータが存在した」ことを示すトークンです。
          <strong>本番は認定タイムスタンプ局を使います</strong>が、ここでは HMAC による同等の仕組みを見せています。
        </p>
        <div style={{ fontSize: 12, fontFamily: "monospace", background: "var(--color-bg)", padding: 10, borderRadius: "var(--radius)", lineHeight: 1.8, wordBreak: "break-all" }}>
          <div>time: {token.time}</div>
          <div>hash: {short(token.dataHash)}</div>
          <div>sig : {short(token.signature)}</div>
        </div>
        <div style={{ fontSize: 13, marginTop: 8, color: tokenOk ? "var(--color-success)" : "var(--color-danger)", fontWeight: 700 }}>
          {tokenOk ? "○ トークンは有効（データが改変されていない）" : "× 検証に失敗"}
        </div>
      </div>
    </>
  );
}
