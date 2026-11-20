---
description: "Make your first PDF from Markdown in three steps: get Node.js, open a terminal, paste one line."
title: Get started
---

# Get started

<p class="lead">Three steps, about five minutes. You need nothing else installed except Node.js.</p>

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

[Something did not work? Help](/help){.more}
