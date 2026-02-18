import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { isPrivateIP, BLOCKED_HOSTNAMES } from "@/lib/validation/url";

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

      // If no title or image provided, try to fetch article data
      if (!titleParam || !imageParam) {
        const apiBaseUrl = process.env.NEXT_PUBLIC_URL || "https://smry.ai";
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        try {
          const response = await fetch(
            `${apiBaseUrl}/api/article/auto?url=${encodeURIComponent(url)}`,
            {
              signal: controller.signal,
            }
          );
          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            if (data.article?.title && !titleParam) {
              title = data.article.title;
            }
            if (data.article?.siteName) {
              siteName = data.article.siteName;
            }
            if (data.article?.image && !imageParam) {
              articleImage = data.article.image;
            }
          }
        } catch {
          clearTimeout(timeoutId);
        }
      }
    } catch {
      // Invalid URL, use defaults
    }
  }

  // Truncate title if too long
  if (title.length > 80) {
    title = title.substring(0, 77) + "...";
  }

  // Validate articleImage to prevent SSRF attacks
  // Reject any image URL pointing to private/internal IPs or blocked hostnames
  if (articleImage) {
    try {
      const imageUrl = new URL(articleImage);
      
      // Only allow http/https protocols
      if (imageUrl.protocol !== "http:" && imageUrl.protocol !== "https:") {
        articleImage = "";
      } else {
        const imageHost = imageUrl.hostname;
        
        // Check if hostname is a private IP address or blocked hostname
        if (isPrivateIP(imageHost) || BLOCKED_HOSTNAMES.has(imageHost)) {
          articleImage = ""; // Clear potentially malicious image URL
        }
      }
    } catch {
      // Invalid URL format, clear the image
      articleImage = "";
    }
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
          // eslint-disable-next-line @next/next/no-img-element
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
}
