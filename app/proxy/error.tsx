"use client";

import TopBar from "@/components/top-bar";
import UnderlineLink from "@/components/underline-link";
import { useRouter } from "next/navigation";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter()

  useEffect(() => {
  //   // Log the error to an error reporting service
  track('Proxy error', { location: pathname });
   }, [error, pathname])

  return (
    <div className="bg-zinc-50">
      <TopBar />
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-800">
          <div className="mx-auto max-w-md rounded-lg border bg-white p-8 text-center dark:bg-zinc-900">
            <h2
              id="error-title"
              className="mb-4 text-xl font-semibold tracking-tight text-zinc-800 dark:text-zinc-100"
            >
              Oops, something went wrong
            </h2>
            <p className="text-sm leading-7 text-zinc-600 dark:text-zinc-300">
              We&apos;ve logged the issue and are working on it. Click{" "}
              <button
                className={`cursor-pointer underline decoration-from-font underline-offset-2 hover:opacity-80`}
                onClick={() => {
                  router.refresh();
                  reset();
                }}
              >
                here
              </button>{" "}
              to try again, or{" "}
              <UnderlineLink href="/" text="read something else" />.
            </p>
            <p className="text-sm leading-7 text-zinc-600 dark:text-zinc-300 mt-3">
              Some providers still do not work with smry.ai. We are improving
              every day, but if the site you are trying to read is protected by
              a{" "}
              <UnderlineLink
                href="https://www.zuora.com/guides/what-is-a-hard-paywall/"
                text="hard paywall"
              />{" "}
              there is nothing we can do.
            </p>
            <p className="mt-6 text-sm leading-7 text-zinc-800 dark:text-zinc-100">
              Questions?{" "}
              <UnderlineLink href="/feedback" text="send us feedback" />.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
