/**
 * **ブラウザ / Edge からも使える部分**だけをまとめた入口。
 *
 * 束ねた入口（`index.ts`）は 署名検証のために **`node:` を使います**。
 * 画面から入口を取ると**使っていない部分まで載り**、
 * `next build` が `UnhandledSchemeError` で落ちます（2026-08）。
 *
 * ここにあるのは**依存を持たない処理だけ**なので、どこからでも呼べます。
 * `ratelimit` / `cron` / `net` の `./browser` と同じ形です。
 *
 * @packageDocumentation
 */
/**
 * 承認・却下ボタン付きのメッセージ(Block Kit)を組み立てる。
 *
 * 承認をチャットで回すと速いが、**押した人が誰かを必ず確かめる**こと。
 * 押下時に届く payload の `userId` を、社内の利用者と突き合わせてから処理する。
 *
 * @param req 見出し・本文・ボタンに埋める値
 * @returns `postMessage` の `blocks` に渡す配列
 *
 * @example
 * ```ts
 * await slack.postMessage({
 *   channel: "#承認",
 *   text: "経費申請の承認",   // 通知欄に出る代替テキスト
 *   blocks: buildApprovalBlocks({ title: "経費申請の承認", summary: "山田太郎 / 12,000円", actionValue: "expense:123" }),
 * });
 * ```
 */
export function buildApprovalBlocks(req: ApprovalRequest): unknown[] {
  const blocks: unknown[] = [
    { type: "header", text: { type: "plain_text", text: req.title, emoji: true } },
    { type: "section", text: { type: "mrkdwn", text: req.summary } },
  ];
  if (req.fields && req.fields.length > 0) {
    blocks.push({
      type: "section",
      fields: req.fields.map((f) => ({ type: "mrkdwn", text: `*${f.label}*\n${f.value}` })),
    });
  }
  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        style: "primary",
        text: { type: "plain_text", text: req.approveLabel ?? "承認する" },
        action_id: "approve",
        value: req.actionValue,
      },
      {
        type: "button",
        style: "danger",
        text: { type: "plain_text", text: req.rejectLabel ?? "却下する" },
        action_id: "reject",
        value: req.actionValue,
        // 誤操作を防ぐため、却下は確認を挟む
        confirm: {
          title: { type: "plain_text", text: "却下しますか" },
          text: { type: "mrkdwn", text: "この操作は申請者に通知されます。" },
          confirm: { type: "plain_text", text: "却下する" },
          deny: { type: "plain_text", text: "やめる" },
        },
      },
    ],
  });
  return blocks;
}

/**
 * ボタン押下の payload を解く。
 *
 * Slack は `application/x-www-form-urlencoded` の `payload=` に JSON を入れて送ってくる。
 * **署名の検証は別途必ず行うこと**(`verifySlackSignature`)。ここは形を整えるだけ。
 *
 * @param body 生ボディ
 * @returns 押されたボタンの情報。想定外の形なら null
 */
export function parseInteraction(body: string): SlackInteraction | null {
  const raw = new URLSearchParams(body).get("payload");
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as {
      actions?: { action_id?: string; value?: string }[];
      user?: { id?: string; username?: string; name?: string };
      channel?: { id?: string };
      message?: { ts?: string };
      response_url?: string;
    };
    const action = p.actions?.[0];
    if (!action?.action_id) return null;
    return {
      actionId: action.action_id,
      value: action.value ?? "",
      userId: p.user?.id ?? "",
      userName: p.user?.username ?? p.user?.name ?? "",
      channelId: p.channel?.id ?? "",
      messageTs: p.message?.ts ?? "",
      responseUrl: p.response_url ?? "",
    };
  } catch {
    return null;
  }
}
