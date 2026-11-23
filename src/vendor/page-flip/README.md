# StPageFlip 2.0.7

Vendored ES module from the `page-flip@2.0.7` npm package (MIT).

- Project: https://github.com/Nodlik/StPageFlip
- Documentation: https://nodlik.github.io/StPageFlip/
- Package: https://registry.npmjs.org/page-flip/-/page-flip-2.0.7.tgz
- Original `dist/js/page-flip.module.js` SHA-256: `b718faafca6856bff51629baedeff601e2cc59482e951105bdbd6e46978cca38`

The module is formatted for review. Three lifecycle fixes are applied locally:

1. Store/cancel the renderer's animation-frame request when destroyed.
2. Always remove the UI resize listener, including when native mouse handlers are disabled.
3. Store/cancel the deferred initialization callback when destroyed.

These fixes prevent detached readers from continuing to render after closing or resizing. Page-fold geometry, timing, and rendering are unchanged. Theorama supplies pointer events to the public input API to preserve text selection, scrolling, and keyboard accessibility.

Keep this provenance and the accompanying LICENSE when updating the bundle. No CDN or runtime package installation is needed.
