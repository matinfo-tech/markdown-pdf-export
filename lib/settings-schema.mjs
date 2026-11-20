/**
 * @fileoverview JSON Schema for settings files (user settings.json and project
 * .markdown-pdf.json). Built from the MCP/CLI export schema so the three
 * surfaces cannot drift; header/footer definitions mirror lib/types.mjs.
 *
 * Generated file: schema/settings.schema.json (scripts/build-settings-schema.mjs).
 */
import { EXPORT_INPUT_SCHEMA } from "../tool-schemas.mjs";
import { LOOKS, FONTS, TEMPLATES } from "./looks.mjs";
import { BUILTIN_PLACEHOLDERS, ELEMENT_TYPES, SHORTHAND_MAPPINGS } from "./types.mjs";

export const SETTINGS_SCHEMA_URL =
  "https://matinfo-tech.github.io/markdown-pdf-export/schema/settings.schema.json";

/** Export options that make no sense in a settings file. */
const CALL_ONLY = new Set(["input_path", "output_path"]);

const css = (description, examples) => ({ type: "string", description, examples });

const COMMON_ELEMENT = {
  font_size: css("CSS font-size.", ["9px", "10pt"]),
  color: css("CSS color.", ["#666", "gray"]),
  style: css("Extra inline CSS, e.g. \"letter-spacing: 1px\"."),
};

const ELEMENT_PROPS = {
  text: {
    content: {
      type: "string",
      description: `Text; supports placeholders ${BUILTIN_PLACEHOLDERS.map((p) => `{${p}}`).join(", ")}.`,
    },
    font_weight: { type: ["string", "number"], description: "CSS font-weight." },
    font_style: { type: "string", enum: ["normal", "italic", "oblique"] },
    ...COMMON_ELEMENT,
  },
  image: {
    src: {
      type: "string",
      description:
        "SVG, PNG or JPG. Relative to the settings file; \"@/name.svg\" looks in assets_directory.",
    },
    height: css("CSS height.", ["12mm"]),
    width: css("CSS width (omit to keep the aspect ratio)."),
    alt: { type: "string" },
    style: COMMON_ELEMENT.style,
  },
  page_number: {
    format: { type: "string", description: "e.g. \"Page {page}\"." },
    ...COMMON_ELEMENT,
  },
  total_pages: {
    format: { type: "string", description: "e.g. \"{pages} pages\"." },
    ...COMMON_ELEMENT,
  },
  date: {
    format: { type: "string", description: "date-fns format, e.g. \"yyyy-MM-dd\"." },
    ...COMMON_ELEMENT,
  },
  title: {
    font_weight: { type: ["string", "number"] },
    fallback: { type: "string", description: "Used when the document has no title." },
    ...COMMON_ELEMENT,
  },
  spacer: {
    width: css("Fixed width; omitted = flexible."),
  },
};

const REQUIRED = { text: ["content"], image: ["src"] };

function elementDefinitions() {
  const defs = {};
  for (const type of ELEMENT_TYPES) {
    defs[`element_${type}`] = {
      type: "object",
      additionalProperties: false,
      required: ["type", ...(REQUIRED[type] ?? [])],
      properties: { type: { const: type }, ...ELEMENT_PROPS[type] },
    };
  }
  return defs;
}

function headerFooterDefinition() {
  const shorthands = {};
  for (const [key, { zone, property }] of Object.entries(SHORTHAND_MAPPINGS)) {
    shorthands[key] =
      property === "height"
        ? css(`Shorthand: height of the ${zone} image.`, ["12mm"])
        : key.endsWith("_image")
          ? { type: "string", description: `Shorthand: image in the ${zone} zone (relative to the settings file, or "@/name.svg").` }
          : { type: "string", description: `Shorthand: text in the ${zone} zone; placeholders allowed, e.g. "Page {page} of {pages}".` };
  }
  const zone = {
    description: "Element, array of elements, or null to clear the zone.",
    anyOf: [
      { $ref: "#/definitions/element" },
      { type: "array", items: { $ref: "#/definitions/element" } },
      { type: "null" },
    ],
  };
  return {
    type: ["object", "null"],
    additionalProperties: false,
    properties: {
      height: css("Height of the area.", ["15mm"]),
      padding: css("CSS padding.", ["0 15mm"]),
      font_family: { type: "string" },
      font_size: css("Default font-size.", ["9px"]),
      font_style: { type: "string", enum: ["normal", "italic", "oblique"] },
      font_weight: { type: ["string", "number"] },
      color: css("Default text color.", ["#666"]),
      background: { type: "string" },
      border_bottom: css("Header only.", ["1px solid #ddd"]),
      border_top: css("Footer only.", ["1px solid #eee"]),
      style: COMMON_ELEMENT.style,
      left: zone,
      center: zone,
      right: zone,
      ...shorthands,
    },
  };
}

/** @returns {object} draft-07 JSON Schema for a settings file */
export function buildSettingsSchema() {
  const properties = {
    $schema: { type: "string", description: "JSON Schema URL (for editor autocomplete)." },
  };
  for (const [name, def] of Object.entries(EXPORT_INPUT_SCHEMA.properties)) {
    if (CALL_ONLY.has(name)) continue;
    if (name === "header" || name === "footer") {
      properties[name] = {
        $ref: "#/definitions/header_footer",
        description: name === "header" ? "Page header." : "Page footer.",
      };
      continue;
    }
    properties[name] = structuredClone(def);
    if (name === "margin") properties[name].description = "Page margins.";
    if (name === "stylesheet_path") {
      properties[name].description =
        "CSS file applied after the built-in stylesheet (relative to this settings file).";
    }
  }
  properties.look = {
    type: "string",
    enum: Object.keys(LOOKS),
    description: `Page style preset: ${Object.entries(LOOKS).map(([k, v]) => `${k} (${v.description})`).join(" ")} Explicit keys in this file override it.`,
  };
  properties.font = {
    type: "string",
    enum: Object.keys(FONTS),
    description: "Font preset for the text. Use font_family for a custom stack.",
  };
  properties.heading_font = {
    type: "string",
    enum: Object.keys(FONTS),
    description: "Font preset for titles (h1-h6). Use heading_font_family for a custom stack.",
  };
  properties.template = {
    type: "string",
    enum: TEMPLATES,
    description: "Header/footer preset. Explicit header/footer keys in this file override it.",
  };
  properties.output_directory = {
    type: "string",
    description: "Folder for the PDFs, relative to each Markdown file. Default: next to it.",
  };
  properties.assets_directory = {
    type: "string",
    description: "Folder for \"@/name.svg\" image references (relative to this settings file).",
  };

  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: SETTINGS_SCHEMA_URL,
    title: "markdown-pdf-export settings",
    description:
      "User settings (~/.config/markdown-pdf-export/settings.json) or project settings (.markdown-pdf.json).",
    type: "object",
    additionalProperties: false,
    properties,
    definitions: {
      header_footer: headerFooterDefinition(),
      element: {
        oneOf: ELEMENT_TYPES.map((type) => ({ $ref: `#/definitions/element_${type}` })),
      },
      ...elementDefinitions(),
    },
  };
}
