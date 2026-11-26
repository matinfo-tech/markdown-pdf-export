/* Studio page logic. No framework: one state object, one sync() that reflects it. */
import {
  CHIPS,
  FIRST_LAYOUT,
  LOGO,
  MARGINS,
  ZONES,
  draftToSettings,
  emptyDraft,
  lookAccent,
  lookDefaults,
  layoutsIn,
  matchLayout,
  renderText,
  settingsToDraft,
  toTranslate,
} from "./model.mjs";

const $ = (id) => document.getElementById(id);

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (value !== false && value !== null && value !== undefined) node.setAttribute(key, value === true ? "" : value);
  }
  node.append(...children.filter((c) => c !== null && c !== undefined));
  return node;
}

// ── token: arrives in the URL fragment, which is never sent to any server ────
const fromHash = location.hash.slice(1);
if (fromHash) {
  sessionStorage.setItem("studio-token", fromHash);
  history.replaceState(null, "", location.pathname);
}
const TOKEN = sessionStorage.getItem("studio-token") ?? "";

/**
 * An editor can show this page inside its own panel (Studio started with
 * --embedded). These hooks exist for it, and nothing else here knows about it:
 *   - window.studioHost.showPdf(blob): set before this script runs, it draws
 *     each preview in place of the two <iframe>s, for panels with no built-in
 *     PDF viewer. It returns a promise that settles when the pages are shown.
 *   - window.studioHost.text: Studio's texts in the editor's language, keyed by
 *     the English text. studio/strings.json lists them all; one left out shows
 *     in English. `{0}`, `{1}`… stand for values; other braces, such as
 *     `{page}`, are header text and stay as they are.
 *   - a "studio:refresh" event on window draws the preview again, for when the
 *     document changed.
 */
const host = window.studioHost ?? null;

const words = host?.text ?? {};

/**
 * A text in the editor's language, with `{0}`, `{1}`… replaced by the values
 * given. The English text is a literal here, or marked with toTranslate where
 * it is written, so that studio/strings.json can be collected from the code.
 */
function say(english, ...values) {
  const text = typeof words[english] === "string" ? words[english] : english;
  return text.replace(/\{(\d+)\}/g, (all, index) => (Number(index) < values.length ? String(values[Number(index)]) : all));
}

/** The starting layouts, with their labels and header text in the editor's language. */
const layouts = layoutsIn(say);

/** The texts of index.html, in the editor's language. */
function translatePage() {
  if (Object.keys(words).length === 0) return;
  // A sentence around a link or code (data-say): one text, the elements numbered {0}, {1}… in it.
  for (const node of document.querySelectorAll("[data-say]")) {
    const parts = [...node.childNodes];
    const elements = parts.filter((n) => n.nodeType === Node.ELEMENT_NODE);
    const key = parts
      .map((n) => (n.nodeType === Node.ELEMENT_NODE ? `{${elements.indexOf(n)}}` : n.nodeType === Node.TEXT_NODE ? n.nodeValue : ""))
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (typeof words[key] !== "string") continue;
    node.replaceChildren(
      ...words[key]
        .split(/(\{\d+\})/)
        .filter((piece) => piece !== "")
        .map((piece) => elements[Number(/^\{(\d+)\}$/.exec(piece)?.[1] ?? NaN)] ?? piece),
    );
  }
  const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement?.closest("code, script, style")) continue;
    const key = node.nodeValue.replace(/\s+/g, " ").trim();
    if (key && typeof words[key] === "string") node.nodeValue = node.nodeValue.replace(node.nodeValue.trim(), () => words[key]);
  }
  for (const attribute of ["title", "aria-label", "placeholder"]) {
    for (const node of document.querySelectorAll(`[${attribute}]`)) {
      const text = words[node.getAttribute(attribute)];
      if (typeof text === "string") node.setAttribute(attribute, text);
    }
  }
}

