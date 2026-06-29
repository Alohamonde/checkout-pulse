import {
  DiscountClass,
  ProductDiscountSelectionStrategy,
} from "../generated/api";

function isUpsellLine(line) {
  return Boolean(line.upsell && line.upsell.value);
}

function variantIdOf(line) {
  return line.merchandise && line.merchandise.id ? line.merchandise.id : null;
}

function resolveRules(config) {
  if (!config || !Array.isArray(config.rules)) return [];

  return config.rules
    .filter((rule) => rule.enabled !== false)
    .map((rule) => ({
      offerVariantId: rule.offerVariantId,
      discountPercent: Number(rule.discountPercent) || 0,
    }))
    .filter((rule) => rule.offerVariantId && rule.discountPercent > 0);
}

export function cartLinesDiscountsGenerateRun(input) {
  const lines = input.cart.lines;
  if (!lines.length) return { operations: [] };

  if (!input.discount.discountClasses.includes(DiscountClass.Product)) {
    return { operations: [] };
  }

  const config = input.shop?.metafield?.jsonValue ?? null;
  if (config && config.enabled === false) {
    return { operations: [] };
  }

  const rules = resolveRules(config);
  if (!rules.length) return { operations: [] };

  const percentByVariant = {};
  for (const rule of rules) {
    percentByVariant[rule.offerVariantId] = Math.min(
      100,
      Math.max(0, rule.discountPercent),
    );
  }

  const candidates = [];

  for (const line of lines) {
    if (!isUpsellLine(line)) continue;

    const variantId = variantIdOf(line);
    const percent = percentByVariant[variantId];
    if (!percent) continue;

    candidates.push({
      message: `Checkout Pulse ${percent}% OFF`,
      targets: [{ cartLine: { id: line.id } }],
      value: { percentage: { value: percent } },
    });
  }

  if (!candidates.length) return { operations: [] };

  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates,
          selectionStrategy: ProductDiscountSelectionStrategy.All,
        },
      },
    ],
  };
}
