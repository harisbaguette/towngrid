# Script-drawn pixel art kit for the 2026-09-29 expansion (farm-v9).
# Buildings are small voxel models rendered in the game's quarter view
# (rows SE, NE, NW, SW); crops, goods and parts are shaded 2D sprites.
# Everything is deterministic: rerunning build.py reproduces the sources.
import numpy as np
from PIL import Image

OUTLINE = np.array([27, 29, 41], np.float32)
COOL = np.array([34, 42, 92], np.float32)


def hexc(s):
    s = s.lstrip('#')
    return np.array([int(s[i:i + 2], 16) for i in (0, 2, 4)], np.float32)


def tone(c, f):
    """Darken toward a cool shadow (f<1) or lighten toward warm white (f>1)."""
    c = np.asarray(c, np.float32)
    if f >= 1:
        return np.clip(c + (np.array([255, 250, 225]) - c) * (f - 1), 0, 255)
    return np.clip(c * f + COOL * (1 - f) * .45, 0, 255)


def outline(rgb, alpha, depth, threshold=3.5):
    """Dark 1px rim outside every silhouette and behind every nearer edge."""
    h, w = alpha.shape
    d = np.where(alpha, depth, -1e9)
    mark = np.zeros_like(alpha)
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        nb = np.full_like(d, -1e9)
        na = np.zeros_like(alpha)
        ys, yd = (slice(0, h - dy), slice(dy, h)) if dy >= 0 else (slice(-dy, h), slice(0, h + dy))
        xs, xd = (slice(0, w - dx), slice(dx, w)) if dx >= 0 else (slice(-dx, w), slice(0, w + dx))
        nb[ys, xs] = d[yd, xd]
        na[ys, xs] = alpha[yd, xd]
        mark |= na & (d < nb - threshold)
    out = rgb.copy()
    out[mark] = OUTLINE
    return out, alpha | mark


def to_image(rgb, alpha, scale):
    arr = np.zeros(alpha.shape + (4,), np.uint8)
    arr[..., :3] = np.clip(np.round(rgb), 0, 255).astype(np.uint8)
    arr[..., 3] = np.where(alpha, 255, 0)
    img = Image.fromarray(arr, 'RGBA')
    return img.resize((img.width * scale, img.height * scale), Image.NEAREST)


# ---------------------------------------------------------------- voxels
class Vox:
    """Voxel model. i grows to screen lower-right, j to lower-left, k is up.
    The facility front faces +j so it is seen in the SE and SW views."""

    def __init__(self, n=40, h=56):
        self.n, self.h = n, h
        self.on = np.zeros((n, n, h), bool)
        self.col = np.zeros((n, n, h, 3), np.float32)
        self.I, self.J, self.K = np.meshgrid(np.arange(n) + .5, np.arange(n) + .5, np.arange(h) + .5, indexing='ij')

    def put(self, mask, color):
        if callable(color):
            c = color(self.I, self.J, self.K)
            self.col[mask] = c[mask]
        else:
            self.col[mask] = np.asarray(color, np.float32)
        self.on |= mask

    def cut(self, mask):
        self.on &= ~mask

    # primitives return boolean masks; bounds are cell edges
    @staticmethod
    def _span(A, a0, a1):
        m = (A > a0) & (A < a1)
        if not m.any() and a1 > a0:
            # A slab at most one cell thick that falls between cell centres
            # keeps the cell containing its midpoint instead of vanishing.
            m = np.floor(A) == np.floor((a0 + a1) / 2)
        return m

    def box(self, i0, i1, j0, j1, k0, k1):
        return self._span(self.I, i0, i1) & self._span(self.J, j0, j1) & self._span(self.K, k0, k1)

    def cyl(self, ci, cj, r, k0, k1):
        return ((self.I - ci) ** 2 + (self.J - cj) ** 2 <= r * r) & (self.K > k0) & (self.K < k1)

    def cyl_i(self, cj, ck, r, i0, i1):
        return ((self.J - cj) ** 2 + (self.K - ck) ** 2 <= r * r) & (self.I > i0) & (self.I < i1)

    def cyl_j(self, ci, ck, r, j0, j1):
        return ((self.I - ci) ** 2 + (self.K - ck) ** 2 <= r * r) & (self.J > j0) & (self.J < j1)

    def ball(self, ci, cj, ck, ri, rj=None, rk=None):
        rj = ri if rj is None else rj
        rk = ri if rk is None else rk
        return ((self.I - ci) / ri) ** 2 + ((self.J - cj) / rj) ** 2 + ((self.K - ck) / rk) ** 2 <= 1

    def cone(self, ci, cj, r, k0, k1):
        t = np.clip((self.K - k0) / max(1e-6, k1 - k0), 0, 1)
        return ((self.I - ci) ** 2 + (self.J - cj) ** 2 <= (r * (1 - t)) ** 2) & (self.K > k0) & (self.K < k1)

    def gable_i(self, i0, i1, j0, j1, k0, slope=1.0):
        """Roof ridge along i over the j span, rising from k0."""
        jm, half = (j0 + j1) / 2, (j1 - j0) / 2
        return (self.I > i0) & (self.I < i1) & (self.K > k0) & (np.abs(self.J - jm) < half - (self.K - k0) / slope)

    def gable_j(self, i0, i1, j0, j1, k0, slope=1.0):
        im, half = (i0 + i1) / 2, (i1 - i0) / 2
        return (self.J > j0) & (self.J < j1) & (self.K > k0) & (np.abs(self.I - im) < half - (self.K - k0) / slope)

    def hip(self, i0, i1, j0, j1, k0, slope=1.0):
        im, jm = (i0 + i1) / 2, (j0 + j1) / 2
        hi, hj = (i1 - i0) / 2, (j1 - j0) / 2
        rise = (self.K - k0) / slope
        return (self.K > k0) & (np.abs(self.I - im) < hi - rise) & (np.abs(self.J - jm) < hj - rise)


