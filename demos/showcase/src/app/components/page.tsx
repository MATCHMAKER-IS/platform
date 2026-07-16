"use client";
/**
 * 追加コンポーネントのデモ(DataTable / Steps / Progress / ダイアログ / Toast / テンキー / エディタ)。
 */
import { useState } from "react";
import {
  DataTable, Steps, Progress, Spinner, Seekbar, Button, Modal,
  ConfirmDialog, ErrorDialog, NumericKeypad, RichTextEditor, toast, type Column,
  Tabs, TabsList, TabsTrigger, TabsContent, Accordion, AccordionItem, AccordionTrigger, AccordionContent,
  Avatar, AvatarFallback, Badge, Skeleton, Breadcrumb, Pagination,
  Rating, Autocomplete, TagInput, OTPInput, SignaturePad,
  VideoPlayer, AudioPlayer, StreamPlayer, Waveform, AudioRecorder, VideoRecorder,
} from "@platform/ui";

interface Row { id: number; name: string; dept: string; age: number }
const rows: Row[] = [
  { id: 1, name: "山田太郎", dept: "営業", age: 34 },
  { id: 2, name: "鈴木花子", dept: "開発", age: 29 },
  { id: 3, name: "佐藤次郎", dept: "総務", age: 41 },
  { id: 4, name: "田中三郎", dept: "開発", age: 25 },
  { id: 5, name: "高橋四郎", dept: "営業", age: 38 },
];
const columns: Column<Row>[] = [
  { key: "name", header: "氏名", sortable: true },
  { key: "dept", header: "部署", sortable: true },
  { key: "age", header: "年齢", sortable: true, align: "right" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: "2rem" }}>
      <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: ".75rem" }}>{title}</h2>
      {children}
    </section>
  );
}

