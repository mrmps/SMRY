import { createFileRoute, redirect, notFound } from "@tanstack/react-router";
import { buildProxyRedirectPath } from "@/lib/proxy-redirect";

export const Route = createFileRoute("/$")({
  beforeLoad: ({ location }) => {
    const redirectPath = buildProxyRedirectPath(location.pathname, location.searchStr);
    if (redirectPath) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ to: redirectPath, replace: true });
    }
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw notFound();
  },
});
