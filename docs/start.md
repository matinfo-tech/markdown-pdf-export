---
description: "Make your first PDF from Markdown in three steps: get Node.js, open a terminal, paste one line."
title: Get started
---

# Get started

<p class="lead">Three steps, about five minutes. You need nothing else installed except Node.js.</p>

::: tip Using VS Code?
Install the [Markdown PDF Export extension](https://marketplace.visualstudio.com/items?itemName=matinfo-tech.markdown-pdf-export) instead: no Node.js, no terminal. The PDF
appears beside your Markdown as you type, and **Design pages** opens Studio inside the editor. It
is also on [Open VSX](https://open-vsx.org/extension/matinfo-tech/markdown-pdf-export).
:::

## 1. Get Node.js

Download it from [nodejs.org](https://nodejs.org) and install it like any other program (choose the
"LTS" version). If you already have Node.js 20 or newer, skip this step.

You also need Google Chrome or Microsoft Edge on your computer. Most people already have one.

## 2. Open a terminal

<PickTabs group="os" tabs="mac:macOS,windows:Windows,linux:Linux">
<template #mac>

Press <kbd>Cmd</kbd> + <kbd>Space</kbd>, type **Terminal** and press <kbd>Return</kbd>.

</template>
<template #windows>

Press the <kbd>Windows</kbd> key, type **Terminal** (or **PowerShell**) and press <kbd>Enter</kbd>.

</template>
<template #linux>

Press <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>T</kbd>, or open **Terminal** from your applications.

</template>
</PickTabs>

## 3. Paste this line

<CopyCommand />

Press <kbd>Enter</kbd>. The first time takes a little longer while it downloads. Then **Studio**
opens in your browser: pick a page style, a header and a footer, and watch the real PDF change.
Press **Save** when you like it.

![Studio: choices on the left, the real PDF on the right](/img/studio.png)

## Make your first PDF

In Studio, press **Add to my editor** to export from VS Code, Zed, Cursor or Claude with one
keystroke or one sentence. [See every editor](/editors).

Or export straight from the terminal. Put the path of your file at the end:

<CopyCommand command="npx -y markdown-pdf-export report.md" />

The PDF appears next to your file, with the same name.

<details>
<summary>Something wrong? Two commands that help</summary>

**Check everything.** Shows the version, the browser, your settings file and which editors are set up,
with the fix for anything missing:

<CopyCommand command="npx -y markdown-pdf-export doctor" />

**Set up my editors.** Finds the editors on your computer and asks, one by one, whether to add the
export command and the AI tools. [More on editors](/editors).

<CopyCommand command="npx -y markdown-pdf-export setup" />

</details>

[Something did not work? Help](/help){.more}
