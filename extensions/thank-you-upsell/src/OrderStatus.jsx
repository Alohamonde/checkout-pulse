import { reactExtension } from "@shopify/ui-extensions-react/checkout";
import { UpsellOffer } from "./Upsell.jsx";

export default reactExtension(
  "customer-account.order-status.block.render",
  () => <UpsellOffer />,
);
