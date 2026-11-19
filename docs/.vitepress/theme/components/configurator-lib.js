// Pure helpers for Configurator.vue: no DOM, no Vue — importable from Node for tests.

export const SCHEMA_URL =
  "https://matinfo.github.io/markdown-pdf-export/schema/settings.schema.json";

/** Mirrors schema/settings.schema.json → properties.page_format.enum */
export const PAGE_FORMATS = ["A4", "Letter", "Legal", "Tabloid", "Ledger", "A0", "A1", "A2", "A3", "A5", "A6"];

/** Paper sizes in mm (portrait). */
export const PAGE_SIZES_MM = {
  A0: [841, 1189], A1: [594, 841], A2: [420, 594], A3: [297, 420], A4: [210, 297],
  A5: [148, 210], A6: [105, 148], Letter: [215.9, 279.4], Legal: [215.9, 355.6],
  Tabloid: [279.4, 431.8], Ledger: [431.8, 279.4],
};

/** Built-in defaults (export.mjs DEFAULT_SETTINGS) — values equal to these are omitted. */
export const DEFAULTS = {
  page_format: "A4",
  orientation: "portrait",
  margin: { top: "15mm", right: "15mm", bottom: "15mm", left: "15mm" },
  toc: false,
  math: false,
};

export const SIDES = ["top", "right", "bottom", "left"];
export const ZONES = ["left", "center", "right"];

/** Header/footer keys edited by the UI (other keys from a template are kept as-is). */
export const ZONE_KEYS = ["height", "font_size", "color", "border_bottom", "border_top"];

export const PLACEHOLDERS = [
  "{title}", "{author}", "{date}", "{date:yyyy-MM-dd}", "{page}", "{pages}", "{filename}",
];

export const SAMPLE = { title: "Quarterly Report", author: "Jane Smith", filename: "quarterly-report.md", page: 1, pages: 5 };

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const clone = (v) => JSON.parse(JSON.stringify(v));

/**
 * Turn a settings object (e.g. a template) into editable UI state.
 * Unknown keys are preserved so loading a template never loses data.
 */
export function stateFromSettings(settings) {
  const s = clone(settings ?? {});
  delete s.$schema;
  const zone = (z) => ({ ...(isObj(z) ? z : {}) });
  return {
    ...s,
    page_format: s.page_format ?? DEFAULTS.page_format,
    orientation: s.orientation ?? DEFAULTS.orientation,
    margin: { ...DEFAULTS.margin, ...(isObj(s.margin) ? s.margin : {}) },
    font_family: s.font_family ?? "",
    toc: s.toc ?? false,
    math: s.math ?? false,
    header: zone(s.header),
    footer: zone(s.footer),
    headerOn: isObj(s.header),
    footerOn: isObj(s.footer),
  };
}

function cleanZone(zone) {
  const out = {};
  for (const [k, v] of Object.entries(zone)) {
    if (v === "" || v === undefined || v === null) continue;
    out[k] = typeof v === "string" ? v.trim() : v;
    if (out[k] === "") delete out[k];
  }
  // An image height without an image is meaningless.
  for (const z of ZONES) {
    if (!out[`${z}_image`]) delete out[`${z}_image_height`];
  }
  return out;
}

/** UI state → minimal settings object (only non-default, non-empty keys). */
export function settingsFromState(state, { schema = true } = {}) {
  const { headerOn, footerOn, header, footer, margin, ...rest } = state;
  const out = schema ? { $schema: SCHEMA_URL } : {};
  for (const [k, v] of Object.entries(rest)) {
    if (v === "" || v === undefined || v === null) continue;
    if (k in DEFAULTS && v === DEFAULTS[k]) continue;
    out[k] = typeof v === "string" ? v.trim() : v;
  }
  const m = {};
  for (const side of SIDES) {
    const v = String(margin?.[side] ?? "").trim();
    if (v && v !== DEFAULTS.margin[side]) m[side] = v;
  }
  if (Object.keys(m).length) out.margin = m;
  if (headerOn) {
    const h = cleanZone(header);
    delete h.border_top;
    if (Object.keys(h).length) out.header = h;
  }
  if (footerOn) {
    const f = cleanZone(footer);
    delete f.border_bottom;
    if (Object.keys(f).length) out.footer = f;
  }
  return out;
}

export const toJson = (settings) => `${JSON.stringify(settings, null, 2)}\n`;

