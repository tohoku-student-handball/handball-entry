// 試作品を1つのHTMLファイルにまとめて配布するための入口（scripts/build-preview.mjs が使う）。
// 本番は Next.js（src/app）で動かすので、このファイルは試作品の配布専用です。
import { createRoot } from "react-dom/client";
import { App } from "./components/App";
import "./app/globals.css";

createRoot(document.getElementById("root")!).render(<App />);