def stripes(base, axis, period, dark=.86, offset=0):
    """Plank / course lines: every period-th cell along axis is darker."""
    b = np.asarray(base, np.float32)

    def f(I, J, K):
        a = {'i': I, 'j': J, 'k': K}[axis]
        line = (np.floor(a - .5 + offset) % period) == 0
        out = np.broadcast_to(b, I.shape + (3,)).copy()
        out[line] = tone(b, dark)
        return out
    return f


def bricks(base, mortar, course=2, length=4):
    b, m = np.asarray(base, np.float32), np.asarray(mortar, np.float32)

    def f(I, J, K):
        k = np.floor(K - .5)
        row = np.floor(k / course)
        u = np.floor(I - .5 + J - .5 + (row % 2) * length / 2)
        joint = (k % course == course - 1) | (u % length == 0)
        out = np.broadcast_to(b, I.shape + (3,)).copy()
        out[joint] = m
        return out
    return f


def checker(a, b, size=2):
    a, b = np.asarray(a, np.float32), np.asarray(b, np.float32)

    def f(I, J, K):
        sel = ((np.floor(I / size) + np.floor(J / size)) % 2) == 0
        return np.where(sel[..., None], a, b)
    return f


def speckle(base, other, seed, amount=.18):
    rng = np.random.default_rng(seed)
    b, o = np.asarray(base, np.float32), np.asarray(other, np.float32)

    def f(I, J, K):
        sel = rng.random(I.shape) < amount
        return np.where(sel[..., None], o, b)
    return f


# Projection fixed to the existing field slab: top surface 65..169, width 9..181,
# base at 181 in the packed 192px cell (half resolution here, doubled on output).
BUILDING_VIEW = dict(W=96, H=96, ox=48.0, oy=37.65, sx=1.13, sy=0.684, sz=1.305)