const yamlScalar = (v) =>
  typeof v === "string" ? JSON.stringify(v) : v === null ? "null" : String(v);

function yamlLines(value, indent) {
  const pad = " ".repeat(indent);
  const lines = [];
  for (const [k, v] of Object.entries(value)) {
    if (Array.isArray(v)) {
      lines.push(`${pad}${k}: [${v.map(yamlScalar).join(", ")}]`);
    } else if (isObj(v)) {
      lines.push(`${pad}${k}:`, ...yamlLines(v, indent + 2));
    } else {
      lines.push(`${pad}${k}: ${yamlScalar(v)}`);
    }
  }
  return lines;
}

/** Settings → front matter block (`pdf:` key, `$schema` dropped). */
export function toFrontMatter(settings) {
  const { $schema, ...rest } = settings;
  const body = Object.keys(rest).length ? yamlLines(rest, 2).join("\n") : "  {}";
  return `---\ntitle: ${SAMPLE.title}\npdf:\n${body}\n---\n`;
}

// --- placeholder preview -------------------------------------------------

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const pad2 = (n) => String(n).padStart(2, "0");

/** Small subset of date-fns `format` tokens — enough for a preview. */
export function formatDate(date, pattern) {
  const tokens = {
    yyyy: () => String(date.getFullYear()),
    yy: () => String(date.getFullYear()).slice(-2),
    MMMM: () => MONTHS[date.getMonth()],
    MMM: () => MONTHS[date.getMonth()].slice(0, 3),
    MM: () => pad2(date.getMonth() + 1),
    M: () => String(date.getMonth() + 1),
    dd: () => pad2(date.getDate()),
    d: () => String(date.getDate()),
    EEEE: () => DAYS[date.getDay()],
    EEE: () => DAYS[date.getDay()].slice(0, 3),
    HH: () => pad2(date.getHours()),
    mm: () => pad2(date.getMinutes()),
    ss: () => pad2(date.getSeconds()),
  };
  return pattern.replace(/'([^']*)'|yyyy|yy|MMMM|MMM|MM|M|dd|d|EEEE|EEE|HH|mm|ss/g, (m, lit) =>
    lit !== undefined ? lit : tokens[m](),
  );
}

/** Replace placeholders with sample values; unknown ones stay visible. */
export function renderPlaceholders(text, date = new Date(), sample = SAMPLE) {
  return String(text ?? "").replace(/\{(\w+)(?::([^}]*))?\}/g, (whole, name, fmt) => {
    switch (name) {
      case "date": return formatDate(date, fmt || "yyyy-MM-dd");
      case "time": return formatDate(date, fmt || "HH:mm");
      case "datetime": return formatDate(date, fmt || "yyyy-MM-dd HH:mm:ss");
      default: return name in sample ? String(sample[name]) : whole;
    }
  });
}

/** CSS length → millimetres (mm, cm, in, px, pt). NaN when unknown. */
export function toMm(value) {
  const m = /^\s*(-?[\d.]+)\s*(mm|cm|in|px|pt)?\s*$/.exec(String(value ?? ""));
  if (!m) return NaN;
  const n = Number(m[1]);
  const factor = { mm: 1, cm: 10, in: 25.4, px: 25.4 / 96, pt: 25.4 / 72 }[m[2] ?? "px"];
  return n * factor;
}

// --- central file + editors ---------------------------------------------

export const TARGETS = {
  unix: {
    label: "macOS / Linux",
    path: "~/.config/markdown-pdf-export/settings.json",
    note: "$XDG_CONFIG_HOME/markdown-pdf-export/settings.json when XDG_CONFIG_HOME is set.",
    commands: [
      { label: "macOS (copy first)", cmd: "mkdir -p ~/.config/markdown-pdf-export && pbpaste > ~/.config/markdown-pdf-export/settings.json" },
      { label: "Linux, X11 (copy first)", cmd: 'd="${XDG_CONFIG_HOME:-$HOME/.config}/markdown-pdf-export"; mkdir -p "$d" && xclip -selection clipboard -o > "$d/settings.json"' },
      { label: "Linux, Wayland (copy first)", cmd: 'd="${XDG_CONFIG_HOME:-$HOME/.config}/markdown-pdf-export"; mkdir -p "$d" && wl-paste > "$d/settings.json"' },
    ],
  },
  windows: {
    label: "Windows",
    path: "%APPDATA%\\markdown-pdf-export\\settings.json",
    note: "Usually C:\\Users\\<you>\\AppData\\Roaming\\markdown-pdf-export\\settings.json.",
    commands: [
      {
        label: "PowerShell (copy first; writes UTF-8 without BOM)",
        cmd: '$d = "$env:APPDATA\\markdown-pdf-export"; New-Item -ItemType Directory -Force $d | Out-Null; [IO.File]::WriteAllText("$d\\settings.json", (Get-Clipboard -Raw))',
      },
    ],
  },
};

