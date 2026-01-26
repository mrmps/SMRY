import { ImageResponse } from "next/og";

export const alt = "smry - Read Anything, Summarize Everything";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Subtle noise for organic variation
function noise2D(x: number, y: number, seed: number): number {
  const gradients = [
    [1, 1], [-1, 1], [1, -1], [-1, -1],
    [1, 0], [-1, 0], [0, 1], [0, -1],
  ];
  const dot = (gx: number, gy: number, dx: number, dy: number) => gx * dx + gy * dy;
  const getGradient = (ix: number, iy: number) => {
    const hash = Math.abs(Math.sin(ix * 12.9898 + iy * 78.233 + seed) * 43758.5453) % 1;
    return gradients[Math.floor(hash * 8)];
  };
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const sx = x - x0, sy = y - y0;
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const u = fade(sx), v = fade(sy);
  const g00 = getGradient(x0, y0), g10 = getGradient(x0 + 1, y0);
  const g01 = getGradient(x0, y0 + 1), g11 = getGradient(x0 + 1, y0 + 1);
  const n00 = dot(g00[0], g00[1], sx, sy), n10 = dot(g10[0], g10[1], sx - 1, sy);
  const n01 = dot(g01[0], g01[1], sx, sy - 1), n11 = dot(g11[0], g11[1], sx - 1, sy - 1);
  return ((n00 * (1 - u) + n10 * u) * (1 - v) + (n01 * (1 - u) + n11 * u) * v + 1) / 2;
}

// Halftone: visible texture pattern
function generateHalftone(seed: number, width: number, height: number) {
  const dots: { x: number; y: number; size: number; opacity: number }[] = [];
  const spacing = 20;
  const centerX = width / 2, centerY = height / 2;

  for (let y = 0; y < height; y += spacing) {
    for (let x = 0; x < width; x += spacing) {
      const dx = (x - centerX) / (width / 2);
      const dy = (y - centerY) / (height / 2);
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 0.3) continue;

      const edgeFade = Math.min(1, (dist - 0.3) / 0.7);
      const n = noise2D(x * 0.012, y * 0.012, seed);

      if (n > 0.25) {
        const intensity = (n - 0.25) / 0.75 * edgeFade;
        dots.push({
          x, y,
          size: 4 + intensity * 6,
          opacity: 0.35 + intensity * 0.45,
        });
      }
    }
  }
  return dots;
}

export default async function TwitterImage() {
  const [syneBold, interRegular] = await Promise.all([
    fetch("https://fonts.gstatic.com/s/syne/v24/8vIS7w4qzmVxsWxjBZRjr0FKM_3fvj6k.ttf").then(r => r.arrayBuffer()),
    fetch("https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf").then(r => r.arrayBuffer()),
  ]);

  const dots = generateHalftone(42, size.width, size.height);

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
          position: "relative",
        }}
      >
        {/* Subtle halftone texture */}
        {dots.map((dot, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: dot.x - dot.size / 2,
              top: dot.y - dot.size / 2,
              width: dot.size,
              height: dot.size,
              borderRadius: "50%",
              backgroundColor: `rgba(94, 105, 209, ${dot.opacity})`,
            }}
          />
        ))}

        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            zIndex: 10,
          }}
        >
          <div
            style={{
              fontFamily: "Syne",
              fontSize: 140,
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: "-0.02em",
            }}
          >
            smry
          </div>

          <div
            style={{
              fontFamily: "Inter",
              fontSize: 32,
              fontWeight: 500,
              color: "#d4d4d8",
              marginTop: 20,
              letterSpacing: "0.01em",
            }}
          >
            Read anything. Summarize everything.
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 56,
              padding: "14px 24px",
              borderRadius: 10,
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
            }}
          >
            <span
              style={{
                fontFamily: "Inter",
                fontSize: 20,
                fontWeight: 500,
                color: "#d4d4d8",
                letterSpacing: "-0.01em",
              }}
            >
              smry.ai/
            </span>
            <span
              style={{
                fontFamily: "Inter",
                fontSize: 20,
                fontWeight: 400,
                color: "#71717a",
                letterSpacing: "-0.01em",
              }}
            >
              paste any article URL
            </span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Syne", data: syneBold, weight: 700 as const },
        { name: "Inter", data: interRegular, weight: 400 as const },
      ],
    }
  );
}
