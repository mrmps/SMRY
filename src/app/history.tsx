import { createFileRoute } from "@tanstack/react-router";
import { HistoryPage } from "@/components/pages/history-page";

export const Route = createFileRoute("/history")({
  component: HistoryPage,
});
