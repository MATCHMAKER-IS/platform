/** 郵便番号→住所の逆引き API(@platform/address、サーバ側)。 */
import { handleRoute } from "@platform/http";
import { createAddressLookup, createZipcloudAdapter } from "@platform/address";

const address = createAddressLookup(createZipcloudAdapter());

export const GET = handleRoute(async (req: Request) => {
  const zip = new URL(req.url).searchParams.get("zip") ?? "";
  const res = await address.lookup(zip);
  if (!res.ok) throw res.error;
  return Response.json({ results: res.value });
});
