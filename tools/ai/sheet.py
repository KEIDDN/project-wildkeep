"""
Shared helpers for turning the AI-generated concept sheets in Assets/*Assets
into real pixel-art sprites.

The sheets are painted *like* pixel art, but at ~2.3 screen pixels per art
pixel, with soft (anti-aliased) edges and noisy colour. So:

  1. segment: alpha-threshold the sheet, find connected blobs (8-way),
     merge blobs that nearly touch (a sword and its hand, a slash effect)
  2. rescale: shrink each blob to its true pixel grid with a *majority*
     filter (each output pixel = the most common colour of the opaque
     source pixels in its cell), never a blur
  3. clean: hard alpha, colours snapped to a small per-sprite palette, and
     the packs' dark 1px outline restored around the silhouette
"""
from collections import Counter, deque
from PIL import Image

OUTLINE = (24, 18, 22, 255)


def load(path, bg_alpha=128):
    im = Image.open(path).convert("RGBA")
    return im


def blobs(im, alpha=140, min_area=60, merge=3):
    w, h = im.size
    px = im.load()
    solid = bytearray(w * h)
    for y in range(h):
        for x in range(w):
            if px[x, y][3] >= alpha:
                solid[y * w + x] = 1
    seen = bytearray(w * h)
    boxes = []
    for y in range(h):
        for x in range(w):
            i = y * w + x
            if not solid[i] or seen[i]:
                continue
            q = deque([(x, y)])
            seen[i] = 1
            x0 = x1 = x
            y0 = y1 = y
            n = 0
            while q:
                a, b = q.popleft()
                n += 1
                x0, x1, y0, y1 = min(x0, a), max(x1, a), min(y0, b), max(y1, b)
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        c, d = a + dx, b + dy
                        if 0 <= c < w and 0 <= d < h:
                            j = d * w + c
                            if solid[j] and not seen[j]:
                                seen[j] = 1
                                q.append((c, d))
            if n >= min_area:
                boxes.append([x0, y0, x1, y1, n])
    # Merge boxes that (nearly) overlap.
    changed = True
    while changed:
        changed = False
        out = []
        for b in boxes:
            for o in out:
                if b[0] <= o[2] + merge and b[2] >= o[0] - merge and b[1] <= o[3] + merge and b[3] >= o[1] - merge:
                    o[0], o[1], o[2], o[3], o[4] = min(o[0], b[0]), min(o[1], b[1]), max(o[2], b[2]), max(o[3], b[3]), o[4] + b[4]
                    changed = True
                    break
            else:
                out.append(list(b))
        boxes = out
    return [tuple(b) for b in boxes]


def quantize_color(c, step=12):
    return tuple(min(255, int(round(v / step) * step)) for v in c[:3])


def pixelate(im, box, scale, alpha=140, palette=24):
    """Crop `box` and shrink it by `scale` with a majority filter."""
    x0, y0, x1, y1 = box[:4]
    src = im.crop((x0, y0, x1 + 1, y1 + 1))
    sw, sh = src.size
    ow = max(1, round(sw / scale))
    oh = max(1, round(sh / scale))
    sp = src.load()
    out = Image.new("RGBA", (ow, oh), (0, 0, 0, 0))
    op = out.load()
    for oy in range(oh):
        for ox in range(ow):
            ax0 = int(ox * sw / ow)
            ax1 = max(ax0 + 1, int((ox + 1) * sw / ow))
            ay0 = int(oy * sh / oh)
            ay1 = max(ay0 + 1, int((oy + 1) * sh / oh))
            cols = Counter()
            opaque = 0
            total = 0
            for yy in range(ay0, ay1):
                for xx in range(ax0, ax1):
                    p = sp[xx, yy]
                    total += 1
                    if p[3] >= alpha:
                        opaque += 1
                        cols[quantize_color(p)] += 1
            if opaque * 2 >= total and cols:
                op[ox, oy] = cols.most_common(1)[0][0] + (255,)
    # Palette: snap to the sprite's most common colours (kills noise).
    if palette:
        q = out.convert("RGB").quantize(colors=palette, method=Image.Quantize.MEDIANCUT)
        rgb = q.convert("RGB").load()
        for y in range(oh):
            for x in range(ow):
                if op[x, y][3]:
                    op[x, y] = rgb[x, y] + (255,)
    return out


