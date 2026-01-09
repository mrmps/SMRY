import { createFileRoute } from "@tanstack/react-router";
import { HardPaywallsPage } from "@/components/pages/hard-paywalls-page";

export const Route = createFileRoute("/hard-paywalls")({
  component: HardPaywallsPage,
});
