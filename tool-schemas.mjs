/**
* JSON-schema definitions shared by the MCP server (tools/list) and the CLI
* (option parsing / --help). Single source of truth for the export options.
*/
import { HIGHLIGHT_STYLES, ALLOWED_PAGE_FORMATS } from "./export.mjs";

export const EXPORT_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["input_path"],
  properties: {
    input_path: {
      type: "string",
      description: "Markdown file to export. Use an absolute path.",
    },
    output_path: {
      type: "string",
      description: "Optional output PDF path.",
    },
    stylesheet_path: {
      type: "string",
      description:
        "Optional CSS file applied after the built-in stylesheet.",
    },
    open_after_export: {
      type: "boolean",
      description: "Open the PDF after export.",
    },
    page_format: {
      type: "string",
      enum: [...ALLOWED_PAGE_FORMATS],
      description: "Paper format.",
    },
    print_background: {
      type: "boolean",
      description:
        "Whether to print background colours and images.",
    },
    margin: {
      type: "object",
      description:
        "Optional per-call page margins. Any omitted side falls back to settings/defaults.",
      additionalProperties: false,
      properties: {
        top: {
          type: "string",
          description: "Top margin, for example '10mm' or '0.5in'.",
        },
        right: {
          type: "string",
          description:
            "Right margin, for example '10mm' or '0.5in'.",
        },
        bottom: {
          type: "string",
          description:
            "Bottom margin, for example '10mm' or '0.5in'.",
        },
        left: {
          type: "string",
          description:
            "Left margin, for example '10mm' or '0.5in'.",
        },
      },
    },
    orientation: {
      type: "string",
      enum: ["portrait", "landscape"],
      description: "Paper orientation.",
    },
    scale: {
      type: "number",
      description: "Scale of the page rendering (default 1).",
    },
    page_ranges: {
      type: "string",
      description:
        "Paper ranges to print, e.g. '1-5, 8, 11-13'. Empty means all pages.",
    },
    include_default_styles: {
      type: "boolean",
      description: "Include the built-in default CSS stylesheet.",
    },
    highlight: {
      type: "boolean",
      description: "Enable syntax highlighting for code blocks.",
    },
    highlight_style: {
      type: "string",
      enum: [...HIGHLIGHT_STYLES].sort(),
      description:
        "Highlight.js style filename to use (e.g. 'github.css', 'monokai.css').",
    },
    breaks: {
      type: "boolean",
      description:
        "Enable hard line breaks in the Markdown renderer.",
    },
    emoji: {
      type: "boolean",
      description:
      "Render :emoji: shortcodes as Unicode characters.",
    },
    math: {
      type: "boolean",
      description:
        "Render LaTeX math via KaTeX. Use $inline$ and $$display$$ syntax.",
    },
    math_options: {
      type: "object",
      additionalProperties: false,
      description: "KaTeX rendering options.",
      properties: {
        throw_on_error: {
          type: "boolean",
          description:
            "If true, abort rendering on a LaTeX error. Default false (renders error inline).",
        },
        error_color: {
          type: "string",
          description: "CSS color used for inline error messages.",
        },
        macros: {
          type: "object",
          additionalProperties: { type: "string" },
          description:
          'User-defined LaTeX macros, e.g. {"\\\\RR": "\\\\mathbb{R}"}.',
        },
      },
    },
    heading_anchors: {
      type: "boolean",
      description:
        "Give each heading an id so [text](#heading) links and the table of contents work. On by default.",
    },
    toc: {
      type: "boolean",
      description:
        "Render a [[toc]] marker as an auto-generated table of contents (also enables heading anchors).",
    },
    toc_options: {
      type: "object",
      additionalProperties: false,
      description: "Table-of-contents rendering options.",
      properties: {
        level: {
          type: "array",
          items: { type: "number" },
          description: "Heading levels to include, e.g. [1, 2, 3].",
        },
        list_type: {
          type: "string",
          enum: ["ul", "ol"],
          description: "List type for the TOC.",
        },
      },
    },
    mermaid: {
      type: "boolean",
      description:
        "Draw ```mermaid code blocks as diagrams. A diagram that fails to parse stays a code block and is listed in diagram_errors. On by default.",
    },
    display_header_footer: {
      type: "boolean",
      default: false,
      description:
        "Display header and footer on each page. Content comes from `header` / `footer` (here, in settings or in front matter); without them the header and footer are empty. Enabled automatically when `header` or `footer` is given.",
    },
    header: {
      type: "object",
      description:
        "Structured page header as JSON. Shorthand keys: left_text, center_text, right_text, left_image, height. Placeholders: {title}, {date}, {page}, {pages}, {filename}, {author}. Example: {\"center_text\":\"{title}\",\"right_text\":\"{date}\"}. Replaces the header from settings; front matter still overrides it.",
    },
    footer: {
      type: "object",
      description:
        "Structured page footer as JSON, same shape as `header`. Example for page numbers: {\"center_text\":\"Page {page} of {pages}\"}. Replaces the footer from settings; front matter still overrides it.",
    },

    font_family: {
      type: "string",
      description:
      "CSS font-family value for the document body and header/footer. Overrides the default system font stack. Example: \"Georgia, 'Times New Roman', serif\".",
    },
    heading_font_family: {
      type: "string",
      description:
        "CSS font-family value for headings (h1-h6). Default: same as the body text.",
    },
    accent_color: {
      type: "string",
      pattern: "^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$",
      description:
        "Accent colour of the page style, as #rgb or #rrggbb: title rules, coloured titles, code block bars. Used by the report and technical looks; the others have no accent.",
    },
  },
};

