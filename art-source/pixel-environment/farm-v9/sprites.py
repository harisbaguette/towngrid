# Crops (4 growth stages), 35 goods and small work parts for farm-v9.
# Crops stand on the 48px sprite's baseline (y=45 -> 181 in the packed cell),
# goods are centred cutouts like the existing resourceGoods atlas.
import numpy as np
from pixel_kit import Sprite, Vox, hexc, tone, stripes, speckle, iso_sprite, outline, to_image

P = {k: hexc(v) for k, v in dict(
    stem='#4d8a32', leaf='#4f9a3b', leaf2='#3b7a30', light='#79bd4f', bark='#6a4428', bark2='#8a5a32',
    cane='#b9c85a', cane2='#8d9a3a', node='#6f5a2e', salt='#f7f6f0', brine='#a4d8d9', blue='#6ab2d8',
    purple='#6b3a8e', grapeg='#c6d765', mint='#5cc47e', mint2='#2f9460', lilac='#b98bd8', orange='#e98a2c',
    orange2='#c96a1c', yellow='#f5d64a', red='#d8373a', white='#f2eee4', cream='#efe1c3', brown='#8e5429',
    wood='#c57b37', plank='#d69a55', choco='#5a3321', choco2='#3f2217', gold='#f2c94c', steel='#7d8793',
    metal='#b4bcc6', glass='#bfe3ea', pink='#f0a2b0', straw='#e2c05a', straw2='#c9a043', clay='#b0603f',
    sand='#e6c985', stone='#d8d2c0', chrome='#c9d6e4', dark='#4a4f5c', bluesteel='#5b86bd', purplecloth='#7a4ab0',
    green='#4f9a3b', sack='#d9c9a0', feed='#7a9b4c', pellet='#9a6a3c', egg='#cfe7df', amber='#e2a02a',
    wax='#f0bf45', milkcap='#3f7fd0', wine='#7a1f2e', winew='#d9d98a', label='#f4ead2', cloth='#c8453a').items()}


def leaf(s, x, y, length, angle, color=None, width=None):
    """Pointed leaf from (x, y) along angle (radians, 0 = right, -pi/2 = up)."""
    color = P['leaf'] if color is None else color
    width = length * .38 if width is None else width
    cx, cy = x + np.cos(angle) * length / 2, y + np.sin(angle) * length / 2
    return s.ellipse(cx, cy, length / 2, width / 2, color, angle=angle)


def stalk(s, x0, y0, x1, y1, color, width=2, nodes=None, node_color=None):
    s.line(x0, y0, x1, y1, color, width)
    if nodes:
        L = np.hypot(x1 - x0, y1 - y0)
        for t in np.arange(nodes, L, nodes) / L:
            s.pixel(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, node_color)
            s.pixel(x0 + (x1 - x0) * t + 1, y0 + (y1 - y0) * t, node_color)


# ----------------------------------------------------------------- crops
BASE = 44


def sugar_crop(stage):
    s = Sprite()
    heights = [8, 16, 26, 32][stage]
    xs = [21, 24, 27] if stage < 2 else [18, 22, 26, 30]
    col = P['light'] if stage < 2 else P['cane'] if stage == 3 else P['stem']
    for n, x in enumerate(xs):
        h = heights - (n % 2) * 4
        s.layer()
        stalk(s, x, BASE, x + (n - 1.5) * .8, BASE - h, col, 2 if stage > 1 else 1, 5 if stage > 1 else None, P['node'] if stage == 3 else P['leaf2'])
        for k in range(1 if stage == 0 else 2 if stage == 1 else 3):
            y = BASE - h * (.45 + k * .22)
            side = 1 if (n + k) % 2 else -1
            leaf(s, x, y, 7 + stage * 2, -np.pi / 2 + side * (1.0 + k * .15), P['leaf'] if k % 2 else P['light'], 2)
        leaf(s, x, BASE - h, 6 + stage, -np.pi / 2 - .5, P['light'], 2)
        leaf(s, x, BASE - h, 6 + stage, -np.pi / 2 + .5, P['leaf'], 2)
    return s


def salt_crop(stage):
    s = Sprite()
    s.ellipse(24, BASE - 1.5, 13, 2.2, P['brine'], shade=False)
    s.layer()
    if stage == 0:
        for x in (18, 23, 28):
            s.ellipse(x, BASE - 1.5, 2.5, 1, P['salt'], shade=False)
        return s
    w, h = [(0, 0), (6, 4), (9, 8), (12, 14)][stage]
    s.poly([(24 - w, BASE), (24 - w * .35, BASE - h * .75), (24, BASE - h), (24 + w * .4, BASE - h * .7), (24 + w, BASE)], P['salt'])
    s.poly([(24, BASE - h), (24 + w * .4, BASE - h * .7), (24 + w, BASE), (24 + 2, BASE)], tone(P['salt'], .86))
    if stage == 3:
        for x, y in ((20, BASE - 9), (26, BASE - 5), (23, BASE - 12)):
            s.pixel(x, y, P['blue'])
        s.pixel(18, BASE - 14, P['white'])
        s.pixel(18, BASE - 15, P['white'])
    return s


def vine_crop(stage, fruit):
    s = Sprite()
    s.line(33, BASE, 33, BASE - 34, P['plank'], 1)
    s.layer()
    h = [10, 22, 28, 30][stage]
    s.line(24, BASE, 24, BASE - h, P['bark'], 2 if stage == 0 else 3)
    if stage == 0:
        s.line(24, BASE - h, 28, BASE - h - 2, P['bark'], 1)
        leaf(s, 28, BASE - h - 2, 4, -.6, P['light'])
        return s
    s.line(24, BASE - h, 12, BASE - h - 2, P['bark'], 2)
    s.line(24, BASE - h, 36, BASE - h - 1, P['bark'], 2)
    s.layer()
    spots = [(12, -8), (18, -10), (24, -12), (30, -10), (36, -8), (15, -3), (33, -3), (24, -5)]
    for n, (x, dy) in enumerate(spots):
        s.ellipse(x, BASE - h + dy + 3, 4.2, 3.4, P['leaf'] if n % 2 else P['leaf2'])
    if stage >= 2:
        s.layer()
        col = P['grapeg'] if stage == 2 else fruit
        r = 1.3 if stage == 2 else 1.7
        rows = 2 if stage == 2 else 4
        for cx in (15, 24, 33):
            for row in range(rows):
                for c in range(rows - row):
                    s.ellipse(cx - (rows - row - 1) * r + c * r * 2, BASE - h + 7 + row * r * 1.8, r, r, col)
    return s