async function api(path, { method = "GET", json, body, raw = false } = {}) {
  const headers = { "x-studio-token": TOKEN };
  if (json !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(path, { method, headers, body: json !== undefined ? JSON.stringify(json) : body });
  if (!res.ok) {
    let message = say("Request failed ({0}).", res.status);
    try {
      message = (await res.json()).error ?? message;
    } catch {
      // keep the generic message
    }
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }
  return raw ? res : res.json();
}

// ── state ───────────────────────────────────────────────────────────────────
let server = null; // /api/state
let raw = {}; // settings file content as last loaded or saved
let draft = emptyDraft();
let selected = null; // { area: "header" | "footer", zone }
let savedJson = "";
let loadedJson = ""; // what the page showed on arrival (nothing to lose until it differs)
const thumbs = new Map(); // image path → object URL of the file just uploaded

/** The six spots of the header and footer, as the page diagram shows them. */
const SPOTS = {
  header: { left: toTranslate("Top left"), center: toTranslate("Top center"), right: toTranslate("Top right") },
  footer: { left: toTranslate("Bottom left"), center: toTranslate("Bottom center"), right: toTranslate("Bottom right") },
};
const spotName = (areaName, zone) => say(SPOTS[areaName][zone]);
const SIZE_LABELS = { s: toTranslate("Small"), m: toTranslate("Medium"), l: toTranslate("Large") };
const MARGIN_LABELS = { narrow: toTranslate("Narrow"), normal: toTranslate("Normal"), wide: toTranslate("Wide") };
/** What the theme colour paints, per page style that has one. */
const ACCENT_HINTS = {
  technical: toTranslate("Title rule, section titles, code bars."),
  report: toTranslate("Title rule and quote bars."),
};
const LOOK_LABELS = {
  clean: toTranslate("Clean"),
  report: toTranslate("Report"),
  academic: toTranslate("Academic"),
  compact: toTranslate("Compact"),
  technical: toTranslate("Technical"),
};

const currentSettings = () => draftToSettings(draft, raw, { looks: server.looks });
const isDirty = () => JSON.stringify(currentSettings()) !== savedJson;

function change(mutate) {
  mutate();
  sync();
  schedulePreview();
}

// ── build once ──────────────────────────────────────────────────────────────
function segmented(host, options, get, set) {
  host.replaceChildren(
    ...options.map(([value, label, style]) => {
      const b = el("button", { type: "button", role: "radio", "data-value": value, text: label, onclick: () => change(() => set(value)) });
      if (style) b.style.fontFamily = style;
      return b;
    }),
  );
  host._sync = () => {
    for (const b of host.children) b.setAttribute("aria-checked", String(b.dataset.value === get()));
  };
}

function build() {
  // page style gallery
  $("looks").replaceChildren(
    ...Object.entries(server.looks).map(([name, def]) =>
      el(
        "button",
        { type: "button", class: "look", role: "radio", "data-value": name, title: say(def.description), onclick: () => change(() => Object.assign(draft, { look: name }, lookDefaults(name, server.looks))) },
        el("span", { class: `thumb ${name}` }, el("i", { class: "h" }), el("i"), el("i", { class: "w80" }), el("i", { class: "code" }), el("i"), el("i", { class: "w55" })),
        el("span", { text: LOOK_LABELS[name] ? say(LOOK_LABELS[name]) : name }),
      ),
    ),
  );

  // Two font choices: body text and titles. "From the page style" writes nothing.
  for (const [id, key] of [["font", "font"], ["heading-font", "heading_font"]]) {
    const names = Object.keys(server.fonts).filter((n) => n !== "system" || draft[key] === "system");
    const options = [
      el("option", { value: "look", text: say("From the page style") }),
      ...names.map((n) => {
        const o = el("option", { value: n, text: server.fontLabels[n] ? say(server.fontLabels[n]) : n });
        o.style.fontFamily = server.fonts[n];
        return o;
      }),
    ];
    if (draft[key] === "custom") options.push(el("option", { value: "custom", text: say("From your file") }));
    $(id).replaceChildren(...options);
    $(id).addEventListener("change", (e) => change(() => (draft[key] = e.target.value)));
  }

  $("accent").addEventListener("input", (e) => change(() => (draft.accent = e.target.value)));
  $("accent-reset").addEventListener("click", () => change(() => (draft.accent = "")));

  $("format").replaceChildren(...server.pageFormats.map((f) => el("option", { value: f, text: f })));
  $("format").addEventListener("change", (e) => change(() => (draft.page_format = e.target.value)));

  const themes = [...server.codeThemes];
  if (!themes.some((t) => t.file === draft.highlight)) {
    themes.push({ file: draft.highlight, label: say("{0} (from file)", draft.highlight.replace(/\.css$/, "")), own: true });
  }
  $("highlight").replaceChildren(...themes.map((t) => el("option", { value: t.file, text: t.own ? t.label : say(t.label) })));
  $("highlight").addEventListener("change", (e) => change(() => (draft.highlight = e.target.value)));
  segmented($("orientation"), [["portrait", say("Portrait")], ["landscape", say("Landscape")]], () => draft.orientation, (v) => (draft.orientation = v));

  const margins = Object.entries(MARGIN_LABELS).map(([value, label]) => [value, say(label)]);
  if (draft.margin === "custom") margins.push(["custom", say("From file")]);
  segmented($("margin"), margins, () => draft.margin, (v) => (draft.margin = v));

  $("layouts").replaceChildren(
    ...layouts.map((l) =>
      el("button", {
        type: "button",
        "data-value": l.id,
        text: l.label,
        onclick: () =>
          change(() => {
            draft.header = l.header();
            draft.footer = l.footer();
            selected = l.id === "letterhead" ? { area: "header", zone: "left" } : null;
          }),
      }),
    ),
  );

  $("line-header").addEventListener("change", (e) => change(() => (draft.header.line = e.target.checked)));
  $("line-footer").addEventListener("change", (e) => change(() => (draft.footer.line = e.target.checked)));
  segmented($("size"), Object.entries(SIZE_LABELS).map(([value, label]) => [value, say(label)]), () => draft.text_size, (v) => (draft.text_size = v));
  $("color").addEventListener("input", (e) => change(() => (draft.color = e.target.value)));

  $("save").addEventListener("click", save);
  $("save-path").textContent = `\u200E${server.displayPath}`; // keep the path left-to-right inside the rtl ellipsis
  $("save-path").title = server.settingsPath;

  $("editors-open").addEventListener("click", openEditors);
  $("editors-close").addEventListener("click", () => $("editors").close());

  addEventListener("beforeunload", (e) => {
    if (isDirty() && JSON.stringify(currentSettings()) !== loadedJson) e.preventDefault();
  });
  addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      save();
    }
  });
}

