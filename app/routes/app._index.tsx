import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  Button,
  Badge,
  InlineGrid,
  Banner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getOfferRules, getOfferStats } from "../models/offers.server";
import {
  ensureUpsellDiscount,
  getUpsellDiscountStatus,
} from "../models/upsell-discount.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const [stats, rules, discountBefore] = await Promise.all([
    getOfferStats(shop),
    getOfferRules(shop),
    getUpsellDiscountStatus(admin),
  ]);

  const discountResult = await ensureUpsellDiscount(admin);
  const discount = discountResult.ok
    ? { ...discountResult, status: discountResult.status ?? discountBefore.status }
    : { ...discountResult, status: discountBefore.status };

  return json({
    stats,
    totalRules: rules.length,
    discount,
  });
};

export default function Index() {
  const { stats, totalRules, discount } = useLoaderData<typeof loader>();

  return (
    <Page
      title="Checkout Pulse"
      subtitle="购后追加销售：感谢页 Offer + 自动折扣 + 转化分析"
    >
      <TitleBar title="Checkout Pulse" />
      <BlockStack gap="500">
        {!discount.ok ? (
          <Banner tone="critical">
            <p>
              自动折扣创建失败：
              {discount.errors?.[0]?.message || "请刷新页面重试"}
            </p>
          </Banner>
        ) : discount.created || discount.repaired ? (
          <Banner tone="success">
            <p>
              已{discount.created ? "创建" : "修复"}自动折扣「Checkout Pulse Upsell」
              （{discount.status}）。
            </p>
          </Banner>
        ) : null}

        <Layout>
          <Layout.Section>
            <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    活跃规则
                  </Text>
                  <Text as="p" variant="heading2xl">
                    {stats.ruleCount}
                  </Text>
                  <Text as="p" tone="subdued">
                    共 {totalRules} 条规则
                  </Text>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    展示次数
                  </Text>
                  <Text as="p" variant="heading2xl">
                    {stats.impressions}
                  </Text>
                  <Text as="p" tone="subdued">
                    感谢页 Offer 曝光
                  </Text>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    点击率
                  </Text>
                  <Text as="p" variant="heading2xl">
                    {stats.ctr}%
                  </Text>
                  <Text as="p" tone="subdued">
                    点击 {stats.clicks} 次
                  </Text>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    成交转化
                  </Text>
                  <Text as="p" variant="heading2xl">
                    {stats.conversions}
                  </Text>
                  <Text as="p" tone="subdued">
                    转化率 {stats.conversionRate}%
                  </Text>
                </BlockStack>
              </Card>
            </InlineGrid>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  模块概览
                </Text>
                <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">
                      购后追加销售
                    </Text>
                    <Badge tone="success">Checkout UI Extension</Badge>
                    <Text as="p">
                      在订单感谢页根据规则展示推荐商品，引导顾客一键加购。
                    </Text>
                  </BlockStack>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">
                      追加购折扣
                    </Text>
                    <Badge tone="info">Shopify Function</Badge>
                    <Text as="p">
                      对带 <code>_upsell_accepted</code> 标记的商品行自动应用百分比折扣。
                    </Text>
                  </BlockStack>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">
                      转化仪表盘
                    </Text>
                    <Badge>Webhook + Analytics</Badge>
                    <Text as="p">
                      追踪展示、点击与 orders/paid 成交归因。
                    </Text>
                  </BlockStack>
                </InlineGrid>
                <Button url="/app/offers" variant="primary">
                  管理 Offer 规则
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