def render_vox(v, view, W, H, ox, oy, sx, sy, sz, samples=3, shadow=True):
    on = np.rot90(v.on, view, axes=(0, 1))
    col = np.rot90(v.col, view, axes=(0, 1))
    n, _, h = on.shape
    kd = 2 * sy / sz
    shade = np.zeros(on.shape, bool)
    if shadow:
        # Light comes from the upper-left of the screen (-i, above): cast toward +i.
        for t in range(1, 26):
            s = np.zeros_like(on)
            s[t:, :, :h - t] = on[:n - t, :, t:]
            shade |= s
    mp = np.pad(on, ((0, 1), (0, 1), (0, 1)))
    faces = (
        ('k', on & ~mp[:-1, :-1, 1:], 1.0),
        ('j', on & ~mp[:-1, 1:, :-1], .80),
        ('i', on & ~mp[1:, :-1, :-1], .62),
    )
    t = (np.arange(samples) + .5) / samples
    xs, ys, ds, cs = [], [], [], []
    for axis, mask, f in faces:
        idx = np.argwhere(mask).astype(np.float32)
        if not len(idx):
            continue
        base = col[mask]
        sh = shade[mask] if axis in 'kj' else np.zeros(len(idx), bool)
        # shadow test uses the cell above the top face
        if axis == 'k':
            above = np.zeros_like(on)
            above[:, :, :-1] = shade[:, :, 1:]
            sh = above[mask]
        c = np.where(sh[:, None], tone(base, f * .74), tone(base, f))
        for a in t:
            for b in t:
                p = idx.copy()
                if axis == 'k':
                    p += [a, b, 1]
                elif axis == 'j':
                    p += [a, 1, b]
                else:
                    p += [1, a, b]
                xs.append(ox + (p[:, 0] - p[:, 1]) * sx)
                ys.append(oy + (p[:, 0] + p[:, 1]) * sy - p[:, 2] * sz)
                ds.append(p[:, 0] + p[:, 1] + p[:, 2] * kd)
                cs.append(c)
    x = np.floor(np.concatenate(xs)).astype(int)
    y = np.floor(np.concatenate(ys)).astype(int)
    d = np.concatenate(ds)
    c = np.concatenate(cs)
    ok = (x >= 0) & (x < W) & (y >= 0) & (y < H)
    x, y, d, c = x[ok], y[ok], d[ok], c[ok]
    key = y * W + x
    order = np.lexsort((d, key))
    ks = key[order]
    last = np.r_[ks[1:] != ks[:-1], True]
    sel = order[last]
    rgb = np.zeros((H, W, 3), np.float32)
    alpha = np.zeros((H, W), bool)
    depth = np.full((H, W), -1e9, np.float32)
    rgb.reshape(-1, 3)[key[sel]] = c[sel]
    alpha.reshape(-1)[key[sel]] = True
    depth.reshape(-1)[key[sel]] = d[sel]
    return rgb, alpha, depth


def building_views(v):
    """Four 192px cells: SE, NE, NW, SW."""
    cells = []
    for view in range(4):
        rgb, alpha, depth = render_vox(v, view, **BUILDING_VIEW)
        rgb, alpha = outline(rgb, alpha, depth, threshold=3.2)
        cells.append(to_image(rgb, alpha, 2))
    return cells


# ---------------------------------------------------------------- 2D sprites
class Sprite:
    """48x48 shaded sprite, doubled to 192 with 4px pixels. Later shapes are
    nearer; call layer() to separate a shape from what is behind it."""
    LIGHT = np.array([-.55, -.75])
    # Drawing-space transform applied to every new sprite (see fit_sprite).
    frame = {'size': 48, 'scale': 1.0, 'shift': (0.0, 0.0)}

    def __init__(self, W=None, H=None):
        W = H = self.frame['size'] if W is None else W
        self.W, self.H = W, H
        self.rgb = np.zeros((H, W, 3), np.float32)
        self.alpha = np.zeros((H, W), bool)
        self.depth = np.full((H, W), -1e9, np.float32)
        self.z = 0.0
        f, (sx, sy) = self.frame['scale'], self.frame['shift']
        Y, X = np.mgrid[0:H, 0:W] + .5
        # Drawing coordinates keep the 48px design space; pixels map back into it.
        self.X = (X - 24 - sx) / f + 24
        self.Y = (Y - 24 - sy) / f + 24
        self.f = f

    def layer(self):
        self.z += 10
        return self

    def _paint(self, mask, color):
        c = np.broadcast_to(np.asarray(color, np.float32), (self.H, self.W, 3)) if np.ndim(color) == 1 else color
        self.rgb[mask] = c[mask]
        self.alpha |= mask
        self.depth[mask] = self.z

    def ellipse(self, cx, cy, rx, ry, color, shade=True, angle=0.0, spec=True):
        dx, dy = self.X - cx, self.Y - cy
        ca, sa = np.cos(angle), np.sin(angle)
        u = (dx * ca + dy * sa) / rx
        w = (-dx * sa + dy * ca) / ry
        mask = u * u + w * w <= 1
        if not shade:
            self._paint(mask, color)
            return mask
        nx = dx / max(rx, ry)
        ny = dy / max(rx, ry)
        lit = -(nx * self.LIGHT[0] + ny * self.LIGHT[1])
        base = np.asarray(color, np.float32)
        c = np.where((lit > .42)[..., None], tone(base, 1.16), np.where((lit < -.28)[..., None], tone(base, .72), base))
        if spec:
            hx, hy = cx - rx * .42, cy - ry * .45
            c = np.where(((np.abs(self.X - hx) < .9) & (np.abs(self.Y - hy) < .9))[..., None] & (min(rx, ry) >= 2.4), tone(base, 1.45), c)
        self._paint(mask, c)
        return mask

    def rect(self, x0, y0, x1, y1, color, shade=None):
        mask = (self.X > x0) & (self.X < x1) & (self.Y > y0) & (self.Y < y1)
        if shade:
            base = np.asarray(color, np.float32)
            left = self.X < x0 + (x1 - x0) * shade[0]
            right = self.X > x1 - (x1 - x0) * shade[1]
            c = np.where(left[..., None], tone(base, 1.14), np.where(right[..., None], tone(base, .74), base))
            self._paint(mask, c)
        else:
            self._paint(mask, color)
        return mask

    def poly(self, pts, color):
        inside = np.zeros((self.H, self.W), bool)
        n = len(pts)
        for a in range(n):
            (x0, y0), (x1, y1) = pts[a], pts[(a + 1) % n]
            if y0 == y1:
                continue
            cross = ((self.Y > min(y0, y1)) & (self.Y <= max(y0, y1)))
            xi = x0 + (self.Y - y0) * (x1 - x0) / (y1 - y0)
            inside ^= cross & (self.X < xi)
        self._paint(inside, color)
        return inside

    def line(self, x0, y0, x1, y1, color, width=1.0):
        px, py = self.X - x0, self.Y - y0
        vx, vy = x1 - x0, y1 - y0
        L = max(1e-6, vx * vx + vy * vy)
        t = np.clip((px * vx + py * vy) / L, 0, 1)
        dist = np.hypot(px - t * vx, py - t * vy)
        mask = dist <= width / 2 + .15 / self.f
        self._paint(mask, color)
        return mask

    def pixel(self, x, y, color):
        f, (sx, sy) = self.frame['scale'], self.frame['shift']
        x, y = int((x - 24) * f + 24 + sx), int((y - 24) * f + 24 + sy)
        if 0 <= x < self.W and 0 <= y < self.H:
            self.rgb[y, x] = color
            self.alpha[y, x] = True
            self.depth[y, x] = self.z

    def image(self, scale=4):
        rgb, alpha = outline(self.rgb, self.alpha, self.depth, threshold=5)
        return to_image(rgb, alpha, scale)


