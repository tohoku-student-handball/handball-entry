// 試作品を「1つのHTMLファイル」にまとめる。サーバーなしで開け、どこに置いても動く。
// 使い方：npm run preview:build  → preview/index.html
import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";

const result = await build({
  entryPoints: ["src/preview-entry.tsx"],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  jsx: "automatic",
  write: false,
  outdir: "preview",
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "error",
});
const js = result.outputFiles.find((f) => f.path.endsWith(".js")).text;
const css = result.outputFiles.find((f) => f.path.endsWith(".css")).text;

const html = `<title>ハンドボール選手権 申込試作</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>${css}</style>
<div id="root"></div>
<script>${js.replaceAll("</script", "<\\/script")}</script>
`;
mkdirSync("preview", { recursive: true });
writeFileSync("preview/index.html", html);
console.log(`preview/index.html を作成しました（${(html.length / 1024).toFixed(0)}KB）`);
