import { requestJSON } from "./resources.js";

export function monitorRelease({ base, assets, notice, canRefresh }) {
  const current = /\/_static\/([a-f0-9]{16})\/$/.exec(assets)?.[1];
  if (!current) return;
  const interval = 5 * 60_000;
  let checkedAt = Date.now(), available;

  const apply = async () => {
    if (await canRefresh()) location.reload();
    else notice("Save your note before loading the update. You can also download a backup from Notes.", {
      type: "error", label: "Try update again", run: apply,
    });
  };

  async function check() {
    if (document.hidden || available || Date.now() - checkedAt < interval) return;
    checkedAt = Date.now();
    try {
      const info = await requestJSON(base + "release.json", { cache: "no-store" });
      if (/^[a-f0-9]{16}$/.test(info?.version) && info.version !== current) {
        available = info.version;
        notice("An updated edition is available.", { label: "Load update", run: apply });
      }
    } catch { /* The current edition remains usable offline. */ }
  }
  window.addEventListener("online", check);
  document.addEventListener("visibilitychange", check);
  setInterval(check, interval);
}