def outline(im, color=OUTLINE, darken_edge=True):
    """Restore a crisp dark outline: transparent pixels next to the silhouette."""
    w, h = im.size
    out = Image.new("RGBA", (w + 2, h + 2), (0, 0, 0, 0))
    out.alpha_composite(im, (1, 1))
    src = out.copy().load()
    dst = out.load()
    for y in range(h + 2):
        for x in range(w + 2):
            if src[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                c, d = x + dx, y + dy
                if 0 <= c < w + 2 and 0 <= d < h + 2 and src[c, d][3]:
                    dst[x, y] = color
                    break
    return out


def contact(sprites, scale=4, cols=10, labels=True):
    from PIL import ImageDraw
    cell = max(max(s.width, s.height) for s in sprites) + 6
    rows = (len(sprites) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * cell, rows * cell), (70, 90, 70, 255))
    d = ImageDraw.Draw(sheet)
    for i, s in enumerate(sprites):
        x, y = (i % cols) * cell, (i // cols) * cell
        sheet.alpha_composite(s, (x + 3, y + 3))
        if labels:
            d.text((x + 1, y), str(i), fill=(255, 255, 0, 255))
    return sheet.resize((sheet.width * scale, sheet.height * scale), Image.NEAREST)


def split(im, box, n, alpha=140):
    """Split a fused blob into `n` side-by-side pieces at the emptiest
    columns near the expected boundaries; returns tight sub-boxes."""
    x0, y0, x1, y1 = box[:4]
    px = im.load()
    counts = [sum(1 for y in range(y0, y1 + 1) if px[x, y][3] >= alpha) for x in range(x0, x1 + 1)]
    w = x1 - x0 + 1
    cuts = []
    for k in range(1, n):
        c = int(w * k / n)
        lo, hi = max(1, c - w // (n * 3)), min(w - 2, c + w // (n * 3))
        cuts.append(min(range(lo, hi + 1), key=lambda i: counts[i]))
    edges = [0] + cuts + [w - 1]
    out = []
    for a, b in zip(edges, edges[1:]):
        sub = im.crop((x0 + a, y0, x0 + b + 1, y1 + 1))
        bb = sub.getbbox()
        if bb:
            out.append((x0 + a + bb[0], y0 + bb[1], x0 + a + bb[2] - 1, y0 + bb[3] - 1))
    return out


def to_height(im, box, height, palette=20):
    return pixelate(im, box, (box[3] - box[1] + 1) / height, palette=palette)


def isolate(im, box, pad=3, loose=140, strict=250):
    """Cut one object out of a tightly packed sheet: take the box (plus a
    little padding), keep only the loose-alpha pixels connected to the
    object's solid core, and drop everything else (neighbours' halos)."""
    x0, y0, x1, y1 = box[:4]
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(im.width - 1, x1 + pad), min(im.height - 1, y1 + pad)
    crop = im.crop((x0, y0, x1 + 1, y1 + 1))
    w, h = crop.size
    px = crop.load()
    keep = bytearray(w * h)
    q = deque()
    # Seeds: solid pixels well inside the original box.
    for y in range(pad, h - pad):
        for x in range(pad, w - pad):
            if px[x, y][3] >= strict:
                keep[y * w + x] = 1
                q.append((x, y))
    while q:
        a, b = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            c, d = a + dx, b + dy
            if 0 <= c < w and 0 <= d < h and not keep[d * w + c] and px[c, d][3] >= loose:
                keep[d * w + c] = 1
                q.append((c, d))
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    op = out.load()
    for y in range(h):
        for x in range(w):
            if keep[y * w + x]:
                op[x, y] = px[x, y][:3] + (255,)
    return out


def prop_from(im, box, scale, palette=24):
    obj = isolate(im, box)
    bb = obj.getbbox()
    obj = obj.crop(bb)
    return outline(pixelate(obj, (0, 0, obj.width - 1, obj.height - 1), scale, palette=palette))
