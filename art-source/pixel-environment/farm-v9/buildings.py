# Voxel models for the 22 facilities of docs/EXPANSION_20260929.md.
# One tile footprint = cells 1..38 on a 40-cell grid; slab top is k=5.
# The front (door / sign face) is +j so it reads in the SE and SW rows.
import numpy as np
from pixel_kit import Vox, hexc, tone, stripes, bricks, speckle, checker

C = {k: hexc(v) for k, v in dict(
    dirt='#a68b66', dirt2='#98805d', soil='#6d412a', soil2='#553222', wood='#c57b37', wood2='#8e5429',
    plank='#d69a55', metal='#aab2bc', steel='#7d8793', stone='#a7a39a', stone2='#8c887f', white='#f0ece2',
    cream='#efe1c3', red='#c8452f', barn='#b43a2c', roof='#7c4a36', slate='#5d6675', grass='#6ea544',
    grass2='#57903a', grass3='#86bd55', water='#4b9fd6', water2='#8ad0f0', water3='#3c83bd', straw='#e2c05a',
    straw2='#c9a043', black='#2d2c33', pink='#f0a2b0', gold='#f2c94c', green='#4f9a3b', leaf='#3f8a34',
    sand='#e1c37d', sand2='#cda968', clay='#a9573a', clay2='#c98052', mud='#77705d', copper='#c9804b',
    choco='#5a3321', choco2='#3f2217', purple='#6a3a8c', teal='#3d8c95', blue='#2d4f8f', blue2='#7fb2e6',
    brine='#a4d8d9', salt='#f7f6f0', orange='#e98a2c', hay='#e6c162', bark='#5f4027', ring='#d9b77c',
    sack='#d9c9a0', feedgreen='#7a9b4c', lilac='#b98bd8', cow='#f4f1ea', nose='#e9a7a0', yellow='#f5d64a',
    brick='#b8583d', silo='#b9c3cc').items()}

N = 40


def model():
    return Vox(N, 56)


def slab(v, color=None, seed=1):
    color = C['dirt'] if color is None else color
    v.put(v.box(1, 39, 1, 39, 0, 5), speckle(color, tone(color, .92), seed, .22))


def ground(v, color, other, seed, height=3):
    """Low terrain facility: no raised slab, only a thin ground plate."""
    v.put(v.box(1, 39, 1, 39, 0, height), speckle(color, other, seed, .30))


def post(v, i, j, k0, k1, color=None, w=1):
    v.put(v.box(i, i + w, j, j + w, k0, k1), C['wood2'] if color is None else color)


def corner_posts(v, lo=2, hi=36, k1=10):
    for i in (lo, hi):
        for j in (lo, hi):
            v.put(v.box(i, i + 2, j, j + 2, 5, k1), C['metal'])
            v.put(v.box(i, i + 2, j, j + 2, k1 - 1, k1), tone(C['metal'], 1.2))


def frame(v, lo, hi, k0=5, k1=8, color=None):
    color = C['wood'] if color is None else color
    ring = v.box(lo, hi, lo, hi, k0, k1) & ~v.box(lo + 1, hi - 1, lo + 1, hi - 1, k0, k1)
    v.put(ring, stripes(color, 'k', 3, .82))


PLOTS = [(14.5, 14.5), (14.5, 25.5), (25.5, 14.5), (25.5, 25.5)]


def plots(v, color, rim=None, k1=7, size=4.5):
    for ci, cj in PLOTS:
        m = v.box(ci - size, ci + size, cj - size, cj + size, 4, k1)
        v.put(m, speckle(color, tone(color, .82), int(ci * 7 + cj), .25))
        if rim is not None:
            r = m & ~v.box(ci - size + 1, ci + size - 1, cj - size + 1, cj + size - 1, 4, k1)
            v.put(r & (v.K > k1 - 1), rim)


def board(v, i0, j, k0, pattern, pal, legs=True, frame_color=None):
    """Icon sign: one voxel thick along j, so every quarter view shows it."""
    rows, cols = len(pattern), len(pattern[0])
    fc = C['wood2'] if frame_color is None else frame_color
    if legs:
        post(v, i0 + 1, j, 5, k0 + 1)
        post(v, i0 + cols, j, 5, k0 + 1)
    v.put(v.box(i0, i0 + cols + 2, j, j + 1, k0, k0 + rows + 2), fc)
    for r, line in enumerate(pattern):
        for c, ch in enumerate(line):
            if ch != '.':
                v.put(v.box(i0 + 1 + c, i0 + 2 + c, j, j + 1, k0 + rows - r, k0 + rows - r + 1), pal[ch])
            else:
                v.put(v.box(i0 + 1 + c, i0 + 2 + c, j, j + 1, k0 + rows - r, k0 + rows - r + 1), C['plank'])


def barrel_i(v, cj, ck, i0, i1, r=3.2):
    """Oak barrel lying along i with dark hoops."""
    m = v.cyl_i(cj, ck, r, i0, i1)
    mid = (i0 + i1) / 2
    bulge = v.cyl_i(cj, ck, r + .7, mid - 1.5, mid + 1.5)
    v.put(m | bulge, stripes(C['wood'], 'k', 2, .9))
    for hi in (i0 + 1, i1 - 2):
        v.put(v.cyl_i(cj, ck, r + .45, hi, hi + 1), C['steel'])
    v.put(v.cyl_i(cj, ck, r - 1.2, i1 - 1, i1), tone(C['ring'], .95))


