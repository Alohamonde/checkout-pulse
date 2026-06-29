import { useEffect, useMemo, useState } from "react";
import {
  Banner,
  BlockStack,
  Button,
  InlineLayout,
  Text,
  useApi,
  useOrder,
} from "@shopify/ui-extensions-react/checkout";

const CONFIG_QUERY = `#graphql
  query CheckoutPulseConfig {
    shop {
      metafield(namespace: "$app:checkout_pulse", key: "config") {
        value
      }
    }
  }
`;

const PRODUCT_COLLECTIONS_QUERY = `#graphql
  query ProductCollections($id: ID!) {
    product(id: $id) {
      collections(first: 20) {
        nodes {
          id
        }
      }
    }
  }
`;

function numericId(gid) {
  if (!gid) return "";
  return String(gid).split("/").pop();
}

function parseConfig(raw) {
  if (!raw) return { enabled: false, rules: [] };
  try {
    return JSON.parse(raw);
  } catch {
    return { enabled: false, rules: [] };
  }
}

export function UpsellOffer() {
  const { query, shop } = useApi();
  const order = useOrder();
  const [config, setConfig] = useState({ enabled: false, rules: [] });
  const [matchedRule, setMatchedRule] = useState(null);
  const [tracked, setTracked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadConfig() {
      const response = await query(CONFIG_QUERY);
      if (cancelled) return;
      const value = response?.data?.shop?.metafield?.value;
      setConfig(parseConfig(value));
    }

    loadConfig();
    return () => {
      cancelled = true;
    };
  }, [query]);

  const lineProductIds = useMemo(() => {
    return (
      order?.lineItems
        ?.map((line) => line.merchandise?.product?.id)
        .filter(Boolean) ?? []
    );
  }, [order]);

  const orderSubtotal = useMemo(() => {
    const subtotal = order?.cost?.subtotalAmount?.amount;
    return subtotal ? Number(subtotal) : 0;
  }, [order]);

  useEffect(() => {
    let cancelled = false;

    async function matchRule() {
      if (!config.enabled || !config.rules?.length || !order) {
        setMatchedRule(null);
        return;
      }

      for (const rule of config.rules) {
        if (rule.enabled === false) continue;

        if (rule.triggerType === "product") {
          if (lineProductIds.includes(rule.triggerProductId)) {
            if (!cancelled) setMatchedRule(rule);
            return;
          }
        }

        if (rule.triggerType === "min_order") {
          if (orderSubtotal >= Number(rule.minOrderAmount || 0)) {
            if (!cancelled) setMatchedRule(rule);
            return;
          }
        }

        if (rule.triggerType === "collection" && rule.triggerCollectionId) {
          for (const productId of lineProductIds) {
            const response = await query(PRODUCT_COLLECTIONS_QUERY, {
              variables: { id: productId },
            });
            const collectionIds =
              response?.data?.product?.collections?.nodes?.map(
                (node) => node.id,
              ) ?? [];
            if (collectionIds.includes(rule.triggerCollectionId)) {
              if (!cancelled) setMatchedRule(rule);
              return;
            }
          }
        }
      }

      if (!cancelled) setMatchedRule(null);
    }

    matchRule();
    return () => {
      cancelled = true;
    };
  }, [config, lineProductIds, order, orderSubtotal, query]);

  useEffect(() => {
    if (!matchedRule || tracked) return;

    async function trackImpression() {
      try {
        const storefrontUrl =
          shop.storefrontUrl || `https://${shop.myshopifyDomain}`;
        await fetch(
          `${storefrontUrl}/apps/checkout-pulse/track?event=impression&ruleId=${encodeURIComponent(matchedRule.id)}`,
        );
        setTracked(true);
      } catch {
        // Analytics should not block checkout UI.
      }
    }

    trackImpression();
  }, [matchedRule, shop, tracked]);

  if (!matchedRule) {
    return null;
  }

  const variantNumericId = numericId(matchedRule.offerVariantId);
  const cartUrl = `/cart/${variantNumericId}:1?properties[_upsell_accepted]=1`;

  async function handleClick() {
    try {
      const storefrontUrl =
        shop.storefrontUrl || `https://${shop.myshopifyDomain}`;
      await fetch(
        `${storefrontUrl}/apps/checkout-pulse/track?event=click&ruleId=${encodeURIComponent(matchedRule.id)}`,
      );
    } catch {
      // Ignore tracking errors.
    }
  }

  return (
    <Banner title="专属追加优惠" status="success">
      <BlockStack spacing="tight">
        <Text>
          感谢购买！加购「{matchedRule.offerProductTitle}」可享{" "}
          {matchedRule.discountPercent}% 折扣。
        </Text>
        <InlineLayout columns={["fill", "auto"]} spacing="base">
          <Text appearance="subdued">结账时自动应用折扣</Text>
          <Button to={cartUrl} onPress={handleClick}>
            立即加购
          </Button>
        </InlineLayout>
      </BlockStack>
    </Banner>
  );
}
