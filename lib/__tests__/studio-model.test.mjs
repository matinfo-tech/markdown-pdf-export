import test from "node:test";
import assert from "node:assert/strict";
import {
  FIRST_LAYOUT,
  LAYOUTS,
  LOGO,
  draftToSettings,
  emptyDraft,
  lookAccent,
  lookDefaults,
  matchLayout,
  renderText,
  settingsToDraft,
} from "../../studio/model.mjs";
import { LOOKS, TEMPLATES, applyPresets, readTemplate } from "../looks.mjs";
import { validateFrontMatterConfig } from "../schema-validator.mjs";

const looks = Object.fromEntries(
  Object.entries(LOOKS).map(([k, v]) => [
    k,
    { margin: v.settings.margin ?? null, highlight: v.settings.highlight_style ?? null, accent: v.accent ?? null },
  ]),
);
const templates = Object.fromEntries(TEMPLATES.map((t) => [t, readTemplate(t)]));
const ctx = { looks, templates };

test("an untouched draft writes an empty settings file", () => {
  assert.deepEqual(draftToSettings(emptyDraft(), {}, ctx), {});
});

test("header and footer make room in the page margin", () => {
  const draft = emptyDraft();
  const layout = LAYOUTS.find((l) => l.id === "titled");
  draft.header = layout.header();
  draft.footer = layout.footer();
  const out = draftToSettings(draft, {}, ctx);
  assert.equal(out.header.left_text, "{title}");
  assert.equal(out.header.right_text, "{date}");
  assert.ok(out.header.border_bottom);
  assert.equal(out.footer.center_text, "Page {page} of {pages}");
  assert.deepEqual(out.margin, { top: "20mm", right: "15mm", bottom: "20mm", left: "15mm" });
  assert.equal(out.header.padding, "0 15mm");
});

test("margins: Normal by default, and a look brings its own", () => {
  assert.equal(emptyDraft().margin, "normal");
  assert.deepEqual(lookDefaults("academic", looks), { margin: "wide", highlight: "ascetic.css" });
  assert.deepEqual(lookDefaults("compact", looks), { margin: "narrow", highlight: "github.css" });
  assert.equal(lookDefaults("technical", looks).highlight, "atom-one-light.css");

  // The look's own margin is not repeated in the file…
  const draft = { ...emptyDraft(), look: "academic", ...lookDefaults("academic", looks) };
  assert.equal(draftToSettings(draft, {}, ctx).margin, undefined);
  assert.equal(draftToSettings(draft, {}, ctx).highlight_style, undefined);
  // …a different choice is.
  draft.margin = "normal";
  assert.deepEqual(draftToSettings(draft, {}, ctx).margin, { top: "15mm", right: "15mm", bottom: "15mm", left: "15mm" });
  // Reading a file with only a look shows that look's margin and code colours.
  const read = settingsToDraft({ look: "academic" }, ctx);
  assert.equal(read.margin, "wide");
  assert.equal(read.highlight, "ascetic.css");
});

test("the footer text lines up with the page margin", () => {
  const draft = { ...emptyDraft(), look: "academic", margin: "wide" };
  draft.footer = LAYOUTS.find((l) => l.id === "numbers").footer();
  const out = draftToSettings(draft, {}, ctx);
  assert.equal(out.margin, undefined, "25mm already has room for a footer");
  assert.equal(out.footer.padding, "0 25mm");
});

test("text and title fonts: nothing written until chosen, then one key each", () => {
  const draft = emptyDraft();
  assert.equal(draft.font, "look");
  assert.equal(draft.heading_font, "look");
  draft.font = "sans";
  draft.heading_font = "book";
  const out = draftToSettings(draft, {}, ctx);
  assert.deepEqual(out, { font: "sans", heading_font: "book" });
  const back = settingsToDraft(out, ctx);
  assert.equal(back.font, "sans");
  assert.equal(back.heading_font, "book");
  // Going back to the page style removes both keys.
  assert.deepEqual(draftToSettings(emptyDraft(), out, ctx), {});
  // A hand-written title stack is kept; choosing a preset replaces it.
  const raw = { heading_font_family: "Futura" };
  const custom = settingsToDraft(raw, ctx);
  assert.equal(custom.heading_font, "custom");
  assert.equal(draftToSettings(custom, raw, ctx).heading_font_family, "Futura");
  custom.heading_font = "serif";
  assert.deepEqual(draftToSettings(custom, raw, ctx), { heading_font: "serif" });
});