def barrel_up(v, ci, cj, k0, h=8, r=3.0, lid=None):
    v.put(v.cyl(ci, cj, r, k0, k0 + h) | v.cyl(ci, cj, r + .6, k0 + h / 2 - 1.5, k0 + h / 2 + 1.5), stripes(C['wood'], 'i', 2, .9))
    for k in (k0 + 1, k0 + h - 2):
        v.put(v.cyl(ci, cj, r + .5, k, k + 1), C['steel'])
    v.put(v.cyl(ci, cj, r - .8, k0 + h - 1, k0 + h), C['ring'] if lid is None else lid)


def sheep(v, ci, cj, k0, face='j'):
    wool = speckle(C['white'], tone(C['white'], .88), int(ci * 13 + cj), .35)
    along_i = face == 'i'
    ri, rj = (3.6, 2.6) if along_i else (2.6, 3.6)
    v.put(v.ball(ci, cj, k0 + 4.2, ri, rj, 2.6), wool)
    for di in (-1.5, 1.5):
        for dj in (-1.5, 1.5):
            a, b = (ci + di * 1.4, cj + dj) if along_i else (ci + di, cj + dj * 1.4)
            v.put(v.box(a - .5, a + .5, b - .5, b + .5, k0, k0 + 2), C['black'])
    hi, hj = (ci + 4.2, cj) if along_i else (ci, cj + 4.2)
    v.put(v.ball(hi, hj, k0 + 5.4, 1.5, 1.5, 1.6), C['black'])
    v.put(v.ball(hi, hj, k0 + 7.0, 1.2, 1.2, .8), C['white'])


def cow(v, ci, cj, k0):
    """Black-and-white dairy cow facing +j."""
    patch = lambda I, J, K: np.where((((np.floor(I / 3) + np.floor(J / 4) + np.floor(K / 3)) % 3) == 0)[..., None], C['black'], C['cow'])
    v.put(v.box(ci - 2.5, ci + 2.5, cj - 5, cj + 4, k0 + 3, k0 + 8), patch)
    for a in (ci - 2, ci + 1):
        for b in (cj - 4, cj + 2):
            v.put(v.box(a, a + 1, b, b + 1.5, k0, k0 + 3), C['black'])
    v.put(v.box(ci - 1.5, ci + 1.5, cj + 4, cj + 7, k0 + 5, k0 + 9), C['cow'])
    v.put(v.box(ci - 1.5, ci + 1.5, cj + 6, cj + 7.5, k0 + 5, k0 + 7), C['nose'])
    v.put(v.box(ci - 2.5, ci - 1.5, cj + 4.5, cj + 5.5, k0 + 8, k0 + 10), C['cream'])
    v.put(v.box(ci + 1.5, ci + 2.5, cj + 4.5, cj + 5.5, k0 + 8, k0 + 10), C['cream'])
    v.put(v.box(ci - .5, ci + .5, cj - 3, cj - 1, k0 + 1, k0 + 3), C['nose'])


def duck(v, ci, cj, k0, s=1.0):
    v.put(v.ball(ci, cj, k0 + 1.8 * s, 2.0 * s, 2.8 * s, 1.7 * s), C['white'])
    v.put(v.ball(ci, cj + 2.4 * s, k0 + 4.0 * s, 1.2 * s), C['white'])
    v.put(v.box(ci - .5, ci + .5, cj + 3.2 * s, cj + 4.6 * s, k0 + 3.2 * s, k0 + 4.2 * s), C['orange'])
    v.put(v.box(ci - 1, ci + 1, cj - 3.2 * s, cj - 2.2 * s, k0 + 2 * s, k0 + 3 * s), tone(C['white'], .9))


def hive(v, ci, cj, k0, layers=3):
    cols = [C['white'], C['gold'], C['cream'], C['gold']]
    k = k0
    v.put(v.box(ci - 3.5, ci + 3.5, cj - 3.5, cj + 3.5, k, k + 1), C['wood2'])
    k += 1
    for n in range(layers):
        v.put(v.box(ci - 3, ci + 3, cj - 3, cj + 3, k, k + 3), cols[n % 4])
        v.put(v.box(ci - 3.2, ci + 3.2, cj - 3.2, cj + 3.2, k + 2, k + 3), tone(cols[n % 4], .86))
        k += 3
    v.put(v.box(ci - 3.8, ci + 3.8, cj - 3.8, cj + 3.8, k, k + 1), C['slate'])
    v.put(v.gable_i(ci - 3.8, ci + 3.8, cj - 3.8, cj + 3.8, k, 1.6), C['slate'])
    # entrance slot on the two camera-facing sides
    v.put(v.box(ci - 1.5, ci + 1.5, cj + 2.5, cj + 3.2, k0 + 1, k0 + 2), C['black'])
    v.put(v.box(ci + 2.5, ci + 3.2, cj - 1.5, cj + 1.5, k0 + 1, k0 + 2), C['black'])


def flowers(v, seed, count, colors, area=(3, 37), k=5, avoid=None):
    rng = np.random.default_rng(seed)
    for _ in range(count):
        i, j = rng.integers(area[0], area[1], 2)
        if avoid is not None and avoid(i, j):
            continue
        v.put(v.box(i, i + 1, j, j + 1, k, k + 1), C['leaf'])
        v.put(v.box(i, i + 1, j, j + 1, k + 1, k + 2), colors[rng.integers(len(colors))])


def tufts(v, seed, count, area=(3, 37), k=3, avoid=None, color=None):
    rng = np.random.default_rng(seed)
    for _ in range(count):
        i, j = rng.integers(area[0], area[1], 2)
        if avoid is not None and avoid(i, j):
            continue
        h = rng.integers(2, 4)
        v.put(v.box(i, i + 1, j, j + 1, k, k + h), C['grass2'] if color is None else color)
        v.put(v.box(i, i + 1, j, j + 1, k + h - 1, k + h), C['grass3'])


