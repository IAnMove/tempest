"""Quita el halo blanco (mate) de los sprites RGBA.

Blender escribe los bordes antialias con contribución del fondo claro;
al componer en canvas queda un filo blanco. Esto deshace el mate
suponiendo fondo blanco: rgb' = (rgb - (1-a)*255) / a

Uso: python desmatar.py assets/themes/*/[nombre].png
"""
import sys

from PIL import Image


def desmatar(path):
    im = Image.open(path).convert('RGBA')
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                px[x, y] = (0, 0, 0, 0)
            elif a < 255:
                f = a / 255.0
                px[x, y] = (
                    max(0, min(255, round((r - (1 - f) * 255) / f))),
                    max(0, min(255, round((g - (1 - f) * 255) / f))),
                    max(0, min(255, round((b - (1 - f) * 255) / f))),
                    a,
                )
    im.save(path)
    print('OK', path)


if __name__ == '__main__':
    for p in sys.argv[1:]:
        desmatar(p)
