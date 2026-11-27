import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { hasIllustration } from "../src/js/illustrations.js";
import { SECTION_KINDS, ideaMedia, isSlug, validateIdea } from "../src/js/content-model.js";

export async function readContent(root) {
  const directory = resolve(root, "content/ideas");
  const entries = await readdir(directory, { withFileTypes: true });
  const errors = [];
  const ideas = [];
  const ids = new Set();
  const titles = new Set();

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, "en"))) {
    const folder = resolve(directory, entry.name);
    const file = resolve(folder, "idea.json");
    const report = (issue) => errors.push(`${relative(root, file)}: ${issue}`);
    if (!entry.isDirectory() || !isSlug(entry.name)) {
      report("expected an idea directory named for its slug");
      continue;
    }
    let idea;
    try {
      const info = await lstat(file);
      if (!info.isFile() || await realpath(file) !== file || info.size > 160_000) {
        report("expected a regular JSON file of 160 KB or less");
        continue;
      }
      idea = JSON.parse(await readFile(file, "utf8"));
    } catch (error) {
      report(error.message);
      continue;
    }
    const issues = validateIdea(idea);
    if (issues.length) {
      issues.forEach(report);
      continue;
    }
    const title = idea.title.normalize("NFKC").trim().toLowerCase();
    if (entry.name !== idea.id) report("folder name must match the idea ID");
    if (ids.has(idea.id)) report("duplicate idea ID");
    if (titles.has(title)) report("duplicate idea title");
    ids.add(idea.id);
    titles.add(title);
    if (idea.illustration && !hasIllustration(idea.illustration)) report("unknown illustration");
    for (const kind of SECTION_KINDS) {
      for (const section of idea.sections[kind]) {
        for (const block of section.blocks) {
          if (block.type === "illustration" && !hasIllustration(block.id)) {
            report(`${section.id}: unknown illustration ${block.id}`);
          }
        }
      }
    }
    for (const path of ideaMedia(idea)) {
      const asset = resolve(folder, path);
      try {
        const info = await lstat(asset);
        if (!info.isFile() || await realpath(asset) !== asset || info.size > 2_000_000) {
          report(`${path} must be a regular media file of 2 MB or less`);
        }
      } catch {
        report(`missing media file ${path}`);
      }
    }
    ideas.push(idea);
  }
  if (!ideas.length) errors.push("Add at least one valid idea.");
  if (errors.length) throw new Error(errors.join("\n"));
  return ideas;
}