// ── sync: reflect state into the page ───────────────────────────────────────
function slotButton(areaName, zone) {
  const slot = draft[areaName][zone];
  const isSelected = selected?.area === areaName && selected.zone === zone;
  const filled = (slot.kind === "text" && slot.text.trim()) || (slot.kind === "image" && slot.image);
  const text = !filled
    ? slot.kind === "image"
      ? say("Add logo")
      : "+"
    : slot.kind === "image"
      ? say("Logo")
      : renderText(slot.text, { title: say("Quarterly report"), author: "Alex Morgan", filename: server.preview.name });
  const button = el("button", {
    type: "button",
    class: `slot ${zone} ${filled ? "filled" : "empty"}`,
    "aria-pressed": String(isSelected),
    "aria-label": filled ? say("{0}: {1}", spotName(areaName, zone), text) : say("{0}: empty", spotName(areaName, zone)),
    text,
    onclick: () => {
      selected = { area: areaName, zone };
      sync();
      $("slot-editor").querySelector("input[type=text]")?.focus();
    },
  });
  button.style.color = filled ? draft.color : "";
  const thumb = slot.kind === "image" ? thumbs.get(slot.image) : null;
  if (thumb) button.replaceChildren(el("img", { src: thumb, alt: say("Logo") }));
  button.addEventListener("dragover", (e) => {
    e.preventDefault();
    button.classList.add("drop");
  });
  button.addEventListener("dragleave", () => button.classList.remove("drop"));
  button.addEventListener("drop", (e) => {
    e.preventDefault();
    button.classList.remove("drop");
    const file = e.dataTransfer?.files?.[0];
    if (file) uploadLogo(file, areaName, zone);
  });
  return button;
}

