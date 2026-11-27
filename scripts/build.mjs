import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, mkdtemp, open, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { FEATURED_ID, PAGE_SIZE, SUBJECTS, ideaMedia, ideaPath, inSubject, summarizeIdea } from "../src/js/content-model.js";
import { featureOrder } from "../src/js/daily-catalog.js";
import { paginationPaths } from "../src/js/catalog-view.js";
import { escapeHTML as escape } from "../src/js/html.js";
import { BOOK_STARTUP_MS, READ_VIEW_KEY } from "../src/js/reader-route.js";
import { readContent } from "./content.mjs";
import { renderArticle, renderCatalog, renderPage } from "./render.mjs";

export const root = fileURLToPath(new URL("../", import.meta.url));

export function siteSettings(env, production = false) {
  if (production && !env.SITE_URL) throw new Error("Set SITE_URL to the public HTTPS address before a production build.");
  const site = new URL(env.SITE_URL || "http://127.0.0.1:5173/");
  if (!(site.protocol === "https:" || (!production && site.protocol === "http:")) ||
      site.username || site.password || site.search || site.hash ||
      !/^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]*$/.test(site.pathname)) {
    throw new Error("SITE_URL must be an HTTPS address with an optional plain subdirectory.");
  }
  const base = site.pathname.endsWith("/") ? site.pathname : `${site.pathname}/`;
  return { site, base, indexable: Boolean(env.SITE_URL) };
}

async function publicFiles() {
  const files = new Set([
    "assets/favicon.svg",
    "src/vendor/page-flip/page-flip.js",
    "src/vendor/page-flip/LICENSE",
  ]);
  for (const [directory, extension] of [
    ["src/js", /\.js$/], ["src/styles", /\.css$/], ["assets/fonts", /\.(woff2|txt)$/],
  ]) {
    for (const entry of await readdir(resolve(root, directory), { withFileTypes: true })) {
      if (entry.isFile() && extension.test(entry.name)) files.add(`${directory}/${entry.name}`);
    }
  }
  return [...files].sort();
}

// Keep the startup gate usable even if the application entry itself is delayed.
const readerStartup = `(()=>{let text=false;try{text=localStorage.getItem("theorama:${READ_VIEW_KEY}")==='"text"';}catch{}if(location.hash==="#book"||(!location.hash&&!text)){const root=document.documentElement;const deadline=String(Date.now()+${BOOK_STARTUP_MS});root.dataset.bookStartup=deadline;setTimeout(()=>{if(root.dataset.bookStartup===deadline)delete root.dataset.bookStartup;},${BOOK_STARTUP_MS});}})();`;
const startupHash = createHash("sha256").update(readerStartup).digest("base64");
const policy = [
  "default-src 'self'", `script-src 'self' 'sha256-${startupHash}'`, "style-src 'self'", "style-src-attr 'unsafe-inline'",
  "img-src 'self'", "font-src 'self'", "connect-src 'self'", "object-src 'none'", "base-uri 'none'",
  "frame-ancestors 'none'", "form-action 'self'",
].join("; ");
export const headers = {
  "Content-Security-Policy": policy,
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
};

async function emitSitemap(write, urls) {
  const xml = (tag, contents, declaration = ' xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"') =>
    `<?xml version="1.0" encoding="UTF-8"?>\n<${tag}${declaration}>${contents}</${tag}>\n`;
  const urlset = (items) => xml("urlset", items.map((url) => `\n  <url><loc>${escape(url)}</loc></url>`).join("") + "\n");
  if (urls.length <= 50_000) return write("sitemap.xml", urlset(urls));
  const indexes = [];
  for (let start = 0; start < urls.length; start += 50_000) {
    const path = `sitemap-${indexes.length + 1}.xml`;
    await write(path, urlset(urls.slice(start, start + 50_000)));
    indexes.push(new URL(path, urls[0]).href);
  }
  await write("sitemap.xml", xml("sitemapindex", indexes.map((url) => `\n  <sitemap><loc>${escape(url)}</loc></sitemap>`).join("") + "\n"));
}