def cocoa_crop(stage):
    s = Sprite()
    if stage == 0:
        s.line(24, BASE, 24, BASE - 6, P['stem'], 1)
        leaf(s, 24, BASE - 6, 6, -2.6, P['leaf'])
        leaf(s, 24, BASE - 6, 6, -.5, P['light'])
        return s
    h = [0, 20, 30, 32][stage]
    s.line(24, BASE, 24, BASE - h, P['bark'], 3)
    s.line(24, BASE - h * .6, 16, BASE - h * .85, P['bark'], 2)
    s.line(24, BASE - h * .55, 33, BASE - h * .8, P['bark'], 2)
    s.layer()
    for x, y, a in ((16, -h * .85, 2.4), (33, -h * .8, .7), (24, -h - 1, -1.6), (12, -h * .7, 2.0), (37, -h * .62, .4), (20, -h * .98, -2.3), (29, -h, -.9)):
        leaf(s, x, BASE + y, 9, a + np.pi / 2 * .0, P['leaf2'] if x % 2 else P['leaf'], 4)
    if stage >= 2:
        s.layer()
        col = P['grapeg'] if stage == 2 else P['orange']
        for x, y in ((21, BASE - h * .45), (27, BASE - h * .38), (24, BASE - h * .2)):
            s.ellipse(x, y, 2.2 if stage == 2 else 2.8, 3.4 if stage == 2 else 4.2, col)
            s.pixel(x, y - 1, tone(col, .7))
    return s


def strawberry_crop(stage):
    s = Sprite()
    n = [3, 6, 7, 8][stage]
    size = [4, 6, 7, 7][stage]
    for k in range(n):
        a = -np.pi / 2 + (k - (n - 1) / 2) * (2.3 / max(1, n - 1))
        s.line(24, BASE, 24 + np.cos(a) * size * 1.3, BASE + np.sin(a) * size * 1.3, P['stem'], 1)
        x, y = 24 + np.cos(a) * size * 1.4, BASE + np.sin(a) * size * 1.4
        for d in (-.5, 0, .5):
            s.ellipse(x + np.cos(a + d) * 2, y + np.sin(a + d) * 2, 2.3, 1.8, P['leaf'] if k % 2 else P['leaf2'])
    if stage == 2:
        s.layer()
        for x, y in ((16, BASE - 8), (31, BASE - 10), (24, BASE - 13)):
            for d in range(5):
                a = d * 1.26
                s.ellipse(x + np.cos(a) * 1.4, y + np.sin(a) * 1.4, 1.1, 1.1, P['white'], shade=False)
            s.pixel(x, y, P['yellow'])
    if stage == 3:
        s.layer()
        for x, y in ((13, BASE - 2), (35, BASE - 3), (22, BASE - 1), (29, BASE - 6)):
            s.poly([(x - 2.8, y - 3), (x + 2.8, y - 3), (x, y + 3)], P['red'])
            s.ellipse(x, y - 2.2, 2.9, 1.6, P['red'])
            s.pixel(x - 1, y - 1, P['yellow'])
            s.pixel(x + 1, y, P['yellow'])
            s.line(x - 2, y - 4, x + 2, y - 4, P['leaf'], 1)
    return s


def mint_crop(stage):
    s = Sprite()
    if stage == 0:
        for x in (19, 29):
            s.line(x, BASE, x, BASE - 4, P['mint2'], 1)
            leaf(s, x, BASE - 4, 4, -.4, P['mint'], 2.6)
            leaf(s, x, BASE - 4, 4, np.pi + .4, P['light'], 2.6)
        return s
    rx, ry = [0, 8, 12, 14][stage], [0, 7, 12, 14][stage]
    rng = np.random.default_rng(40 + stage)
    s.ellipse(24, BASE - ry * .45, rx, ry * .6, P['mint2'], shade=False)
    for n in range([0, 14, 30, 40][stage]):
        a = rng.uniform(np.pi, 2 * np.pi)
        r = np.sqrt(rng.uniform(.1, 1))
        x, y = 24 + np.cos(a) * rx * r, BASE - 1 + np.sin(a) * ry * r
        s.ellipse(x, y, 2.4, 1.7, P['mint'] if n % 3 else P['light'], angle=rng.uniform(-.6, .6), spec=False)
    if stage == 3:
        s.layer()
        for x in (16, 21, 27, 32):
            for k in range(4):
                s.ellipse(x, BASE - ry - 1 - k * 1.8 + (x % 3), 1.3, 1.1, P['lilac'])
    return s


def pumpkin_crop(stage):
    s = Sprite()
    if stage == 0:
        s.line(24, BASE, 24, BASE - 5, P['stem'], 1)
        s.ellipse(21, BASE - 6, 3, 2, P['leaf'])
        s.ellipse(27, BASE - 6, 3, 2, P['light'])
        return s
    s.line(8, BASE - 1, 40, BASE - 2, P['stem'], 1)
    for x, y, r in ((11, BASE - 5, 4.5), (22, BASE - 9, 5.5), (36, BASE - 6, 5)) if stage < 3 else ((9, BASE - 7, 5), (39, BASE - 7, 5), (16, BASE - 12, 5)):
        s.layer()
        s.ellipse(x, y, r, r * .8, P['leaf2'])
        s.line(x, y, x + r * .6, y - r * .5, P['light'], 1)
        s.line(x, y + 4, x, y, P['stem'], 1)
    if stage == 2:
        s.layer()
        s.poly([(29, BASE - 14), (33, BASE - 14), (31, BASE - 8)], P['yellow'])
        s.ellipse(31, BASE - 14, 2.4, 1.2, P['yellow'])
        s.ellipse(16, BASE - 3, 3, 2.6, P['light'])
    if stage == 3:
        s.layer()
        w = 11
        for dx in (-7, 7, -3.5, 3.5, 0):
            s.ellipse(24 + dx, BASE - 8, 5.2, 8, P['orange'] if dx in (-3.5, 3.5) else tone(P['orange'], 1.05))
        s.line(24, BASE - 16, 25, BASE - 20, P['bark'], 2)
        s.line(25, BASE - 20, 29, BASE - 20, P['stem'], 1)
    return s


def oak_crop(stage):
    s = Sprite()
    if stage == 0:
        s.ellipse(24, BASE - 2, 2.4, 2.8, P['brown'])
        s.ellipse(24, BASE - 4.5, 2.8, 1.4, tone(P['bark'], .9))
        s.line(25, BASE - 5, 27, BASE - 10, P['stem'], 1)
        leaf(s, 27, BASE - 10, 5, -.4, P['light'])
        return s
    h = [0, 20, 30, 38][stage]
    if stage == 1:
        s.line(28, BASE, 28, BASE - 18, P['plank'], 1)
    s.layer()
    s.line(24, BASE, 24, BASE - h * .55, P['bark'], [0, 1, 2, 4][stage])
    if stage == 3:
        s.line(24, BASE - 14, 16, BASE - 22, P['bark'], 2)
        s.line(24, BASE - 16, 32, BASE - 24, P['bark'], 2)
    s.layer()
    crowns = {1: [(24, BASE - 17, 5, 4)], 2: [(24, BASE - 24, 8, 6), (19, BASE - 20, 5, 4), (29, BASE - 20, 5, 4)],
              3: [(24, BASE - 31, 11, 8), (14, BASE - 25, 8, 6), (34, BASE - 25, 8, 6), (20, BASE - 35, 7, 5), (29, BASE - 35, 7, 5)]}[stage]
    for n, (x, y, rx, ry) in enumerate(crowns):
        s.ellipse(x, y, rx, ry, P['leaf2'] if n % 2 else hexc('#3d7d2f'))
    if stage == 3:
        for x, y in ((18, BASE - 27), (30, BASE - 29), (25, BASE - 24)):
            s.pixel(x, y, P['brown'])
            s.pixel(x, y - 1, tone(P['bark'], .8))
    return s


