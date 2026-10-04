import esbuild from "esbuild";
import fs from "fs";
import path from "path";

export async function startClientBuild(root: string, opts: { watch: boolean; minify?: boolean }) {
  const out = path.join(root, "dist", "public");
  fs.mkdirSync(out, { recursive: true });
  for (const f of ["index.html", "style.css"]) fs.copyFileSync(path.join(root, "src", "client", f), path.join(out, f));
  const config: esbuild.BuildOptions = {
    entryPoints: [path.join(root, "src", "client", "main.ts")],
    bundle: true, format: "iife", target: "es2020", outfile: path.join(out, "app.js"),
    sourcemap: !opts.minify, minify: !!opts.minify, logLevel: "warning",
  };
  if (opts.watch) {
    const ctx = await esbuild.context(config);
    await ctx.rebuild();
    await ctx.watch();
    // static files are cheap to re-copy on change
    for (const f of ["index.html", "style.css"]) fs.watchFile(path.join(root, "src", "client", f), () => fs.copyFileSync(path.join(root, "src", "client", f), path.join(out, f)));
  } else {
    await esbuild.build(config);
  }
}
