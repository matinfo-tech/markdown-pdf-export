import test from "node:test";
import assert from "node:assert/strict";
import {
  LAYOUTS,
  draftToSettings,
  emptyDraft,
  matchLayout,
  renderText,
  settingsToDraft,
} from "../../studio/model.mjs";
import { LOOKS, TEMPLATES, applyPresets, readTemplate } from "../looks.mjs";
import { validateFrontMatterConfig } from "../schema-validator.mjs";

const looks = Object.fromEntries(
  Object.entries(LOOKS).map(([k, v]) => [k, { margin: v.settings.margin ?? null }]),
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

test("a look's own margin is the base for Auto", () => {
  const draft = { ...emptyDraft(), look: "academic" };
  assert.equal(draftToSettings(draft, {}, ctx).margin, undefined);
  draft.footer = LAYOUTS.find((l) => l.id === "numbers").footer();
  const out = draftToSettings(draft, {}, ctx);
  assert.equal(out.margin, undefined, "25mm already has room for a footer");
  assert.equal(out.footer.padding, "0 25mm");
  draft.header.left = { kind: "image", text: "", image: "assets/l.png" };
  assert.equal(draftToSettings(draft, {}, ctx).margin.top, "26mm");
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
    if (layout.id === "letterhead") draft.header.left.image = "assets/a.png";
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
