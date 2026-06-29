import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { recordOfferEvent } from "../models/offers.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const order = payload as {
    id?: number;
    line_items?: Array<{
      properties?: Array<{ name: string; value: string }>;
    }>;
  };

  const hasUpsell = order.line_items?.some((line) =>
    line.properties?.some(
      (property) =>
        property.name === "_upsell_accepted" && property.value === "1",
    ),
  );

  if (hasUpsell) {
    await recordOfferEvent(
      shop,
      "conversion",
      undefined,
      order.id ? String(order.id) : undefined,
    );
  }

  return new Response();
};
