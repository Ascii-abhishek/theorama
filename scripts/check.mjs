import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { readContent } from "./content.mjs";
import { root } from "./build.mjs";

for (const directory of ["src/js", "src/vendor/page-flip", "scripts", "tests"]) {
  for (const file of readdirSync(resolve(root, directory)).filter((name) => /\.m?js$/.test(name))) {
    const path = join(directory, file);
    const source = resolve(root, path);
    assert.equal(spawnSync(process.execPath, ["--check", source], { stdio: "inherit" }).status, 0, `Invalid syntax: ${path}`);
    for (const [, relative] of readFileSync(source, "utf8").matchAll(/(?:\bfrom\s+|\bimport\()["'](\.[^"']+)["']/g)) {
      assert.ok(existsSync(resolve(root, directory, relative)), `Missing import in ${path}: ${relative}`);
    }
  }
}
for (const file of readdirSync(resolve(root, "src/styles")).filter((name) => name.endsWith(".css"))) {
  for (const [, relative] of readFileSync(resolve(root, "src/styles", file), "utf8").matchAll(/url\(["']?([^"'()\s]+)["']?\)/g)) {
    assert.ok(existsSync(resolve(root, "src/styles", relative)), `Missing stylesheet asset in ${file}: ${relative}`);
  }
}

assert.ok(existsSync(resolve(root, "src/vendor/page-flip/LICENSE")), "The bundled reader needs its MIT license.");
const ideas = await readContent(root);
console.log(`Checked JavaScript, stylesheets, and ${ideas.length} article source files.`);
