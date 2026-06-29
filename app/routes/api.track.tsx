import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { recordOfferEvent } from "../models/offers.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ ok: false }, { status: 405 });
  }

  let body: { eventType?: string; ruleId?: string };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = body.eventType;
  if (!eventType || !["impression", "click"].includes(eventType)) {
    return json({ ok: false, error: "Invalid eventType" }, { status: 400 });
  }

  const { sessionToken, cors } = await authenticate.public.checkout(request);
  const shop = sessionToken.dest.replace("https://", "");

  await recordOfferEvent(shop, eventType, body.ruleId);

  return cors(json({ ok: true }));
};

export const loader = async ({ request }: ActionFunctionArgs) => {
  const { cors } = await authenticate.public.checkout(request);
  return cors(json({ ok: true }));
};
