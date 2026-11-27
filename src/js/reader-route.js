export const BOOK_STARTUP_MS = 3000;
export const READ_VIEW_KEY = "reader-view";
export const wantsBook = (hash, defaultView = "book") => hash === "#book" || (!hash && defaultView === "book");