export const MCP_KEY = "markdown-pdf";
export const TASK_LABEL = "Markdown: Export to PDF";
const SERVER = { command: "npx", args: ["-y", "markdown-pdf-export", "mcp"] };
const j = (v) => JSON.stringify(v, null, 2);

/** Base64 of a UTF-8 string in browser and Node. */
function b64(text) {
  if (typeof btoa === "function") return btoa(unescape(encodeURIComponent(text)));
  return Buffer.from(text, "utf8").toString("base64");
}

/** Install deep links, per the editors' docs (VS Code MCP guide, Cursor "MCP install links"). */
export function installLinks() {
  const vscode = `vscode:mcp/install?${encodeURIComponent(JSON.stringify({ name: MCP_KEY, ...SERVER }))}`;
  return {
    vscode,
    vscodeWeb: `https://vscode.dev/redirect?url=${encodeURIComponent(vscode)}`,
    cursor: `cursor://anysphere.cursor-deeplink/mcp/install?name=${MCP_KEY}&config=${encodeURIComponent(b64(JSON.stringify(SERVER)))}`,
  };
}

/** Same shapes as lib/editor-setup.mjs with the npx launcher. */
export function editorSnippets() {
  const addMcp = JSON.stringify({ name: MCP_KEY, ...SERVER });
  return [
    {
      id: "zed", name: "Zed",
      items: [
        {
          label: "Task", file: "~/.config/zed/tasks.json (Windows: %APPDATA%\\Zed\\tasks.json)", lang: "json",
          code: j([{ label: TASK_LABEL, command: "npx", args: ["-y", "markdown-pdf-export", "$ZED_FILE"], use_new_terminal: false, reveal: "never" }]),
        },
        {
          label: "MCP server (merge into settings)", file: "~/.config/zed/settings.json (Windows: %APPDATA%\\Zed\\settings.json)", lang: "json",
          code: j({ context_servers: { [MCP_KEY]: SERVER } }),
        },
      ],
    },
    {
      id: "vscode", name: "VS Code",
      items: [
        {
          label: "Task", file: "User tasks.json (Command Palette → “Tasks: Open User Tasks”)", lang: "json",
          code: j({ version: "2.0.0", tasks: [{ label: TASK_LABEL, type: "process", command: "npx", args: ["-y", "markdown-pdf-export", "${file}"], problemMatcher: [] }] }),
        },
        { label: "MCP server (run once in a macOS/Linux terminal; on Windows use the one-click link)", file: null, lang: "sh", code: `code --add-mcp '${addMcp}'` },
      ],
    },
    {
      id: "cursor", name: "Cursor",
      items: [
        {
          label: "Task", file: "User tasks.json (Command Palette → “Tasks: Open User Tasks”)", lang: "json",
          code: j({ version: "2.0.0", tasks: [{ label: TASK_LABEL, type: "process", command: "npx", args: ["-y", "markdown-pdf-export", "${file}"], problemMatcher: [] }] }),
        },
        { label: "MCP server", file: "~/.cursor/mcp.json", lang: "json", code: j({ mcpServers: { [MCP_KEY]: SERVER } }) },
      ],
    },
    {
      id: "claude-code", name: "Claude Code",
      items: [
        { label: "MCP server (run once in a terminal)", file: null, lang: "sh", code: `claude mcp add ${MCP_KEY} -- npx -y markdown-pdf-export mcp` },
      ],
    },
    {
      id: "claude-desktop", name: "Claude Desktop",
      items: [
        {
          label: "MCP server",
          file: "macOS: ~/Library/Application Support/Claude/claude_desktop_config.json · Windows: %APPDATA%\\Claude\\claude_desktop_config.json",
          lang: "json",
          code: j({ mcpServers: { [MCP_KEY]: SERVER } }),
        },
      ],
    },
  ];
}
