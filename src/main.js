import { createApp, createSSRApp } from "vue";
import "./style.css";
import App from "./App.vue";
const app = document.getElementById("app");
(app.hasChildNodes() ? createSSRApp(App) : createApp(App)).mount(app);
