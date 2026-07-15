/** 保護ページ。Server Component で requireSession し、未ログインなら /session へリダイレクト。 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession } from "@platform/guard";
import { session } from "../../server/session";

export default async function Page() {
  const cookieHeader = (await cookies()).toString();
  let data: { email: string; loginAt: number };
  try {
    data = requireSession(cookieHeader, session);
  } catch {
    redirect("/session");
  }

  return (
    <main style={{ maxWidth: 460, margin: "3rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>ダッシュボード(保護ページ)</h1>
      <p style={{ marginTop: ".5rem" }}>ようこそ、<strong>{data!.email}</strong> さん。</p>
      <p style={{ color: "var(--color-muted)", fontSize: ".85rem", marginTop: ".5rem" }}>
        このページは requireSession で保護されており、未ログインだと /session に飛ばされます。
      </p>
      <p style={{ marginTop: "1.5rem" }}><a href="/session">セッション管理へ</a> / <a href="/">← 戻る</a></p>
    </main>
  );
}
