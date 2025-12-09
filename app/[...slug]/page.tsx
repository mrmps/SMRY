import { redirect } from "next/navigation";
import { normalizeUrl } from "@/lib/validation/url";

// Server Component - redirect happens once on the server
export default async function RedirectPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const resolvedParams = await params;
  const slug = (resolvedParams?.slug ?? []).join("/");

  if (!slug) {
    redirect("/");
  }

  // Normalize the URL - handles decoding, protocol repair, and validation
  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeUrl(slug);
  } catch {
    // Fallback: try adding https:// if not present
    const fallback = /^https?:\/\//i.test(slug) ? slug : `https://${slug}`;
    try {
      normalizedUrl = normalizeUrl(fallback);
    } catch {
      // Last resort - let proxy handle validation
      normalizedUrl = fallback;
    }
  }

  redirect(`/proxy?url=${encodeURIComponent(normalizedUrl)}`);
}
