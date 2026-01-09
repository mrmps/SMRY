import { createFileRoute } from "@tanstack/react-router";
import { HomeContent } from "@/components/features/home-content";

export const Route = createFileRoute("/$locale/")({
  component: HomeContent,
});
