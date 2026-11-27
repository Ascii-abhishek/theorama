// One note per origin. Compare revisions inside the write transaction so two
// tabs can never silently replace each other's edits.
export const NOTE_LIMIT = 20000;
export const NOTE_DEFAULTS = { markdown: "", color: "theme", font: "sans", size: 17, revision: 0 };
export const NOTE_COLORS = ["theme", "white", "yellow", "red", "green", "blue", "gray"];

export const isCustomColor = (color) => typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color);

export function normalizeNote(value = {}) {
  if (!value || typeof value !== "object") value = {};
  return {
    markdown: typeof value.markdown === "string" ? value.markdown.slice(0, NOTE_LIMIT) : "",
    color: NOTE_COLORS.includes(value.color) || isCustomColor(value.color) ? value.color : "theme",
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
      let blocked = false;
      request.onblocked = () => {
        blocked = true;
        reject(new Error("Close other Theorama tabs and retry."));
      };
      request.onsuccess = () => {
        const db = request.result;
        if (blocked) {
          db.close();
          return;
        }
        const current = connection;
        db.onclose = () => { if (connection === current) connection = null; };
        db.onversionchange = () => { db.close(); db.onclose(); };
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
        let conflict = false, writeError;
        request.onsuccess = () => {
          if (normalizeNote(request.result).revision !== expectedRevision) {
            conflict = true;
            tx.abort();
            return;
          }
          try {
            store.put({ ...normalizeNote(note), revision: expectedRevision + 1 }, "personal");
          } catch (error) {
            writeError = error;
            tx.abort();
          }
        };
        tx.oncomplete = () => resolve(expectedRevision + 1);
        tx.onabort = () => reject(Object.assign(
          new Error(conflict ? "Note changed in another tab." : "Saving failed.", { cause: writeError || tx.error }),
          { conflict },
        ));
        tx.onerror = () => {};
      });
    },
  };
}
