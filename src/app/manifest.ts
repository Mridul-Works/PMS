import type { MetadataRoute } from "next";

/** Lets phones "Add to home screen" and open the app full-screen, like an installed app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Site Manager",
    short_name: "Site Manager",
    description: "Construction site tracker – attendance, wages, materials, expenses",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f5f4",
    theme_color: "#ea580c",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