export const DOCTOR_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    input_path: {
      type: "string",
      description:
        "Optional Markdown file used to resolve relative settings. Use an absolute path.",
    },
  },
};

export const INSTALL_BROWSER_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    force: {
      type: "boolean",
      description:
        "Download even when a working browser is already found. Default: false.",
    },
  },
};

export const OPEN_STUDIO_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    file: {
      type: "string",
      description:
        "Markdown file to preview instead of the built-in sample. Use an absolute path.",
    },
    project_folder: {
      type: "string",
      description:
        "Edit the settings of this folder only (its .markdown-pdf.json) instead of the user settings used by every document. Use an absolute path.",
    },
    open_browser: {
      type: "boolean",
      description:
        "Open Studio in the default browser. Default: true. The private link is returned either way.",
    },
  },
};

export const TOOLS = [
  {
    name: "export_markdown_pdf",
    title: "Export Markdown PDF",
    description:
      "Render a Markdown file to HTML and convert it to PDF with Playwright/Chromium. Raw HTML in the Markdown is filtered (no scripts, frames or event handlers) unless the user's settings file says otherwise; removed_html in the result lists what was taken out. ```mermaid blocks are drawn as diagrams; diagram_errors lists any that could not be drawn and were left as code.",
    inputSchema: EXPORT_INPUT_SCHEMA,
  },
  {
    name: "doctor_markdown_pdf",
    title: "Doctor Markdown PDF",
    description:
      "Inspect browser setup and current settings.",
    inputSchema: DOCTOR_INPUT_SCHEMA,
  },
  {
    name: "install_browser_markdown_pdf",
    title: "Install browser for Markdown PDF",
    description:
      "Download Playwright's Chromium (about 200 MB), the browser that draws the PDF. " +
      "Only needed when doctor_markdown_pdf reports no browser (no Chrome or Edge on this computer). " +
      "Ask the user before calling it. Returns status \"installing\" if the download is still running; " +
      "call doctor_markdown_pdf a minute later to check.",
    inputSchema: INSTALL_BROWSER_INPUT_SCHEMA,
  },
  {
    name: "open_studio_markdown_pdf",
    title: "Open Markdown PDF Studio",
    description:
      "Open Studio, a local page with a live PDF preview, to choose the page style, font, " +
      "header, footer and logo. Saved choices apply to every later export. " +
      "Use when the user wants to change how their PDFs look in general; for a one-off change, " +
      "pass arguments to export_markdown_pdf instead.",
    inputSchema: OPEN_STUDIO_INPUT_SCHEMA,
  },
];
