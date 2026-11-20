import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import "@fontsource-variable/literata";
import "@fontsource-variable/atkinson-hyperlegible-next";
import "@fontsource-variable/jetbrains-mono";
import Layout from "./Layout.vue";
import Landing from "./components/Landing.vue";
import CopyCommand from "./components/CopyCommand.vue";
import PickTabs from "./components/PickTabs.vue";
import LayoutDiagram from "./components/LayoutDiagram.vue";
import StudioOnline from "./components/StudioOnline.vue";
import "./custom.css";

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component("Landing", Landing);
    app.component("CopyCommand", CopyCommand);
    app.component("PickTabs", PickTabs);
    app.component("LayoutDiagram", LayoutDiagram);
    app.component("StudioOnline", StudioOnline);
  },
} satisfies Theme;
