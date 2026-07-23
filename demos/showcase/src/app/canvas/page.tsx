"use client";
/**
 * 自由配置キャンバスのデモ。
 * オブジェクトをドラッグで任意の位置へ移動し、座標を localStorage に保存（リロードで復元）。
 * ドラッグは Pointer Events でマウス/タッチ両対応。
 *
 * 実務で必要になるものを足している:
 *   - 追加 / ラベル変更 / 削除
 *   - グリッド吸着（そろえやすくする）
 *   - 整列（左揃え・等間隔）
 *   - キーボード操作（矢印キーで移動。マウスが使えない場面のため）
 */
import * as React from "react";
import { Badge, Button, Input, Select } from "@platform/ui";

const box: React.CSSProperties = { border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: 16, marginBottom: 16 };
const lb: React.CSSProperties = { display: "grid", gap: 4, fontSize: 12, color: "var(--color-muted)" };
const KEY = "demo-canvas-positions-v2";
const W = 96, H = 44;

/** 置ける形。用途で選べるようにする(四角だけだと図が単調になる)。 */
type Shape = "rect" | "round" | "circle" | "diamond" | "note" | "pill";

type Obj = { id: string; label: string; color: string; x: number; y: number; shape: Shape };

/** 形ごとの見た目。角丸や回転で作るので、画像を持たなくてよい。 */
const SHAPES: { id: Shape; name: string; style: React.CSSProperties }[] = [
  { id: "rect", name: "四角", style: { borderRadius: 4 } },
  { id: "round", name: "角丸", style: { borderRadius: 14 } },
  { id: "pill", name: "丸帯", style: { borderRadius: 999 } },
  { id: "circle", name: "円", style: { borderRadius: "50%" } },
  // ひし形は本体を回し、中の文字を戻して読めるようにする
  { id: "diamond", name: "ひし形", style: { borderRadius: 6, transform: "rotate(45deg)" } },
  // 付箋は右上を折ったように見せる
  { id: "note", name: "付箋", style: { borderRadius: 2, clipPath: "polygon(0 0, 100% 0, 100% 72%, 82% 100%, 0 100%)" } },
];
const COLORS = ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed"];
const DEFAULT: Obj[] = [
  { id: "a", label: "タスクA", color: "#2563eb", x: 20, y: 20 , shape: "round" },
  { id: "b", label: "タスクB", color: "#16a34a", x: 180, y: 60 , shape: "round" },
  { id: "c", label: "メモ", color: "#d97706", x: 90, y: 150 , shape: "note" },
  { id: "d", label: "承認待ち", color: "#dc2626", x: 260, y: 180 , shape: "circle" },
];

