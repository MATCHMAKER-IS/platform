import * as React from "react";
import { SlideGallery } from "@platform/ui";
import { type RenderedBlock } from "../server/site-content";

/** 描画モデルの配列を React 要素にする。text は安全な HTML（エスケープ済み）を挿入。 */
export function BlockRenderer({ blocks }: { blocks: RenderedBlock[] }) {
  return (
    <div className="flex flex-col gap-4">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "heading": {
            const Tag = (`h${Math.min(6, Math.max(1, b.level))}`) as "h1";
            return <Tag key={i} className="font-bold">{b.text}</Tag>;
          }
          case "text":
            return <div key={i} className="leading-relaxed" dangerouslySetInnerHTML={{ __html: b.html }} />;
          case "image":
            return <img key={i} src={b.src} alt={b.alt} className="rounded" loading="lazy" />;
          case "list":
            return (
              <ul key={i} className="list-disc pl-5">
                {b.items.map((it, j) => <li key={j}>{it}</li>)}
              </ul>
            );
          case "cta":
            return <a key={i} href={b.href} className="w-fit rounded bg-black px-4 py-2 text-white">{b.label}</a>;
          case "gallery":
            return <SlideGallery key={i} images={b.images} />;
          case "embed":
            return <div key={i} className="[&_iframe]:aspect-video [&_iframe]:w-full" dangerouslySetInnerHTML={{ __html: b.html }} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
