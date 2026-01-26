import { ImageResponse } from "next/og";

export const alt = "Smry - AI-powered reader for any article";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#09090b",
        }}
      >
        <div style={{ color: "#fafafa", fontSize: 64 }}>smry</div>
        <div style={{ color: "#888", fontSize: 32, marginTop: 20 }}>
          Read anything. Summarize instantly.
        </div>
      </div>
    ),
    { ...size }
  );
}