export default function Page() {
  const [objs, setObjs] = React.useState<Obj[]>(DEFAULT);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [snap, setSnap] = React.useState("20");
  const [saved, setSaved] = React.useState(false);
  const [shape, setShape] = React.useState<Shape>("round");
  const [color, setColor] = React.useState(COLORS[0]!);
  const [label, setLabel] = React.useState("新しいカード");
  const selectedObj = objs.find((o) => o.id === selected) ?? null;
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef<{ id: string; dx: number; dy: number } | null>(null);

  React.useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) setObjs(JSON.parse(raw)); } catch { /* noop */ }
  }, []);

  const persist = (next: Obj[]) => {
    try { localStorage.setItem(KEY, JSON.stringify(next)); setSaved(true); window.setTimeout(() => setSaved(false), 1200); } catch { /* noop */ }
  };
  const update = (next: Obj[]) => { setObjs(next); persist(next); };

  /** グリッドに吸着させる（0 のときはそのまま）。 */
  const fit = (v: number) => { const g = Number(snap); return g > 0 ? Math.round(v / g) * g : v; };

  const onPointerDown = (e: React.PointerEvent, id: string) => {
    const o = objs.find((x) => x.id === id);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!o || !rect) return;
    setSelected(id);
    drag.current = { id, dx: e.clientX - rect.left - o.x, dy: e.clientY - rect.top - o.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current, rect = canvasRef.current?.getBoundingClientRect();
    if (!d || !rect) return;
    const x = Math.max(0, Math.min(rect.width - W, e.clientX - rect.left - d.dx));
    const y = Math.max(0, Math.min(rect.height - H, e.clientY - rect.top - d.dy));
    setObjs((prev) => prev.map((o) => (o.id === d.id ? { ...o, x, y } : o)));
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    drag.current = null;
    setObjs((cur) => { const next = cur.map((o) => ({ ...o, x: fit(o.x), y: fit(o.y) })); persist(next); return next; });
  };

  /** 選択中のカードを矢印キーで動かす（マウスが使えない場面のため）。 */
  const onKeyDown = (e: React.KeyboardEvent, id: string) => {
    const step = e.shiftKey ? 1 : Number(snap) || 10;
    const move = (dx: number, dy: number) => {
      e.preventDefault();
      update(objs.map((o) => (o.id === id ? { ...o, x: Math.max(0, o.x + dx), y: Math.max(0, o.y + dy) } : o)));
    };
    if (e.key === "ArrowLeft") move(-step, 0);
    else if (e.key === "ArrowRight") move(step, 0);
    else if (e.key === "ArrowUp") move(0, -step);
    else if (e.key === "ArrowDown") move(0, step);
    else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); update(objs.filter((o) => o.id !== id)); setSelected(null); }
  };

  const add = () => {
    const id = `o${Date.now()}`;
    update([...objs, { id, label: label.trim() || "新しい図形", color, shape, x: fit(20), y: fit(20) }]);
    setSelected(id);
  };
  const alignLeft = () => update(objs.map((o) => ({ ...o, x: fit(20) })));
  const spreadY = () => update(objs.map((o, i) => ({ ...o, y: fit(20 + i * 60) })));

  const sel = objs.find((o) => o.id === selected) ?? null;

  return (
    <main style={{ maxWidth: 780, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 6 }}>自由配置キャンバス（ドラッグ＆位置保存）</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 16 }}>
        カードをドラッグで好きな位置へ。離すと座標が保存され、リロードしても同じ位置に戻ります。
        カードを選んで<strong>矢印キーでも動かせます</strong>（Shift で 1px 単位、Delete で削除）。
      </p>

      <div style={box}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
          <label style={lb}>ラベル<Input value={label} onChange={(e) => setLabel(e.target.value)} style={{ width: 160 }} /></label>
          <Button size="sm" onClick={add}>カードを追加</Button>
          <label style={lb}>形
            <Select value={shape} onChange={(e) => setShape(e.target.value as Shape)}
              options={SHAPES.map((x) => ({ label: x.name, value: x.id }))} />
          </label>
          <label style={lb}>色
            <div style={{ display: "flex", gap: 4 }}>
              {COLORS.map((c) => (
                <Button
                  key={c}
                  type="button"
                  variant="ghost"
                  aria-label={`色 ${c}`}
                  onClick={() => setColor(c)}
                  style={{
                    width: 22, height: 22, minHeight: 0, padding: 0, borderRadius: 6, background: c,
                    border: color === c ? "2px solid var(--color-fg)" : "2px solid transparent",
                  }}
                />
              ))}
            </div>
          </label>
          <label style={lb}>グリッド吸着
            <Select value={snap} onChange={(e) => setSnap(e.target.value)}
              options={[{ label: "なし", value: "0" }, { label: "10px", value: "10" }, { label: "20px", value: "20" }, { label: "40px", value: "40" }]} />
          </label>
          <Button size="sm" variant="secondary" onClick={alignLeft}>左に揃える</Button>
          <Button size="sm" variant="secondary" onClick={spreadY}>縦に等間隔</Button>
        </div>

        <div
          ref={canvasRef}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          style={{ position: "relative", height: 340, borderRadius: "var(--radius)", background: "var(--color-bg)", border: "1px dashed var(--color-border)", overflow: "hidden", touchAction: "none", backgroundImage: "radial-gradient(var(--color-border) 1px, transparent 1px)", backgroundSize: `${Number(snap) || 20}px ${Number(snap) || 20}px` }}
        >
          {objs.map((o) => (
            <Button
              key={o.id}
              type="button"
              aria-label={`${o.label}（矢印キーで移動、Delete で削除）`}
              onPointerDown={(e) => onPointerDown(e, o.id)}
              onKeyDown={(e) => onKeyDown(e, o.id)}
              onFocus={() => setSelected(o.id)}
              style={{
                position: "absolute", left: o.x, top: o.y,
                // 円とひし形は縦横を揃えないと歪む
                width: o.shape === "circle" || o.shape === "diamond" ? H + 12 : W,
                height: H,
                background: o.color, color: "#fff",
                border: selected === o.id ? "2px solid var(--color-fg)" : "2px solid transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, cursor: "grab", padding: 4, minHeight: 0,
                ...(SHAPES.find((x) => x.id === o.shape)?.style ?? {}),
              }}
            >
              <span style={{ transform: o.shape === "diamond" ? "rotate(-45deg)" : undefined, pointerEvents: "none" }}>
                {o.label}
              </span>
            </Button>
          ))}
        </div>
      </div>
      {selectedObj && (
        <div style={{ ...box, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>選んだ図形を変える</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={lb}>文字
              <Input
                value={selectedObj.label}
                onChange={(e) => update(objs.map((o) => (o.id === selectedObj.id ? { ...o, label: e.target.value } : o)))}
                style={{ width: 160 }}
              />
            </label>
            <label style={lb}>形
              <Select
                value={selectedObj.shape}
                onChange={(e) => update(objs.map((o) => (o.id === selectedObj.id ? { ...o, shape: e.target.value as Shape } : o)))}
                options={SHAPES.map((x) => ({ label: x.name, value: x.id }))}
              />
            </label>
            <label style={lb}>色
              <div style={{ display: "flex", gap: 4 }}>
                {COLORS.map((c) => (
                  <Button
                    key={c}
                    type="button"
                    variant="ghost"
                    aria-label={`色を ${c} にする`}
                    onClick={() => update(objs.map((o) => (o.id === selectedObj.id ? { ...o, color: c } : o)))}
                    style={{
                      width: 22, height: 22, minHeight: 0, padding: 0, borderRadius: 6, background: c,
                      border: selectedObj.color === c ? "2px solid var(--color-fg)" : "2px solid transparent",
                    }}
                  />
                ))}
              </div>
            </label>
          </div>
          <p style={{ fontSize: 11.5, color: "var(--color-muted)", margin: "10px 0 0", lineHeight: 1.8 }}>
            図形を押すと選べます。<strong>文字は打った瞬間に反映</strong>され、位置と同じく保存されます。
          </p>
        </div>
      )}


      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <Button size="sm" variant="secondary" onClick={() => { update(DEFAULT); setSelected(null); }}>初期配置に戻す</Button>
        {sel && (
          <>
            <Badge variant="secondary">選択中: {sel.label}</Badge>
            <Button size="sm" variant="danger" onClick={() => { update(objs.filter((o) => o.id !== sel.id)); setSelected(null); }}>削除</Button>
          </>
        )}
        {saved && <span style={{ fontSize: 12, color: "var(--color-success, #16a34a)" }}>✓ 位置を保存しました</span>}
      </div>

      <div style={box}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>保存中の座標（localStorage）</div>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }}>
          {objs.map((o) => (
            <li key={o.id} style={{ fontFamily: "monospace", fontSize: 12, color: selected === o.id ? "var(--color-fg)" : "var(--color-muted)" }}>
              {o.label}: x={Math.round(o.x)}, y={Math.round(o.y)}
            </li>
          ))}
        </ul>
      </div>

      <p style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.8 }}>
        Pointer Events でマウス・タッチ両対応。位置は localStorage に保存しています（実運用では利用者ごとの設定として API / DB に保存）。
        グリッド並べ替え＋幅変更は <a href="/dashboard-grid" style={{ color: "var(--color-primary)" }}>ライブダッシュボード</a>、
        列間ドラッグは <a href="/kanban" style={{ color: "var(--color-primary)" }}>タスクボード</a> を参照してください。
      </p>
    </main>
  );
}