function syncBand(areaName) {
  const band = $(`band-${areaName}`);
  const area = draft[areaName];
  band.className = `band ${area.line ? (areaName === "header" ? "lined-below" : "lined-above") : ""}`;
  if (area.custom) {
    band.replaceChildren(
      el("div", {
        class: "slot locked",
        text:
          areaName === "header"
            ? say("Your file has a hand-written header. Studio keeps it as it is.")
            : say("Your file has a hand-written footer. Studio keeps it as it is."),
      }),
    );
    return;
  }
  band.replaceChildren(...ZONES.map((zone) => slotButton(areaName, zone)));
}

/** Logo size slider: percent of the standard 12 mm, within a range that still fits a header. */
function sizeRow(slot) {
  const output = el("output", { text: `${slot.size}%` });
  const input = el("input", {
    type: "range",
    min: LOGO.min,
    max: LOGO.max,
    step: LOGO.step,
    value: slot.size,
    "aria-label": say("Logo size"),
    oninput: (e) => {
      output.textContent = `${e.target.value}%`;
      change(() => (slot.size = Number(e.target.value)));
    },
  });
  return el("div", { class: "size-row" }, el("span", { class: "label", text: say("Size") }), input, output);
}

let editorKey = "";
function syncSlotEditor() {
  const host = $("slot-editor");
  if (!selected || draft[selected.area].custom) {
    editorKey = "";
    host.replaceChildren(el("p", { class: "empty-note", text: say("Click a spot on the page above to put text or a logo there.") }));
    return;
  }
  const { area: areaName, zone } = selected;
  const slot = draft[areaName][zone];
  const key = `${areaName}.${zone}.${slot.kind === "image" ? `image:${slot.image}` : "text"}`;
  if (key === editorKey) return; // keep the input (and the caret) while typing
  editorKey = key;

  const title = el("div", { class: "title" }, el("span", { text: spotName(areaName, zone) }));
  const picker = el("input", { type: "file", accept: ".svg,.png,.jpg,.jpeg,image/*", hidden: true, onchange: (e) => e.target.files[0] && uploadLogo(e.target.files[0], areaName, zone) });

  if (slot.kind === "image") {
    const preview = thumbs.get(slot.image);
    host.replaceChildren(
      title,
      picker,
      el(
        "div",
        { class: "logo-row" },
        preview ? el("img", { src: preview, alt: "" }) : null,
        el("span", { class: "name", text: slot.image || say("No logo chosen yet. Drop an image here or choose a file.") }),
        el("button", { type: "button", class: "btn small", text: slot.image ? say("Replace") : say("Choose file"), onclick: () => picker.click() }),
        el("button", {
          type: "button",
          class: "btn small quiet",
          text: say("Use text"),
          onclick: () => change(() => (draft[areaName][zone] = { kind: "text", text: "", image: "", size: 100 })),
        }),
      ),
      slot.image ? sizeRow(slot) : null,
    );
    return;
  }

  const input = el("input", {
    type: "text",
    value: slot.text,
    placeholder: say("Type here, or pick something below"),
    "aria-label": say("{0} text", spotName(areaName, zone)),
    oninput: (e) =>
      change(() => {
        const text = e.target.value;
        draft[areaName][zone] = { kind: text.trim() ? "text" : "none", text, image: "", size: 100 };
      }),
  });
  const insert = (snippet) => {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    input.value = input.value.slice(0, start) + snippet + input.value.slice(end);
    input.setSelectionRange(start + snippet.length, start + snippet.length);
    input.dispatchEvent(new Event("input"));
    input.focus();
  };
  host.replaceChildren(
    title,
    picker,
    input,
    el(
      "div",
      { class: "chips" },
      ...CHIPS.map((c) => {
        const snippet = say(c.insert); // "Page {page} of {pages}" in the editor's language
        return el("button", { type: "button", class: "chip", text: say(c.label), title: say("Inserts {0}", snippet), onclick: () => insert(snippet) });
      }),
      el("button", { type: "button", class: "chip logo", text: say("Logo…"), onclick: () => picker.click() }),
    ),
  );
}

