// Builds the console into dist/. Set CONSOLE_API_URL to the backend address.
//   CONSOLE_API_URL=https://dailybasics-backend.onrender.com npm run build
//   npm run dev   (serves on http://localhost:5174, rebuilds on change)
import * as esbuild from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";

const apiUrl = (process.env.CONSOLE_API_URL || "https://dailybasics-backend.onrender.com").replace(/\/$/, "");
const serve = process.argv.includes("--serve");

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });
cpSync("public", "dist", { recursive: true });

const options = {
  entryPoints: ["src/main.tsx"],
  bundle: true,
  outfile: "dist/app.js",
  minify: !serve,
  sourcemap: serve,
  target: ["es2020"],
  jsx: "automatic",
  define: {
    __API_URL__: JSON.stringify(apiUrl),
    "process.env.NODE_ENV": JSON.stringify(serve ? "development" : "production"),
  },
  logLevel: "info",
};

if (serve) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: "dist", port: 5174 });
  console.log(`Console running at http://localhost:${port}  (API: ${apiUrl})`);
} else {
  await esbuild.build(options);
  console.log(`Built dist/ (API: ${apiUrl})`);
}
