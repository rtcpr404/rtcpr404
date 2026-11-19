#!/usr/bin/env python3
"""Traces the letter outlines that build.mjs draws with and writes scripts/glyphs.json.

    python3 scripts/glyphs.py path/to/node_modules/@fontsource

Needs fontTools, plus the @fontsource/unbounded and @fontsource/dm-mono packages.
Both typefaces are under the SIL Open Font License 1.1; the notice goes to scripts/OFL.txt.
"""
import json
import pathlib
import sys

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont

packages = pathlib.Path(sys.argv[1])
here = pathlib.Path(__file__).resolve().parent

FACES = {
    "d": ("unbounded", "unbounded-latin-700-normal.woff"),  # key legends and figures
    "m": ("dm-mono", "dm-mono-latin-400-normal.woff"),  # text
    "b": ("dm-mono", "dm-mono-latin-500-normal.woff"),  # text, emphasised
}

out = {}
for key, (package, file) in FACES.items():
    font = TTFont(packages / package / "files" / file)
    glyph_set, cmap, widths, os2 = font.getGlyphSet(), font.getBestCmap(), font["hmtx"], font["OS/2"]
    glyphs = {}
    for code in range(0x20, 0x7F):  # printable ASCII
        name = cmap.get(code)
        if name is None:
            continue
        pen = SVGPathPen(glyph_set, ntos=lambda v: str(int(round(v))))
        glyph_set[name].draw(pen)
        glyphs[str(code)] = [widths[name][0], pen.getCommands()]
    out[key] = {"upm": font["head"].unitsPerEm, "cap": os2.sCapHeight, "x": os2.sxHeight, "g": glyphs}

(here / "glyphs.json").write_text(json.dumps(out, separators=(",", ":")))

licence = (packages / "unbounded" / "LICENSE").read_text()
notice = """The letter outlines in glyphs.json come from two typefaces, each under the
SIL Open Font License, Version 1.1. Only the printable ASCII glyphs are included.

Unbounded (key legends and figures)
Copyright 2022 The Unbounded Project Authors (https://github.com/googlefonts/unbounded)

DM Mono (text)
Copyright 2020 The DM Mono Project Authors (https://www.github.com/googlefonts/dm-mono)

"""
(here / "OFL.txt").write_text(notice + licence[licence.index("This Font Software is licensed under") :])
print(f"glyphs.json: {sum(len(face['g']) for face in out.values())} glyphs from {len(out)} faces")
