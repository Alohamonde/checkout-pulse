import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Button,
  BlockStack,
  Text,
  Banner,
  ResourceList,
  ResourceItem,
  Thumbnail,
  InlineStack,
  Select,
  Badge,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { useCallback, useEffect, useState } from "react";
import { authenticate } from "../shopify.server";
import {
  createOfferRule,
  deleteOfferRule,
  getOfferRules,
  syncConfigToMetafield,
  toggleOfferRule,
  type TriggerType,
} from "../models/offers.server";
import {
  searchCollections,
  searchProducts,
  type SearchCollection,
  type SearchProduct,
} from "../models/products.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const rules = await getOfferRules(session.shop);
  return json({ rules });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent"));

  if (intent === "search_products") {
    const query = String(formData.get("query") ?? "");
    const products = await searchProducts(admin, query);
    return json({ products });
  }

  if (intent === "search_collections") {
    const query = String(formData.get("query") ?? "");
    const collections = await searchCollections(admin, query);
    return json({ collections });
  }

  if (intent === "create") {
    await createOfferRule(session.shop, {
      triggerType: String(formData.get("triggerType")) as TriggerType,
      triggerProductId: String(formData.get("triggerProductId") ?? ""),
      triggerProductTitle: String(formData.get("triggerProductTitle") ?? ""),
      triggerCollectionId: String(formData.get("triggerCollectionId") ?? ""),
      triggerCollectionTitle: String(formData.get("triggerCollectionTitle") ?? ""),
      minOrderAmount: Number(formData.get("minOrderAmount") ?? 0),
      offerProductId: String(formData.get("offerProductId")),
      offerProductTitle: String(formData.get("offerProductTitle")),
      offerVariantId: String(formData.get("offerVariantId")),
      discountPercent: Number(formData.get("discountPercent") ?? 10),
    });
    await syncConfigToMetafield(admin, session.shop);
    return json({ ok: true, message: "Offer 规则已创建" });
  }

  if (intent === "delete") {
    await deleteOfferRule(session.shop, String(formData.get("id")));
    await syncConfigToMetafield(admin, session.shop);
    return json({ ok: true, message: "规则已删除" });
  }

  if (intent === "toggle") {
    await toggleOfferRule(
      session.shop,
      String(formData.get("id")),
      formData.get("enabled") === "true",
    );
    await syncConfigToMetafield(admin, session.shop);
    return json({ ok: true, message: "规则状态已更新" });
  }

  return json({ ok: false }, { status: 400 });
};

const triggerOptions = [
  { label: "订单含指定商品", value: "product" },
  { label: "订单含指定系列", value: "collection" },
  { label: "订单金额达标", value: "min_order" },
];

function triggerLabel(type: string) {
  if (type === "collection") return "系列";
  if (type === "min_order") return "最低订单金额";
  return "商品";
}