# ----------------------------------------------------------------- farms
ICON = {
    'cane': (['..g.g.', '.gGgG.', '..G.G.', '..B.B.', '..G.G.', '..G.G.'], {'g': C['grass3'], 'G': C['green'], 'B': C['bark']}),
    'salt': (['......', '..ww..', '.wwWw.', 'wwWwww', 'bbbbbb', '......'], {'w': C['salt'], 'W': C['brine'], 'b': C['water']}),
    'grape': (['...gg.', '..pp..', '.pPpP.', '.pPpp.', '..pP..', '...p..'], {'g': C['green'], 'p': C['purple'], 'P': tone(C['purple'], 1.3)}),
    'cocoa': (['...g..', '..oo..', '.oOoo.', '.ooOo.', '.oOoo.', '..oo..'], {'g': C['green'], 'o': C['orange'], 'O': C['choco']}),
    'berry': (['.g.g..', '..gg..', '.rrrr.', '.rYrr.', '..rYr.', '...r..'], {'g': C['green'], 'r': C['red'], 'Y': C['yellow']}),
    'mint': (['..gg..', '.gGGg.', 'gGggGg', '.gGGg.', '..gg..', '...b..'], {'g': hexc('#59c07a'), 'G': hexc('#2f8f58'), 'b': C['bark']}),
    'pumpkin': (['...g..', '..bg..', '.oOoO.', 'oOoOoo', 'oOoOoo', '.oooo.'], {'g': C['green'], 'b': C['bark'], 'o': C['orange'], 'O': tone(C['orange'], .8)}),
    'acorn': (['..b...', '.BBBB.', 'BBbBBB', '.aaaa.', '.aAaa.', '..aa..'], {'b': C['bark'], 'B': tone(C['bark'], 1.2), 'a': C['wood'], 'A': C['plank']}),
}


def field_base(v, seed, soil=None, frame_color=None):
    slab(v, seed=seed)
    frame(v, 7, 33, 5, 8, frame_color)
    v.put(v.box(8, 32, 8, 32, 4, 6), speckle(C['soil2'] if soil is None else tone(soil, .8), C['soil2'], seed, .2))
    corner_posts(v, 6, 32, 10)


def sugarfield():
    v = model()
    field_base(v, 11)
    plots(v, C['soil'])
    # irrigation channels between the plots: sugarcane is the thirstiest crop
    v.put((v.box(19, 21, 8, 32, 4, 7) | v.box(8, 32, 19, 21, 4, 7)), C['water'])
    v.put((v.box(19, 21, 8, 32, 6, 7) | v.box(8, 32, 19, 21, 6, 7)) & ((((v.I + v.J) * 1.0).astype(int) % 6) == 0), C['water2'])
    board(v, 2, 3, 10, *ICON['cane'])
    # tied bundle of cut cane at the front corner
    for di, dj in ((0, 0), (1.5, .5), (.5, 1.6), (-1, 1)):
        v.put(v.box(34 + di, 35 + di, 34 + dj, 35 + dj, 5, 17), stripes(C['straw'], 'k', 3, .7))
    v.put(v.box(33.2, 36.8, 33.5, 37, 10, 11), C['wood2'])
    v.put(v.box(33, 37, 33, 37, 16, 18), C['grass3'])
    barrel_up(v, 35, 5, 5, 7, 2.4, C['water'])
    return v


def saltfield():
    v = model()
    slab(v, C['stone'], 12)
    # four shallow evaporation pans with low stone curbs
    for ci, cj in PLOTS:
        v.put(v.box(ci - 5, ci + 5, cj - 5, cj + 5, 4, 7), C['stone2'])
        v.put(v.box(ci - 4, ci + 4, cj - 4, cj + 4, 4, 7), C['brine'])
        v.put(v.box(ci - 4, ci + 4, cj - 4, cj + 4, 6, 7) & (((v.I + v.J) % 5) < 1.2), C['salt'])
    # crystal heap and rake at the back, sluice gate at the front
    v.put(v.cone(5.5, 33, 4.5, 4, 14), speckle(C['salt'], tone(C['salt'], .9), 3, .3))
    v.put(v.box(33, 34, 3, 16, 12, 13), C['wood2'])
    v.put(v.box(33, 34, 3, 4, 7, 13), C['wood2'])
    v.put(v.box(31, 36, 15, 16, 10, 13), C['wood'])
    v.put(v.box(19.5, 20.5, 2, 38, 5, 7) | v.box(2, 38, 19.5, 20.5, 5, 7), C['stone'])
    board(v, 2, 3, 9, *ICON['salt'])
    v.put(v.box(34, 38, 34, 38, 5, 8), C['sack'])
    v.put(v.box(34.5, 37.5, 34.5, 37.5, 8, 9), C['salt'])
    return v


def vineyard():
    v = model()
    field_base(v, 13)
    for cj in (14.5, 25.5):
        v.put(v.box(9, 31, cj - 3, cj + 3, 4, 7), speckle(C['soil'], C['soil2'], int(cj), .3))
        for i in (8, 20, 31):
            post(v, i, cj - .5, 5, 22)
            v.put(v.box(i, i + 1, cj - .5, cj + .5, 21, 22), C['bark'])
        for k in (13, 18):
            v.put(v.box(8, 32, cj - .1, cj + .3, k, k + .6), C['steel'])
    board(v, 2, 3, 10, *ICON['grape'])
    # harvest basket of grapes
    v.put(v.cyl(35, 35, 2.8, 5, 9), stripes(C['straw2'], 'k', 2, .8))
    v.put(v.ball(35, 35, 9, 2.4, 2.4, 1.6), C['purple'])
    v.put(v.ball(34.5, 34, 10, 1), tone(C['purple'], 1.3))
    return v