def iso_sprite(v, size=48, fill=.84, view=0, samples=4, pad_bottom=None):
    """Render a small voxel prop (goods) into a 48px square sprite, centred."""
    corners = np.argwhere(v.on)
    lo, hi = corners.min(0), corners.max(0) + 1
    # screen bounds with unit scale
    pts = np.array([[a, b, c] for a in (lo[0], hi[0]) for b in (lo[1], hi[1]) for c in (lo[2], hi[2])], np.float32)
    sy_sx, sz_sx = .605, 1.155
    X = pts[:, 0] - pts[:, 1]
    Y = (pts[:, 0] + pts[:, 1]) * sy_sx - pts[:, 2] * sz_sx
    wspan, hspan = X.max() - X.min(), Y.max() - Y.min()
    s = (size - 4) * fill / max(wspan, hspan)
    ox = size / 2 - (X.max() + X.min()) / 2 * s
    oy = size / 2 - (Y.max() + Y.min()) / 2 * s if pad_bottom is None else size - pad_bottom - Y.max() * s
    rgb, alpha, depth = render_vox(v, view, size, size, ox, oy, s, s * sy_sx, s * sz_sx, samples=samples, shadow=False)
    return rgb, alpha, depth


def iso_image(v, **kw):
    rgb, alpha, depth = iso_sprite(v, **kw)
    rgb, alpha = outline(rgb, alpha, depth, threshold=2.5)
    return to_image(rgb, alpha, 4)


def fit_sprite(draw, size=48, margin=2):
    """Draw once on a roomy canvas to measure, then again scaled/centred so the
    good keeps a transparent border like the existing resource atlas."""
    Sprite.frame = {'size': 96, 'scale': 1.0, 'shift': (24.0, 24.0)}
    try:
        probe = draw()
        box = probe.getchannel('A').getbbox()
        # probe is 4x upscaled; convert back to its 96px canvas then to design space
        x0, y0, x1, y1 = (v / 4 - 24 for v in box)
        w, h = x1 - x0, y1 - y0
        f = min(1.0, (size - 2 * margin) / w, (size - 2 * margin) / h)
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        Sprite.frame = {'size': size, 'scale': f, 'shift': (round(-(cx - 24) * f), round(-(cy - 24) * f))}
        return draw()
    finally:
        Sprite.frame = {'size': 48, 'scale': 1.0, 'shift': (0.0, 0.0)}
