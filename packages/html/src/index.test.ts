import { describe, it, expect } from "vitest";
import {
  escapeHtml, unescapeHtml, stripTags,
  normalizeNewlines, nl2br, zenkakuSpaceToHankaku, collapseWhitespace, normalizeSpace, stripControlChars,
  zenkakuToHankaku, hankakuToZenkaku, zenkakuDigitsToHankaku,
  textToHtml, truncate, linkify,
  escapeAttribute, embedScript, inlineScript, embedIframe, trackingPixel, embedHtml, embedAsText,
} from "./index";

describe("escapeHtml(XSS 対策の基本)", () => {
  it("`&<>\"'` を実体参照にする", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  it("**script タグが実行されない形になる**", () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("**`&` を最初に置換する**(二重エスケープにならない)", () => {
    // & を後で置換すると &lt; が &amp;lt; になる
    expect(escapeHtml("<")).toBe("&lt;");
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });

  it("属性を閉じる引用符も潰す(属性への注入を防ぐ)", () => {
    expect(escapeHtml('" onerror="alert(1)')).toBe("&quot; onerror=&quot;alert(1)");
  });

  it("普通の文字列・空文字はそのまま", () => {
    expect(escapeHtml("こんにちは 123")).toBe("こんにちは 123");
    expect(escapeHtml("")).toBe("");
  });
});

describe("unescapeHtml", () => {
  it("主要な実体参照を戻す", () => {
    expect(unescapeHtml("&amp;&lt;&gt;&quot;&#39;")).toBe(`&<>"'`);
  });

  it("`'` の別表記(&#x27; / &apos;)も戻す", () => {
    expect(unescapeHtml("&#x27;&apos;")).toBe("''");
  });

  it("&nbsp; は半角空白にする", () => {
    expect(unescapeHtml("a&nbsp;b")).toBe("a b");
  });

  it("知らない実体参照はそのまま残す(壊さない)", () => {
    expect(unescapeHtml("&copy;&hearts;")).toBe("&copy;&hearts;");
  });

  it("escapeHtml と往復できる", () => {
    for (const s of [`a&b<c>d"e'f`, "普通の文字列", ""]) {
      expect(unescapeHtml(escapeHtml(s))).toBe(s);
    }
  });
});

describe("stripTags", () => {
  it("タグを取り除いてテキストだけにする", () => {
    expect(stripTags("<p>本文<strong>強調</strong></p>")).toBe("本文強調");
  });

  it("属性つきタグ・自己終了タグも取る", () => {
    expect(stripTags('<img src="x.png" alt="図">後'))
      .toBe("後");
  });

  it("**これはサニタイズではない**(中身のテキストは残る)", () => {
    // タグを取るだけなので、安全な HTML を作る用途には使えない
    expect(stripTags("<script>alert(1)</script>")).toBe("alert(1)");
  });

  it("タグが無ければそのまま", () => {
    expect(stripTags("ただの文字列")).toBe("ただの文字列");
  });
});

describe("改行・空白", () => {
  it("normalizeNewlines は CRLF / CR を LF に揃える", () => {
    expect(normalizeNewlines("a\r\nb\rc\nd")).toBe("a\nb\nc\nd");
  });

  it("nl2br は改行を <br> にする(改行自体は残す)", () => {
    expect(nl2br("a\nb")).toBe("a<br>\nb");
  });

  it("nl2br は xhtml 指定で <br />", () => {
    expect(nl2br("a\nb", { xhtml: true })).toBe("a<br />\nb");
  });

  it("nl2br は CRLF も扱える", () => {
    expect(nl2br("a\r\nb")).toBe("a<br>\nb");
  });

  it("zenkakuSpaceToHankaku は全角空白を半角に", () => {
    expect(zenkakuSpaceToHankaku("a　b")).toBe("a b");
  });

  it("collapseWhitespace は**改行を残して**連続空白を 1 つにする", () => {
    // 改行まで潰すと、段落の区切りが消える
    expect(collapseWhitespace("a   b\t\tc")).toBe("a b c");
    expect(collapseWhitespace("a  \n  b")).toBe("a \n b");
  });

  it("normalizeSpace は全角空白も含めて整え、前後を落とす", () => {
    expect(normalizeSpace("　 a　　b 　")).toBe("a b");
  });

  it("stripControlChars は制御文字と BOM を落とす", () => {
    expect(stripControlChars("a\u0000b\u001Fc\uFEFF")).toBe("abc");
  });

  it("stripControlChars は改行・タブを残す(意味のある空白)", () => {
    expect(stripControlChars("a\nb\tc")).toBe("a\nb\tc");
  });
});

describe("全角・半角", () => {
  it("zenkakuToHankaku は英数記号を半角にする", () => {
    expect(zenkakuToHankaku("ＡＢＣ１２３")).toBe("ABC123");
  });

  it("hankakuToZenkaku は英数を全角にする", () => {
    expect(hankakuToZenkaku("ABC123")).toBe("ＡＢＣ１２３");
  });

  it("往復すると元に戻る", () => {
    expect(zenkakuToHankaku(hankakuToZenkaku("Xyz789"))).toBe("Xyz789");
  });

  it("zenkakuDigitsToHankaku は**数字だけ**を半角にする", () => {
    // 氏名の英字は全角のまま残したいが、電話番号や金額は半角にしたい場面がある
    expect(zenkakuDigitsToHankaku("ＡＢＣ１２３")).toBe("ＡＢＣ123");
  });

  it("日本語はそのまま", () => {
    expect(zenkakuToHankaku("山田太郎")).toBe("山田太郎");
    expect(zenkakuDigitsToHankaku("山田太郎")).toBe("山田太郎");
  });
});

describe("textToHtml", () => {
  it("**エスケープしてから改行変換する**(順序が逆だと <br> まで消える)", () => {
    expect(textToHtml("a<b>\nc")).toBe("a&lt;b&gt;<br>\nc");
  });

  it("script を入れても実行される形にならない", () => {
    expect(textToHtml("<script>alert(1)</script>")).not.toContain("<script>");
  });
});

describe("truncate", () => {
  it("最大長を超えたら省略記号つきで切る", () => {
    expect(truncate("あいうえおかきく", 5)).toBe("あいうえ…");
  });

  it("**省略記号を含めて最大長に収める**", () => {
    expect(truncate("あいうえおかきく", 5).length).toBe(5);
  });

  it("短ければそのまま", () => {
    expect(truncate("あい", 5)).toBe("あい");
    expect(truncate("あいうえお", 5)).toBe("あいうえお");
  });

  it("省略記号を変えられる", () => {
    expect(truncate("abcdefg", 5, "...")).toBe("ab...");
  });

  it("省略記号が最大長以上なら記号を付けない(記号だけになるのを防ぐ)", () => {
    expect(truncate("abcdefg", 2, "...")).toBe("ab");
  });

  it("負の最大長はそのまま返す(壊さない)", () => {
    expect(truncate("abc", -1)).toBe("abc");
  });
});

describe("linkify", () => {
  it("URL を <a> にする", () => {
    const html = linkify("詳細は https://example.com/a を見てください");
    expect(html).toContain('<a href="https://example.com/a"');
    expect(html).toContain("を見てください");
  });

  it("**既定で noopener noreferrer を付ける**(タブナビング対策)", () => {
    // 付けないとリンク先の JS から元ページを操作できる
    expect(linkify("https://example.com")).toContain('rel="noopener noreferrer"');
    expect(linkify("https://example.com")).toContain('target="_blank"');
  });

  it("**先にエスケープしてからリンク化する**(URL 以外の HTML が実行されない)", () => {
    const html = linkify('<script>alert(1)</script> https://example.com');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("href では &amp; を & に戻す(クエリが壊れない)", () => {
    const html = linkify("https://example.com/?a=1&b=2");
    expect(html).toContain('href="https://example.com/?a=1&b=2"');
    // 表示テキスト側はエスケープされたまま
    expect(html).toContain("&amp;b=2</a>");
  });

  it("複数の URL を扱える", () => {
    const html = linkify("https://a.example と https://b.example");
    expect((html.match(/<a /g) ?? []).length).toBe(2);
  });

  it("URL が無ければリンクを作らない", () => {
    expect(linkify("リンクはありません")).toBe("リンクはありません");
  });

  it("**target / rel / className の 3 つともエスケープする**", () => {
    // 以前は className だけで、target / rel は素通しだった。
    // `_blank" onload="…` のように任意の属性を差し込めてしまう
    for (const opts of [
      { target: '_blank" onload="alert(1)' },
      { rel: 'x" onmouseover="alert(1)' },
      { className: 'x" onload="alert(1)' },
    ]) {
      const html = linkify("https://example.com", opts);
      expect(html).not.toContain('onload="alert(1)"');
      expect(html).not.toContain('onmouseover="alert(1)"');
      expect(html).toContain("&quot;");
    }
  });

  it("既定値はそのまま出る(エスケープで壊れない)", () => {
    const html = linkify("https://example.com");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("javascript: は URL とみなさない(http/https のみ)", () => {
    expect(linkify("javascript:alert(1)")).not.toContain("<a ");
  });
});

describe("escapeAttribute", () => {
  it("`&` `\"` `<` を潰す(属性からの脱出を防ぐ)", () => {
    expect(escapeAttribute('a"b&c<d')).toBe("a&quot;b&amp;c&lt;d");
  });

  it("**引用符を閉じて新しい属性を差し込めない**", () => {
    const attr = escapeAttribute('" onerror="alert(1)');
    expect(attr).not.toContain('"');
  });
});

describe("埋め込みタグの生成", () => {
  it("embedScript は src つきの script タグを作る", () => {
    expect(embedScript("https://cdn.example/a.js")).toBe('<script src="https://cdn.example/a.js"></script>');
  });

  it("async / defer は**値なし属性**として出す", () => {
    const tag = embedScript("https://cdn.example/a.js", { async: true, defer: false });
    expect(tag).toContain(" async");
    expect(tag).not.toContain("defer");
  });

  it("属性値はエスケープされる", () => {
    expect(embedScript('https://x/?a="b')).toContain("&quot;");
  });

  it("inlineScript は**中身をそのまま出す**(信頼済みのコード専用)", () => {
    expect(inlineScript("var a = 1 < 2;")).toBe("<script>var a = 1 < 2;</script>");
  });

  it("embedIframe は既定で lazy 読み込みにしない(指定したものだけ出す)", () => {
    const tag = embedIframe("https://www.example/embed", { width: 560, height: 315, title: "動画" });
    expect(tag).toContain('src="https://www.example/embed"');
    expect(tag).toContain('width="560"');
    expect(tag).toContain('title="動画"');
  });

  it("trackingPixel は画像タグを作る", () => {
    expect(trackingPixel("https://t.example/p.gif")).toContain('<img src="https://t.example/p.gif"');
  });

  it("embedHtml は**信頼済みの生 HTML をそのまま通す**", () => {
    expect(embedHtml("<b>そのまま</b>")).toBe("<b>そのまま</b>");
  });

  it("embedAsText は HTML をエスケープして見せる(タグを文字として表示)", () => {
    expect(embedAsText("<b>x</b>")).toContain("&lt;b&gt;");
  });
});
