import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/** App icon: orange square with "SM" (no emoji, so nothing is fetched from the network). */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ea580c",
          borderRadius: 96,
          color: "white",
          fontSize: 230,
          fontWeight: 800,
          letterSpacing: -8,
        }}
      >
        SM
      </div>
    ),
    size,
  );
}
