/** CSRF トークンを発行し、cookie にセットして返す(double-submit 用に非 httpOnly)。 */
import { createCsrf } from "@platform/security";

const csrf = createCsrf({ secret: process.env.CSRF_SECRET ?? "showcase-demo-secret-change-me" });

export async function GET() {
  const token = csrf.issue();
  return new Response(JSON.stringify({ token }), {
    headers: {
      "content-type": "application/json",
      "set-cookie": `csrf=${token}; Path=/; SameSite=Lax`,
    },
  });
}
