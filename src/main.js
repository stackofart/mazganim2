import { createApp, createSSRApp } from "vue";
import "./style.css";
import App from "./App.vue";
import { localeFromPath } from "./data/content.js";
const app = document.getElementById("app");
const locale = localeFromPath(location.pathname);
(app.hasChildNodes()
  ? createSSRApp(App, { locale })
  : createApp(App, { locale })
).mount(app);
