// One note per origin. Compare revisions inside the write transaction so two
// tabs can never silently replace each other's edits.
export const NOTE_LIMIT = 20000;
export const NOTE_DEFAULTS = { markdown: "", color: "white", font: "sans", size: 17, revision: 0 };
export const NOTE_COLORS = ["white", "yellow", "red", "green", "blue", "gray"];

export function normalizeNote(value = {}) {
  if (!value || typeof value !== "object") value = {};
  return {
    markdown: typeof value.markdown === "string" ? value.markdown.slice(0, NOTE_LIMIT) : "",
    color: NOTE_COLORS.includes(value.color) ? value.color : "white",
    font: ["sans", "serif", "mono"].includes(value.font) ? value.font : "sans",
    size: [15, 17, 20, 24].includes(value.size) ? value.size : 17,
    revision: Number.isSafeInteger(value.revision) && value.revision >= 0 ? value.revision : 0,
  };
}

export function createNotesStore(databaseName = "theorama-notes") {
  let connection;
  function connect() {
    if (connection) return connection;
    connection = new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("notes");
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Close other Theorama tabs and retry."));
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); connection = null; };
        resolve(db);
      };
    }).catch((error) => { connection = null; throw error; });
    return connection;
  }
  return {
    async read() {
      const db = await connect();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("notes", "readonly");
        const request = tx.objectStore("notes").get("personal");
        tx.oncomplete = () => resolve(normalizeNote(request.result));
        tx.onabort = () => reject(tx.error || new Error("Reading notes failed."));
        tx.onerror = () => {};
      });
    },
    async write(note, expectedRevision) {
      const db = await connect();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("notes", "readwrite");
        const store = tx.objectStore("notes");
        const request = store.get("personal");
        let conflict = false;
        request.onsuccess = () => {
          if (normalizeNote(request.result).revision !== expectedRevision) {
            conflict = true;
            tx.abort();
            return;
          }
          store.put({ ...normalizeNote(note), revision: expectedRevision + 1 }, "personal");
        };
        tx.oncomplete = () => resolve(expectedRevision + 1);
        tx.onabort = () => reject(Object.assign(new Error(conflict ? "Note changed in another tab." : "Saving failed."), { conflict }));
        tx.onerror = () => {};
      });
    },
  };
}
