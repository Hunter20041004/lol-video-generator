# Winner crest identity correction

Follow the approved final-read spec: reuse preflighted crests without another manifest lookup. Inline execution, no agents, no frontend/layout changes.

- [ ] RED: add a regression to `tests/unit/render/playerRadarAssetPlanner.test.js` using the real repository resolver and PNG files, series identity `Hanwha Life Esports` and winner full name; require `/team-crests/hle.png`. Run this test file and observe the reported winner-crest error.
- [ ] GREEN: in `utils/render/playerRadarAssetPlanner.js`, pair each preflighted crest with its requested series identity. Select exactly one match against the original identity or verified canonical team name. Keep missing/ambiguous/outside-series winners blocked; do not add another lookup or change assets.
- [ ] Test both series slots, Gen.G alias, canonical-name compatibility, and outside-series rejection. Only add further production code if a new failing case requires it.
- [ ] Run doctor, coverage, build, audit, render QA and browser tests. Render a preview from the existing HLE snapshot without a new Leaguepedia scan, verify media and unchanged publish stores.
- [ ] Merge main with existing changes preserved, repeat gates, update HANDOFF, push if security service permits, restore original URL. Never claim the separate rate-limit cause is resolved.