def rooted(draw):
    """Nothing of a plant may hang below its root line (round line caps would)."""
    def crop(stage):
        s = draw(stage)
        s.alpha[BASE + 1:, :] = False
        return s
    return crop


CROPS = {k: rooted(f) for k, f in {
    'sugarGrowth': sugar_crop, 'saltGrowth': salt_crop,
    'grapeRedGrowth': lambda n: vine_crop(n, P['purple']), 'grapeWhiteGrowth': lambda n: vine_crop(n, hexc('#d8dc6a')),
    'cocoaGrowth': cocoa_crop, 'strawberryGrowth': strawberry_crop, 'mintGrowth': mint_crop,
    'pumpkinGrowth': pumpkin_crop, 'oakGrowth': oak_crop,
}.items()}


# ----------------------------------------------------------------- goods helpers
def vox_icon(build, fill=.84, n=24, h=24, view=0):
    v = Vox(n, h)
    build(v)
    rgb, alpha, depth = iso_sprite(v, 48, fill, view)
    rgb, alpha = outline(rgb, alpha, depth, threshold=2.5)
    return to_image(rgb, alpha, 4)


def bottle(s, x, color, label, cap):
    s.rect(x - 5, 18, x + 5, 44, color, (.3, .3))
    s.ellipse(x, 18, 5, 3, color, spec=False)
    s.rect(x - 2, 6, x + 2, 17, color, (.3, .3))
    s.rect(x - 2.4, 3, x + 2.4, 8, cap, (.3, .3))
    s.layer()
    s.rect(x - 5, 26, x + 5, 36, label, (.2, .25))
    s.line(x - 3, 29, x + 3, 29, cap, 1)
    s.line(x - 2, 32, x + 2, 32, tone(label, .7), 1)
    s.pixel(x - 3, 21, tone(color, 1.6))
    s.pixel(x - 3, 22, tone(color, 1.6))


def sack(s, x, y, color, band=None):
    s.ellipse(x, y + 5, 12, 12, color)
    s.poly([(x - 6, y - 8), (x + 6, y - 8), (x + 9, y), (x - 9, y)], color)
    s.ellipse(x, y - 8, 6, 2.2, tone(color, .8), shade=False)
    s.line(x - 6, y - 6, x + 6, y - 6, P['bark'], 1)
    if band is not None:
        s.layer()
        s.rect(x - 11, y + 2, x + 11, y + 8, band, (.2, .3))


# ----------------------------------------------------------------- goods
def g_sugarcane():
    s = Sprite()
    for n, (x0, y0, x1, y1) in enumerate(((8, 40, 36, 8), (12, 43, 40, 12), (6, 34, 32, 5))):
        s.layer()
        stalk(s, x0, y0, x1, y1, P['cane'] if n != 1 else tone(P['cane'], 1.1), 4, 6, P['node'])
    s.layer()
    s.line(17, 27, 25, 34, P['bark2'], 3)
    for x, y, a in ((36, 8, -1.2), (40, 12, -.4), (32, 5, -1.9)):
        leaf(s, x, y, 9, a, P['light'], 3)
    return s.image()


def g_salt():
    s = Sprite()
    s.ellipse(24, 34, 18, 9, P['brown'])
    s.rect(6, 28, 42, 34, P['brown'], (.25, .25))
    s.layer()
    s.ellipse(24, 28, 16, 5, tone(P['brown'], .7), shade=False)
    s.layer()
    s.poly([(10, 29), (17, 17), (24, 11), (31, 16), (38, 29)], P['salt'])
    s.poly([(24, 11), (31, 16), (38, 29), (26, 29)], tone(P['salt'], .86))
    for x, y in ((16, 24), (22, 18), (29, 22), (33, 26)):
        s.pixel(x, y, P['blue'])
    for x, y in ((6, 40), (41, 41), (38, 44)):
        s.rect(x - 1, y - 1, x + 1, y + 1, P['salt'])
    return s.image()


def g_grapes(col):
    s = Sprite()
    s.line(24, 4, 23, 11, P['bark'], 2)
    leaf(s, 24, 7, 14, -.25, P['leaf'], 9)
    s.layer()
    r = 3.2
    for row, cnt in enumerate((5, 5, 4, 3, 2, 1)):
        for c in range(cnt):
            s.ellipse(24 - (cnt - 1) * r + c * r * 2, 14 + row * r * 1.7, r, r, col)
    return s.image()


def g_cocoa():
    s = Sprite()
    s.ellipse(20, 22, 10, 15, P['orange'], angle=.35)
    for dx in (-5, 0, 5):
        s.line(20 + dx * .9 - 4, 10, 20 + dx * .9 + 4, 34, tone(P['orange'], .78), 1)
    s.line(25, 7, 28, 3, P['bark'], 2)
    s.layer()
    for x, y in ((31, 38), (37, 34), (26, 42), (36, 42)):
        s.ellipse(x, y, 4, 3, P['choco'], angle=.4)
        s.pixel(x - 1, y - 1, tone(P['choco'], 1.5))
    return s.image()


def g_strawberry():
    s = Sprite()
    for x, y, sc in ((17, 26, 1.0), (31, 30, 1.1)):
        s.layer()
        s.poly([(x - 9 * sc, y - 6 * sc), (x + 9 * sc, y - 6 * sc), (x + 1, y + 12 * sc), (x - 1, y + 12 * sc)], P['red'])
        s.ellipse(x, y - 4 * sc, 9 * sc, 5 * sc, P['red'])
        for dx, dy in ((-4, -2), (0, 0), (4, -2), (-2, 4), (2, 4), (0, 8), (-5, -5), (5, -5)):
            s.pixel(x + dx * sc, y + dy * sc, P['yellow'])
        s.layer()
        for a in (-2.6, -1.57, -.5):
            leaf(s, x, y - 8 * sc, 6 * sc, a, P['leaf'], 3)
    return s.image()


def g_mint():
    s = Sprite()
    s.line(24, 44, 24, 6, P['mint2'], 2)
    for k, y in enumerate((36, 27, 18, 10)):
        size = 13 - k * 2
        leaf(s, 24, y, size, -.35, P['mint'], size * .6)
        leaf(s, 24, y, size, np.pi + .35, P['mint'] if k % 2 else tone(P['mint'], 1.1), size * .6)
        s.line(24, y, 24 + size * .75, y - size * .28, P['mint2'], 1)
        s.line(24, y, 24 - size * .75, y - size * .28, P['mint2'], 1)
    s.ellipse(24, 5, 2.6, 3, P['light'])
    return s.image()


def pumpkin_body(s, cx, cy, rx, ry, col):
    for dx in (-.62, .62, -.3, .3, 0):
        s.ellipse(cx + dx * rx, cy, rx * .45, ry, col if dx in (-.3, .3) else tone(col, 1.06))


def g_pumpkin():
    s = Sprite()
    pumpkin_body(s, 24, 29, 19, 14, P['orange'])
    s.layer()
    s.rect(22, 8, 26, 17, P['bark'], (.3, .3))
    s.line(26, 10, 33, 8, P['stem'], 1)
    leaf(s, 26, 12, 10, -.3, P['leaf'], 6)
    return s.image()


