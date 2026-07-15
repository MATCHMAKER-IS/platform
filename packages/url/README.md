# @platform/url

URL・ドメインの汎用処理。URL の解析/組み立て、クエリパラメータ操作、ドメイン抽出(eTLD+1)、
正規化、検証・安全性判定。記事の URL 構造は `@platform/blog`(permalink)、低レベルの
ネットワークは `@platform/net`。すべて純ロジック(標準の URL API を使用)。

## URL 解析・組み立て
```ts
import { parseUrl, buildUrl, getOrigin, getPath, isAbsoluteUrl } from "@platform/url";
parseUrl("https://ex.com:8080/blog/a?x=1#top");  // { protocol, hostname, port, pathname, search, hash, origin }
parseUrl("/foo", "https://ex.com");               // 相対URLはbaseで解決
buildUrl({ protocol: "https", hostname: "ex.com", pathname: "/a", search: "x=1" });
```

## クエリパラメータ操作(URLを保ったまま)
```ts
import { setParam, setParams, removeParam, appendParam, keepParams, parseQuery } from "@platform/url";
setParam("https://ex.com/a?x=1#top", "x", 9);     // "https://ex.com/a?x=9#top"
setParams(url, { page: 2, sort: "new", old: null });  // まとめて設定(null は削除)
keepParams(url, ["q", "page"]);                    // 許可リストのパラメータだけ残す
parseQuery("?a=1&b=2&a=3");                        // { a: ["1","3"], b: "2" }
```

## ドメイン抽出(eTLD+1)
```ts
import { getRegistrableDomain, getSubdomain, getTld, isSameDomain } from "@platform/url";
getRegistrableDomain("www.example.co.jp");   // "example.co.jp"(co.jp を考慮)
getSubdomain("a.b.example.com");             // "a.b"
getTld("example.co.jp");                     // "co.jp"
isSameDomain("www.example.com", "api.example.com");   // true(サブドメイン差を無視)
```
co.jp / ne.jp / co.uk など代表的な多段 TLD に対応(完全な Public Suffix List ではありません)。

## 正規化(比較・重複排除)
```ts
import { normalizeUrl, urlsEqual } from "@platform/url";
normalizeUrl("https://EX.com/blog/?utm_source=x&a=1");   // "https://ex.com/blog?a=1"
urlsEqual("https://EX.com/a/", "https://ex.com/a");       // true
```
ホスト小文字化・トラッキングパラメータ除去(utm_*/fbclid 等)・クエリソート・末尾スラッシュ除去。

## 検証・安全性
```ts
import { isValidUrl, isHttpUrl, isSafeUrl, isSameOrigin, isExternalUrl } from "@platform/url";
isSafeUrl("javascript:alert(1)");            // false(危険スキームを排除・XSS対策)
isHttpUrl("ftp://x");                         // false(http/https のみ)
isExternalUrl(userLink, "example.com");       // 外部リンク判定(rel="noopener" 付与等に)
isSameOrigin(a, b);                           // 同一オリジン判定
```
