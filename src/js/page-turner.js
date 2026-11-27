import { PageFlip } from "../vendor/page-flip/page-flip.js";

export function mountPageTurner({ host, pages, width, height, single, startPage, onPage, onState }) {
  const controller = new PageFlip(host, {
    width,
    height,
    size: "fixed",
    autoSize: false,
    usePortrait: single,
    showCover: false,
    startPage,
    flippingTime: 580,
    drawShadow: true,
    maxShadowOpacity: 0.22,
    useMouseEvents: false,
    showPageCorners: false,
    mobileScrollSupport: false,
  });
  controller.on("flip", (event) => onPage(event.data));
  controller.on("changeState", (event) => onState(event.data));
  try { controller.loadFromHTML(pages); }
  catch (error) {
    try { controller.destroy(); }
    finally { host.remove(); }
    throw error;
  }

  return {
    idle: () => controller.getState() === "read",
    show: (index) => controller.turnToPage(index),
    flip(direction) {
      if (direction > 0) controller.flipNext("bottom");
      else controller.flipPrev("bottom");
    },
    startDrag: (point) => controller.startUserTouch(point),
    moveDrag: (point) => controller.userMove(point, true),
    endDrag: (point) => controller.userStop(point),
    destroy: () => controller.destroy(),
  };
}
