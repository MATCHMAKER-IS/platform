/** 外部API仕様(OpenAPI 3.0 JSON)。開発者向け。認証不要。 */
import { withApiObservability } from "../../../../server/instrument";
import { openApiSpec } from "../../../../server/api-reference";

async function handleGET(req: Request): Promise<Response> {
  const origin = new URL(req.url).origin;
  return Response.json(openApiSpec(origin));
}

export const GET = withApiObservability("/api/v1/openapi", handleGET);
