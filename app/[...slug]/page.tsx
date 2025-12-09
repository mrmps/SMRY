"use server";

import { redirect } from "next/navigation";
import { normalizeInputUrl } from "@/lib/proxy-url";

export default async function RedirectPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const resolvedParams = await params;
  const slugSegments = resolvedParams?.slug ?? [];
  const slug = slugSegments.join("/");

  if (!slug) {
    redirect("/");
  }

  // Normalize first; call redirect outside the try to avoid catching NEXT_REDIRECT.
  let normalized: string | null = null;

  try {
    normalized = normalizeInputUrl(slug);
  } catch (error) {
    console.error("Failed to normalize path slug", slug, error);
    const fallbackRaw = /^https?:\/\//i.test(slug) ? slug : `https://${slug}`;
    try {
      normalized = normalizeInputUrl(fallbackRaw);
    } catch {
      normalized = fallbackRaw; // last resort, let proxy handle validation
    }
  }

  const proxyUrl = `/proxy?url=${encodeURIComponent(normalized)}`;
  redirect(proxyUrl);
}
