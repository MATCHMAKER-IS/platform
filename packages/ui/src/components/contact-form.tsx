"use client";
/**
 * 問い合わせフォーム。
 *
 * 【なぜ要るか】
 * `internal-app` と `public-site` が**同じ項目・同じ作りのフォームを別々に持っていた**
 * (氏名・メール・分類・件名・本文)。違うのは**送信先とカテゴリだけ**なのに、
 * 二重送信の防止や必須チェックまで書き直されており、**片方だけ抜けていた**。
 *
 * @packageDocumentation
 */
import * as React from "react";
import { Button } from "./button";
import { Input } from "./input";
import { Select } from "./select";
import { Textarea } from "./textarea";
import { useSubmit } from "./use-submit";

/** 問い合わせの内容。 */
export interface ContactFormValues {
  /** 氏名。 */
  name: string;
  /** 返信先のメールアドレス。 */
  email: string;
  /** 分類。 */
  category: string;
  /** 件名。 */
  subject: string;
  /** 本文。 */
  message: string;
}

/** {@link ContactForm} の設定。 */
export interface ContactFormProps {
  /** 送信先(`/api/contact` など)。 */
  endpoint: string;
  /** 分類の選択肢(**アプリごとに違う**)。 */
  categories: readonly string[];
  /** fetch の差し替え(テスト用)。 */
  fetchImpl?: typeof fetch;
  /** 送信できたときの文言。 */
  doneMessage?: string;
}

/**
 * 問い合わせフォームを描く。
 *
 * **二重送信を防ぐ**({@link useSubmit} を使う)——利用者は応答が無いと
 * もう一度押すので、防がないと**問い合わせが 2 件登録される**。
 *
 * **必須チェックは送信処理の中で行う。** 外で分岐すると
 * エラー表示の経路が 2 つになり、**片方だけ消し忘れる**。
 *
 * **エラーはサーバが返した文言をそのまま出す。** ここで作文すると、
 * 「なぜ送れないか」が利用者に伝わらない。
 *
 * @param props 送信先と分類
 *
 * @example
 * ```tsx
 * <ContactForm endpoint="/api/contact" categories={["請求・支払", "その他"]} />
 * ```
 */
export function ContactForm({ endpoint, categories, fetchImpl, doneMessage }: ContactFormProps) {
  const empty: ContactFormValues = {
    name: "", email: "", category: categories[0] ?? "", subject: "", message: "",
  };
  const [form, setForm] = React.useState<ContactFormValues>(empty);
  const { status, error, submit, sending } = useSubmit({ onDone: () => setForm(empty) });

  const set = (k: keyof ContactFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }));

  // **ハニーポット。** 人には見えない欄で、**埋まっていたら機械**。
  // 2026-08 まで基盤に `isHoneypotFilled` があるのに繋いでおらず、
  // 守りはレート制限だけだった——**分散したスパムは 1 通ずつ来る**ので、
  // 回数の制限では止まらない。
  //
  // **判定はサーバ側で行う**(`/api/contact` が `isHoneypotFilled` で見る)。
  // クライアントで弾くと、**JavaScript を切った機械には効かない**。
  const [honeypot, setHoneypot] = React.useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    void submit(async () => {
      // **必須チェックも中で投げる**(エラー表示の経路を 1 つにする)
      if (!form.name || !form.email || !form.subject || !form.message) {
        throw new Error("必須項目を入力してください。");
      }
      const doFetch = fetchImpl ?? fetch;
      const res = await doFetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        // **ハニーポットも一緒に送る**(サーバ側が `isHoneypotFilled` で見る)
        body: JSON.stringify({ ...form, website: honeypot }),
      });
      if (!res.ok) {
        // **サーバの文言をそのまま出す**(ここで作文すると理由が伝わらない)
        throw new Error(((await res.json()) as { error?: string }).error ?? "送信に失敗しました。");
      }
    });
  };

  const field: React.CSSProperties = { display: "grid", gap: 4 };
  const label: React.CSSProperties = { fontSize: 12, color: "var(--color-muted)" };

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, maxWidth: 560 }}>
      {/* **ハニーポット。** 画面から見えない位置に置き、読み上げからも隠す。
          自動入力も切る——**人が誤って埋めることがない**ようにする */}
      <div aria-hidden="true" style={{ position: "absolute", left: -9999, width: 1, height: 1, overflow: "hidden" }}>
        <input
          tabIndex={-1}
          autoComplete="off"
          name="website"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>
      <label style={field}>
        <span style={label}>お名前</span>
        <Input value={form.name} onChange={set("name")} required />
      </label>
      <label style={field}>
        <span style={label}>メールアドレス</span>
        <Input type="email" value={form.email} onChange={set("email")} required />
      </label>
      <label style={field}>
        <span style={label}>分類</span>
        <Select
          value={form.category}
          onChange={set("category")}
          options={categories.map((c) => ({ label: c, value: c }))}
        />
      </label>
      <label style={field}>
        <span style={label}>件名</span>
        <Input value={form.subject} onChange={set("subject")} required />
      </label>
      <label style={field}>
        <span style={label}>お問い合わせ内容</span>
        <Textarea value={form.message} onChange={set("message")} rows={6} required />
      </label>

      <Button type="submit" disabled={sending} style={{ justifySelf: "start" }}>
        {sending ? "送信中…" : "送信する"}
      </Button>

      {/* **`role="alert"` を付ける。** 読み上げ環境では、付けないと送信結果が伝わらない */}
      {status === "error" && (
        <p role="alert" style={{ color: "var(--color-danger)", fontSize: 14 }}>{error}</p>
      )}
      {status === "done" && (
        <p role="status" style={{ color: "var(--color-success)", fontSize: 14 }}>
          {doneMessage ?? "送信しました。折り返しご連絡します。"}
        </p>
      )}
    </form>
  );
}
