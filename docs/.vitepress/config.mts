import { fileURLToPath } from "node:url";
import { defineConfig } from "vitepress";

const BASE = "/markdown-pdf-export/";

export default defineConfig({
  title: "Markdown PDF Export",
  description: "Turn Markdown into a PDF worth sending, with your header, footer, page numbers and logo.",
  base: BASE,
  appearance: "dark",
  cleanUrls: true,

  head: [
    ["link", { rel: "icon", type: "image/png", href: `${BASE}logo.png` }],
    ["meta", { name: "theme-color", content: "#262624" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:site_name", content: "Markdown PDF Export" }],
  ],

  // Main pages: one quiet column, no sidebar. Advanced and reference keep the docs layout.
  transformPageData(page) {
    const detailed = /^(advanced|reference)\//.test(page.relativePath);
    if (!detailed && page.frontmatter.layout !== "page") {
      page.frontmatter.sidebar ??= false;
      page.frontmatter.aside ??= false;
      page.frontmatter.outline ??= false;
      page.frontmatter.pageClass ??= "simple";
    }
  },

  vite: {
    server: { fs: { allow: [fileURLToPath(new URL("../..", import.meta.url))] } },
  },

  themeConfig: {
    logo: "/logo.png",
    siteTitle: "Markdown PDF",

    nav: [
      { text: "Get started", link: "/start" },
      { text: "Studio", link: "/studio" },
      { text: "Your editor", link: "/editors" },
      { text: "Design online", link: "/online" },
      { text: "Help", link: "/help" },
      { text: "Advanced", link: "/advanced/", activeMatch: "^/(advanced|reference)/" },
    ],

    sidebar: {
      "/advanced/": sidebarAdvanced(),
      "/reference/": sidebarAdvanced(),
    },

    socialLinks: [{ icon: "github", link: "https://github.com/matinfo/markdown-pdf-export" }],

    footer: { message: "Released under the MIT License." },

    search: { provider: "local" },

    editLink: {
      pattern: "https://github.com/matinfo/markdown-pdf-export/edit/main/docs/:path",
      text: "Improve this page on GitHub",
    },
  },
});

function sidebarAdvanced() {
  return [
    {
      text: "Advanced",
      items: [
        { text: "Overview", link: "/advanced/" },
        { text: "Settings file", link: "/advanced/settings-file" },
        { text: "Per-document options", link: "/advanced/per-document" },
        { text: "Header and footer", link: "/advanced/header-footer" },
        { text: "Styles, fonts and code", link: "/advanced/styling" },
        { text: "Maths, contents, emoji", link: "/advanced/content" },
        { text: "Recipes", link: "/advanced/recipes" },
      ],
    },
    {
      text: "Tools",
      items: [
        { text: "Command line", link: "/advanced/cli" },
        { text: "AI assistant tools", link: "/advanced/assistant-tools" },
        { text: "Browser", link: "/advanced/browser" },
      ],
    },
    {
      text: "Reference",
      items: [
        { text: "All settings", link: "/reference/settings" },
        { text: "Placeholders and dates", link: "/reference/placeholders" },
        { text: "Structured header and footer", link: "/reference/header-footer" },
      ],
    },
  ];
}
