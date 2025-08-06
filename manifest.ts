import { VitePWAOptions } from "vite-plugin-pwa";

const manifest: VitePWAOptions["manifest"] = {
  name: "TodoApp",
  short_name: "TodoApp",
  description: "A modern, feature-rich todo application",
  theme_color: "#1976d2",
  background_color: "#ffffff",
  display: "standalone",
  orientation: "portrait",
  scope: "/",
  start_url: "/",
  icons: [
    {
      src: "/pwa/icon-192x192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any maskable",
    },
    {
      src: "/pwa/icon-512x512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any maskable",
    },
  ],
  categories: ["productivity", "utilities"],
  lang: "en",
  dir: "ltr",
  prefer_related_applications: false,
  related_applications: [],
  screenshots: [],
  shortcuts: [
    {
      name: "Add Task",
      short_name: "Add",
      description: "Quickly add a new task",
      url: "/add-task",
      icons: [
        {
          src: "/pwa/icon-192x192.png",
          sizes: "192x192",
          type: "image/png",
        },
      ],
    },
  ],
};

export default manifest; 