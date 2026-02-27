import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

// Cache OG images for 1 hour
export const revalidate = 3600;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get("url");
  const titleParam = searchParams.get("title");
  const imageParam = searchParams.get("image");

  // Default values
  let title = titleParam || "Read articles without paywalls";
  let siteName = "smry.ai";
  let hostname = "";
  let articleImage = imageParam || "";

  if (url) {
    try {
      // Extract hostname for display
      const parsedUrl = new URL(url);
      hostname = parsedUrl.hostname.replace("www.", "");
      siteName = hostname;

      // If no title or image provided, try lightweight metadata endpoint
      // Uses Redis-only lookup (~1ms), no concurrency slot, ~200 bytes response
      if (!titleParam || !imageParam) {
        const apiBaseUrl = process.env.NEXT_PUBLIC_URL || "https://smry.ai";
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        try {
          const metaStart = Date.now();
          const response = await fetch(
            `${apiBaseUrl}/api/article/meta?url=${encodeURIComponent(url)}`,
            { signal: controller.signal }
          );
          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            const meta = data.meta;
            if (meta?.title && !titleParam) {
              title = meta.title;
            }
            if (meta?.siteName) {
              siteName = meta.siteName;
            }
            if (meta?.image && !imageParam) {
              articleImage = meta.image;
            }
            console.log(`[og] meta hit hostname=${hostname} source=${data.source} duration=${Date.now() - metaStart}ms`);
          } else {
            console.log(`[og] meta miss hostname=${hostname} status=${response.status} duration=${Date.now() - metaStart}ms`);
          }
        } catch (err) {
          clearTimeout(timeoutId);
          console.log(`[og] meta error hostname=${hostname} error=${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } catch {
      // Invalid URL, use defaults
    }
  }

  // Strip characters that can't be rendered by Latin fonts (Inter/Syne).
  // Non-Latin chars (CJK, Arabic, Hebrew, etc.) cause "Cannot convert argument
  // to a ByteString" crash in ImageResponse. Replace them with a space.
  // Exclude control chars (U+0000-U+001F), line/paragraph separators (U+2028-U+2029),
  // and BOM (U+FEFF) which are known Satori crash vectors.
  title = title
    .replace(/[\u0000-\u001F\u2028\u2029\uFEFF]/g, '')
    .replace(/[^\u0020-\u024F\u1E00-\u1EFF\u2010-\u2027\u2030-\u205E\u2070-\u209F\u20A0-\u20CF\u2100-\u214F]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim() || "Read articles without paywalls";

  // Also sanitize siteName and hostname for the same reason
  siteName = siteName.replace(/[\u0000-\u001F\u2028\u2029\uFEFF]/g, '').replace(/[^\u0020-\u024F\u1E00-\u1EFF\u2010-\u2027\u2030-\u205E]/g, ' ').replace(/\s{2,}/g, ' ').trim() || "smry.ai";
  hostname = hostname.replace(/[\u0000-\u001F\u2028\u2029\uFEFF]/g, '').replace(/[^\u0020-\u024F\u1E00-\u1EFF\u2010-\u2027\u2030-\u205E]/g, ' ').replace(/\s{2,}/g, ' ').trim();

  // Sanitize articleImage URL — non-ASCII chars in URLs crash ImageResponse
  // with "Cannot convert argument to a ByteString". Validate it's a proper http(s) URL
  // and use the encoded href (new URL() percent-encodes non-ASCII path segments).
  if (articleImage) {
    const originalImage = articleImage;
    try {
      const imgUrl = new URL(articleImage);
      if (imgUrl.protocol !== 'http:' && imgUrl.protocol !== 'https:') {
        articleImage = "";
        console.log(`[og] image dropped: bad protocol="${imgUrl.protocol}" hostname=${hostname}`);
      } else {
        // Use encoded URL — this percent-encodes any CJK/non-ASCII chars in the path
        articleImage = imgUrl.href;
        if (articleImage !== originalImage) {
          console.log(`[og] image re-encoded hostname=${hostname}`);
        }
      }
    } catch {
      articleImage = ""; // Invalid URL (e.g., relative path), skip image
      console.log(`[og] image dropped: invalid URL hostname=${hostname} url=${originalImage.slice(0, 100)}`);
    }
  }

  // Extra safety: drop data: URIs (can be huge), and URLs that still have non-ASCII after encoding
  if (articleImage) {
    if (articleImage.startsWith('data:')) {
      console.log(`[og] image dropped: data URI hostname=${hostname}`);
      articleImage = "";
    } else if (/[^\x20-\x7E]/.test(articleImage)) {
      console.log(`[og] image dropped: non-ASCII in encoded URL hostname=${hostname}`);
      articleImage = "";
    }
  }

  // Truncate title if too long
  if (title.length > 80) {
    title = title.substring(0, 77) + "...";
  }

  // Load fonts with error handling
  let syneBold: ArrayBuffer;
  let interRegular: ArrayBuffer;
  let interMedium: ArrayBuffer;

  try {
    [syneBold, interRegular, interMedium] = await Promise.all([
      fetch(
        "https://fonts.gstatic.com/s/syne/v24/8vIS7w4qzmVxsWxjBZRjr0FKM_3fvj6k.ttf"
      ).then((r) => r.arrayBuffer()),
      fetch(
        "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf"
      ).then((r) => r.arrayBuffer()),
      fetch(
        "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYMZg.ttf"
      ).then((r) => r.arrayBuffer()),
    ]);
  } catch {
    // Font loading failed - return a simple fallback image
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#09090b",
            color: "#ffffff",
            fontSize: 64,
            fontWeight: 700,
          }}
        >
          smry.ai
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

  // Wrap in try-catch to handle any remaining ByteString crashes from Satori/resvg.
  // Sanitization covers most cases, but remote image response headers or edge-case
  // characters can still crash ImageResponse. A safe fallback prevents 500s.
  try {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#09090b",
          padding: "60px",
          position: "relative",
        }}
      >
        {/* Article image as background (if available) */}
        {articleImage && (
          <img
            src={articleImage}
            alt=""
            width="1200"
            height="630"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: 1200,
              height: 630,
              objectFit: "cover",
              objectPosition: "center",
              opacity: 0.35,
            }}
          />
        )}
        {/* Dark overlay for readability */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: articleImage
              ? "linear-gradient(to bottom, rgba(9, 9, 11, 0.7) 0%, rgba(9, 9, 11, 0.95) 100%)"
              : "radial-gradient(ellipse at top left, rgba(94, 105, 209, 0.15) 0%, transparent 50%)",
          }}
        />

        {/* Content container */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            height: "100%",
            zIndex: 10,
          }}
        >
          {/* Top: smry branding */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <div
              style={{
                fontFamily: "Syne",
                fontSize: 48,
                fontWeight: 700,
                color: "#ffffff",
                letterSpacing: "-0.02em",
              }}
            >
              smry
            </div>
            <div
              style={{
                width: "2px",
                height: "32px",
                backgroundColor: "#27272a",
              }}
            />
            <div
              style={{
                fontFamily: "Inter",
                fontSize: 24,
                color: "#71717a",
              }}
            >
              {hostname || "Read without paywalls"}
            </div>
          </div>

          {/* Middle: Article title */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              flex: 1,
              justifyContent: "center",
              paddingRight: "40px",
            }}
          >
            <div
              style={{
                fontFamily: "Inter",
                fontSize: title.length > 60 ? 42 : 52,
                fontWeight: 500,
                color: "#fafafa",
                lineHeight: 1.2,
                letterSpacing: "-0.02em",
              }}
            >
              {title}
            </div>
          </div>

          {/* Bottom: Source info */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 20px",
                backgroundColor: "#18181b",
                borderRadius: "12px",
                border: "1px solid #27272a",
              }}
            >
              <div
                style={{
                  fontFamily: "Inter",
                  fontSize: 18,
                  color: "#a1a1aa",
                }}
              >
                Source:
              </div>
              <div
                style={{
                  fontFamily: "Inter",
                  fontSize: 18,
                  fontWeight: 500,
                  color: "#e4e4e7",
                }}
              >
                {siteName}
              </div>
            </div>

            <div
              style={{
                fontFamily: "Inter",
                fontSize: 18,
                color: "#52525b",
              }}
            >
              smry.ai
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Syne", data: syneBold, weight: 700 as const },
        { name: "Inter", data: interRegular, weight: 400 as const },
        { name: "Inter", data: interMedium, weight: 500 as const },
      ],
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
      },
    }
  );
  } catch (err) {
    console.error(`[og] ImageResponse crashed hostname=${hostname} title=${title.slice(0, 50)} hasImage=${!!articleImage} error=${err instanceof Error ? err.message : String(err)}`);

    // Fallback: minimal safe image with no dynamic content or external images
    try {
      return new ImageResponse(
        (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#09090b",
              gap: "16px",
            }}
          >
            <div style={{ color: "#ffffff", fontSize: 64, fontWeight: 700 }}>
              smry
            </div>
            <div style={{ color: "#71717a", fontSize: 24 }}>
              Read without paywalls
            </div>
          </div>
        ),
        {
          width: 1200,
          height: 630,
          headers: {
            "Cache-Control": "public, max-age=60, s-maxage=60",
          },
        }
      );
    } catch {
      // Ultimate fallback: return a 302 redirect or plain response
      return new Response("smry.ai", {
        status: 200,
        headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=60" },
      });
    }
  }
}
