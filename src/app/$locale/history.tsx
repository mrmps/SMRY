import { createFileRoute } from "@tanstack/react-router";
import { HistoryPage } from "@/components/pages/history-page";

export const Route = createFileRoute("/$locale/history")({
  component: HistoryPage,
});