def g_oakwood():
    s = Sprite()
    s.poly([(8, 28), (30, 8), (44, 18), (22, 40)], P['bark'])
    for t in (.2, .45, .7):
        s.line(8 + 22 * t + 3, 28 - 20 * t + 3, 22 + 22 * t + 1, 40 - 22 * t + 1, tone(P['bark'], .72), 1)
    s.layer()
    s.ellipse(15, 34, 9, 9, P['ring'] if 'ring' in P else hexc('#d9b77c'))
    s.ellipse(15, 34, 6, 6, hexc('#c89a5c'), shade=False)
    s.ellipse(15, 34, 3.5, 3.5, hexc('#d9b77c'), shade=False)
    s.ellipse(15, 34, 1.2, 1.2, hexc('#a8773e'), shade=False)
    s.layer()
    leaf(s, 34, 11, 11, -.9, hexc('#3d7d2f'), 7)
    s.ellipse(41, 22, 2.6, 3, P['brown'])
    s.ellipse(41, 19.5, 3, 1.5, P['bark'])
    return s.image()


def g_sugar():
    def b(v):
        for i, j, k in ((0, 0, 0), (8, 0, 0), (0, 8, 0), (8, 8, 0), (4, 4, 8)):
            v.put(v.box(i + 1, i + 8, j + 1, j + 8, k, k + 7), speckle(hexc('#f4f6fb'), hexc('#dfe6f2'), i + j + k, .25))
    return vox_icon(b, .82, 18, 18)


def g_wine(col, label):
    s = Sprite()
    bottle(s, 24, col, P['label'], label)
    return s.image()


def g_barrel():
    s = Sprite()
    body = P['wood']
    s.ellipse(24, 26, 15, 16, body)
    s.rect(9, 11, 39, 41, body, (.28, .3))
    s.ellipse(24, 41, 15, 3, tone(body, .8), shade=False)
    for x in (15, 21, 27, 33):
        s.line(x, 11, x + (x - 24) * .12, 41, tone(body, .78), 1)
    s.layer()
    for y in (14, 26, 38):
        s.rect(8.5 + (y == 26) * -1, y - 1.5, 39.5 + (y == 26), y + 1.5, P['steel'], (.25, .3))
    s.layer()
    s.ellipse(24, 10, 15, 4.5, hexc('#d9b77c'), shade=False)
    s.ellipse(24, 10, 12, 3.2, tone(hexc('#d9b77c'), .9), shade=False)
    s.pixel(24, 10, P['bark'])
    return s.image()


def g_chocolate():
    def b(v):
        v.put(v.box(2, 22, 5, 15, 0, 3), P['choco'])
        seg = lambda I, J, K: np.where(((np.floor(I - 2) % 5 == 0) | (np.floor(J - 5) % 5 == 0))[..., None], P['choco2'], tone(P['choco'], 1.12))
        v.put(v.box(2, 16, 5, 15, 3, 4), seg)
        v.put(v.box(15, 23, 4, 16, 0, 4.5), P['gold'])
        v.put(v.box(17, 23, 3.6, 16.4, 0, 4.8), P['cloth'])
    return vox_icon(b, .86, 24, 10)


def g_jam():
    s = Sprite()
    s.rect(11, 16, 37, 44, P['glass'], (.2, .2))
    s.ellipse(24, 44, 13, 2, P['glass'], shade=False)
    s.layer()
    s.rect(13, 20, 35, 43, P['red'], (.25, .3))
    s.layer()
    s.rect(16, 27, 32, 37, P['label'], (.2, .2))
    s.poly([(22, 29), (26, 29), (24, 35)], P['red'])
    s.pixel(24, 28, P['leaf'])
    s.layer()
    s.poly([(7, 18), (41, 18), (36, 9), (12, 9)], P['white'])
    for x in range(10, 40, 4):
        s.rect(x, 9, x + 2, 18, P['cloth'])
    s.layer()
    s.line(10, 17, 38, 17, P['bark2'], 1)
    s.pixel(8, 20, P['bark2'])
    s.pixel(40, 20, P['bark2'])
    return s.image()


def g_candy():
    s = Sprite()
    for x, y in ((14, 32), (32, 34)):
        s.layer()
        s.ellipse(x, y, 8, 8, P['white'])
        for a in range(3):
            ang = a * 2.09
            s.line(x, y, x + np.cos(ang) * 7, y + np.sin(ang) * 7, P['mint'], 2)
        s.ellipse(x, y, 1.4, 1.4, P['mint2'], shade=False)
    s.layer()
    s.poly([(10, 13), (5, 7), (5, 21)], P['mint'])
    s.poly([(38, 13), (43, 7), (43, 21)], P['mint'])
    s.ellipse(24, 14, 13, 7, P['white'])
    for x in (16, 22, 28):
        s.line(x, 8, x + 4, 20, P['mint'], 2)
    return s.image()


def g_pie():
    def b(v):
        v.put(v.cyl(12, 12, 11, 0, 3), hexc('#c7894a'))
        v.put(v.cyl(12, 12, 10.5, 3, 4.5) & ~v.cyl(12, 12, 8.8, 0, 9), stripes(hexc('#d9a35e'), 'i', 2, .85))
        v.put(v.cyl(12, 12, 8.9, 3, 4), P['orange'])
        v.cut(v.box(12, 30, 12, 30, 0, 9) & (v.J - 12 < (v.I - 12) * .7))
        v.put(v.ball(9, 10, 5, 2.2, 2.2, 1.6), P['white'])
    return vox_icon(b, .86, 24, 10)


def g_lantern():
    s = Sprite()
    pumpkin_body(s, 24, 29, 18, 14, P['orange'])
    s.layer()
    glow = P['yellow']
    s.poly([(14, 25), (20, 25), (17, 19)], glow)
    s.poly([(28, 25), (34, 25), (31, 19)], glow)
    s.poly([(13, 31), (35, 31), (32, 37), (28, 34), (24, 38), (20, 34), (16, 37)], glow)
    s.rect(22, 9, 26, 16, P['bark'], (.3, .3))
    s.layer()
    s.line(24, 9, 24, 3, P['dark'], 1)
    s.line(14, 17, 24, 3, P['dark'], 1)
    s.line(34, 17, 24, 3, P['dark'], 1)
    return s.image()


def g_wool():
    s = Sprite()
    col = hexc('#f1e6cf')
    for x, y, r in ((13, 31, 9), (35, 31, 9), (24, 34, 10), (18, 21, 9), (31, 21, 9), (24, 13, 7)):
        s.ellipse(x, y, r, r * .9, col)
    s.layer()
    rng = np.random.default_rng(11)
    for _ in range(22):
        x, y = rng.uniform(9, 39), rng.uniform(12, 40)
        if ((x - 24) / 17) ** 2 + ((y - 27) / 15) ** 2 < .75:
            s.line(x - 1, y, x + 1, y - 1, tone(col, .8), 1)
    s.layer()
    s.line(7, 33, 41, 29, P['bark2'], 2)
    return s.image()

def g_yarn():
    s = Sprite()
    s.line(8, 10, 40, 38, P['metal'], 2)
    s.line(40, 10, 10, 40, P['metal'], 2)
    s.layer()
    s.ellipse(24, 26, 15, 15, P['pink'])
    for a in (-.6, -.2, .25, .7):
        s.line(24 - 13 * np.cos(a), 26 - 13 * np.sin(a), 24 + 13 * np.cos(a + 1.6), 26 + 13 * np.sin(a + 1.6), tone(P['pink'], .78), 1)
    s.layer()
    s.line(36, 36, 44, 44, P['pink'], 2)
    s.ellipse(8, 10, 2, 2, P['red'])
    s.ellipse(40, 10, 2, 2, P['red'])
    return s.image()