def cocoafarm():
    v = model()
    field_base(v, 14, hexc('#4b2c1d'), C['wood2'])
    plots(v, hexc('#4b2c1d'), None)
    # raised drying tray of fermented beans at the back
    for i in (3, 14):
        for j in (3, 11):
            post(v, i, j, 5, 11)
    v.put(v.box(2.5, 15.5, 2.5, 12.5, 11, 12), C['plank'])
    v.put(v.box(3.5, 14.5, 3.5, 11.5, 12, 13), speckle(C['choco'], tone(C['choco'], 1.4), 5, .35))
    board(v, 24, 2, 10, *ICON['cocoa'])
    # basket of ripe pods at the front
    v.put(v.cyl(34.5, 34.5, 3, 5, 9), stripes(C['straw2'], 'k', 2, .8))
    for a, b, k, col in ((33.5, 34, 10, 'orange'), (35.5, 35, 10, 'yellow'), (34.5, 36, 11, 'orange')):
        v.put(v.ball(a, b, k, 1.3, 1.3, 2), C[col])
    return v


def berryfield():
    v = model()
    field_base(v, 15)
    # straw mulch rows with low hoops
    for ci, cj in PLOTS:
        m = v.box(ci - 4.5, ci + 4.5, cj - 4.5, cj + 4.5, 4, 7)
        v.put(m, speckle(C['straw'], C['straw2'], int(ci + cj), .35))
        hoop = (np.abs(np.hypot(v.I - ci, v.K - 7) - 4) < .5) & (np.abs(v.J - cj) < .5) & (v.K > 7)
        v.put(hoop, C['metal'])
    board(v, 2, 3, 10, *ICON['berry'])
    # crate of picked berries
    v.put(v.box(32, 37, 33, 37, 5, 9), stripes(C['plank'], 'k', 2, .8))
    v.put(v.box(32.5, 36.5, 33.5, 36.5, 9, 10), speckle(C['red'], tone(C['red'], 1.3), 9, .35))
    return v


def mintfield():
    v = model()
    slab(v, seed=16)
    # stone-edged beds instead of a timber frame
    v.put(v.box(7, 33, 7, 33, 4, 7), speckle(C['stone'], C['stone2'], 16, .4))
    plots(v, C['soil'], None)
    corner_posts(v, 6, 32, 9)
    board(v, 2, 3, 10, *ICON['mint'])
    # metal watering can at the front
    v.put(v.cyl(35, 34.5, 2.2, 5, 10), C['teal'])
    v.put(v.box(35, 36, 36, 39, 7, 8), C['teal'])
    v.put(v.box(34.5, 35.5, 33, 36, 10.5, 11.5), C['steel'])
    # drying bundles hanging on a rail at the back right
    post(v, 33, 3, 5, 17)
    post(v, 33, 14, 5, 17)
    v.put(v.box(33, 34, 3, 15, 16, 17), C['wood2'])
    for j in (5, 8, 11):
        v.put(v.box(33, 34, j, j + 2, 11, 16), hexc('#59c07a'))
    return v


def pumpkinpatch():
    v = model()
    field_base(v, 17)
    plots(v, C['soil'])
    # scarecrow at the back corner
    post(v, 4, 4, 5, 25)
    v.put(v.box(1.5, 7.5, 4, 5, 19, 20), C['wood2'])
    v.put(v.box(2.5, 6.5, 3, 6, 14, 20), C['red'])
    v.put(v.ball(4.5, 4.5, 22.5, 2.2), C['sack'])
    v.put(v.box(1.5, 7.5, 1.5, 7.5, 24, 25), C['straw2'])
    v.put(v.box(3, 6, 3, 6, 25, 27), C['straw'])
    board(v, 24, 2, 10, *ICON['pumpkin'])
    # harvested pumpkins at the front
    for a, b, r in ((34.5, 34, 2.6), (31.5, 36, 2.0), (36, 30.5, 1.9)):
        v.put(v.ball(a, b, 5 + r * .8, r, r, r * .8) & (np.abs(((np.arctan2(v.J - b, v.I - a) * 3 / np.pi) % 1) - .5) < .45), C['orange'])
        v.put(v.ball(a, b, 5 + r * .8, r, r, r * .8), stripes(C['orange'], 'i', 2, .82))
        v.put(v.box(a - .5, a + .5, b - .5, b + .5, 5 + r * 1.6, 6.5 + r * 1.6), C['green'])
    return v


def oakfarm():
    v = model()
    slab(v, seed=18)
    v.put(v.box(7, 33, 7, 33, 4, 6), speckle(C['grass2'], C['grass'], 18, .4))
    plots(v, C['soil'], None, 6, 3.5)
    corner_posts(v, 6, 32, 9)
    # stacked oak logs at the back, pale end rings facing the camera sides
    for n, (cj, ck) in enumerate(((5, 7.2), (9.4, 7.2), (7.2, 11))):
        m = v.cyl_i(cj, ck, 2.2, 22, 36)
        v.put(m, stripes(C['bark'], 'i', 3, .8))
        v.put(v.cyl_i(cj, ck, 1.6, 35, 36), C['ring'])
    # chopping stump and axe
    v.put(v.cyl(34, 34, 2.6, 4, 9), C['bark'])
    v.put(v.cyl(34, 34, 2.0, 8, 9), C['ring'])
    v.put(v.box(33.5, 34.5, 33.5, 34.5, 9, 15), C['wood2'])
    v.put(v.box(33, 35, 33, 34.5, 13, 15), C['metal'])
    board(v, 3, 2, 10, *ICON['acorn'])
    return v


