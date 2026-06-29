import { reactExtension } from "@shopify/ui-extensions-react/checkout";
import { UpsellOffer } from "./Upsell.jsx";

export default reactExtension(
  "purchase.thank-you.block.render",
  () => <UpsellOffer />,
);
