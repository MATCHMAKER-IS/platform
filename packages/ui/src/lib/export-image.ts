/**
 * DOM 要素内の SVG(recharts 等)を PNG 画像として書き出す。ブラウザ専用・依存なし。
 * @packageDocumentation
 */

/** {@link elementToPng} のオプション。 */
export interface ExportPngOptions {
  /** 解像度倍率(既定 2 = 高精細)。 */
  scale?: number;
  /** 背景色(既定 "#ffffff"。透明にするなら "transparent")。 */
  background?: string;
}

/**
 * 要素内の最初の SVG を PNG としてダウンロードする。
 * @param element グラフを含む DOM 要素
 * @param filename 例 "chart.png"
 */
export async function elementToPng(element: HTMLElement, filename: string, options: ExportPngOptions = {}): Promise<void> {
  if (typeof document === "undefined") return;
  const svg = element.querySelector("svg");
  if (!svg) return;
  const { scale = 2, background = "#ffffff" } = options;

  const rect = svg.getBoundingClientRect();
  const width = rect.width || Number(svg.getAttribute("width")) || 600;
  const height = rect.height || Number(svg.getAttribute("height")) || 400;

  const clone = svg.cloneNode(true) as SVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));

  const data = new XMLSerializer().serializeToString(clone);
  const svgUrl = URL.createObjectURL(new Blob([data], { type: "image/svg+xml;charset=utf-8" }));

  try {
    const img = new Image();
    img.width = width;
    img.height = height;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("SVG の読み込みに失敗しました"));
      img.src = svgUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (background !== "transparent") {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);

    await new Promise<void>((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
        resolve();
      }, "image/png");
    });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