def g_milk():
    s = Sprite()
    s.rect(14, 16, 34, 44, P['white'], (.25, .3))
    s.ellipse(24, 16, 10, 5, P['white'])
    s.rect(18, 6, 30, 14, P['white'], (.25, .3))
    s.layer()
    s.rect(17, 3, 31, 8, P['milkcap'], (.25, .3))
    s.layer()
    s.rect(14, 26, 34, 36, P['milkcap'], (.25, .3))
    s.ellipse(24, 31, 4, 3, P['white'], shade=False)
    s.pixel(17, 19, P['glass'])
    s.pixel(17, 20, P['glass'])
    return s.image()


def g_butter():
    def b(v):
        v.put(v.box(0, 24, 2, 18, 0, 2), hexc('#8fb7d4'))
        v.put(v.box(3, 19, 5, 15, 2, 9), hexc('#f7d65c'))
        v.cut(v.box(15, 19, 5, 15, 6, 9))
        v.put(v.box(19, 24, 9, 10, 2, 3), P['metal'])
    return vox_icon(b, .86, 24, 12)


def g_honey():
    s = Sprite()
    s.ellipse(22, 31, 15, 13, P['amber'])
    s.rect(12, 14, 32, 22, P['amber'], (.25, .3))
    s.ellipse(22, 14, 10, 3, tone(P['amber'], .7), shade=False)
    s.layer()
    s.rect(9, 12, 35, 16, P['cream'], (.2, .2))
    s.layer()
    s.line(26, 12, 38, 2, P['plank'], 2)
    s.ellipse(38, 4, 3, 3, P['plank'])
    s.layer()
    s.rect(14, 28, 30, 36, P['label'], (.2, .2))
    s.ellipse(22, 32, 3, 2, P['gold'])
    s.line(9, 18, 9, 24, P['amber'], 2)
    return s.image()


def g_wax():
    s = Sprite()
    s.poly([(4, 22), (22, 13), (36, 20), (18, 30)], tone(P['wax'], 1.12))
    s.poly([(4, 22), (18, 30), (18, 42), (4, 34)], P['wax'])
    s.poly([(18, 30), (36, 20), (36, 32), (18, 42)], tone(P['wax'], .78))
    for cx, cy in ((12, 21), (20, 17), (28, 20), (20, 24), (12, 25), (28, 16)):
        s.poly([(cx - 2.2, cy), (cx - 1.1, cy - 1.4), (cx + 1.1, cy - 1.4), (cx + 2.2, cy), (cx + 1.1, cy + 1.4), (cx - 1.1, cy + 1.4)], tone(P['wax'], .7))
    for x, h in ((38, 26), (44, 20)):
        s.layer()
        s.rect(x - 3, 44 - h, x + 3, 44, hexc('#f6d36e'), (.3, .3))
        s.ellipse(x, 44 - h, 3, 1.2, tone(hexc('#f6d36e'), 1.15), shade=False)
        s.line(x, 44 - h, x, 40 - h, P['dark'], 1)
    return s.image()


def g_feed():
    s = Sprite()
    col = P['sack']
    s.poly([(10, 44), (7, 30), (10, 16), (14, 11), (34, 11), (38, 16), (41, 30), (38, 44)], col)
    s.poly([(28, 11), (34, 11), (38, 16), (41, 30), (38, 44), (30, 44)], tone(col, .8))
    s.poly([(14, 11), (11, 4), (18, 8), (24, 3), (30, 8), (37, 4), (34, 11)], tone(col, 1.1))
    s.layer()
    s.line(13, 12, 35, 12, P['bark'], 2)
    s.layer()
    s.rect(8, 24, 40, 34, P['feed'], (.2, .3))
    s.ellipse(24, 29, 3, 3, P['straw'], shade=False)
    s.layer()
    for x, y in ((36, 44), (41, 42), (44, 45), (39, 46), (33, 46)):
        s.ellipse(x, y, 2, 1.5, P['pellet'])
    return s.image()


def g_duckegg():
    s = Sprite()
    s.ellipse(24, 36, 19, 8, P['straw2'])
    for x in range(8, 42, 3):
        s.line(x, 32, x + 4, 42, P['straw'], 1)
    s.layer()
    for x, y in ((16, 27), (32, 27), (24, 23)):
        s.layer()
        s.ellipse(x, y, 6, 8, P['egg'])
    s.layer()
    s.ellipse(24, 38, 17, 5, P['straw'])
    return s.image()


def g_clay():
    s = Sprite()
    col = P['clay']
    s.poly([(6, 30), (10, 18), (20, 12), (34, 13), (42, 22), (42, 34), (34, 42), (14, 42)], col)
    s.poly([(34, 13), (42, 22), (42, 34), (34, 42), (30, 42), (34, 26)], tone(col, .78))
    s.layer()
    for x0, y0, x1, y1 in ((12, 24, 18, 21), (22, 17, 28, 16), (26, 30, 32, 27)):
        s.line(x0, y0, x1, y1, tone(col, .82), 1)
    for x, y in ((12, 20), (20, 15), (13, 30)):
        s.pixel(x, y, tone(col, 1.6))
        s.pixel(x + 1, y, tone(col, 1.35))
    s.line(8, 34, 38, 16, tone(col, .7), 1)
    return s.image()


def g_sand():
    s = Sprite()
    s.poly([(4, 42), (14, 26), (24, 16), (34, 26), (44, 42)], P['sand'])
    s.poly([(24, 16), (34, 26), (44, 42), (27, 42)], tone(P['sand'], .86))
    rng = np.random.default_rng(5)
    for _ in range(18):
        x, y = rng.uniform(10, 38), rng.uniform(26, 41)
        s.pixel(x, y, tone(P['sand'], .72))
    s.layer()
    s.ellipse(37, 29, 5, 6, P['metal'], angle=.7)
    s.line(40, 24, 45, 13, P['bark'], 2)
    s.line(42, 13, 47, 14, P['bark'], 2)
    return s.image()


def g_limestone():
    """2026-09-30 redraw: two warm cream cut blocks and a rough chunk with a
    spiral shell fossil and pores, distinct from the grey stone cubes."""
    def b(v):
        cream = hexc('#eadcb4')
        rough = speckle(cream, tone(cream, .86), 7, .22)
        v.put(v.box(1, 13, 1, 9, 0, 7), rough)
        v.put(v.box(1, 13, 10, 18, 0, 7), rough)
        v.put(v.box(3, 12, 3, 16, 7, 13) & ~(v.box(9, 12, 3, 7, 10, 13)), speckle(tone(cream, 1.05), tone(cream, .88), 9, .25))
        v.put(v.box(14, 22, 5, 14, 0, 6) & ~v.box(19, 22, 5, 8, 3, 6), speckle(tone(cream, .95), tone(cream, .8), 11, .3))
        # spiral fossil on the +j face of the top block
        face = (v.J > 15) & (v.J < 16) & (v.I > 3) & (v.I < 12) & (v.K > 7) & (v.K < 13)
        r = np.hypot(v.I - 7.5, v.K - 10)
        ang = np.arctan2(v.K - 10, v.I - 7.5)
        spiral = (np.abs(((r - ang * .45) % 1.4) - .7) < .28) & (r < 2.8)
        v.put(face & spiral, hexc('#a98f5f'))
        v.put(face & (r < .7), hexc('#a98f5f'))
        # pores on the +i face of the chunk
        pores = (v.I > 21) & (v.I < 22) & ((((v.J * 2).astype(int) * 3 + (v.K * 2).astype(int) * 5) % 11) == 0)
        v.put(pores & v.box(14, 22, 5, 14, 0, 6), tone(cream, .7))
    return vox_icon(b, .86, 24, 16)

