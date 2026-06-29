import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { recordOfferEvent } from "../models/offers.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  const url = new URL(request.url);
  const eventType = url.searchParams.get("event");
  const ruleId = url.searchParams.get("ruleId") ?? undefined;

  if (!eventType || !["impression", "click"].includes(eventType)) {
    return json({ ok: false, error: "Invalid event" }, { status: 400 });
  }

  await recordOfferEvent(session.shop, eventType, ruleId);

  return json({ ok: true });
};