async function emit(stage, ideas, { site, base, indexable }, contentRoot) {
  const [shell, catalog, assets] = await Promise.all([
    readFile(resolve(root, "index.html"), "utf8"),
    readFile(resolve(root, "scripts/catalog.html"), "utf8"),
    publicFiles(),
  ]);
  const absolute = (url) => new URL(url, site).href;
  const urls = [];
  const write = async (file, data) => {
    const destination = join(stage, file);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, data);
  };

  const hash = createHash("sha256").update(absolute(base)).update(String(indexable)).update(shell).update(catalog);
  for (const idea of ideas) hash.update(JSON.stringify(idea));
  for (const path of ["scripts/build.mjs", "scripts/render.mjs"]) hash.update(await readFile(resolve(root, path)));
  const files = assets.map((file) => [file, resolve(root, file)]);
  for (const idea of ideas) {
    for (const file of ideaMedia(idea)) {
      files.push([`ideas/${idea.id}/${file}`, resolve(contentRoot, "content/ideas", idea.id, file)]);
    }
  }
  for (const [file, input] of files) {
    hash.update(file).update("\0");
    for await (const chunk of createReadStream(input)) hash.update(chunk);
    hash.update("\0");
  }
  const version = hash.digest("hex").slice(0, 16);
  const assetDirectory = `_static/${version}/`;
  const assetBase = base + assetDirectory;
  for (const [file, input] of files) {
    const destination = join(stage, assetDirectory, file);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(input, destination);
  }

  async function page(path, options) {
    const canonical = options.noindex ? null : absolute(path);
    if (canonical) urls.push(canonical);
    await write(path.slice(base.length) + "index.html", renderPage(shell, {
      base, assets: assetBase, canonical: indexable ? canonical : null, ...options,
    }));
  }

  const summaries = ideas.map(summarizeIdea).sort((a, b) =>
    Number(b.id === FEATURED_ID) - Number(a.id === FEATURED_ID) || a.title.localeCompare(b.title, "en") || a.id.localeCompare(b.id, "en"));
  const byId = new Map(summaries.map((item) => [item.id, item]));
  const subjects = new Map(Object.values(SUBJECTS).map((subject) => [subject, summaries.filter((item) => inSubject(item, subject))]));
  const searchable = { ideas: summaries };
  await write(assetDirectory + "catalog.json", JSON.stringify(searchable));

  const rotation = featureOrder(summaries);
  for (let start = 0; start < rotation.length; start += PAGE_SIZE) {
    await write(`${assetDirectory}daily/${start / PAGE_SIZE}.json`, JSON.stringify(rotation.slice(start, start + PAGE_SIZE)));
  }

  for (const [slug, subject] of [["", ""], ...Object.entries(SUBJECTS)]) {
    const list = slug ? subjects.get(subject) : summaries;
    const path = slug ? `${base}subjects/${slug}/` : base;
    const links = paginationPaths(path, list.length, 1);
    for (let number = 1; number <= links.total; number++) {
      await page(links.path(number), {
        title: `${subject || "Theorama — A little field guide to big ideas"}${number > 1 ? ` · Page ${number}` : ""}${subject ? " · Theorama" : ""}`,
        summary: subject ? `Explore ${subject.toLowerCase()} ideas and mental models in Theorama’s field guide.` : undefined,
        pageData: `data-catalog data-subject="${escape(subject)}" data-page="${number}"${!slug && number === 1 ? ` data-home-count="${list.length}"` : ""}`,
        noindex: !list.length,
        main: renderCatalog(catalog, { base, assets: assetBase, list, page: number, slug, path }),
      });
    }
  }
  for (const idea of ideas) {
    const { minutes } = byId.get(idea.id);
    const related = subjects.get(idea.category).slice(0, 4).filter((item) => item.id !== idea.id).slice(0, 3);
    const path = ideaPath(base, idea.id);
    await page(path, {
      title: `${idea.title} · Theorama`, summary: idea.description,
      earlyScript: readerStartup,
      pageData: `data-article="${escape(idea.id)}"`,
      main: renderArticle(idea, { base, assets: assetBase, minutes, related }),
    });
    await write(`${assetDirectory}ideas/${idea.id}/idea.json`, JSON.stringify(idea));
  }

  await write("404.html", renderPage(shell, {
    title: "Page not found · Theorama", canonical: null, base, assets: assetBase, noindex: true,
    main: `<main id="main" tabindex="-1" class="site-main missing-page"><h1>Page not found</h1><p>This idea may have moved.</p><a class="primary-button" href="${escape(base)}">Browse ideas</a></main>`,
  }));
  await write("release.json", JSON.stringify({ version }));
  await emitSitemap(write, urls);
  await write("robots.txt", indexable ? `User-agent: *\nAllow: /\nSitemap: ${absolute(base + "sitemap.xml")}\n` : "User-agent: *\nDisallow: /\n");
  await write("_headers", [
    "/*", ...Object.entries(headers).map(([name, value]) => `  ${name}: ${value}`),
    "  Strict-Transport-Security: max-age=31536000",
    ...["", "ideas/*", "subjects/*", "page/*", "404.html", "sitemap*", "robots.txt"].flatMap((path) =>
      [base + path, "  Cache-Control: public, max-age=0, must-revalidate"]),
    `${base}_static/*`, "  Cache-Control: public, max-age=31536000, immutable",
    `${base}release.json`, "  Cache-Control: no-store",
    "",
  ].join("\n"));
  return { ideas: ideas.length, pages: urls.length, version };
}

export async function build({ out = resolve(root, "dist"), env = process.env, production = false, contentRoot = root } = {}) {
  const settings = siteSettings(env, production);
  const ideas = await readContent(contentRoot);
  await mkdir(dirname(out), { recursive: true });
  const lock = await open(out + ".lock", "wx");
  let temporary;
  let hasBackup = false;
  let published = false;
  try {
    temporary = await mkdtemp(join(dirname(out), ".theorama-build-"));
    const next = join(temporary, "public");
    const prior = join(temporary, "previous");
    const result = await emit(next, ideas, settings, contentRoot);
    try {
      await rename(out, prior);
      hasBackup = true;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    try {
      await rename(next, out);
      published = true;
    } catch (error) {
      if (hasBackup) {
        await rename(prior, out);
        hasBackup = false;
      }
      throw error;
    }
    return result;
  } finally {
    try {
      if (temporary && (published || !hasBackup)) await rm(temporary, { recursive: true, force: true });
    } finally {
      await lock.close();
      await rm(out + ".lock", { force: true });
    }
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const result = await build({ production: process.argv.includes("--production") });
    console.log(`Built ${result.ideas} ideas and ${result.pages} catalog and article pages in dist (${result.version}).`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
