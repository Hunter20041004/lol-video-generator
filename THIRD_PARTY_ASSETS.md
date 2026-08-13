# Third-party assets

## Bundled licensed audio

Authorization was confirmed by the project owner on 2026-08-11 to use the following audio files in generated videos and to redistribute them in this GitHub repository:

| File | SHA-256 |
| --- | --- |
| `public/audio/bgm1.mp3` | `fb9fe588eeb13b281542de89b69550f24b9c0bebb7b5d6e4fb4f150a6af93be4` |
| `public/audio/bgm2.mp3` | `c6e83e763f9b18517fca6f9974de7d9d7c48f94f0d2d4b53bbfce894c7d16812` |
| `public/audio/bgm3.mp3` | `561ad3f5b1311abedfb920ca39ecbff2644fe71b4901424148a94dc6614174c3` |

These audio files are third-party material. Their original copyrights and license terms remain with their respective rights holders, and the repository's ISC license does not grant any additional right to reuse them outside the authorized project context.

## Bundled player portraits

The project owner confirmed on 2026-08-13 that player portraits may be used in generated videos and redistributed in this GitHub repository. This confirmation does not imply official LCK authorization or grant reuse rights outside the authorized project context.

| Player | Team / season | Repository file | Source | Dimensions / format | SHA-256 |
| --- | --- | --- | --- | --- | --- |
| Ruler | Gen.G / 2026 | `public/player-portraits/gen-ruler-2026.webp` | [Leaguepedia-hosted image](https://static.wikia.nocookie.net/lolesports_gamepedia_en/images/e/e3/GEN_Ruler_2026_Split_1.png/revision/latest?cb=20260122171312) | 693×549 WebP | `9b10b93cc8368c90c82dd1381151931e6f857a4beb6a34e46469ea6aee9d558d` |

## Repository-hosted Google Fonts

The following variable font files are redistributed under the SIL Open Font License, Version 1.1. The complete license and both project copyright notices are preserved in `public/fonts/OFL.txt`.

| File | Official source | SHA-256 |
| --- | --- | --- |
| `public/fonts/Outfit-Variable.woff2` | [Google Fonts Outfit v15](https://fonts.gstatic.com/s/outfit/v15/QGYvz_MVcBeNP4NJtEtqUYLknw.woff2) | `92684e4acde79ef07758cd09380b7e01e9824d8b061eddeda046f78c166d7b12` |
| `public/fonts/Cinzel-Variable.woff2` | [Google Fonts Cinzel v26](https://fonts.gstatic.com/s/cinzel/v26/8vIJ7ww63mVu7gt79mT7PkRXMw.woff2) | `ef95296c778719c3d658a8284d65078100450948851b9114485ada01d9d3d3f8` |

Outfit is used by both the web workbench and Remotion videos. Cinzel is used by the web workbench's display headings and controls. Their original copyrights and OFL terms remain with their respective project authors; the repository's ISC license does not replace those terms.

### Noto Serif TC Post Match Read subset

`public/fonts/NotoSerifTC-PostMatchRead-700.woff2` is a weight-700 subset of Noto Serif TC built from Google Fonts commit `73fc2ff52147e34a74804b500cf89ca219eac55d`. It is redistributed under the SIL Open Font License, Version 1.1; the separate license text is preserved at `public/fonts/OFL-NotoSerifTC.txt`.

| File | Source SHA-256 | Output SHA-256 |
| --- | --- | --- |
| `public/fonts/NotoSerifTC-PostMatchRead-700.woff2` | `0077e18f57c6908f4a000969880940bdb0dad057c0e8d98b49dc364c3d1b09c6` | `22cfa6a3c60cb2b314d451958213a0a65ce9f0af4d4aa3c28796937be725c830` |

The reproducible build script is `scripts/buildPostMatchReadFont.sh`; its exact glyph inventory is `config/post-match-read-font-glyphs.txt`.
