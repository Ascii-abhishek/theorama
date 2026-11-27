export const SUBJECTS = {
  physics: "Physics",
  psychology: "Psychology",
  biology: "Biology",
  space: "Space",
  "computer-science": "Computer science",
  mathematics: "Mathematics",
  "everyday-life": "Everyday life",
};
export const PAGE_SIZE = 24;
export const FEATURED_ID = "butterfly-effect";
export const IDEA_COLORS = ["peach", "sage", "lavender", "yellow", "blue", "pink"];
export const SECTION_KINDS = ["details", "mental"];

const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value, max) => typeof value === "string" && value.trim().length > 0 && value.length <= max;
const count = (value, max) => Array.isArray(value) && value.length > 0 && value.length <= max;
const positive = (value, max) => Number.isFinite(value) && value > 0 && value <= max;

export const sectionAnchor = (id) => `section-${id}`;
export const ideaPath = (base, id) => `${base}ideas/${encodeURIComponent(id)}/`;
export const isSlug = (value) => text(value, 100) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
export const isMediaPath = (value) =>
  text(value, 240) && /^media\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:avif|gif|jpe?g|png|webp)$/i.test(value);

export function sourceURL(value) {
  if (!text(value, 2048)) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export function validateSummary(idea) {
  if (!record(idea)) return ["must be an object"];
  const errors = [];
  if (!isSlug(idea.id)) errors.push("id must be a lowercase slug");
  for (const [field, max] of Object.entries({
    title: 140, description: 450, kind: 50, attribution: 140, year: 70,
  })) {
    if (!text(idea[field], max)) errors.push(`${field} needs 1–${max} characters`);
  }
  if (!Object.values(SUBJECTS).includes(idea.category)) errors.push("category must be a known subject");
  if (!count(idea.tags, 15) || !idea.tags.every((tag) => text(tag, 50))) errors.push("tags must contain 1–15 short labels");
  else if (new Set(idea.tags.map((tag) => tag.trim().toLowerCase())).size !== idea.tags.length) errors.push("tags must be unique");
  if (!IDEA_COLORS.includes(idea.color)) errors.push("color must be a supported palette");
  if (idea.illustration !== undefined && !isSlug(idea.illustration)) errors.push("illustration must be an artwork ID");
  return errors;
}

export function validateIdea(idea) {
  const errors = validateSummary(idea);
  if (!record(idea)) return errors;
  if (!text(idea.takeaway, 500)) errors.push("takeaway needs 1–500 characters");
  if (!count(idea.sources, 20)) errors.push("sources must contain 1–20 references");
  else idea.sources.forEach((source, i) => {
    if (!record(source) || !text(source.label, 200) || !sourceURL(source.url)) {
      errors.push(`sources[${i}] needs a label and a valid HTTPS URL`);
    }
  });

  const ids = new Set();
  for (const kind of SECTION_KINDS) {
    const sections = idea.sections?.[kind];
    if (!count(sections, 24)) {
      errors.push(`sections.${kind} must contain 1–24 sections`);
      continue;
    }
    sections.forEach((section, index) => {
      const field = `sections.${kind}[${index}]`;
      if (!record(section)) {
        errors.push(`${field} must be an object`);
        return;
      }
      if (!isSlug(section.id) || ids.has(section.id)) errors.push(`${field}.id must be a unique slug`);
      ids.add(section.id);
      if (!text(section.title, 160)) errors.push(`${field}.title needs 1–160 characters`);
      if (!count(section.blocks, 32)) {
        errors.push(`${field}.blocks must contain 1–32 blocks`);
        return;
      }
      section.blocks.forEach((block, i) => {
        const issue = validateBlock(block);
        if (issue) errors.push(`${field}.blocks[${i}] ${issue}`);
      });
    });
  }
  return errors;
}

function validateBlock(block) {
  if (!record(block)) return "must be an object";
  if (block.caption !== undefined && !text(block.caption, 600)) return "caption needs 1–600 characters";
  switch (block.type) {
    case "paragraph":
    case "heading":
      return text(block.text, block.type === "heading" ? 160 : 5000) ? "" : "has missing or oversized text";
    case "bullets":
      return count(block.items, 24) && block.items.every((item) => text(item, 1000)) ? "" : "needs 1–24 short list items";
    case "diagram":
      return ["divergence", "concept"].includes(block.name) ? "" : "names an unsupported diagram";
    case "illustration":
      return isSlug(block.id) && (block.aspectRatio === undefined || positive(block.aspectRatio, 20)) ? "" : "needs an illustration ID and a valid aspect ratio";
    case "animation":
      if (!/\.(?:webp|gif)$/i.test(block.src) || !isMediaPath(block.poster) || /\.gif$/i.test(block.poster) || block.src === block.poster) {
        return "needs an animated WebP or GIF and a separate still poster";
      }
      // Animated images share the same dimension and description rules.
    case "image":
      return isMediaPath(block.src) && Number.isInteger(block.width) && positive(block.width, 6000) &&
        Number.isInteger(block.height) && positive(block.height, 6000) && text(block.alt, 300)
        ? "" : "needs a local raster image, integer dimensions, and alt text";
    default:
      return "has an unsupported type";
  }
}

export function ideaMedia(idea) {
  const paths = new Set();
  for (const kind of SECTION_KINDS) {
    for (const section of idea.sections[kind]) {
      for (const block of section.blocks) {
        if (block.type === "image" || block.type === "animation") paths.add(block.src);
        if (block.type === "animation") paths.add(block.poster);
      }
    }
  }
  return paths;
}

export function inSubject(idea, subject) {
  return !subject || idea.category === subject || idea.tags.includes(subject);
}

export function readingMinutes(idea) {
  const words = SECTION_KINDS.flatMap((kind) => idea.sections[kind])
    .flatMap((section) => [section.title, ...section.blocks.flatMap((block) =>
      block.items ?? [block.text ?? block.caption ?? ""])])
    .join(" ").trim().split(/\s+/u).length;
  return Math.max(1, Math.ceil(words / 220));
}

export function summarizeIdea(idea) {
  const preview = SECTION_KINDS.flatMap((kind) => idea.sections[kind])
    .flatMap((section) => section.blocks).find((block) => block.type === "animation");
  const { id, title, description, category, kind, tags, attribution, year, color, illustration, takeaway } = idea;
  return { id, title, description, category, kind, tags, attribution, year, color, illustration, takeaway, preview: preview?.poster,
    minutes: readingMinutes(idea),
    search: normalizeSearch([title, description, category, kind, attribution, ...tags].join(" ")),
  };
}

export const normalizeSearch = (query) => query.normalize("NFKC").toLowerCase().trim().replace(/\s+/gu, " ");