def g_chromium():
    """2026-09-30 redraw: mirror-bright chrome nuggets (sky band, white glint,
    dark ground reflection) on a green-black chromite lump, so it no longer
    reads as a plain dark rock with spikes."""
    s = Sprite()
    rock = hexc('#3b4a44')
    s.poly([(3, 38), (8, 29), (19, 26), (33, 27), (44, 33), (41, 43), (26, 46), (9, 45)], rock)
    s.poly([(33, 27), (44, 33), (41, 43), (30, 45), (33, 35)], tone(rock, .72))
    for x, y in ((10, 40), (16, 43), (37, 40), (22, 44)):
        s.pixel(x, y, hexc('#5f7a6b'))
    for cx, cy, rx, ry in ((16, 25, 9, 10), (31, 21, 10, 12), (25, 34, 8, 7)):
        s.layer()
        s.poly([(cx - rx, cy + ry * .3), (cx - rx * .5, cy - ry), (cx + rx * .6, cy - ry * .9), (cx + rx, cy + ry * .2), (cx + rx * .4, cy + ry), (cx - rx * .6, cy + ry * .9)], hexc('#8a939e'))
        s.poly([(cx - rx * .9, cy + ry * .1), (cx - rx * .45, cy - ry * .9), (cx + rx * .55, cy - ry * .8), (cx + rx * .85, cy - ry * .05)], hexc('#c6ccd3'))
        s.poly([(cx - rx * .85, cy + ry * .12), (cx + rx * .9, cy + ry * .02), (cx + rx * .95, cy + ry * .22), (cx - rx * .8, cy + ry * .34)], hexc('#ffffff'))
        s.poly([(cx - rx * .7, cy + ry * .5), (cx + rx * .95, cy + ry * .3), (cx + rx * .4, cy + ry), (cx - rx * .6, cy + ry * .9)], hexc('#3a414c'))
        s.poly([(cx + rx * .1, cy + ry * .6), (cx + rx * .7, cy + ry * .45), (cx + rx * .45, cy + ry * .8)], hexc('#9b7a52'))
        s.line(cx - rx * .3, cy - ry * .6, cx - rx * .05, cy - ry * .75, P['white'], 1)
    return s.image()

def g_bluesteel():
    def b(v):
        bar = lambda i, j, k: v.box(i, i + 14, j, j + 5, k, k + 4) & ~(v.box(i, i + 14, j, j + 5, k + 3, k + 4) & ((v.J < j + 1) | (v.J > j + 4)))
        for i, j, k in ((1, 1, 0), (1, 7, 0), (1, 13, 0), (3, 4, 4), (3, 10, 4)):
            v.put(bar(i, j, k), stripes(P['bluesteel'], 'i', 7, 1.25))
    return vox_icon(b, .86, 20, 12)


def g_woodbox():
    def b(v):
        v.put(v.box(1, 17, 1, 17, 0, 14), stripes(P['plank'], 'k', 4, .8))
        edge = (v.I < 2.5) | (v.I > 15.5) | (v.J < 2.5) | (v.J > 15.5)
        v.put(v.box(1, 17, 1, 17, 0, 14) & (((v.K < 1.5) | (v.K > 12.5)) & edge), P['wood'])
        v.put(v.box(1, 17, 1, 17, 0, 14) & (np.abs(v.I - v.K - 2) < .8) & (v.J > 15.5), P['wood'])
        v.put(v.box(1, 17, 1, 17, 0, 14) & (np.abs(v.J - v.K - 2) < .8) & (v.I > 15.5), P['wood'])
        v.put(v.box(1, 17, 1, 17, 13, 14) & (np.floor(v.I) % 5 == 0), P['wood'])
    return vox_icon(b, .80, 18, 16)


def g_clothbox():
    def b(v):
        cloth = stripes(P['purplecloth'], 'k', 3, .9)
        v.put(v.box(1, 17, 1, 17, 0, 12), cloth)
        v.put(v.box(1, 17, 7.5, 10.5, 0, 12.5) | v.box(7.5, 10.5, 1, 17, 0, 12.5), tone(P['purplecloth'], 1.2))
        v.put(v.ball(9, 9, 14, 3.4, 3.4, 2.5), tone(P['purplecloth'], 1.2))
        v.put(v.ball(5.5, 9, 15.5, 2.2, 1.4, 1.6) | v.ball(12.5, 9, 15.5, 2.2, 1.4, 1.6), P['purplecloth'])
    return vox_icon(b, .80, 18, 18)


def g_foodparcel():
    def b(v):
        v.put(v.box(1, 19, 1, 19, 0, 8), stripes(P['plank'], 'k', 3, .8))
        v.cut(v.box(2, 18, 2, 18, 2, 8))
        v.put(v.box(2, 18, 2, 18, 1, 2), P['straw'])
        v.put(v.ball(7, 8, 7, 5.5, 3, 3), hexc('#d99a4a'))
        v.put(v.cyl(14, 6, 2.6, 2, 11), P['red'])
        v.put(v.cyl(14, 6, 2.8, 11, 12), P['white'])
        v.put(v.ball(13, 14, 6, 3, 3, 4), P['amber'])
        v.put(v.box(1, 19, 9.4, 10.6, 0, 8.3) | v.box(9.4, 10.6, 1, 19, 0, 8.3), P['bark2'])
        v.put(v.box(17, 19.4, 15, 18, 4, 7), P['green'])
    return vox_icon(b, .82, 20, 16)


def g_giftparcel():
    def b(v):
        v.put(v.box(1, 17, 1, 17, 0, 12), P['red'])
        v.put(v.box(7.5, 10.5, 0.6, 17.4, 0, 12.4) | v.box(0.6, 17.4, 7.5, 10.5, 0, 12.4), P['gold'])
        v.put(v.ball(6, 9, 14, 3, 2, 2.2) | v.ball(12, 9, 14, 3, 2, 2.2), P['gold'])
        v.put(v.ball(9, 9, 13.5, 1.4), tone(P['gold'], .8))
    return vox_icon(b, .80, 18, 18)