function syncNotices() {
  const notices = [];
  if (server.fileError) {
    notices.push(
      el(
        "div",
        { class: "notice bad" },
        el("strong", { text: `${say("Your settings file could not be read.")} ` }),
        say("{0} Saving replaces it; the old file is kept as a .bak copy.", server.fileError),
      ),
    );
  }
  if (server.envOverride) {
    notices.push(
      el("div", { class: "notice" }, say("MARKDOWN_PDF_SETTINGS is set on this computer, so exports use that instead of the file Studio saves.")),
    );
  }
  for (const areaName of ["header", "footer"]) {
    if (!draft[areaName].custom) continue;
    notices.push(
      el(
        "div",
        { class: "notice" },
        `${
          areaName === "header"
            ? say("The header in your file was written by hand with options Studio does not show. It stays untouched.")
            : say("The footer in your file was written by hand with options Studio does not show. It stays untouched.")
        } `,
        el("a", {
          class: "help",
          href: "https://markdown-pdf.matinfo.tech/reference/header-footer",
          target: "_blank",
          rel: "noopener noreferrer",
          text: say("Header and footer reference"),
        }),
        el("br"),
        el("button", {
          type: "button",
          class: "btn small",
          text: areaName === "header" ? say("Replace the header with a simple one") : say("Replace the footer with a simple one"),
          onclick: () => change(() => (draft[areaName] = emptyDraft()[areaName])),
        }),
      ),
    );
  }
  $("notices").replaceChildren(...notices);
}

function sync() {
  for (const b of $("looks").children) b.setAttribute("aria-checked", String(b.dataset.value === draft.look));
  for (const id of ["orientation", "margin", "size"]) $(id)._sync();
  for (const [id, key] of [["font", "font"], ["heading-font", "heading_font"]]) {
    $(id).value = draft[key];
    $(id).style.fontFamily = server.fonts[draft[key]] ?? ""; // the control shows its own choice
  }
  syncAccent();
  $("format").value = draft.page_format;
  $("highlight").value = draft.highlight;
  // The diagram's side padding follows the margins, so text and rules sit where they will print.
  const side = MARGINS[draft.margin] ?? 15;
  $("sheet").style.setProperty("--side", `${Math.round(side * 0.95)}px`);
  const layout = matchLayout(draft, layouts) ?? matchLayout(draft);
  for (const b of $("layouts").children) b.setAttribute("aria-pressed", String(b.dataset.value === layout));

  const stack = server.fonts[draft.font];
  $("sheet").style.fontFamily = stack ?? "";
  syncBand("header");
  syncBand("footer");
  syncSlotEditor();
  syncNotices();

  $("line-header").checked = draft.header.line;
  $("line-footer").checked = draft.footer.line;
  $("line-header").disabled = draft.header.custom;
  $("line-footer").disabled = draft.footer.custom;
  $("color").value = draft.color;

  const state = $("save-state");
  if (isDirty()) {
    state.textContent = server.exists ? say("Changes not saved") : say("Not saved yet");
    state.className = "dirty";
    $("save").disabled = false;
  } else {
    state.textContent = say("Saved");
    state.className = "saved";
    $("save").disabled = true;
  }
}

/** Theme colour: offered only for page styles that have one. */
function syncAccent() {
  const own = lookAccent(draft.look, server.looks);
  $("accent-box").hidden = !own;
  if (!own) return;
  const value = draft.accent || own;
  $("accent").value = value;
  $("accent-swatch").style.background = value;
  $("accent-hint").textContent = ACCENT_HINTS[draft.look] ? say(ACCENT_HINTS[draft.look]) : "";
  $("accent-reset").hidden = !draft.accent || draft.accent.toLowerCase() === own;
}

// ── preview ─────────────────────────────────────────────────────────────────
let previewTimer = null;
let previewRun = 0;
let frontFrame = $("frame-a");
let backFrame = $("frame-b");
let frontUrl = null;

function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(drawPreview, 350);
}

/** Load the PDF in the hidden frame, then swap the two: no blank moment between previews. */
function showInFrame(blob, run) {
  const url = URL.createObjectURL(blob);
  const incoming = backFrame;
  const swap = () => {
    if (run !== previewRun || incoming === frontFrame) return;
    incoming.classList.remove("back");
    incoming.removeAttribute("tabindex");
    frontFrame.classList.add("back");
    frontFrame.setAttribute("tabindex", "-1");
    if (frontUrl) URL.revokeObjectURL(frontUrl);
    frontUrl = url;
    [frontFrame, backFrame] = [incoming, frontFrame];
  };
  incoming.addEventListener("load", swap, { once: true });
  setTimeout(swap, 900); // some PDF viewers never fire load
  incoming.src = `${url}#toolbar=0&navpanes=0&view=Fit`;
}