# ----------------------------------------------------------------- livestock
def sheeppen():
    v = model()
    slab(v, seed=21)
    v.put(v.box(2, 38, 2, 38, 4, 5.5), speckle(C['grass'], C['grass2'], 21, .35))
    # post-and-rail fence around the pen
    for a in range(2, 38, 5):
        for i, j in ((a, 2), (a, 37), (2, a), (37, a)):
            post(v, i, j, 5, 12, C['wood2'])
    for k in (8, 11):
        rail = (v.box(2, 38, 2, 3, k, k + 1) | v.box(2, 38, 37, 38, k, k + 1) | v.box(2, 3, 2, 38, k, k + 1) | v.box(37, 38, 2, 38, k, k + 1))
        v.put(rail, C['wood'])
    # shed at the back with a lean-to roof
    v.put(v.box(3, 15, 3, 15, 5, 16), stripes(C['plank'], 'i', 3, .82))
    lean = v.box(2, 16, 2, 16, 15, 22) & (v.K < 22 - (v.J - 2) * .45)
    v.put(lean, stripes(C['red'], 'j', 2, .85))
    v.put(v.box(6, 12, 14.8, 15.2, 5, 12), C['black'])
    # hay trough
    v.put(v.box(24, 35, 4, 8, 5, 9), C['wood2'])
    v.put(v.box(24.5, 34.5, 4.5, 7.5, 9, 10), C['hay'])
    sheep(v, 22, 23, 5, 'j')
    sheep(v, 13, 28, 5, 'i')
    sheep(v, 29, 31, 5, 'i')
    return v


def milkbarn():
    v = model()
    slab(v, seed=22)
    # red barn with a gambrel roof
    body = v.box(4, 24, 4, 26, 5, 20)
    v.put(body, stripes(C['barn'], 'i', 3, .85))
    for k0, w in ((20, 0), (21, 1), (22, 2), (23, 3.5), (24, 5), (25, 6.5), (26, 8)):
        v.put(v.box(3, 25, 4 + w * .0 + (k0 - 20) * .9, 26 - (k0 - 20) * .9, k0, k0 + 1), C['slate'])
    v.put(v.box(3, 25, 3, 27, 19, 20), C['white'])
    # big door with white X trim and the hay loft
    v.put(v.box(9, 19, 25.5, 26.2, 5, 15), C['white'])
    v.put(v.box(10, 18, 25.5, 26.4, 6, 14), tone(C['barn'], .8))
    x = (np.abs((v.I - 10) - (v.K - 6)) < .7) | (np.abs((v.I - 10) - (14 - v.K)) < .7)
    v.put(x & v.box(10, 18, 25.5, 26.6, 6, 14), C['white'])
    v.put(v.box(12, 16, 25.5, 26.4, 16, 19), C['black'])
    v.put(v.box(23.5, 24.4, 10, 16, 9, 14), C['white'])
    v.put(v.box(23.6, 24.6, 11, 15, 10, 13), C['black'])
    # cow in the paddock and milk churns
    cow(v, 31, 16, 5)
    for a, b in ((7, 32), (10, 34), (6.5, 35.5)):
        v.put(v.cyl(a, b, 1.4, 5, 10), C['metal'])
        v.put(v.cyl(a, b, .8, 10, 11), C['steel'])
    for a in range(27, 38, 4):
        post(v, a, 36, 5, 11)
    v.put(v.box(27, 38, 36, 37, 9, 10), C['white'])
    return v


def apiary():
    v = model()
    slab(v, seed=23)
    v.put(v.box(2, 38, 2, 38, 4, 5.5), speckle(C['grass'], C['grass2'], 23, .35))
    flowers(v, 230, 70, [C['white'], C['lilac'], C['pink']], (3, 37), 5, avoid=lambda i, j: any(abs(i - a) < 5 and abs(j - b) < 5 for a, b in PLOTS))
    for n, (ci, cj) in enumerate(PLOTS):
        hive(v, ci, cj, 5, 3 if n % 3 else 4)
    # bench with honey jars at the front
    v.put(v.box(31, 38, 33, 36, 9, 10), C['wood'])
    post(v, 31, 33, 5, 9)
    post(v, 37, 35, 5, 9)
    for a in (32, 34.5):
        v.put(v.cyl(a + .8, 34.5, 1.2, 10, 13), C['gold'])
        v.put(v.cyl(a + .8, 34.5, 1.3, 13, 14), C['red'])
    return v


def duckhouse():
    v = model()
    slab(v, seed=24)
    v.put(v.box(2, 38, 2, 38, 4, 5.5), speckle(C['grass'], C['grass2'], 24, .35))
    # pond in the front half with a stone rim
    pond = ((v.I - 24) / 12) ** 2 + ((v.J - 25) / 11) ** 2 <= 1
    v.cut(pond & (v.K > 3))
    v.put(pond & (v.K > 3) & (v.K < 4.5), C['water'])
    rim = (((v.I - 24) / 13.2) ** 2 + ((v.J - 25) / 12.2) ** 2 <= 1) & ~pond & (v.K > 4) & (v.K < 6.5)
    v.put(rim, speckle(C['stone'], C['stone2'], 24, .4))
    v.put(pond & (v.K > 3) & (v.K < 4.5) & ((((v.I * 3 + v.J * 5).astype(int)) % 17) == 0), C['water2'])
    # little A-frame hut at the back with a ramp
    v.put(v.box(3, 13, 3, 12, 5, 10), stripes(C['plank'], 'i', 2, .85))
    v.put(v.gable_j(2, 14, 2, 13, 9, .9), stripes(C['teal'], 'k', 2, .85))
    v.put(v.box(6, 10, 11.6, 12.2, 5, 9), C['black'])
    v.put(v.box(6.5, 9.5, 12, 17, 5, 6), C['wood2'])
    duck(v, 20, 22, 4.2, 1.1)
    duck(v, 28, 30, 4.2, 1.0)
    duck(v, 9, 19, 5.5, 1.0)
    for i, j in ((35, 7), (36, 9), (34, 10)):
        v.put(v.box(i, i + 1, j, j + 1, 5, 12), C['grass2'])
        v.put(v.box(i, i + 1, j, j + 1, 12, 14), C['bark'])
    return v


