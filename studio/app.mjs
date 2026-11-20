/* Studio page logic. No framework: one state object, one sync() that reflects it. */
import {
  CHIPS,
  FIRST_LAYOUT,
  LAYOUTS,
  LOGO,
  MARGINS,
  ZONES,
  draftToSettings,
  emptyDraft,
  lookDefaults,
  matchLayout,
  renderText,
  settingsToDraft,
} from "/model.mjs";

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

async function api(path, { method = "GET", json, body, raw = false } = {}) {
  const headers = { "x-studio-token": TOKEN };
  if (json !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(path, { method, headers, body: json !== undefined ? JSON.stringify(json) : body });
  if (!res.ok) {
    let message = `Request failed (${res.status}).`;
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

const AREA_NAMES = { header: "Top", footer: "Bottom" };
const SIZE_LABELS = { s: "Small", m: "Medium", l: "Large" };
const MARGIN_LABELS = { narrow: "Narrow", normal: "Normal", wide: "Wide" };
const LOOK_LABELS = { clean: "Clean", report: "Report", academic: "Academic", compact: "Compact", technical: "Technical" };

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
        { type: "button", class: "look", role: "radio", "data-value": name, title: def.description, onclick: () => change(() => Object.assign(draft, { look: name }, lookDefaults(name, server.looks))) },
        el("span", { class: `thumb ${name}` }, el("i", { class: "h" }), el("i"), el("i", { class: "w80" }), el("i", { class: "code" }), el("i"), el("i", { class: "w55" })),
        el("span", { text: LOOK_LABELS[name] ?? name }),
      ),
    ),
  );

  // Two font choices: body text and titles. "From the page style" writes nothing.
  for (const [id, key] of [["font", "font"], ["heading-font", "heading_font"]]) {
    const names = Object.keys(server.fonts).filter((n) => n !== "system" || draft[key] === "system");
    const options = [
      el("option", { value: "look", text: "From the page style" }),
      ...names.map((n) => {
        const o = el("option", { value: n, text: server.fontLabels[n] ?? n });
        o.style.fontFamily = server.fonts[n];
        return o;
      }),
    ];
    if (draft[key] === "custom") options.push(el("option", { value: "custom", text: "From your file" }));
    $(id).replaceChildren(...options);
    $(id).addEventListener("change", (e) => change(() => (draft[key] = e.target.value)));
  }

  $("format").replaceChildren(...server.pageFormats.map((f) => el("option", { value: f, text: f })));
  $("format").addEventListener("change", (e) => change(() => (draft.page_format = e.target.value)));

  const themes = [...server.codeThemes];
  if (!themes.some((t) => t.file === draft.highlight)) {
    themes.push({ file: draft.highlight, label: `${draft.highlight.replace(/\.css$/, "")} (from file)` });
  }
  $("highlight").replaceChildren(...themes.map((t) => el("option", { value: t.file, text: t.label })));
  $("highlight").addEventListener("change", (e) => change(() => (draft.highlight = e.target.value)));
  segmented($("orientation"), [["portrait", "Portrait"], ["landscape", "Landscape"]], () => draft.orientation, (v) => (draft.orientation = v));

  const margins = Object.entries(MARGIN_LABELS);
  if (draft.margin === "custom") margins.push(["custom", "From file"]);
  segmented($("margin"), margins, () => draft.margin, (v) => (draft.margin = v));

  $("layouts").replaceChildren(
    ...LAYOUTS.map((l) =>
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
  segmented($("size"), Object.entries(SIZE_LABELS), () => draft.text_size, (v) => (draft.text_size = v));
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
      ? "Add logo"
      : "+"
    : slot.kind === "image"
      ? "Logo"
      : renderText(slot.text, { title: "Quarterly report", author: "Alex Morgan", filename: server.preview.name });
  const button = el("button", {
    type: "button",
    class: `slot ${zone} ${filled ? "filled" : "empty"}`,
    "aria-pressed": String(isSelected),
    "aria-label": `${AREA_NAMES[areaName]} ${zone}: ${filled ? text : "empty"}`,
    text,
    onclick: () => {
      selected = { area: areaName, zone };
      sync();
      $("slot-editor").querySelector("input[type=text]")?.focus();
    },
  });
  button.style.color = filled ? draft.color : "";
  const thumb = slot.kind === "image" ? thumbs.get(slot.image) : null;
  if (thumb) button.replaceChildren(el("img", { src: thumb, alt: "Logo" }));
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
      el("div", { class: "slot locked", text: `Your file has a hand-written ${areaName}. Studio keeps it as it is.` }),
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
    "aria-label": "Logo size",
    oninput: (e) => {
      output.textContent = `${e.target.value}%`;
      change(() => (slot.size = Number(e.target.value)));
    },
  });
  return el("div", { class: "size-row" }, el("span", { class: "label", text: "Size" }), input, output);
}