GOODS = {
    'sugarcane': g_sugarcane, 'salt': g_salt, 'grapered': lambda: g_grapes(P['purple']),
    'grapewhite': lambda: g_grapes(hexc('#cfd96a')), 'cocoa': g_cocoa, 'strawberry': g_strawberry,
    'mint': g_mint, 'pumpkin': g_pumpkin, 'oakwood': g_oakwood,
    'sugar': g_sugar, 'winered': lambda: g_wine(P['wine'], P['red']), 'winewhite': lambda: g_wine(P['winew'], P['green']),
    'barrel': g_barrel, 'chocolate': g_chocolate, 'jam': g_jam, 'candy': g_candy, 'pie': g_pie, 'lantern': g_lantern,
    'wool': g_wool, 'yarn': g_yarn, 'milk': g_milk, 'butter': g_butter, 'honey': g_honey, 'wax': g_wax,
    'feed': g_feed, 'duckegg': g_duckegg,
    'clay': g_clay, 'sand': g_sand, 'limestone': g_limestone, 'chromium': g_chromium, 'bluesteel': g_bluesteel,
    'woodbox': g_woodbox, 'clothbox': g_clothbox, 'foodparcel': g_foodparcel, 'giftparcel': g_giftparcel,
}


# ----------------------------------------------------------------- 2026-09-30 goods (section 6)
def g_dough():
    """Risen dough ball in a wooden bowl with a dusting of flour."""
    s = Sprite()
    s.line(4, 16, 40, 8, P['plank'], 3)
    s.ellipse(4, 16, 2, 2, P['bark2'])
    s.ellipse(40, 8, 2, 2, P['bark2'])
    s.layer()
    s.ellipse(24, 32, 19, 12, P['wood'])
    s.rect(5, 26, 43, 32, P['wood'], (.2, .25))
    s.layer()
    s.ellipse(24, 26, 18, 5, tone(P['wood'], .62), shade=False)
    s.layer()
    s.ellipse(24, 22, 14, 10, hexc('#f3e2bd'))
    s.line(17, 20, 25, 23, tone(hexc('#f3e2bd'), .82), 1)
    for x, y in ((14, 18), (29, 16), (22, 14), (33, 22), (8, 25)):
        s.pixel(x, y, P['white'])
    s.layer()
    s.rect(9, 36, 39, 38, tone(P['wood'], .78))
    return s.image()


def g_baguette():
    """Two long crossed loaves with diagonal slashes and a paper sleeve."""
    s = Sprite()
    crust = hexc('#d7963e')
    for (x0, y0, x1, y1) in ((6, 40, 40, 6), (9, 10, 43, 40)):
        s.layer()
        s.line(x0, y0, x1, y1, crust, 9)
        d = 1 if y1 > y0 else -1
        s.line(x0 + 1, y0 - 2, x1 - 1, y1 - 2, tone(crust, 1.18), 3)
        for t in (.22, .4, .58, .76):
            x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            s.line(x - 2, y - 2 * d, x + 2, y + 1 * d, hexc('#f3d9a0'), 1.2)
    s.layer()
    s.poly([(13, 30), (26, 20), (32, 30), (19, 40)], P['label'])
    s.poly([(26, 20), (32, 30), (30, 31), (25, 23)], tone(P['label'], .8))
    s.line(16, 33, 28, 24, P['red'], 1)
    return s.image()


def g_batter():
    """Blue mixing bowl of pale cake batter with a whisk and a drip."""
    s = Sprite()
    s.line(33, 4, 26, 22, P['steel'], 2)
    for dx in (-3, 0, 3):
        s.ellipse(25 + dx * .6, 24, 2.6, 5, P['metal'], shade=False)
    s.layer()
    bowl = hexc('#7fb2e6')
    s.ellipse(24, 32, 20, 12, bowl)
    s.rect(4, 26, 44, 32, bowl, (.2, .25))
    s.layer()
    s.ellipse(24, 26, 19, 5, hexc('#f4e3a8'), shade=False)
    for a in np.linspace(0, 5.5, 14):
        s.pixel(24 + np.cos(a) * a * 2.4, 26 + np.sin(a) * a * .7, tone(hexc('#f4e3a8'), .8))
    s.layer()
    s.ellipse(6, 32, 2, 3.5, hexc('#f4e3a8'), spec=False)
    s.rect(9, 37, 39, 39, tone(bowl, .7))
    return s.image()


def g_fancycake():
    """Whole chocolate layer cake with cream rosettes and strawberries."""
    def b(v):
        cake = speckle(P['choco'], tone(P['choco'], 1.18), 3, .15)
        v.put(v.cyl(10, 10, 9, 0, 1), P['white'])
        v.put(v.cyl(10, 10, 8, 1, 5), cake)
        v.put(v.cyl(10, 10, 8, 5, 6), hexc('#f6e7cf'))
        v.put(v.cyl(10, 10, 8, 6, 10), cake)
        v.put(v.cyl(10, 10, 8.2, 9, 10.5), P['choco2'])
        for a in np.linspace(0, 2 * np.pi, 9)[:-1]:
            ci, cj = 10 + np.cos(a) * 6, 10 + np.sin(a) * 6
            v.put(v.ball(ci, cj, 11, 1.4, 1.4, 1.2), hexc('#fbf4e6'))
        for ci, cj in ((8, 11), (12, 9), (10, 13.5)):
            v.put(v.ball(ci, cj, 12.2, 1.6, 1.6, 1.9), P['red'])
            v.put(v.box(ci - .4, ci + .4, cj - .4, cj + .4, 13.5, 14.5), P['leaf'])
    return vox_icon(b, .98, 20, 16)


def g_decorcake():
    """Tall two-tier white cake with pink piping and mint-candy decorations."""
    s = Sprite()
    s.ellipse(24, 43, 19, 3.5, P['metal'], spec=False)
    s.layer()
    s.rect(8, 28, 40, 42, P['white'], (.25, .3))
    s.ellipse(24, 28, 16, 3.5, tone(P['white'], 1.05), shade=False)
    s.layer()
    s.rect(14, 14, 34, 28, hexc('#f7d7df'), (.25, .3))
    s.ellipse(24, 14, 10, 2.8, tone(hexc('#f7d7df'), 1.08), shade=False)
    s.layer()
    for x in range(9, 40, 3):
        s.ellipse(x, 30, 1.5, 1.2, P['pink'], spec=False)
        s.ellipse(x, 41, 1.5, 1.2, P['pink'], spec=False)
    for x in range(15, 34, 3):
        s.ellipse(x, 16, 1.3, 1.1, P['white'], spec=False)
    for x, y in ((13, 36), (24, 36), (35, 36), (19, 22), (29, 22)):
        s.layer()
        s.ellipse(x, y, 3, 3, P['white'])
        s.line(x - 2.2, y - 1, x + 2.2, y + 1, P['mint'], 1.2)
        s.line(x - 1, y + 2.2, x + 1, y - 2.2, P['mint'], 1.2)
    s.layer()
    s.line(24, 12, 24, 5, P['gold'], 1)
    s.ellipse(24, 4, 2.6, 2.6, P['gold'])
    return s.image()


def g_winebottle():
    """Three empty dark-green wine bottles standing in a small wooden carrier
    (no label: the product is the glass, not the wine)."""
    s = Sprite()
    glass = hexc('#2f6b3f')
    for x in (13, 24, 35):
        s.layer()
        s.rect(x - 4.5, 17, x + 4.5, 42, glass, (.28, .3))
        s.ellipse(x, 17, 4.5, 3, glass, spec=False)
        s.rect(x - 1.6, 5, x + 1.6, 16, glass, (.3, .3))
        s.rect(x - 2, 3, x + 2, 7, hexc('#c9a36a'), (.3, .3))
        s.line(x - 2.8, 20, x - 2.8, 34, tone(glass, 1.7), 1)
    s.layer()
    s.rect(5, 30, 43, 45, P['plank'], (.2, .3))
    s.line(5, 37, 43, 37, tone(P['plank'], .75), 1)
    s.rect(4, 29, 44, 31, P['wood'])
    return s.image()


