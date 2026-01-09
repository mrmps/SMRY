import { createFileRoute } from "@tanstack/react-router";
import { PricingPage } from "@/components/pages/pricing-page";

export const Route = createFileRoute("/$locale/pricing")({
  component: PricingPage,
});