def feedmill():
    v = model()
    slab(v, C['stone'], 25)
    # corrugated silo with a cone roof
    v.put(v.cyl(10, 10, 6.5, 5, 30), lambda I, J, K: np.where(((np.floor(np.arctan2(J - 10, I - 10) * 6) % 2) == 0)[..., None], C['silo'], tone(C['silo'], .88)))
    for k in (11, 18, 25):
        v.put(v.cyl(10, 10, 6.9, k, k + 1), C['steel'])
    v.put(v.cone(10, 10, 7.2, 30, 38), C['red'])
    # mill house with green roof
    v.put(v.box(18, 34, 16, 32, 5, 18), stripes(C['cream'], 'k', 3, .9))
    v.put(v.gable_i(17, 35, 15, 33, 18, 1.0), stripes(C['feedgreen'], 'k', 2, .85))
    v.put(v.box(23, 29, 31.6, 32.4, 5, 13), C['wood2'])
    v.put(v.box(33.6, 34.4, 21, 27, 9, 14), C['black'])
    # chute from the silo into the house
    for t in range(10):
        a = 14 + t * .9
        k = 26 - t * .8
        v.put(v.box(a, a + 1.6, a, a + 1.6, k, k + 1.6), C['steel'])
    # feed sacks at the front
    for a, b, k in ((8, 33, 5), (11.5, 33, 5), (9.7, 33, 8)):
        v.put(v.box(a, a + 3.2, b, b + 4, k, k + 3) | v.box(a + .5, a + 2.7, b + .5, b + 3.5, k + 2, k + 3.6), C['sack'])
        v.put(v.box(a - .1, a + 3.3, b + 1.4, b + 2.6, k + .5, k + 2.4), C['feedgreen'])
    return v


# ----------------------------------------------------------------- crafts
def winery():
    v = model()
    slab(v, seed=31)
    v.put(v.box(3, 23, 3, 21, 5, 18), bricks(C['cream'], tone(C['stone'], .9), 2, 5))
    v.put(v.gable_i(2, 24, 2, 22, 18, 1.1), stripes(C['roof'], 'k', 2, .82))
    # arched cellar door
    arch = v.box(9, 17, 20.5, 21.5, 5, 14) & ((v.K < 12) | (((v.I - 13) / 4) ** 2 + ((v.K - 12) / 2.5) ** 2 <= 1))
    v.put(arch, C['choco2'])
    v.put(v.box(12.5, 13.5, 20.5, 21.6, 5, 13), C['wood2'])
    # oak barrel pyramid in the yard
    barrel_i(v, 26, 8, 24, 33, 3.1)
    barrel_i(v, 32.5, 8, 24, 33, 3.1)
    barrel_i(v, 29.2, 13.6, 24, 33, 3.1)
    # grape press: slatted vat, screw and crossbar
    v.put(v.cyl(31, 12, 4.4, 5, 12), stripes(C['wood'], 'i', 2, .82))
    v.put(v.cyl(31, 12, 4.6, 6, 7) | v.cyl(31, 12, 4.6, 10, 11), C['steel'])
    v.put(v.cyl(31, 12, 3.6, 11, 12), C['purple'])
    for a in (26.5, 35):
        post(v, a, 11.5, 5, 22, C['wood2'])
    v.put(v.box(26.5, 36, 11.5, 12.5, 21, 23), C['wood2'])
    v.put(v.box(30.5, 31.5, 11.5, 12.5, 12, 21), C['steel'])
    return v


def chocolatier():
    v = model()
    slab(v, seed=32)
    v.put(v.box(3, 25, 3, 23, 5, 18), stripes(C['cream'], 'k', 4, .92))
    v.put(v.box(3, 25, 3, 23, 5, 7), C['pink'])
    # chocolate roof with a dripping edge
    v.put(v.hip(2, 26, 2, 24, 18, 1.2), stripes(C['choco'], 'k', 2, .8))
    drip = (v.box(2, 26, 2, 24, 16, 18) & ~v.box(3, 25, 3, 23, 0, 40)) & ((((v.I + v.J) * 1.7).astype(int) % 5) < 2)
    v.put(drip, C['choco'])
    v.put(v.box(2, 26, 2, 24, 17, 18) & ~v.box(3, 25, 3, 23, 0, 40), C['choco'])
    # shop window with bar sign and door
    v.put(v.box(6, 12, 22.6, 23.4, 8, 14), C['blue2'])
    v.put(v.box(15, 20, 22.6, 23.4, 5, 14), C['choco2'])
    v.put(v.box(6, 20, 22.6, 23.6, 14, 15), C['pink'])
    v.put(v.box(24.6, 25.4, 8, 16, 9, 15), C['choco'])
    v.put(v.box(24.6, 25.6, 9, 15, 10, 14) & (((v.J.astype(int) + v.K.astype(int)) % 2) == 0), tone(C['choco'], 1.4))
    # copper melting kettle and cocoa sacks
    v.put(v.cyl(31, 31, 4.6, 8, 14) | v.ball(31, 31, 10, 4.6, 4.6, 4), stripes(C['copper'], 'k', 3, .85))
    v.put(v.cyl(31, 31, 3.6, 13, 14), C['choco'])
    v.put(v.box(27, 35, 30.5, 31.5, 5, 8) | v.box(30.5, 31.5, 27, 35, 5, 8), C['black'])
    v.put(v.box(30.5, 31.5, 30.5, 31.5, 14, 21), C['wood'])
    for a, b in ((30, 5), (34, 5), (32, 8.5)):
        v.put(v.box(a, a + 3.4, b, b + 3, 5, 9), C['sack'])
        v.put(v.box(a + .6, a + 2.8, b + 2.9, b + 3.3, 6, 8), C['choco'])
    return v


