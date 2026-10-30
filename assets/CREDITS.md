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

The v0.16.0 smoke, dust and sparks are drawn procedurally; the six built-in audio cues are synthesized by project code. They add no third-party image/audio files. User-imported audio remains part of the user's level document.
