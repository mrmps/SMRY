import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Smry - AI-powered reader for any article";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  // Load Inter font (reliable Google font) for body text
  const interSemiBold = fetch(
    new URL("https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYAZ9hiJ-Ek-_EeA.woff2")
  ).then((res) => res.arrayBuffer());

  const interMedium = fetch(
    new URL("https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fAZ9hiJ-Ek-_EeA.woff2")
  ).then((res) => res.arrayBuffer());

  const [interSemiBoldData, interMediumData] = await Promise.all([
    interSemiBold,
    interMedium,
  ]);

  // Content types that smry can read - showing breadth/power
  const contentTypes = [
    "Paywalled News",
    "Research Papers",
    "Academic Journals",
    "Long-form Articles",
  ];

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#09090b",
          padding: "56px 72px",
          position: "relative",
        }}
      >
        {/* Subtle gradient glow from top */}
        <div
          style={{
            position: "absolute",
            top: "-200px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "800px",
            height: "500px",
            background: "radial-gradient(ellipse at center, rgba(120, 119, 198, 0.12) 0%, transparent 70%)",
          }}
        />

        {/* Secondary glow from bottom right */}
        <div
          style={{
            position: "absolute",
            bottom: "-100px",
            right: "-100px",
            width: "400px",
            height: "400px",
            background: "radial-gradient(circle at center, rgba(59, 130, 246, 0.08) 0%, transparent 70%)",
          }}
        />

        {/* Top bar - brand and tagline */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
          }}
        >
          <span
            style={{
              fontFamily: "Inter",
              fontSize: 42,
              fontWeight: 600,
              color: "#fafafa",
              letterSpacing: "-0.04em",
            }}
          >
            smry
          </span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              borderRadius: 8,
              backgroundColor: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            <span
              style={{
                fontFamily: "Inter",
                fontSize: 15,
                fontWeight: 500,
                color: "rgba(250, 250, 250, 0.6)",
                letterSpacing: "0.02em",
              }}
            >
              AI-POWERED READER
            </span>
          </div>
        </div>

        {/* Main headline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "center",
            gap: 8,
            marginTop: -20,
          }}
        >
          <span
            style={{
              fontFamily: "Inter",
              fontSize: 80,
              fontWeight: 600,
              color: "#fafafa",
              letterSpacing: "-0.04em",
              lineHeight: 1.05,
            }}
          >
            Read anything.
          </span>
          <span
            style={{
              fontFamily: "Inter",
              fontSize: 80,
              fontWeight: 600,
              background: "linear-gradient(90deg, rgba(250, 250, 250, 0.5) 0%, rgba(250, 250, 250, 0.25) 100%)",
              backgroundClip: "text",
              color: "transparent",
              letterSpacing: "-0.04em",
              lineHeight: 1.05,
            }}
          >
            Summarize instantly.
          </span>
        </div>

        {/* Bottom section: badges + domain */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            width: "100%",
          }}
        >
          {/* Content type badges */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            {contentTypes.map((type) => (
              <div
                key={type}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "10px 18px",
                  borderRadius: 100,
                  backgroundColor: "rgba(255, 255, 255, 0.06)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                }}
              >
                <span
                  style={{
                    fontFamily: "Inter",
                    fontSize: 15,
                    fontWeight: 500,
                    color: "rgba(250, 250, 250, 0.7)",
                  }}
                >
                  {type}
                </span>
              </div>
            ))}
          </div>

          {/* Domain */}
          <span
            style={{
              fontFamily: "Inter",
              fontSize: 18,
              fontWeight: 500,
              color: "rgba(250, 250, 250, 0.4)",
            }}
          >
            smry.ai
          </span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Inter",
          data: interSemiBoldData,
          style: "normal",
          weight: 600,
        },
        {
          name: "Inter",
          data: interMediumData,
          style: "normal",
          weight: 500,
        },
      ],
    }
  );
}
