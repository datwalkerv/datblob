import type { MetadataRoute } from "next";

/** Makes datblob installable, which iOS requires before it will deliver web push notifications. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "datblob",
    short_name: "datblob",
    description: "Temporary, private chat. Say it, then let it pop.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#141417",
    theme_color: "#141417",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
