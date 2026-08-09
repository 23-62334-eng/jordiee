import numpy as np, json, random
from PIL import Image, ImageDraw, ImageFont

COLS = 76
CHAR_ASPECT = 0.50   # cell height = width / CHAR_ASPECT

# density ramp, dark -> bright. multiple glyphs per level for texture
RAMP = [
    " ",
    ".'`,",
    ":;\"^~",
    "-_+<>i!lI?",
    "/\\|()1{}[]r",
    "cvunxzjft",
    "JCLQ0OZmwq",
    "pdbkhao*#",
    "MW&8%B@$",
]

def load():
    im = Image.open('cut.png').convert('RGBA')
    a = np.array(im)[:, :, 3]
    ys, xs = np.where(a > 12)
    im = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    return im

def local_normalize(im):
    """Homomorphic-style flattening: divide luminance by a heavily blurred
    version of itself so the backlit face gets its own local exposure."""
    from PIL import ImageFilter
    a = np.asarray(im).astype(np.float32) / 255.0
    rgb, alpha = a[:, :, :3], a[:, :, 3:4]
    lum = 0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2]
    lum = np.clip(lum, 0.004, 1)
    li = Image.fromarray((lum * 255).astype(np.uint8))
    r = max(im.size) / 13.0
    base = np.asarray(li.filter(ImageFilter.GaussianBlur(r))).astype(np.float32) / 255.0
    base = np.clip(base, 0.02, 1)
    flat = np.clip(lum / base * 0.52, 0, 1)
    gain = (flat / lum)[:, :, None]
    out = np.clip(rgb * gain, 0, 1)
    out = np.concatenate([out, alpha], axis=2)
    return Image.fromarray((out * 255).astype(np.uint8))


def cells(im, cols):
    w, h = im.size
    cw = w / cols
    ch = cw / CHAR_ASPECT
    rows = max(1, int(round(h / ch)))
    small = im.resize((cols, rows), Image.LANCZOS)
    return np.asarray(small).astype(np.float32) / 255.0, rows

def build():
    im = load()
    im = local_normalize(im)
    arr, rows = cells(im, COLS)
    rgb, alpha = arr[:, :, :3], arr[:, :, 3]
    mask = alpha > 0.45

    lum = 0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2]
    v = lum[mask]
    lo, hi = np.percentile(v, 2), np.percentile(v, 99)
    norm = np.clip((lum - lo) / max(hi - lo, 1e-5), 0, 1)
    norm = norm ** 0.72                      # lift shadows
    norm = np.clip(norm * 1.06 - 0.03, 0, 1)

    # colour: saturation boost + value floor so dark cells still read on black
    mx = rgb.max(axis=2); mn = rgb.min(axis=2)
    chroma = mx - mn
    mean = rgb.mean(axis=2, keepdims=True)
    col = np.clip(mean + (rgb - mean) * 1.9, 0, 1)          # saturate
    scale = (0.30 + 0.70 * norm)[:, :, None] / np.clip(col.max(axis=2, keepdims=True), 1e-4, None)
    col = np.clip(col * scale, 0, 1)
    col = np.clip(col ** 0.88, 0, 1)

    # quantise to a small terminal-like palette: fewer colours -> longer
    # same-colour runs -> a much smaller SVG
    qi = Image.fromarray((col * 255).astype(np.uint8), 'RGB')
    qi = qi.quantize(colors=14, method=Image.MEDIANCUT, dither=Image.NONE).convert('RGB')
    col = np.asarray(qi).astype(np.float32) / 255.0

    rng = random.Random(7)
    grid = []
    for y in range(rows):
        line = []
        for x in range(COLS):
            if not mask[y, x]:
                line.append((' ', None)); continue
            n = float(norm[y, x])
            idx = int(round(n * (len(RAMP) - 1)))
            idx = max(1, min(len(RAMP) - 1, idx))
            pool = RAMP[idx]
            g = pool[rng.randrange(len(pool))]
            r, gg, b = (int(round(c * 255)) for c in col[y, x])
            r, gg, b = (max(c, 26) for c in (r, gg, b))
            line.append((g, '#%02x%02x%02x' % (r, gg, b)))
        grid.append(line)

    # trim fully blank leading/trailing columns
    used = [x for x in range(COLS) if any(grid[y][x][0] != ' ' for y in range(rows))]
    x0, x1 = used[0], used[-1] + 1
    grid = [row[x0:x1] for row in grid]
    return grid

def preview(grid, path='ascii_preview.png'):
    fs = 14
    f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf', fs)
    cw = f.getlength('M'); ch = fs * 1.05
    W = int(cw * len(grid[0])) + 20
    H = int(ch * len(grid)) + 20
    img = Image.new('RGB', (W, H), (13, 15, 20))
    d = ImageDraw.Draw(img)
    for y, row in enumerate(grid):
        for x, (g, c) in enumerate(row):
            if g == ' ':
                continue
            d.text((10 + x * cw, 10 + y * ch), g, font=f, fill=c)
    img.save(path)
    print(path, img.size, 'cols', len(grid[0]), 'rows', len(grid))

if __name__ == '__main__':
    g = build()
    json.dump([[[c, col] for c, col in row] for row in g], open('grid.json', 'w'))
    preview(g)
