# Local application fonts

These font files are bundled with the static artifact so the Home screen and game display remain available offline.

- `Inter-Variable-subset.woff2` is Inter, licensed under the SIL Open Font License 1.1. It is a subset of
  `InterVariable.woff2` from Inter 4.001 (both variable axes, `opsz` 14–32 and `wght` 100–900, are kept).
- `PressStart2P-Regular.woff2` is Press Start 2P, licensed under the SIL Open Font License 1.1 (Reserved Font Name
  "Press Start 2P"). It is `PressStart2P-Regular.ttf` 3.000 compressed to WOFF2 only, with every glyph and table
  unchanged (the WOFF2 encoder drops the empty `DSIG` signature), so it is not a modified version and keeps its name.

Sources: <https://github.com/rsms/inter> and <https://github.com/google/fonts/tree/main/ofl/pressstart2p>.

## How the files were generated

The fonts are generated once and committed; the build copies them as they are. They are small so the first paint is not
held up on a slow network (the task 10.2 Lighthouse check). Both were made with fontTools 4 (`pip install fonttools
brotli`):

```sh
# Inter: Latin-1, Ukrainian and Russian Cyrillic, punctuation, the currency, arrow and minus signs the catalogs use,
# and the suit symbols. Default OpenType features plus tnum (tabular figures); every name record, including the
# copyright and licence, is kept.
pyftsubset InterVariable.woff2 \
    --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0400-045F,U+0490-0491,U+2000-206F,U+20AC,U+20B4,U+2116,U+2122,U+2190-2199,U+2212,U+2215,U+2660-2667,U+FEFF,U+FFFD" \
    --layout-features+=tnum --name-IDs='*' --flavor=woff2 --output-file=Inter-Variable-subset.woff2

# Press Start 2P: WOFF2 compression only, no subsetting.
python -c "from fontTools.ttLib import woff2; woff2.compress('PressStart2P-Regular.ttf', 'PressStart2P-Regular.woff2')"
```

If a catalog gains a character outside the Inter ranges above, regenerate the subset with that character added;
otherwise the browser draws it with a fallback font.
