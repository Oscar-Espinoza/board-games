# Table Light implementation evidence

First-iteration browser screenshots and recordings from the built application, September 13, 2026. The [latest viewport-fit revision](viewport-fit/README.md) supersedes this scrolling layout; these captures remain preserved. Original before-images remain one directory above; design mockups remain under `docs/azul-redesign/images/`.

`chromium/` and `webkit/` separate the browser captures. `table-light-{width}.webp` shows four-player layouts at 360×640, 390×844, 768×1024, 1100×700, 1440×900 and 720×450. The `centre`, `picker` and `text200` captures exercise the crowded centre, phone colour chooser and doubled computed text sizes. Text enlargement is not native browser zoom or physical Safari validation.

The score rail uses ticks every five and numerals every twenty so enlarged text remains distinct. The `100plus` capture shows the uncapped score 106 and a clamped rail marker. `cleanup` follows multiple completed rows, final-draft floor overflow and separate marker return. Other `azul-*` captures show retained Spanish, inspection, overflow, results and real multiplayer journeys in the new materials.

`scoring-motion.webm` records the actual browser timeline. The contact sheet samples it at two frames per second for review: final-draft reconstruction, successive wall scores, actual floor loss, cleanup and refill are visible. `phone-picker.webm` records the phone geometry/selection journey. Endpoints are also tested by seeking each actual Web Animation and comparing it with measured table destinations; the cross-browser final-layout tolerance is one CSS pixel (1.1px including floating point rounding).

Visual review compared the preserved before-images, the corrected written design and new desktop/phone/centre/board/200%-text captures. Vertical scrolling belonged to this first iteration and is superseded by the fixed viewport requirement. Functional text contrast was calculated against a conservative upper bound for the composited wood (warm lamp plus white grain): table main 5.73:1 and secondary 4.77:1. Against the darkest board, main ink is 8.78:1 and secondary ink 6.48:1. This exceeds the [4.5:1 normal-text requirement](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Decorative wall print and disabled controls are not normal text.

These captures are inspected evidence, not automated screenshot-baseline comparisons. Physical Safari, device touch/audio and fluent Spanish editorial review remain unverified.