async function drawPreview() {
  const run = ++previewRun;
  const status = $("status");
  status.textContent = say("Drawing the page…");
  status.className = "status busy";
  try {
    const res = await api("/api/preview", { method: "POST", json: { settings: currentSettings() }, raw: true });
    const blob = await res.blob();
    if (run !== previewRun) return;
    if (typeof host?.showPdf === "function") {
      await host.showPdf(blob);
      if (run !== previewRun) return;
    } else {
      showInFrame(blob, run);
    }
    $("problem").hidden = true;
    const seconds = new Intl.NumberFormat(document.documentElement.lang || undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
      Number(res.headers.get("x-render-ms")) / 1000,
    );
    // An embedded Studio is told by its editor which document each preview draws.
    const named = res.headers.get("x-preview-name");
    status.textContent =
      !named && server.preview.sample
        ? say("This is the real PDF of a sample document, drawn in {0} s.", seconds)
        : say("This is the real PDF of {0}, drawn in {1} s.", named ? decodeURIComponent(named) : server.preview.name, seconds);
    status.className = "status";
  } catch (error) {
    if (run !== previewRun || error.status === 409) return;
    const box = $("problem");
    box.replaceChildren(el("strong", { text: say("The page could not be drawn") }), error.message);
    box.hidden = false;
    status.textContent = say("Showing the last page that worked.");
    status.className = "status";
  }
}

// ── actions ─────────────────────────────────────────────────────────────────
async function uploadLogo(file, areaName, zone) {
  try {
    const { path } = await api(`/api/logo?name=${encodeURIComponent(file.name)}`, { method: "POST", body: file });
    thumbs.set(path, URL.createObjectURL(file));
    change(() => {
      const before = draft[areaName][zone];
      draft[areaName][zone] = { kind: "image", text: "", image: path, size: before.kind === "image" ? before.size : 100 };
      selected = { area: areaName, zone };
    });
  } catch (error) {
    const box = $("problem");
    box.replaceChildren(el("strong", { text: say("That logo could not be used") }), error.message);
    box.hidden = false;
  }
}

async function save() {
  if (!isDirty()) return;
  const button = $("save");
  button.disabled = true;
  try {
    const settings = currentSettings();
    const { removed = [] } = await api("/api/save", { method: "POST", json: { settings } });
    if (removed.length) {
      $("status").textContent =
        removed.length === 1
          ? say("Saved. Removed the logo no longer used ({0}).", removed[0])
          : say("Saved. Removed {0} logos no longer used.", removed.length);
    }
    raw = settings;
    savedJson = JSON.stringify(settings);
    server.exists = true;
    server.fileError = null;
    sync();
  } catch (error) {
    button.disabled = false;
    const box = $("problem");
    box.replaceChildren(el("strong", { text: say("Saving did not work") }), error.message);
    box.hidden = false;
  }
}

const EDITOR_ORDER = ["vscode", "copilot-cli", "claude-code", "claude-desktop", "cursor", "zed"];
const EDITOR_NOTES = {
  vscode: "Works with GitHub Copilot Chat in agent mode.",
  "copilot-cli": "For GitHub Copilot in the terminal (the copilot command).",
};
let editorTab = "";

