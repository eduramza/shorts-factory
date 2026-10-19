import { readdir, writeFile } from "node:fs/promises";
const dir = "packages/composition/effects";
const files = (await readdir(dir))
  .filter((f) => f.endsWith(".tsx") && f !== "visuals.tsx")
  .sort();
await writeFile(
  dir + "/catalog.ts",
  files
    .map(
      (f, i) => `import {effect as e${i}} from './${f.replace(".tsx", "")}';`,
    )
    .join("\n") +
    "\nexport const effectCatalog=[" +
    files.map((_, i) => "e" + i).join(",") +
    "];\n",
);
