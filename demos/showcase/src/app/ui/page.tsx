"use client";
/**
 * UI ショーケース。@platform/ui の各コンポーネントを実際に触って確認できる。
 */
import { useState } from "react";
import {
  Button, Input, Select, Checkbox, Switch, Slider, Combobox,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  Dialog, DialogTrigger, DialogContent, DialogTitle, DialogHeader, DialogFooter, DialogClose,
  TooltipProvider, Tooltip, TooltipTrigger, TooltipContent, Carousel,
  PasswordInput, PasswordStrengthMeter,
  Icon, VoiceInput,
  RadioGroup, RadioGroupItem, ToggleGroup, ToggleGroupItem,
  NumberInput, DatePicker, TimePicker, ColorPicker, FileUpload,
} from "@platform/ui";

const prefs = [
  { label: "東京都", value: "tokyo" },
  { label: "大阪府", value: "osaka" },
  { label: "北海道", value: "hokkaido" },
  { label: "福岡県", value: "fukuoka" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: "2rem" }}>
      <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: ".75rem" }}>{title}</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center" }}>{children}</div>
    </section>
  );
}

export default function Page() {
  const [checked, setChecked] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [volume, setVolume] = useState(50);
  const [pref, setPref] = useState<string>();
  const [pw, setPw] = useState("");
  const [strength, setStrength] = useState<{ score: 0|1|2|3|4; label: string } | null>(null);
  const [plan, setPlan] = useState("standard");
  const [view, setView] = useState("list");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [qty, setQty] = useState("1");
  const [color, setColor] = useState("#0f766e");
  const [files, setFiles] = useState<File[]>([]);
  const [voice, setVoice] = useState("");

  async function onPwChange(value: string) {
    setPw(value);
    if (!value) { setStrength(null); return; }
    const res = await fetch("/api/password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: value }) });
    setStrength(await res.json());
  }
  async function generate() {
    const res = await fetch("/api/password?length=20");
    const { password } = await res.json();
    await onPwChange(password);
  }

  return (
    <TooltipProvider>
      <main style={{ maxWidth: 760, margin: "3rem auto", padding: "0 1rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>UI コンポーネント</h1>
        <p style={{ color: "var(--color-muted)" }}>@platform/ui の共通部品を触って確認できます。</p>

        <Section title="アイコン(名前指定・Font Awesome ライク)">
          {["Home","Search","Settings","User","Bell","Calendar","Mail","Trash2","Download","Heart","Star","Check"].map((n) => (
            <div key={n} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: ".25rem", width: 64 }}>
              <Icon name={n as never} size={22} />
              <span style={{ fontSize: ".65rem", color: "var(--color-muted)" }}>{n}</span>
            </div>
          ))}
          <a href="/icons" style={{ alignSelf: "center", fontSize: ".8rem", color: "var(--color-primary)" }}>
            → 一覧(カテゴリ別・検索・コピー)
          </a>
        </Section>

        <Section title="音声入力(Web Speech API)">
          <div style={{ width: 320 }}>
            <VoiceInput value={voice} onChange={setVoice} placeholder="マイクを押して話してください" multiline />
          </div>
        </Section>

        <Section title="ボタン">
          <Button>プライマリ</Button>
          <Button variant="secondary">セカンダリ</Button>
          <Button variant="ghost">ゴースト</Button>
          <Button variant="danger">削除</Button>
        </Section>

        <Section title="入力">
          <Input placeholder="氏名を入力" style={{ maxWidth: 240 }} />
          <Select placeholder="部署" options={[{ label: "営業", value: "s" }, { label: "開発", value: "d" }]} />
        </Section>

        <Section title="トグル・レンジ">
          <label style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
            <Checkbox checked={checked} onCheckedChange={(v) => setChecked(!!v)} /> 同意する
          </label>
          <label style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
            <Switch checked={enabled} onCheckedChange={setEnabled} /> 通知 {enabled ? "ON" : "OFF"}
          </label>
          <div style={{ width: 220 }}>
            <Slider value={[volume]} max={100} step={1} onValueChange={([v]) => setVolume(v ?? 0)} />
            <div style={{ fontSize: ".8rem", color: "var(--color-muted)" }}>音量: {volume}</div>
          </div>
        </Section>

        <Section title="コンボボックス(検索付き)">
          <div style={{ width: 240 }}>
            <Combobox options={prefs} value={pref} onChange={setPref} placeholder="都道府県を選択" />
          </div>
        </Section>

        <Section title="ドロップダウンメニュー">
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="secondary">操作 ▾</Button></DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>編集</DropdownMenuItem>
              <DropdownMenuItem>複製</DropdownMenuItem>
              <DropdownMenuItem>削除</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Section>

        <Section title="ダイアログ・ツールチップ">
          <Dialog>
            <DialogTrigger asChild><Button>ダイアログを開く</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>確認</DialogTitle></DialogHeader>
              <p>この操作を実行しますか?</p>
              <DialogFooter>
                <DialogClose asChild><Button variant="secondary">キャンセル</Button></DialogClose>
                <DialogClose asChild><Button>実行</Button></DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Tooltip>
            <TooltipTrigger asChild><Button variant="ghost">ホバー</Button></TooltipTrigger>
            <TooltipContent>ツールチップの例</TooltipContent>
          </Tooltip>
        </Section>

        <Section title="ラジオボタン・トグルグループ">
          <RadioGroup value={plan} onValueChange={setPlan}>
            {([["standard","スタンダード"],["pro","プロ"],["enterprise","エンタープライズ"]] as const).map(([v,l]) => (
              <label key={v} style={{ display: "flex", gap: ".5rem", alignItems: "center", cursor: "pointer" }}>
                <RadioGroupItem value={v} /> {l}
              </label>
            ))}
          </RadioGroup>
          <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v)}>
            <ToggleGroupItem value="list">リスト</ToggleGroupItem>
            <ToggleGroupItem value="grid">グリッド</ToggleGroupItem>
            <ToggleGroupItem value="board">ボード</ToggleGroupItem>
          </ToggleGroup>
        </Section>

        <Section title="日付・時刻・数値・カラー">
          <div style={{ width: 180 }}><DatePicker value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div style={{ width: 140 }}><TimePicker value={time} onChange={(e) => setTime(e.target.value)} /></div>
          <div style={{ width: 100 }}><NumberInput value={qty} min={0} max={99} onChange={(e) => setQty(e.target.value)} /></div>
          <ColorPicker value={color} onChange={setColor} />
        </Section>

        <Section title="ファイルアップロード">
          <div style={{ width: "100%" }}>
            <FileUpload multiple accept="image/*,.pdf" hint="画像 / PDF(複数可)" onFilesChange={setFiles} />
            <div style={{ fontSize: ".8rem", color: "var(--color-muted)", marginTop: ".5rem" }}>選択: {files.length} 件</div>
          </div>
        </Section>

        <Section title="パスワード(表示切替・強度・生成)">
          <div style={{ width: 280, display: "flex", flexDirection: "column", gap: ".5rem" }}>
            <PasswordInput value={pw} onChange={(e) => onPwChange(e.target.value)} placeholder="パスワード" />
            {strength && <PasswordStrengthMeter score={strength.score} label={strength.label} />}
            <Button variant="secondary" onClick={generate}>強力なパスワードを生成</Button>
          </div>
        </Section>

        <Section title="カルーセル">
          <div style={{ width: "100%" }}>
            <Carousel loop>
              {["#0f766e", "#334155", "#b91c1c"].map((c) => (
                <div key={c} style={{ height: 160, background: c, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius)" }}>
                  スライド {c}
                </div>
              ))}
            </Carousel>
          </div>
        </Section>

        <p style={{ marginTop: "2rem" }}><a href="/">← 戻る</a></p>
      </main>
    </TooltipProvider>
  );
}
