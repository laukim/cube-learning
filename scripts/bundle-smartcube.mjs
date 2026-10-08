import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["node_modules/smartcube-web-bluetooth/dist/esm/index.mjs"],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  outfile: "vendor/smartcube-web-bluetooth.js",
  banner: {
    js: "/* smartcube-web-bluetooth (MIT) — Pau Oliva, Andy Fedotov. https://github.com/poliva/smartcube-web-bluetooth */",
  },
});