test("code colours are written only when they differ from the look", () => {
  const draft = { ...emptyDraft(), highlight: "github-dark.css" };
  assert.equal(draftToSettings(draft, {}, ctx).highlight_style, "github-dark.css");
  assert.equal(settingsToDraft({ highlight_style: "nord.css" }, ctx).highlight, "nord.css");
  const back = { ...draft, highlight: "github.css" };
  assert.equal(draftToSettings(back, { highlight_style: "github-dark.css" }, ctx).highlight_style, undefined);
});

test("logo size is a percentage of 12 mm, and the area grows with it", () => {
  const draft = emptyDraft();
  draft.header.left = { kind: "image", text: "", image: "assets/l.png", size: 150 };
  const big = draftToSettings(draft, {}, ctx);
  assert.equal(big.header.left_image_height, "18mm");
  assert.equal(big.header.height, "24mm");
  assert.equal(big.margin.top, "32mm");
  assert.equal(settingsToDraft(big, ctx).header.left.size, 150);

  draft.header.left.size = 50;
  const small = draftToSettings(draft, {}, ctx);
  assert.equal(small.header.left_image_height, "6mm");
  assert.equal(small.header.height, "12mm");

  draft.header.left.size = 900; // out of range input is clamped
  assert.equal(draftToSettings(draft, {}, ctx).header.left_image_height, "24mm");
  assert.equal(settingsToDraft({ header: { left_image: "a.png", left_image_height: "90mm" } }, ctx).header.left.size, LOGO.max);
});

test("a logo gets a taller area and an image height", () => {
  const draft = emptyDraft();
  draft.header.left = { kind: "image", text: "", image: "assets/logo.svg" };
  const out = draftToSettings(draft, {}, ctx);
  assert.equal(out.header.left_image, "assets/logo.svg");
  assert.equal(out.header.height, "18mm");
  assert.equal(out.header.left_image_height, "12mm");
  assert.equal(out.margin.top, "26mm");
});

test("a logo spot with no file yet writes nothing", () => {
  const draft = emptyDraft();
  draft.header.left = { kind: "image", text: "", image: "" };
  assert.equal(draftToSettings(draft, {}, ctx).header, undefined);
});

test("round trip: what Studio saves, Studio reads back the same", () => {
  for (const layout of LAYOUTS) {
    const draft = { ...emptyDraft(), look: "report", font: "serif", margin: "wide", text_size: "l", color: "#112233" };
    draft.header = layout.header();
    draft.footer = layout.footer();
    if (layout.id === "letterhead") {
      draft.header.left.image = "assets/a.png";
      draft.header.left.size = 85;
    }
    const saved = draftToSettings(draft, {}, ctx);
    const again = settingsToDraft(saved, ctx);
    assert.deepEqual(draftToSettings(again, saved, ctx), saved, layout.id);
    assert.equal(again.margin, "wide");
    // Text size and colour live on the header/footer, so "Nothing" has none to keep.
    if (layout.id !== "none") {
      assert.equal(again.text_size, "l");
      assert.equal(again.color, "#112233");
    }
  }
});

test("keys Studio does not manage survive a save", () => {
  const raw = { math: true, toc: true, output_directory: "pdf", header: { background: "#eee", left_text: "x" } };
  const out = draftToSettings(settingsToDraft(raw, ctx), raw, ctx);
  assert.equal(out.math, true);
  assert.equal(out.output_directory, "pdf");
  assert.equal(out.header.background, "#eee");
  assert.equal(out.header.left_text, "x");
});

test("a template key is read, then written out as plain header/footer", () => {
  const draft = settingsToDraft({ template: "simple" }, ctx);
  assert.equal(draft.header.left.text, "{title}");
  const out = draftToSettings(draft, { template: "simple" }, ctx);
  assert.equal(out.template, undefined);
  assert.equal(out.footer.center_text, "Page {page} of {pages}");
});

test("hand-written structured areas are left alone", () => {
  const header = { left: [{ type: "title" }, { type: "spacer" }], height: "30mm" };
  const draft = settingsToDraft({ header }, ctx);
  assert.equal(draft.header.custom, true);
  assert.deepEqual(draftToSettings(draft, { header }, ctx).header, header);
});