export default function Page() {
  const [confirm, setConfirm] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [modal, setModal] = useState(false);
  const [pin, setPin] = useState("");
  const [pos, setPos] = useState(30);
  const [html, setHtml] = useState("<p>ここに入力できます。<strong>太字</strong>や<s>取り消し線</s>、色・サイズも変更可能。</p>");
  const [page, setPage] = useState(1);
  const [rating, setRating] = useState(3);
  const [ac, setAc] = useState("");
  const [tags, setTags] = useState<string[]>(["営業", "開発"]);
  const [otp, setOtp] = useState("");
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <main style={{ maxWidth: 760, margin: "3rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>追加コンポーネント</h1>

      <Section title="DataTable(ソート・ページング)">
        <DataTable columns={columns} data={rows} pageSize={3} rowKey={(r) => r.id} />
      </Section>

      <Section title="Steps(ステッパー)">
        <Steps steps={["入力", "確認", "完了"]} current={1} />
      </Section>

      <Section title="Progress / Spinner / Seekbar">
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: 400 }}>
          <Progress value={65} />
          <div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}><Spinner /> 読み込み中...</div>
          <Seekbar value={pos} max={180} onSeek={setPos} formatLabel={fmt} />
        </div>
      </Section>

      <Section title="Toast / ダイアログ / モーダル">
        <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem" }}>
          <Button onClick={() => toast.success("保存しました")}>成功トースト</Button>
          <Button variant="secondary" onClick={() => toast.error("失敗しました")}>エラートースト</Button>
          <Button variant="secondary" onClick={() => setConfirm(true)}>確認ダイアログ</Button>
          <Button variant="danger" onClick={() => setErrorOpen(true)}>エラーダイアログ</Button>
          <Button variant="ghost" onClick={() => setModal(true)}>モーダル</Button>
        </div>
        <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="削除しますか?" description="この操作は取り消せません。" destructive confirmText="削除" onConfirm={() => { setConfirm(false); toast.success("削除しました"); }} />
        <ErrorDialog open={errorOpen} onOpenChange={setErrorOpen} message="サーバに接続できませんでした。" />
        <Modal open={modal} onOpenChange={setModal} title="お知らせ" footer={<Button onClick={() => setModal(false)}>閉じる</Button>}>
          <p>モーダルの本文です。</p>
        </Modal>
      </Section>

      <Section title="テンキー">
        <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
          <NumericKeypad value={pin} onChange={setPin} maxLength={6} />
          <div style={{ fontSize: "1.5rem", fontFamily: "monospace" }}>{pin || "―"}</div>
        </div>
      </Section>

      <Section title="リッチテキストエディタ(太字・取消線・色・サイズ)">
        <RichTextEditor value={html} onChange={setHtml} />
      </Section>

      <Section title="Tabs / Accordion">
        <Tabs defaultValue="a">
          <TabsList>
            <TabsTrigger value="a">概要</TabsTrigger>
            <TabsTrigger value="b">詳細</TabsTrigger>
            <TabsTrigger value="c">履歴</TabsTrigger>
          </TabsList>
          <TabsContent value="a">概要タブの内容</TabsContent>
          <TabsContent value="b">詳細タブの内容</TabsContent>
          <TabsContent value="c">履歴タブの内容</TabsContent>
        </Tabs>
        <div style={{ marginTop: "1rem", maxWidth: 480 }}>
          <Accordion type="single" collapsible>
            <AccordionItem value="1"><AccordionTrigger>配送について</AccordionTrigger><AccordionContent>通常2〜3営業日でお届けします。</AccordionContent></AccordionItem>
            <AccordionItem value="2"><AccordionTrigger>返品について</AccordionTrigger><AccordionContent>到着後7日以内に承ります。</AccordionContent></AccordionItem>
          </Accordion>
        </div>
      </Section>

      <Section title="Badge / Avatar / Skeleton / Breadcrumb">
        <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", alignItems: "center" }}>
          <Badge>新着</Badge>
          <Badge variant="success">承認済</Badge>
          <Badge variant="warning">保留</Badge>
          <Badge variant="danger">却下</Badge>
          <Avatar><AvatarFallback>山田</AvatarFallback></Avatar>
          <Skeleton className="h-8 w-32" />
        </div>
        <div style={{ marginTop: ".75rem" }}>
          <Breadcrumb items={[{ label: "ホーム", href: "/" }, { label: "設定", href: "#" }, { label: "プロフィール" }]} />
        </div>
      </Section>

      <Section title="Pagination">
        <Pagination page={page} totalPages={12} onPageChange={setPage} />
      </Section>

      <Section title="評価(⭐)・サジェスト・タグ・OTP">
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: 360 }}>
          <div><Rating value={rating} onChange={setRating} /> <span style={{ color: "var(--color-muted)" }}>{rating} / 5</span></div>
          <Autocomplete value={ac} onChange={setAc} placeholder="都道府県を入力" suggestions={["東京都", "東京都下", "大阪府", "京都府", "北海道", "福岡県"]} />
          <TagInput value={tags} onChange={setTags} placeholder="タグを追加" />
          <OTPInput length={6} value={otp} onChange={setOtp} />
        </div>
      </Section>

      <Section title="署名パッド">
        <SignaturePad />
      </Section>

      <Section title="動画・音声プレイヤー">
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: 480 }}>
          <VideoPlayer src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4" />
          <AudioPlayer src="https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3" title="サンプル音声" />
        </div>
      </Section>

      <Section title="HLS ストリーミング(StreamPlayer)">
        <div style={{ maxWidth: 480 }}>
          <StreamPlayer src="https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8" />
        </div>
      </Section>

      <Section title="波形表示(Waveform)">
        <div style={{ maxWidth: 480 }}>
          <Waveform src="https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3" />
        </div>
      </Section>

      <Section title="録音・録画(MediaRecorder / 要許可)">
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: 480 }}>
          <AudioRecorder />
          <VideoRecorder />
        </div>
      </Section>

      <p style={{ marginTop: "2rem" }}><a href="/">← 戻る</a></p>
    </main>
  );
}
