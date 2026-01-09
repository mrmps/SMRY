import { createFileRoute } from "@tanstack/react-router";
import AdminDashboard from "@/components/pages/admin-dashboard";

export const Route = createFileRoute("/admin")({
  component: AdminDashboard,
});