async function openEditors() {
  const dialog = $("editors");
  const list = $("editors-list");
  list.replaceChildren(el("p", { class: "hint", text: "Looking for your editors…" }));
  if (!dialog.open) dialog.showModal();
  let editors;
  try {
    editors = await api("/api/editors");
  } catch (error) {
    list.replaceChildren(el("div", { class: "notice bad", text: error.message }));
    return;
  }

  const card = (editor) =>
    el(
      "div",
      { class: "editor" },
      editor.detected ? el("p", { class: "found-note", text: `${editor.name} is on this computer.` }) : null,
      EDITOR_NOTES[editor.id] ? el("p", { class: "editor-note", text: EDITOR_NOTES[editor.id] }) : null,
      ...editor.items.map((item, index) => {
        const result = el("div", { class: "result", role: "status" });
        const copy = copyButton(item.snippet);
        const auto =
          item.write === "print"
            ? null
            : el("button", {
                type: "button",
                class: "btn small primary",
                text: "Do it for me",
                onclick: async () => {
                  auto.disabled = true;
                  try {
                    const { done, message } = await api("/api/editors/apply", { method: "POST", json: { id: editor.id, index } });
                    result.textContent = done ? `Done: ${message}` : message;
                    result.className = `result ${done ? "" : "bad"}`;
                    auto.disabled = done;
                  } catch (error) {
                    result.textContent = error.message;
                    result.className = "result bad";
                    auto.disabled = false;
                  }
                },
              });
        return el(
          "div",
          { class: "step" },
          el("div", { class: "step-head" }, el("span", { text: item.label }), el("span", { class: "actions" }, copy, auto)),
          item.file ? el("div", { class: "step-file", text: item.write === "print" ? `Paste into ${item.file}` : item.file }) : null,
          el("pre", { text: item.snippet }),
          result,
        );
      }),
    );

  // One tab per editor, in a fixed order; open on the first one found on this computer.
  const sorted = EDITOR_ORDER.map((id) => editors.find((e) => e.id === id)).filter(Boolean);
  for (const e of editors) if (!sorted.includes(e)) sorted.push(e);
  let current = sorted.find((e) => e.id === editorTab) ?? sorted.find((e) => e.detected) ?? sorted[0];

  const tabs = el("div", { class: "tabs", role: "tablist", "aria-label": "Editors" });
  const panel = el("div", { class: "tab-panel", role: "tabpanel" });
  const buttons = new Map();

  const select = (editor, focus = false) => {
    current = editor;
    editorTab = editor.id;
    for (const [id, button] of buttons) {
      const on = id === editor.id;
      button.setAttribute("aria-selected", String(on));
      button.tabIndex = on ? 0 : -1;
      if (on && focus) button.focus();
    }
    panel.setAttribute("aria-labelledby", `tab-${editor.id}`);
    panel.replaceChildren(card(editor));
  };

  sorted.forEach((editor, i) => {
    const button = el(
      "button",
      {
        type: "button",
        role: "tab",
        id: `tab-${editor.id}`,
        class: "tab",
        onclick: () => select(editor),
        onkeydown: (event) => {
          const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
          if (!step) return;
          event.preventDefault();
          select(sorted[(i + step + sorted.length) % sorted.length], true);
        },
      },
      editor.name,
      editor.detected ? el("span", { class: "found", title: "Found on this computer", "aria-label": "found on this computer" }) : null,
    );
    buttons.set(editor.id, button);
    tabs.append(button);
  });

  const found = sorted.filter((e) => e.detected);
  const manual = el(
    "details",
    { class: "manual", open: found.length === 0 },
    el("summary", { text: found.length ? "All editors and manual steps" : "Pick your editor" }),
    tabs,
    panel,
  );
  list.replaceChildren(quickSetup(found), manual);
  select(current);
}

function copyButton(text) {
  const button = el("button", {
    type: "button",
    class: "btn small",
    text: "Copy",
    onclick: async () => {
      await navigator.clipboard.writeText(text);
      button.textContent = "Copied";
      setTimeout(() => (button.textContent = "Copy"), 1500);
    },
  });
  return button;
}

const KIND_LABEL = { task: "export task", key: "keyboard shortcut", mcp: "AI tools" };

/**
 * Editors found on this computer, one switch each (on by default). Already
 * set-up parts are skipped. Existing files get only the new entry (the server
 * keeps a backup); a file it cannot read is left alone and the person gets
 * the snippet to paste instead.
 */
