import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import Configurator from './components/Configurator.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('Configurator', Configurator)
  },
} satisfies Theme
