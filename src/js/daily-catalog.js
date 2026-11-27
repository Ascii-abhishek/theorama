import { IDEA_COLORS, PAGE_SIZE } from "./content-model.js";

const DAY_MS = 86_400_000;

export function localDay(date = new Date()) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
}

function hash(value) {
  let result = 2166136261;
  for (const char of value) result = Math.imul(result ^ char.codePointAt(0), 16777619);
  return result >>> 0;
}

export function featureOrder(ideas) {
  return [...ideas].sort((a, b) => hash(a.id) - hash(b.id) || a.id.localeCompare(b.id, "en"));
}

export function dailySlots(day, count) {
  if (!Number.isSafeInteger(count) || count < 1) return [];
  const wrap = (position) => ((position % count) + count) % count;
  const featured = wrap(day);
  const size = Math.min(count, PAGE_SIZE);
  const start = wrap(day * (size - 1));
  const slots = [featured];
  for (let offset = 0; slots.length < size; offset++) {
    const slot = wrap(start + offset);
    if (slot !== featured) slots.push(slot);
  }
  return slots;
}

export function dailyCards(ideas, day) {
  const [featured, ...cards] = ideas;
  return {
    featured,
    cards: cards.sort((a, b) => hash(`${a.id}:${day}`) - hash(`${b.id}:${day}`) || a.id.localeCompare(b.id, "en")),
  };
}

export function colorForDay(id, day) {
  const index = (hash(id) + day) % IDEA_COLORS.length;
  return IDEA_COLORS[(index + IDEA_COLORS.length) % IDEA_COLORS.length];
}