function quickSetup(found) {
  const box = el("section", { class: "quick", "aria-label": "Editors found on this computer" });
  if (found.length === 0) {
    box.append(el("p", { class: "hint", text: "No editor found on this computer. Pick yours below." }));
    return box;
  }
  box.append(el("h3", { text: "Found on this computer" }));

  const rows = found.map((editor) => {
    const todo = editor.items.map((item, index) => ({ item, index })).filter((x) => x.item.pending);
    const result = el("div", { class: "quick-result", role: "status" });
    if (todo.length === 0) {
      const row = el(
        "div",
        { class: "quick-row done" },
        el("span", { class: "tick", "aria-hidden": "true", text: "✓" }),
        el("span", { class: "quick-name", text: editor.name }),
        el("span", { class: "quick-what", text: "Already set up" }),
      );
      return { row, toggle: null };
    }
    const id = `quick-${editor.id}`;
    const toggle = el("input", { type: "checkbox", role: "switch", class: "switch", id, checked: true });
    const what = [...new Set(todo.map((x) => KIND_LABEL[x.item.kind]))].join(" + ");
    const row = el(
      "div",
      { class: "quick-row" },
      toggle,
      el("label", { for: id, class: "quick-name", text: editor.name }),
      el("span", { class: "quick-what", text: what }),
      result,
    );
    return { row, toggle, editor, todo, result };
  });

  const pending = rows.filter((r) => r.toggle);
  box.append(...rows.map((r) => r.row));
  if (pending.length === 0) {
    box.append(el("p", { class: "hint", text: "Everything found here is set up." }));
    return box;
  }

  const go = el("button", { type: "button", class: "btn primary" });
  const selected = () => pending.filter((r) => r.toggle.checked && !r.toggle.disabled);
  const refresh = () => {
    const n = selected().length;
    go.textContent = n ? `Set up ${n} editor${n > 1 ? "s" : ""}` : "Nothing selected";
    go.disabled = n === 0;
  };
  for (const r of pending) r.toggle.addEventListener("change", refresh);

  const line = (ok, text, title) => el("p", { class: ok ? "ok" : "bad", text: `${ok ? "✓" : "✗"} ${text}`, title });
  const paste = (item, why) =>
    el(
      "div",
      { class: "paste" },
      el("div", { class: "step-head" }, el("span", { text: why }), copyButton(item.snippet)),
      el("pre", { text: item.snippet }),
    );

  go.addEventListener("click", async () => {
    go.disabled = true;
    for (const r of selected()) {
      r.toggle.disabled = true;
      r.result.replaceChildren();
      for (const { item, index } of r.todo) {
        const label = KIND_LABEL[item.kind];
        if (item.write === "print") {
          r.result.append(paste(item, `${label}: paste this into ${item.file}`));
          continue;
        }
        try {
          const { done, message } = await api("/api/editors/apply", { method: "POST", json: { id: r.editor.id, index } });
          r.result.append(line(done, done ? `${label} added` : `${label}: ${message}`, message));
          if (!done) r.result.append(paste(item, "Run or add this yourself:"));
        } catch (error) {
          r.result.append(line(false, `${label}: ${error.message}`), paste(item, "Run or add this yourself:"));
        }
      }
    }
    refresh();
    if (selected().length === 0) go.textContent = "Done";
  });
  refresh();
  box.append(el("div", { class: "quick-foot" }, go));
  return box;
}

// ── start ───────────────────────────────────────────────────────────────────
async function start() {
  translatePage();
  try {
    server = await api("/api/state");
  } catch (error) {
    document.body.replaceChildren(
      el(
        "div",
        { class: "problem" },
        el("strong", { text: say("Studio is not connected") }),
        error.status === 401
          ? say("Open Studio from the link printed in your terminal. Each launch has its own private link.")
          : say("The Studio program is no longer running. Start it again with: {0}", "markdown-pdf-export studio"),
      ),
    );
    return;
  }
  raw = server.raw;
  draft = settingsToDraft(raw, { looks: server.looks, templates: server.templates });
  if (!server.exists) {
    // Nothing saved yet: propose a sensible page instead of a bare one.
    const first = layouts.find((l) => l.id === FIRST_LAYOUT);
    draft.header = first.header();
    draft.footer = first.footer();
  }
  // A file Studio would rewrite differently counts as unsaved only after a change.
  loadedJson = JSON.stringify(currentSettings());
  savedJson = server.exists && !server.fileError ? loadedJson : "";
  build();
  // The editor showing this page is set up already.
  $("editors-open").hidden = server.embedded;
  sync();
  drawPreview();
  addEventListener("studio:refresh", schedulePreview);
  setInterval(() => api("/api/ping", { method: "POST" }).catch(() => {}), 30000);
}

start();
