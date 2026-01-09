import { createFileRoute } from "@tanstack/react-router";
import {
  proxyLoader,
  proxyHead,
  proxySearchSchema,
  ProxyRouteView,
  ProxyLoading,
  ProxyErrorComponent,
} from "@/routes/shared/proxy-route";

export const Route = createFileRoute("/$locale/proxy")({
  validateSearch: (search) => proxySearchSchema.parse(search),
  loader: proxyLoader,
  head: proxyHead,
  errorComponent: ProxyErrorComponent,
  pendingComponent: ProxyLoading,
  component: LocaleProxyRoute,
});

function LocaleProxyRoute() {
  const data = Route.useLoaderData();
  return <ProxyRouteView data={data} />;
}
