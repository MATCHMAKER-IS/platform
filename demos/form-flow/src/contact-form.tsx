"use client";
/**
 * 入力 → 確認 → 完了フォームの完成テンプレート(基盤の組み合わせ)。
 * @platform/form の useSubmitFlow(段階管理)+ reviewItems(確認画面の項目整形)+ @platform/ui の
 * Input/Button/PageHeader/Steps を束ね、3 段階フォームを実現する。
 * @packageDocumentation
 */
import * as React from "react";
import { useSubmitFlow, reviewItems, SUBMIT_PHASES, phaseIndex, type ReviewItem } from "@platform/form";
import { Input, Textarea, Button, PageHeader, Steps, DescriptionList } from "@platform/ui";

/** 問い合わせ入力の型。 */
export interface ContactValues {
  name: string;
  email: string;
  message: string;
}

/** 確認画面に表示する項目定義。 */
const FIELDS = [
  { name: "name", label: "お名前", type: "text" as const },
  { name: "email", label: "メールアドレス", type: "text" as const },
  { name: "message", label: "お問い合わせ内容", type: "textarea" as const },
];

const STEP_LABELS: Record<(typeof SUBMIT_PHASES)[number], string> = {
  input: "入力",
  confirm: "確認",
  complete: "完了",
};

/** {@link ContactForm} の props。 */
export interface ContactFormProps {
  /** 送信処理(API 呼び出し等)。投げると確認画面でエラー表示。 */
  onSubmit: (values: ContactValues) => Promise<void>;
}

/** 入力→確認→完了の問い合わせフォーム。 */
export function ContactForm({ onSubmit }: ContactFormProps) {
  const flow = useSubmitFlow<ContactValues>();
  const [values, setValues] = React.useState<ContactValues>({ name: "", email: "", message: "" });

  const steps = SUBMIT_PHASES.map((p) => ({ label: STEP_LABELS[p] }));
  const currentStep = phaseIndex(flow.phase);

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="お問い合わせ" />
      <Steps steps={steps} current={currentStep} className="mb-6" />

      {flow.phase === "input" && (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">お名前
            <Input value={values.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, name: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1 text-sm">メールアドレス
            <Input type="email" value={values.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, email: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1 text-sm">お問い合わせ内容
            <Textarea value={values.message} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setValues((v) => ({ ...v, message: e.target.value }))} />
          </label>
          <Button onClick={() => flow.toConfirm(values)}>確認画面へ</Button>
        </div>
      )}

      {flow.phase === "confirm" && (
        <div className="flex flex-col gap-6">
          {/* reviewItems で入力値を表示用に整形し、DescriptionList で確認表示 */}
          <DescriptionList
            items={reviewItems(FIELDS, values as unknown as Record<string, unknown>).map((r: ReviewItem) => ({ term: r.label, description: r.value }))}
          />
          {flow.error != null && <p className="text-sm text-red-600">{flow.error}</p>}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={flow.toEdit} disabled={flow.submitting}>修正する</Button>
            <Button onClick={() => flow.submit(onSubmit)} disabled={flow.submitting}>
              {flow.submitting ? "送信中…" : "送信する"}
            </Button>
          </div>
        </div>
      )}

      {flow.phase === "complete" && (
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-8 text-center">
          <p className="text-lg font-semibold text-[var(--color-fg)]">送信が完了しました</p>
          <p className="mt-2 text-sm text-[var(--color-muted)]">お問い合わせありがとうございました。</p>
          <Button variant="secondary" className="mt-6" onClick={() => { flow.reset(); setValues({ name: "", email: "", message: "" }); }}>
            新しい問い合わせ
          </Button>
        </div>
      )}
    </div>
  );
}