export default function OffersPage() {
  const { rules } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const searchFetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const [triggerType, setTriggerType] = useState<TriggerType>("product");
  const [triggerQuery, setTriggerQuery] = useState("");
  const [offerQuery, setOfferQuery] = useState("");
  const [triggerProduct, setTriggerProduct] = useState<SearchProduct | null>(null);
  const [triggerCollection, setTriggerCollection] =
    useState<SearchCollection | null>(null);
  const [minOrderAmount, setMinOrderAmount] = useState("50");
  const [offerProduct, setOfferProduct] = useState<SearchProduct | null>(null);
  const [discountPercent, setDiscountPercent] = useState("15");

  const searchProductsAction = useCallback(
    (field: "trigger" | "offer") => {
      const query = field === "trigger" ? triggerQuery : offerQuery;
      const payload = new FormData();
      payload.append("intent", "search_products");
      payload.append("query", query);
      payload.append("field", field);
      searchFetcher.submit(payload, { method: "POST" });
    },
    [offerQuery, searchFetcher, triggerQuery],
  );

  const searchCollectionsAction = useCallback(() => {
    const payload = new FormData();
    payload.append("intent", "search_collections");
    payload.append("query", triggerQuery);
    payload.append("field", "trigger");
    searchFetcher.submit(payload, { method: "POST" });
  }, [searchFetcher, triggerQuery]);

  const createRule = useCallback(() => {
    if (!offerProduct) return;
    if (triggerType === "product" && !triggerProduct) return;
    if (triggerType === "collection" && !triggerCollection) return;

    const payload = new FormData();
    payload.append("intent", "create");
    payload.append("triggerType", triggerType);
    payload.append("triggerProductId", triggerProduct?.id ?? "");
    payload.append("triggerProductTitle", triggerProduct?.title ?? "");
    payload.append("triggerCollectionId", triggerCollection?.id ?? "");
    payload.append("triggerCollectionTitle", triggerCollection?.title ?? "");
    payload.append("minOrderAmount", minOrderAmount);
    payload.append("offerProductId", offerProduct.id);
    payload.append("offerProductTitle", offerProduct.title);
    payload.append("offerVariantId", offerProduct.variantId);
    payload.append("discountPercent", discountPercent);
    fetcher.submit(payload, { method: "POST" });
  }, [
    discountPercent,
    fetcher,
    minOrderAmount,
    offerProduct,
    triggerCollection,
    triggerProduct,
    triggerType,
  ]);

  const products = (searchFetcher.data?.products ?? []) as SearchProduct[];
  const collections = (searchFetcher.data?.collections ?? []) as SearchCollection[];
  const searchField = String(searchFetcher.formData?.get("field") ?? "");

  useEffect(() => {
    if (fetcher.data?.message) {
      shopify.toast.show(fetcher.data.message);
    }
  }, [fetcher.data, shopify]);

  const canCreate =
    offerProduct &&
    ((triggerType === "product" && triggerProduct) ||
      (triggerType === "collection" && triggerCollection) ||
      (triggerType === "min_order" && Number(minOrderAmount) > 0));

  return (
    <Page title="Offer 规则" subtitle="配置购后追加销售触发条件与推荐商品">
      <TitleBar title="Offer 规则" />
      <BlockStack gap="500">
        <Banner tone="info">
          <p>
            规则保存后会同步到 Shop Metafield，Checkout UI Extension 与 Discount
            Function 将自动读取。请确保在结账编辑器中启用 <strong>Thank You Upsell</strong> 区块。
          </p>
        </Banner>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  新建 Offer 规则
                </Text>
                <FormLayout>
                  <Select
                    label="触发条件"
                    options={triggerOptions}
                    value={triggerType}
                    onChange={(value) => setTriggerType(value as TriggerType)}
                  />

                  {triggerType === "product" && (
                    <>
                      <InlineStack gap="300" blockAlign="end">
                        <div style={{ flex: 1 }}>
                          <TextField
                            label="触发商品搜索"
                            value={triggerQuery}
                            onChange={setTriggerQuery}
                            autoComplete="off"
                          />
                        </div>
                        <Button onClick={() => searchProductsAction("trigger")}>
                          搜索
                        </Button>
                      </InlineStack>
                      {searchField === "trigger" && products.length > 0 && (
                        <ResourceList
                          items={products}
                          renderItem={(item) => (
                            <ResourceItem
                              id={item.id}
                              media={
                                <Thumbnail source={item.imageUrl || ""} alt={item.title} />
                              }
                              onClick={() => setTriggerProduct(item)}
                            >
                              <Text as="span">{item.title}</Text>
                            </ResourceItem>
                          )}
                        />
                      )}
                      {triggerProduct && (
                        <Text as="p">已选触发商品：{triggerProduct.title}</Text>
                      )}
                    </>
                  )}

                  {triggerType === "collection" && (
                    <>
                      <InlineStack gap="300" blockAlign="end">
                        <div style={{ flex: 1 }}>
                          <TextField
                            label="触发系列搜索"
                            value={triggerQuery}
                            onChange={setTriggerQuery}
                            autoComplete="off"
                          />
                        </div>
                        <Button onClick={searchCollectionsAction}>搜索</Button>
                      </InlineStack>
                      {searchField === "trigger" && collections.length > 0 && (
                        <ResourceList
                          items={collections}
                          renderItem={(item) => (
                            <ResourceItem
                              id={item.id}
                              media={
                                <Thumbnail source={item.imageUrl || ""} alt={item.title} />
                              }
                              onClick={() => setTriggerCollection(item)}
                            >
                              <Text as="span">{item.title}</Text>
                            </ResourceItem>
                          )}
                        />
                      )}
                      {triggerCollection && (
                        <Text as="p">已选系列：{triggerCollection.title}</Text>
                      )}
                    </>
                  )}

                  {triggerType === "min_order" && (
                    <TextField
                      label="最低订单金额"
                      type="number"
                      value={minOrderAmount}
                      onChange={setMinOrderAmount}
                      autoComplete="off"
                      helpText="订单小计达到该金额时展示 Offer"
                    />
                  )}

                  <InlineStack gap="300" blockAlign="end">
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="推荐商品搜索"
                        value={offerQuery}
                        onChange={setOfferQuery}
                        autoComplete="off"
                      />
                    </div>
                    <Button onClick={() => searchProductsAction("offer")}>搜索</Button>
                  </InlineStack>
                  {searchField === "offer" && products.length > 0 && (
                    <ResourceList
                      items={products}
                      renderItem={(item) => (
                        <ResourceItem
                          id={item.id}
                          media={
                            <Thumbnail source={item.imageUrl || ""} alt={item.title} />
                          }
                          onClick={() => setOfferProduct(item)}
                        >
                          <Text as="span">{item.title}</Text>
                        </ResourceItem>
                      )}
                    />
                  )}
                  {offerProduct && (
                    <Text as="p">已选推荐商品：{offerProduct.title}</Text>
                  )}

                  <TextField
                    label="追加购折扣 (%)"
                    type="number"
                    value={discountPercent}
                    onChange={setDiscountPercent}
                    autoComplete="off"
                  />
                </FormLayout>

                <Button
                  variant="primary"
                  disabled={!canCreate}
                  loading={fetcher.state !== "idle"}
                  onClick={createRule}
                >
                  保存规则
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  已有规则 ({rules.length})
                </Text>
                {rules.length === 0 ? (
                  <Text as="p">暂无规则</Text>
                ) : (
                  rules.map((rule) => (
                    <BlockStack key={rule.id} gap="100">
                      <InlineStack gap="200">
                        <Badge tone={rule.enabled ? "success" : undefined}>
                          {rule.enabled ? "启用" : "停用"}
                        </Badge>
                        <Text as="p" variant="bodyMd">
                          {triggerLabel(rule.triggerType)} → {rule.offerProductTitle}
                        </Text>
                      </InlineStack>
                      <Text as="p" tone="subdued">
                        折扣 {rule.discountPercent}%
                      </Text>
                      <InlineStack gap="200">
                        <Button
                          onClick={() =>
                            fetcher.submit(
                              {
                                intent: "toggle",
                                id: rule.id,
                                enabled: String(!rule.enabled),
                              },
                              { method: "POST" },
                            )
                          }
                        >
                          {rule.enabled ? "停用" : "启用"}
                        </Button>
                        <Button
                          tone="critical"
                          onClick={() =>
                            fetcher.submit(
                              { intent: "delete", id: rule.id },
                              { method: "POST" },
                            )
                          }
                        >
                          删除
                        </Button>
                      </InlineStack>
                    </BlockStack>
                  ))
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