let editorKey = "";
function syncSlotEditor() {
  const host = $("slot-editor");
  if (!selected || draft[selected.area].custom) {
    editorKey = "";
    host.replaceChildren(el("p", { class: "empty-note", text: "Click a spot on the page above to put text or a logo there." }));
    return;
  }
  const { area: areaName, zone } = selected;
  const slot = draft[areaName][zone];
  const key = `${areaName}.${zone}.${slot.kind === "image" ? `image:${slot.image}` : "text"}`;
  if (key === editorKey) return; // keep the input (and the caret) while typing
  editorKey = key;

  const title = el("div", { class: "title" }, el("span", { text: `${AREA_NAMES[areaName]} ${zone}` }));
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
        el("span", { class: "name", text: slot.image || "No logo chosen yet. Drop an image here or choose a file." }),
        el("button", { type: "button", class: "btn small", text: slot.image ? "Replace" : "Choose file", onclick: () => picker.click() }),
        el("button", {
          type: "button",
          class: "btn small quiet",
          text: "Use text",
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
    placeholder: "Type here, or pick something below",
    "aria-label": `${AREA_NAMES[areaName]} ${zone} text`,
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
      ...CHIPS.map((c) => el("button", { type: "button", class: "chip", text: c.label, title: `Inserts ${c.insert}`, onclick: () => insert(c.insert) })),
      el("button", { type: "button", class: "chip logo", text: "Logo…", onclick: () => picker.click() }),
    ),
  );
}

function syncNotices() {
  const notices = [];
  if (server.fileError) {
    notices.push(
      el("div", { class: "notice bad" }, el("strong", { text: "Your settings file could not be read. " }), `${server.fileError} Saving replaces it; the old file is kept as a .bak copy.`),
    );
  }
  if (server.envOverride) {
    notices.push(
      el("div", { class: "notice" }, "MARKDOWN_PDF_SETTINGS is set on this computer, so exports use that instead of the file Studio saves."),
    );
  }
  for (const areaName of ["header", "footer"]) {
    if (!draft[areaName].custom) continue;
    notices.push(
      el(
        "div",
        { class: "notice" },
        `The ${areaName} in your file was written by hand with options Studio does not show. It stays untouched.`,
        el("br"),
        el("button", {
          type: "button",
          class: "btn small",
          text: `Replace the ${areaName} with a simple one`,
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
  $("format").value = draft.page_format;
  $("highlight").value = draft.highlight;
  // The diagram's side padding follows the margins, so text and rules sit where they will print.
  const side = MARGINS[draft.margin] ?? 15;
  $("sheet").style.setProperty("--side", `${Math.round(side * 0.95)}px`);
  const layout = matchLayout(draft);
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
    state.textContent = server.exists ? "Changes not saved" : "Not saved yet";
    state.className = "dirty";
    $("save").disabled = false;
  } else {
    state.textContent = "Saved";
    state.className = "saved";
    $("save").disabled = true;
  }
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

async function drawPreview() {
  const run = ++previewRun;
  const status = $("status");
  status.textContent = "Drawing the page…";
  status.className = "status busy";
  try {
    const res = await api("/api/preview", { method: "POST", json: { settings: currentSettings() }, raw: true });
    const blob = await res.blob();
    if (run !== previewRun) return;
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
    $("problem").hidden = true;
    const seconds = (Number(res.headers.get("x-render-ms")) / 1000).toFixed(1);
    status.textContent = `This is the real PDF of ${server.preview.sample ? "a sample document" : server.preview.name}, drawn in ${seconds} s.`;
    status.className = "status";
  } catch (error) {
    if (run !== previewRun || error.status === 409) return;
    const box = $("problem");
    box.replaceChildren(el("strong", { text: "The page could not be drawn" }), error.message);
    box.hidden = false;
    status.textContent = "Showing the last page that worked.";
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
    box.replaceChildren(el("strong", { text: "That logo could not be used" }), error.message);
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
        removed.length === 1 ? `Saved. Removed the logo no longer used (${removed[0]}).` : `Saved. Removed ${removed.length} logos no longer used.`;
    }
    raw = settings;
    savedJson = JSON.stringify(settings);
    server.exists = true;
    server.fileError = null;
    sync();
  } catch (error) {
    button.disabled = false;
    const box = $("problem");
    box.replaceChildren(el("strong", { text: "Saving did not work" }), error.message);
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
  dialog.showModal();
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
        const copy = el("button", {
          type: "button",
          class: "btn small",
          text: "Copy",
          onclick: async () => {
            await navigator.clipboard.writeText(item.snippet);
            copy.textContent = "Copied";
            setTimeout(() => (copy.textContent = "Copy"), 1500);
          },
        });
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

  list.replaceChildren(tabs, panel);
  select(current);
}

// ── start ───────────────────────────────────────────────────────────────────
async function start() {
  try {
    server = await api("/api/state");
  } catch (error) {
    document.body.replaceChildren(
      el(
        "div",
        { class: "problem" },
        el("strong", { text: "Studio is not connected" }),
        error.status === 401
          ? "Open Studio from the link printed in your terminal. Each launch has its own private link."
          : "The Studio program is no longer running. Start it again with: markdown-pdf-export studio",
      ),
    );
    return;
  }
  raw = server.raw;
  draft = settingsToDraft(raw, { looks: server.looks, templates: server.templates });
  if (!server.exists) {
    // Nothing saved yet: propose a sensible page instead of a bare one.
    const first = LAYOUTS.find((l) => l.id === FIRST_LAYOUT);
    draft.header = first.header();
    draft.footer = first.footer();
  }
  // A file Studio would rewrite differently counts as unsaved only after a change.
  loadedJson = JSON.stringify(currentSettings());
  savedJson = server.exists && !server.fileError ? loadedJson : "";
  build();
  sync();
  drawPreview();
  setInterval(() => api("/api/ping", { method: "POST" }).catch(() => {}), 30000);
}

start();
