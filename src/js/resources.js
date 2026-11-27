const styles = new Map();

export function loadStyles(href) {
  if (styles.has(href)) return styles.get(href);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  const promise = new Promise((resolve, reject) => {
    function finish(error) {
      clearTimeout(timer);
      link.onload = link.onerror = null;
      if (error) {
        link.remove();
        reject(error);
      } else resolve();
    }
    const timer = setTimeout(() => finish(new Error("Stylesheet timed out.")), 12000);
    link.onload = () => finish();
    link.onerror = () => finish(new Error("Stylesheet could not load."));
    document.head.append(link);
  }).catch((error) => {
    styles.delete(href);
    throw error;
  });
  styles.set(href, promise);
  return promise;
}

export async function requestJSON(url, { cache = "default", signal } = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, 12000);
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
  try {
    const response = await fetch(url, { cache, signal: controller.signal });
    if (!response.ok) throw new Error(`Request failed with HTTP ${response.status}.`);
    return await response.json();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