def packshop():
    v = model()
    slab(v, seed=33)
    v.put(v.box(3, 23, 3, 21, 5, 17), stripes(hexc('#6f8fa8'), 'i', 2, .88))
    v.put(v.gable_j(2, 24, 2, 22, 17, 1.0), stripes(C['orange'], 'k', 2, .82))
    v.put(v.box(8, 18, 20.6, 21.4, 5, 13), C['black'])
    # oversized parcel sign on the roof ridge
    v.put(v.box(8, 18, 7, 17, 24, 32), hexc('#c9955a'))
    v.put(v.box(8, 18, 7, 17, 31, 32), tone(hexc('#c9955a'), 1.1))
    twine = v.box(12, 13.9, 7, 17, 24, 32) | v.box(8, 18, 11, 12.9, 24, 32)
    v.put(twine & ((v.I < 8.6) | (v.I > 17.4) | (v.J < 7.6) | (v.J > 16.4) | (v.K > 31)), C['bark'])
    # packing table and stacked goods boxes
    v.put(v.box(24, 36, 8, 14, 9, 10), C['wood'])
    for a, b in ((25, 9), (35, 13)):
        post(v, a, b, 5, 9)
    v.put(v.box(26, 30, 26, 31, 5, 10), stripes(C['plank'], 'k', 2, .8))
    v.put(v.box(26.5, 30.5, 26, 30, 10, 14), C['purple'])
    v.put(v.box(31, 36, 27, 32, 5, 10), C['red'])
    v.put(v.box(33, 34, 27, 32.2, 5, 10.2) | v.box(31, 36.2, 29, 30, 5, 10.2), C['gold'])
    v.put(v.box(27, 35, 33, 37, 5, 8), C['sack'])
    v.put(v.box(30.5, 31.5, 33, 37.2, 5, 8.2), C['wood2'])
    return v


# ----------------------------------------------------------------- minerals, power
def sandpit():
    v = model()
    slab(v, seed=41)
    # dug pit with sandy walls
    pit = v.box(6, 30, 8, 32, 1.5, 6)
    v.cut(pit)
    v.put(v.box(6, 30, 8, 32, 0, 2), speckle(C['sand'], C['sand2'], 41, .4))
    v.put(v.box(5, 31, 7, 33, 2, 5) & ~pit, speckle(C['sand2'], C['sand'], 42, .3))
    # big sand heap and a sieve frame
    v.put(v.cone(30, 9, 7.5, 4, 17), speckle(C['sand'], tone(C['sand'], .88), 43, .35))
    for a, b in ((22, 27), (29, 27), (22, 34), (29, 34)):
        post(v, a, b, 5, 13)
    v.put(v.box(21, 31, 26.5, 35, 12, 13) & (((v.I.astype(int) + v.J.astype(int)) % 2) == 0), C['steel'])
    v.put(v.box(21, 31, 26.5, 35, 12, 13.5) & ~v.box(22, 30, 27.5, 34, 0, 40), C['wood'])
    # wheelbarrow loaded with sand
    v.put(v.box(33, 38, 20, 24, 7, 10), C['red'])
    v.put(v.box(33.5, 37.5, 20.5, 23.5, 9.5, 11), C['sand'])
    v.put(v.cyl_j(35.5, 5.5, 1.5, 24, 25), C['black'])
    v.put(v.box(34, 34.8, 12, 20, 8, 9) | v.box(36.2, 37, 12, 20, 8, 9), C['wood2'])
    return v


def clayfield():
    v = model()
    slab(v, seed=42)
    # terraced wet clay pit with muddy pools
    v.put(v.box(4, 34, 4, 26, 3, 6), speckle(C['clay'], tone(C['clay'], .85), 42, .35))
    v.cut(v.box(8, 30, 8, 22, 4, 6))
    v.put(v.box(8, 30, 8, 22, 3, 4.5), speckle(C['clay'], C['clay2'], 44, .3))
    v.put((((v.I - 14) / 4.2) ** 2 + ((v.J - 13) / 3.2) ** 2 <= 1) & (v.K > 3) & (v.K < 4.8), C['mud'])
    v.put((((v.I - 24) / 3.6) ** 2 + ((v.J - 17) / 2.8) ** 2 <= 1) & (v.K > 3) & (v.K < 4.8), C['mud'])
    # drying rack of raw clay blocks at the front
    for k in (5, 10):
        v.put(v.box(5, 35, 29, 36, k, k + 1), C['wood2'])
        for a in range(6, 34, 4):
            v.put(v.box(a, a + 3, 30, 35, k + 1, k + 3.5), C['clay2'])
    for a in (5, 34):
        post(v, a, 29, 5, 15)
        post(v, a, 35, 5, 15)
    v.put(v.box(4.5, 35.5, 28.5, 36.5, 15, 16), C['wood'])
    # spade stuck in the clay
    v.put(v.box(33, 34, 12, 13, 5, 16), C['wood2'])
    v.put(v.box(32, 35, 12, 13, 4, 8), C['metal'])
    return v


