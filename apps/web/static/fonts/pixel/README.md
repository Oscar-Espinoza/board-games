# Pixel fonts

Local woff2 files for the shared 8-bit kit (`packages/shared/src/ui/pixel/pixel.css`). No remote
font requests at runtime.

- **Jersey 10** by The Soft Type Project Authors, SIL OFL 1.1 ([license](OFL-jersey-10.txt),
  [upstream](https://github.com/google/fonts/tree/main/ofl/jersey10)). Subset to Latin-1 with
  `pyftsubset` on 2026-09-23. Default `--px-font`: clear C/O, mixed case, Spanish accents.
- **Pixelify Sans** by The Pixelify Sans Project Authors, SIL OFL 1.1 ([license](OFL-pixelify-sans.txt),
  [upstream](https://github.com/google/fonts/tree/main/ofl/pixelifysans)). From
  `@fontsource/pixelify-sans` (Latin, 400/700) on 2026-09-22; used by the 8-bit home store. Its
  capital C is nearly closed, so it is not used for game text.
