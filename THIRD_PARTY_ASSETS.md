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

### Post Match Read font subsets

The Post Match Read video uses Barlow Condensed for condensed Latin display type and Noto Sans TC for Traditional Chinese. All four weights are built from Google Fonts commit `73fc2ff52147e34a74804b500cf89ca219eac55d` and redistributed under the SIL Open Font License, Version 1.1. The license texts are preserved at `public/fonts/OFL-BarlowCondensed.txt` and `public/fonts/OFL-NotoSansTC.txt`.

| File | Source SHA-256 | Output SHA-256 |
| --- | --- | --- |
| `public/fonts/BarlowCondensed-PostMatchRead-800.woff2` | `724c9c25952d5f4a2d87185d9767aa006144c5f0d944dc05bf7d5d603551c260` | `cc607f6a6463f1176204fbd7102e81b599dc12a12664307d2c8f5aea462e230b` |
| `public/fonts/BarlowCondensed-PostMatchRead-900.woff2` | `e74b750df582c608f35db467b711b2b60d2217618e85e60b72b42dfd00446cab` | `f7afeadbb7b336eef95b35884c824a00bf5e0261869239c8f8ad5f0f41ef233f` |
| `public/fonts/NotoSansTC-PostMatchRead-700.woff2` | `864727d210d54f2537bbe23b3a839436c3992af72de9322af5270897246bd44f` | `e84e5f7e4134b90dbc281d43d2a75a80251d82a8868e238728d4f2a7b1c58f81` |
| `public/fonts/NotoSansTC-PostMatchRead-900.woff2` | `864727d210d54f2537bbe23b3a839436c3992af72de9322af5270897246bd44f` | `2e4b1cee33fe3bd60e4c231c30e019947eebb71dd702d7a53f74fec25c026b18` |

The reproducible build script is `scripts/buildPostMatchReadFont.sh`; its exact glyph inventory is `config/post-match-read-font-glyphs.txt`.
