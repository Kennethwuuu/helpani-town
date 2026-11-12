# Licenses and asset provenance

Helpani Town's original application code, documentation, programmatically drawn
Canvas scenes, and project-created SVG assets are distributed under the
[MIT License](LICENSE). The canonical license text and SPDX identifier are
published by the [Open Source Initiative](https://opensource.org/license/mit).

## Installed dependencies

The exact dependency versions are recorded in `package-lock.json`. The organizer
table uses AG Grid Community; the server serves its installed browser bundle at
`/vendor/ag-grid-community.min.js`.

| Package | Version | License | Upstream license file |
| --- | --- | --- | --- |
| `ag-grid-community` | 36.3.0 | MIT | `node_modules/ag-grid-community/LICENSE.txt` |
| `ag-stack` | 36.3.0 | MIT | `node_modules/ag-stack/LICENSE.txt` |
| `ag-charts-types` | 14.3.0 | MIT | `node_modules/ag-charts-types/LICENSE.txt` |

All three installed packages contain the identical license text below. This
notice reproduces that text for all three components; their upstream copyright
and license remain in effect.

```text
The MIT License

Copyright (c) 2015-2026 AG GRID LTD

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Project artwork

The layered habitats and animated animals in `public/woodland-scene.js` and
`public/companion-scene.js`, the prototype animal/story SVG illustrations in
`public/`, and the six turtle/pangolin medal SVGs in `public/assets/medals/` are
project-created, stylized virtual artwork. These assets are included under the
project's MIT license.

Three red-panda medal PNGs were generated from text-only prompts using
`image_gen.imagegen` on 9 November 2026, with transparent backgrounds and no
reference images:

- `public/assets/medals/canopy-listener.png`
- `public/assets/medals/trail-finder.png`
- `public/assets/medals/leaf-reader.png`

These generated game assets are included in the project's MIT distribution.
The prompts and generation provenance are recorded in
[the medal artwork record](docs/medal-art-prompts-2026-11-09.md).
Medals and player photographs depict virtual game scenes, not real rescue
photographs, conservation certifications, or organizational endorsements.

## Educational references and external services

[The asset record](docs/assets.md) and in-game patrol citations identify the
educational references used for species facts and visual observation. Referenced
institutional photographs and web pages are linked, not redistributed as game
assets. Their content is not relicensed by this repository.

PayPal Sandbox and Astropods AI Gateway are external services. Their names and
links identify integrations, and the project license does not grant rights to
their services or trademarks. Private service credentials and Sandbox buyer
passwords are not part of this distribution. Organizations, project records,
activities, and budgets shown in the prototype are fictional demo material.