def solarpanel():
    v = model()
    slab(v, C['stone'], 43)
    grid_panel = lambda I, J, K: np.where((((np.floor(I - .5) % 4) == 0) | ((np.floor(K - .5) % 3) == 0))[..., None], C['blue2'], C['blue'])
    for n, cj in enumerate((8, 19, 30)):
        # a tilted panel row rising toward -j, facing the front
        panel = v.box(4, 36, cj - 4.5, cj + 4.5, 6, 17) & (np.abs((v.K - 8) - (cj + 4.5 - v.J) * .45) < .8)
        v.put(panel, grid_panel)
        edge = panel & ((v.I < 5) | (v.I > 35))
        back = v.box(4, 36, cj - 4.5, cj + 4.5, 6, 17) & (np.abs((v.K - 7) - (cj + 4.5 - v.J) * .45) < .6) & ~panel
        v.put(edge, C['metal'])
        v.put(back, C['steel'])
        for a in (6, 19, 33):
            post(v, a, cj + 2, 5, 8, C['steel'])
            post(v, a, cj - 3, 5, 10, C['steel'])
    # inverter cabinet
    v.put(v.box(34, 38, 34, 38, 5, 11), C['white'])
    v.put(v.box(34.5, 37.5, 37.6, 38.2, 7, 10), C['slate'])
    v.put(v.box(35.5, 36.5, 37.8, 38.4, 10, 10.8), C['yellow'])
    return v


# ----------------------------------------------------------------- terrain facilities
def pond():
    v = model()
    ground(v, C['grass'], C['grass2'], 51)
    basin = ((v.I - 20) / 15.5) ** 2 + ((v.J - 20.5) / 14) ** 2 + .15 * np.sin(v.I * .7) <= 1
    v.cut(basin & (v.K > 1))
    v.put(basin & (v.K > 0) & (v.K < 2), lambda I, J, K: np.where((((I * 5 + J * 3).astype(int) % 13) == 0)[..., None], C['water2'], np.where((((I - 20) ** 2 + (J - 20) ** 2) < 60)[..., None], C['water3'], C['water'])))
    rim = (((v.I - 20) / 17) ** 2 + ((v.J - 20.5) / 15.6) ** 2 + .15 * np.sin(v.I * .7) <= 1) & ~basin
    rocks = rim & (v.K > 2) & (v.K < 4.5) & ((((v.I * 1.3).astype(int) + (v.J * 1.1).astype(int)) % 3) != 0)
    v.put(rocks, speckle(C['stone'], C['stone2'], 52, .45))
    for a, b in ((13, 16), (25, 26), (19, 11)):
        v.put(v.cyl(a, b, 2.2, 1, 2.4) & ~(np.abs(v.J - b - (v.I - a)) < .6), C['green'])
    v.put(v.box(24.5, 25.5, 25.5, 26.5, 2.4, 3.4), C['pink'])
    for i, j in ((33, 6), (34, 8), (32, 9), (35, 11)):
        v.put(v.box(i, i + 1, j, j + 1, 3, 9), C['grass2'])
        v.put(v.box(i, i + 1, j, j + 1, 9, 11), C['bark'])
    return v


def pasture():
    v = model()
    ground(v, C['grass3'], C['grass'], 53)
    v.put(v.box(1, 39, 1, 39, 2, 3), checker(C['grass3'], tone(C['grass3'], .92), 5))
    tufts(v, 54, 55, avoid=lambda i, j: i > 28 and j > 28)
    flowers(v, 55, 18, [C['white'], C['yellow']], (3, 37), 3)
    # split-rail fence on the back two edges
    for a in range(2, 38, 6):
        post(v, a, 2, 3, 10)
        post(v, 2, a, 3, 10)
    for k in (6, 9):
        v.put(v.box(2, 38, 2, 3, k - 1, k) | v.box(2, 3, 2, 38, k - 1, k), C['wood'])
    # round hay bale
    v.put(v.cyl_i(33, 7, 4, 29, 36), stripes(C['hay'], 'j', 2, .84))
    v.put(v.cyl_i(33, 7, 3, 35, 36), tone(C['hay'], 1.1))
    return v


def clover():
    v = model()
    ground(v, C['grass'], C['grass2'], 56)
    rng = np.random.default_rng(57)
    for _ in range(46):
        i, j = rng.uniform(4, 36, 2)
        for a in range(3):
            ang = a * 2.1 + rng.uniform(0, 1)
            v.put(v.ball(i + np.cos(ang) * 1.3, j + np.sin(ang) * 1.3, 3.4, 1.2, 1.2, .8), hexc('#4fa84a'))
        if rng.random() < .75:
            col = C['white'] if rng.random() < .5 else hexc('#d77bb5')
            v.put(v.ball(i, j, 5.2, 1.0, 1.0, 1.2), col)
    for i, j in ((8, 30), (30, 9)):
        v.put(v.ball(i, j, 3, 2.2, 1.8, 1.6), C['stone'])
    return v


BUILDERS = {
    'sugarfield': sugarfield, 'saltfield': saltfield, 'vineyard': vineyard, 'cocoafarm': cocoafarm,
    'berryfield': berryfield, 'mintfield': mintfield, 'pumpkinpatch': pumpkinpatch, 'oakfarm': oakfarm,
    'winery': winery, 'chocolatier': chocolatier,
    'sheeppen': sheeppen, 'milkbarn': milkbarn, 'apiary': apiary, 'duckhouse': duckhouse, 'feedmill': feedmill,
    'sandpit': sandpit, 'clayfield': clayfield, 'packshop': packshop, 'solarpanel': solarpanel,
    'pond': pond, 'pasture': pasture, 'clover': clover,
}