def g_sangria():
    """Glass pitcher of red sangria with fruit pieces, ice and an orange slice."""
    s = Sprite()
    s.rect(9, 12, 35, 44, P['glass'], (.2, .2))
    s.ellipse(22, 44, 13, 2.2, P['glass'], shade=False)
    s.poly([(9, 12), (4, 9), (10, 16)], P['glass'])
    s.layer()
    wine = hexc('#b3263a')
    s.rect(11, 18, 33, 43, wine, (.2, .35))
    s.ellipse(22, 18, 11, 2.2, tone(wine, 1.25), shade=False)
    s.layer()
    for x, y, c in ((15, 24, P['orange']), (27, 29, P['red']), (19, 35, P['yellow']), (29, 38, P['orange'])):
        s.ellipse(x, y, 2.4, 2, c)
    for x, y in ((24, 20), (16, 30)):
        s.rect(x - 1.8, y - 1.8, x + 1.8, y + 1.8, hexc('#e8f6fb'))
    s.layer()
    s.ellipse(37, 20, 5, 5, P['orange'])
    s.ellipse(37, 20, 3.6, 3.6, hexc('#f6c35b'), shade=False)
    for a in range(4):
        s.line(37, 20, 37 + np.cos(a * .8) * 3.4, 20 + np.sin(a * .8) * 3.4, P['orange'], 1)
    s.line(35, 16, 40, 30, P['glass'], 2)
    s.line(33, 24, 44, 24, tone(P['glass'], .8), 2)
    return s.image()


def g_honeycomb():
    """A hive frame of capped honeycomb with an open, dripping corner:
    rectangular frame and hex cells, unlike the rolled wax sheet."""
    s = Sprite()
    s.rect(3, 8, 45, 12, P['wood'], (.2, .25))
    s.rect(5, 12, 9, 42, P['wood'], (.3, .3))
    s.rect(39, 12, 43, 42, P['wood'], (.3, .3))
    s.rect(5, 40, 43, 43, P['wood'], (.2, .25))
    s.layer()
    s.rect(9, 12, 39, 40, P['amber'])
    capped = hexc('#f2cc6b')
    for row in range(7):
        for col in range(8):
            cx = 11.5 + col * 3.8 + (row % 2) * 1.9
            cy = 14.5 + row * 3.6
            if cx > 38:
                continue
            open_cell = cx + cy > 58
            c = hexc('#c7771e') if open_cell else capped
            s.poly([(cx - 1.7, cy), (cx - .85, cy - 1.5), (cx + .85, cy - 1.5), (cx + 1.7, cy), (cx + .85, cy + 1.5), (cx - .85, cy + 1.5)], c)
            if not open_cell:
                s.pixel(cx - .5, cy - .6, tone(capped, 1.3))
    s.layer()
    for x, h in ((30, 6), (35, 9), (24, 4)):
        s.rect(x - 1, 40, x + 1, 40 + h, P['amber'])
        s.ellipse(x, 40 + h, 1.6, 1.6, P['amber'])
    return s.image()


def g_jetfuel():
    """Blue aviation jerrycan with a white wing emblem and spout, unlike the
    yellow fuel drum and black oil drum."""
    s = Sprite()
    can = hexc('#2f6fb8')
    s.poly([(10, 14), (34, 14), (40, 20), (40, 45), (10, 45)], can)
    s.poly([(34, 14), (40, 20), (40, 45), (34, 45)], tone(can, .72))
    s.rect(9, 14, 11, 45, tone(can, 1.2))
    s.layer()
    s.rect(14, 6, 26, 10, P['steel'], (.3, .3))
    s.rect(14, 9, 17, 15, P['steel'])
    s.rect(23, 9, 26, 15, P['steel'])
    s.poly([(30, 11), (36, 4), (39, 6), (34, 13)], P['metal'])
    s.rect(36, 2, 41, 5, P['red'])
    s.layer()
    s.line(13, 24, 31, 24, tone(can, .7), 1)
    s.line(13, 40, 31, 40, tone(can, .7), 1)
    # white aircraft silhouette: fuselage, swept wings, tail fin
    s.rect(12, 30.5, 32, 33.5, P['white'])
    s.ellipse(32, 32, 2.4, 1.5, P['white'], spec=False)
    s.poly([(19, 31), (24, 23), (27, 23), (25, 31)], P['white'])
    s.poly([(19, 33), (24, 41), (27, 41), (25, 33)], P['white'])
    s.poly([(12, 31), (11, 26), (14, 26), (16, 31)], P['white'])
    return s.image()


# Section 6 goods (2026-09-30) are a separate atlas (farmGoods2) appended after
# the 71 existing goods; the farmGoods atlas keeps its 35 slots.
GOODS2 = {
    'dough': g_dough, 'baguette': g_baguette, 'batter': g_batter, 'fancycake': g_fancycake,
    'decorcake': g_decorcake, 'winebottle': g_winebottle, 'sangria': g_sangria,
    'honeycomb': g_honeycomb, 'jetfuel': g_jetfuel,
}


# ----------------------------------------------------------------- work parts
def p_bees():
    s = Sprite()
    for x, y in ((12, 18), (30, 12), (22, 30), (38, 26), (8, 34)):
        s.layer()
        s.ellipse(x - 1, y - 3, 2.4, 1.6, P['white'], shade=False)
        s.ellipse(x + 2, y - 3, 2.4, 1.6, P['white'], shade=False)
        s.layer()
        s.ellipse(x, y, 3.2, 2.2, P['yellow'])
        s.line(x, y - 2, x, y + 2, P['dark'], 1)
        s.pixel(x + 3, y, P['dark'])
    return s.image()



def p_rotor():
    """Wind-pump wheel seen face-on: sixteen sheet-metal blades between an
    inner and outer ring, red tips. The runtime spins it and projects it onto
    its vertical plane, so it is drawn as a flat disc."""
    s = Sprite()
    blade, tip = hexc('#d8dde3'), P['red']
    for n in range(16):
        a = n * np.pi / 8
        s.layer()
        pts = [(24 + np.cos(a + da) * r, 24 + np.sin(a + da) * r) for r, da in ((6, -.1), (21, -.13), (21, .13), (6, .1))]
        s.poly(pts, blade if n % 2 else tone(blade, .86))
        s.line(24 + np.cos(a) * 19, 24 + np.sin(a) * 19, 24 + np.cos(a) * 21.5, 24 + np.sin(a) * 21.5, tip, 2.2)
    s.layer()
    d = np.hypot(s.X - 24, s.Y - 24)
    s._paint((d > 13.3) & (d < 14.6), P['steel'])
    s.layer()
    s.ellipse(24, 24, 4.5, 4.5, P['dark'])
    s.ellipse(24, 24, 2, 2, P['metal'], spec=False)
    return s.image()


PARTS = {'bees': p_bees, 'rotor': p_rotor}
