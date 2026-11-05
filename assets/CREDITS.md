# Artwork sources

All artwork in this directory is available under **CC0 1.0**. The code's licensing is separate.

| Source | Author | Original files / use |
| --- | --- | --- |
| [Platformer Art: Buildings](https://kenney.nl/assets/platformer-art-buildings) | Kenney / Kenney Vleugels | Modular walls, roofs, windows, doors, awnings, signs, chimneys, fences and clock. Original license: LICENSE-kenney-buildings.txt. |
| [Background Elements](https://kenney.nl/assets/background-elements) | Kenney / Kenney Vleugels | Moon, clouds and distant buildings. Original license: LICENSE-kenney-background.txt. |
| [Toon Characters](https://kenney.nl/assets/toon-characters) | Kenney | Male person side and walk poses. Original license: LICENSE-kenney-characters.txt. |
| original/ | Gothere contributors | Additional slate roofs, shutters, window frames, balcony, flowers, umbrella, bracket, cat, signs, ivy, stars and tower silhouette. Released under CC0; see LICENSE-original.txt. |

Sources and licenses were checked on 2026-10-29 from the authors' own download pages and included license files. CC0 permits personal and commercial use, modification and redistribution. [CC0 legal terms](https://creativecommons.org/publicdomain/zero/1.0/).

Palette adaptations wallLavender, wallTeal, wallIndigo, wallRose, wallStone and roofBlue are recolored Kenney images. The traveler poses have transparent margins trimmed. The original/ vector supplements were authored for this project to complement the night palette; they were not taken from Good Night Mr. Snoozleberg. No original-game image, video frame or animation is shipped.

library.json records the source, license, size and relative file of every library entry. Run `node scripts/pack-assets.mjs` after changing artwork or the manifest to regenerate the embedded library used by both online and offline editors. The delivered HTML contains the artwork locally and needs no CDN or network requests.

The v0.26.0 scooter encounter adds 7 original CC0 SVGs under `original/commute/scoot*.svg`: apartment alley, fixed posts, movable barrier, parked bicycles, bins and two rider states. Source drawings are preserved in `scripts/draw-scooter.mjs`. They share the existing street palette and contain no original-game artwork.

The v0.27.0 continuous chapter adds 7 original CC0 SVGs (`original/commute/chapter*.svg`): shared three-street pavement, separate endpoint-bound crossing and alley paving, two small shop modules, company exterior and alley posts. The drawing source is `scripts/draw-commute-chapter.mjs`. They reuse the established palette and LICENSE-original.txt; no third-party or original-game artwork was added.

The v0.27.1 proportion and ground-layout revision adds 11 original CC0 SVGs (`original/commute/block*.svg`): shared ground, street-corner paving and apron, alley paving, three single-story shop modules, apartment, office, low shelter and proportion-corrected rider. Source: `scripts/draw-commute-block.mjs`, under LICENSE-original.txt. The earlier `chapter*.svg` resources remain available for saved drafts. Official screenshots of Hidden Folks and Thank Goodness You're Here! informed spatial composition only; none of their artwork is included.

The v0.16.0 smoke, dust and sparks are drawn procedurally; the six built-in audio cues are synthesized by project code. They add no third-party image/audio files. User-imported audio remains part of the user's level document.

The spatial commute study adds modular street props in original/commute/ (bus, cars, scooters, rails, signals, road textures and office equipment), authored for this project and released under the same LICENSE-original.txt CC0 dedication. Its four worker PNGs are palette adaptations of the bundled Kenney Toon Characters, retaining that pack's CC0 license. These assets are editable library entries; they contain no original Snoozleberg artwork or in-scene text.

The layered street v0.21.0 adds project-authored SVG facades, windows, canopy, breakfast bag, bowl, dog, door, paving and two-frame inward/outward walking clips (`street*.svg`). They use the same LICENSE-original.txt CC0 dedication. These are simple editable demonstration assets, not finished production character animation.

The v0.21.1 crosswalk texture, carriageway and front-facing scooter are also project-authored CC0 SVGs under LICENSE-original.txt. Their perspective and movement are configurable editor data; no original-game artwork is included.

The v0.22.0 bus-stop study adds 19 project-authored CC0 SVGs (`original/commute/stop*.svg`), including the continuous atmosphere/pavement, complete architectural modules, shelter, tree, bus, door, hand and character poses. They use LICENSE-original.txt; `scripts/draw-bus-stop.mjs` retains the vector source construction and shared palette. No third-party or original-game image is included in this set.

The v0.24.0 towing encounter adds 9 project-authored CC0 SVGs (`original/commute/tow*.svg`): a parked car, a tow truck with rolling frame, three pedestrian poses, two car-owner poses and continuous paving. They use LICENSE-original.txt and the established street palette. `scripts/draw-tow-street.mjs` preserves their vector construction; no third-party or original-game image is included.

The v0.25.0 crosswalk encounter adds 14 project-authored CC0 SVGs (`original/commute/cross*.svg`): continuous crossing pavement, a duty umbrella, red/green pedestrian signals, four traffic-officer poses, four pedestrian poses and two inward-walking protagonist frames. They use LICENSE-original.txt and the same street palette; `scripts/draw-crosswalk.mjs` preserves their vector construction. No third-party or original-game image is included.