test("simple structured zones are understood", () => {
  const draft = settingsToDraft(
    { footer: { center: { type: "text", content: "{page}" }, left: { type: "image", src: "a.svg" } } },
    ctx,
  );
  assert.equal(draft.footer.custom, false);
  assert.equal(draft.footer.center.text, "{page}");
  assert.equal(draft.footer.left.image, "a.svg");
});

test("custom margins and font_family in the file are kept", () => {
  const raw = { margin: { top: "31mm", left: "17mm", right: "17mm", bottom: "9mm" }, font_family: "Inter" };
  const draft = settingsToDraft(raw, ctx);
  assert.equal(draft.margin, "custom");
  assert.equal(draft.font, "custom");
  const out = draftToSettings(draft, raw, ctx);
  assert.deepEqual(out.margin, raw.margin);
  assert.equal(out.font_family, "Inter");
});

test("everything Studio can produce passes the engine's own validation", () => {
  for (const layout of LAYOUTS) {
    for (const look of Object.keys(LOOKS)) {
      const draft = { ...emptyDraft(), look, font: "mono", orientation: "landscape", page_format: "Letter" };
      draft.header = layout.header();
      draft.footer = layout.footer();
      const { data, warnings } = applyPresets(draftToSettings(draft, {}, ctx));
      assert.deepEqual(warnings, []);
      const result = validateFrontMatterConfig(data);
      assert.deepEqual(result.errors, [], `${layout.id}/${look}`);
    }
  }
});

test("hand-set margins that Studio would not write are kept", () => {
  const raw = { margin: { top: "40mm", right: "15mm", bottom: "15mm", left: "15mm" } };
  const draft = settingsToDraft(raw, ctx);
  assert.equal(draft.margin, "custom");
  assert.deepEqual(draftToSettings(draft, raw, ctx).margin, raw.margin);
});

test("the first-time proposal exists", () => {
  assert.ok(LAYOUTS.some((l) => l.id === FIRST_LAYOUT));
});

test("matchLayout names the starting layout", () => {
  const draft = emptyDraft();
  assert.equal(matchLayout(draft), "none");
  const report = LAYOUTS.find((l) => l.id === "report");
  draft.header = report.header();
  draft.footer = report.footer();
  assert.equal(matchLayout(draft), "report");
  draft.header.left.text = "Mine";
  assert.equal(matchLayout(draft), null);
});

test("renderText shows people what a placeholder becomes", () => {
  assert.equal(renderText("Page {page} of {pages}"), "Page 1 of 2");
  assert.equal(renderText("{title}", { title: "T" }), "T");
  assert.equal(renderText("{date:yyyy}", { date: "2026-11-19" }), "2026-11-19");
  assert.equal(renderText("{unknown}"), "{unknown}");
});

test("theme colour: only looks with an accent offer it", () => {
  assert.equal(lookAccent("technical", looks), "#0969da");
  assert.equal(lookAccent("report", looks), "#24292e");
  assert.equal(lookAccent("clean", looks), null);
  assert.equal(lookAccent("academic", looks), null);
});

test("theme colour: written only when it differs from the look's own", () => {
  const draft = { ...emptyDraft(), look: "technical", ...lookDefaults("technical", looks) };
  assert.equal(draftToSettings(draft, {}, ctx).accent_color, undefined);
  draft.accent = "#0969DA"; // same colour, other case
  assert.equal(draftToSettings(draft, {}, ctx).accent_color, undefined);
  draft.accent = "#2E7D32";
  assert.equal(draftToSettings(draft, {}, ctx).accent_color, "#2e7d32");
  assert.equal(settingsToDraft({ look: "technical", accent_color: "#2e7d32" }, ctx).accent, "#2e7d32");
  draft.accent = "";
  assert.equal(draftToSettings(draft, { accent_color: "#2e7d32" }, ctx).accent_color, undefined, "reset drops it");
});

test("theme colour: kept as written, and left alone by looks without an accent", () => {
  const raw = { look: "technical", accent_color: "#C00" };
  const draft = settingsToDraft(raw, ctx);
  assert.equal(draft.accent, "#cc0000");
  assert.equal(draftToSettings(draft, raw, ctx).accent_color, "#C00", "no rewrite on load");
  const clean = { accent_color: "#c00" };
  assert.deepEqual(draftToSettings(settingsToDraft(clean, ctx), clean, ctx), clean);
  assert.equal(settingsToDraft({ accent_color: "red; }" }, ctx).accent, "", "invalid value ignored");
});
