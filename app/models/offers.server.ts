import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import prisma from "../db.server";

export type TriggerType = "product" | "collection" | "min_order";

export type OfferRuleInput = {
  enabled?: boolean;
  triggerType: TriggerType;
  triggerProductId?: string;
  triggerProductTitle?: string;
  triggerCollectionId?: string;
  triggerCollectionTitle?: string;
  minOrderAmount?: number;
  offerProductId: string;
  offerProductTitle: string;
  offerVariantId: string;
  discountPercent?: number;
};

export type PulseConfig = {
  enabled: boolean;
  rules: Array<{
    id: string;
    enabled: boolean;
    triggerType: TriggerType;
    triggerProductId: string;
    triggerCollectionId: string;
    minOrderAmount: number;
    offerProductId: string;
    offerProductTitle: string;
    offerVariantId: string;
    discountPercent: number;
  }>;
};

const METAFIELD_NAMESPACE = "$app:checkout_pulse";
const METAFIELD_KEY = "config";

export async function getOfferRules(shop: string) {
  return prisma.offerRule.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
  });
}

export async function createOfferRule(shop: string, data: OfferRuleInput) {
  return prisma.offerRule.create({
    data: {
      shop,
      enabled: data.enabled ?? true,
      triggerType: data.triggerType,
      triggerProductId: data.triggerProductId ?? "",
      triggerProductTitle: data.triggerProductTitle ?? "",
      triggerCollectionId: data.triggerCollectionId ?? "",
      triggerCollectionTitle: data.triggerCollectionTitle ?? "",
      minOrderAmount: data.minOrderAmount ?? 0,
      offerProductId: data.offerProductId,
      offerProductTitle: data.offerProductTitle,
      offerVariantId: data.offerVariantId,
      discountPercent: data.discountPercent ?? 10,
    },
  });
}

export async function deleteOfferRule(shop: string, id: string) {
  return prisma.offerRule.deleteMany({
    where: { id, shop },
  });
}

export async function toggleOfferRule(
  shop: string,
  id: string,
  enabled: boolean,
) {
  return prisma.offerRule.updateMany({
    where: { id, shop },
    data: { enabled },
  });
}

export async function recordOfferEvent(
  shop: string,
  eventType: string,
  ruleId?: string,
  orderId?: string,
) {
  return prisma.offerEvent.create({
    data: { shop, eventType, ruleId, orderId },
  });
}

export async function getOfferStats(shop: string) {
  const [impressions, clicks, conversions, ruleCount] = await Promise.all([
    prisma.offerEvent.count({ where: { shop, eventType: "impression" } }),
    prisma.offerEvent.count({ where: { shop, eventType: "click" } }),
    prisma.offerEvent.count({ where: { shop, eventType: "conversion" } }),
    prisma.offerRule.count({ where: { shop, enabled: true } }),
  ]);

  const ctr =
    impressions > 0 ? ((clicks / impressions) * 100).toFixed(1) : "0.0";
  const conversionRate =
    clicks > 0 ? ((conversions / clicks) * 100).toFixed(1) : "0.0";

  return { impressions, clicks, conversions, ruleCount, ctr, conversionRate };
}

export async function syncConfigToMetafield(
  admin: AdminApiContext,
  shop: string,
) {
  const rules = await getOfferRules(shop);
  const config: PulseConfig = {
    enabled: rules.some((rule) => rule.enabled),
    rules: rules.map((rule) => ({
      id: rule.id,
      enabled: rule.enabled,
      triggerType: rule.triggerType as TriggerType,
      triggerProductId: rule.triggerProductId,
      triggerCollectionId: rule.triggerCollectionId,
      minOrderAmount: rule.minOrderAmount,
      offerProductId: rule.offerProductId,
      offerProductTitle: rule.offerProductTitle,
      offerVariantId: rule.offerVariantId,
      discountPercent: rule.discountPercent,
    })),
  };

  const shopResponse = await admin.graphql(
    `#graphql
      query CheckoutPulseShopId {
        shop {
          id
        }
      }
    `,
  );
  const shopJson = await shopResponse.json();
  const shopId = shopJson.data?.shop?.id;
  if (!shopId) {
    throw new Error("Unable to resolve shop id for metafield sync");
  }

  const response = await admin.graphql(
    `#graphql
      mutation CheckoutPulseSetConfig($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            namespace
            key
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      variables: {
        metafields: [
          {
            ownerId: shopId,
            namespace: METAFIELD_NAMESPACE,
            key: METAFIELD_KEY,
            type: "json",
            value: JSON.stringify(config),
          },
        ],
      },
    },
  );

  const json = await response.json();
  const userErrors = json.data?.metafieldsSet?.userErrors ?? [];
  if (userErrors.length) {
    throw new Error(userErrors.map((e: { message: string }) => e.message).join(", "));
  }

  return config;
}

export async function purgeShopData(shop: string) {
  await prisma.offerEvent.deleteMany({ where: { shop } });
  await prisma.offerRule.deleteMany({ where: { shop } });
}
