const banner = document.getElementById("site-banner");
const message = document.getElementById("site-banner-message");
const action = document.getElementById("site-banner-action");
const close = document.getElementById("site-banner-close");
let timeout, runAction;

function hide() {
  banner.hidden = true;
  message.textContent = "";
  runAction = null;
  clearTimeout(timeout);
}

close.addEventListener("click", hide);
action.addEventListener("click", () => {
  const run = runAction;
  hide();
  if (run) void run();
});

export function notice(text, { type = "info", label, run } = {}) {
  clearTimeout(timeout);
  message.classList.remove("notice-error");
  if (type === "error") message.classList.add("notice-error");
  banner.dataset.type = type;
  action.hidden = !run;
  action.textContent = label ?? "";
  runAction = run;
  banner.hidden = false;
  message.textContent = text;
  if (!run && type === "success") timeout = setTimeout(hide, 4500);
}
