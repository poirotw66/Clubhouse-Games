#!/usr/bin/env python3
"""
Wave 10 Multi-Battleground Art Generator
Generates high-resolution, tactile game assets for:
- Reversi (512x512 obsidian & ivory turned stone pieces, cell texture, parlor table)
- Connect-Four (512x512 tactile grip gravity chips, arcade blue frame, playroom table)
- Dominoes (512x768 ivory bone domino tile with brass spinner, mahogany tavern table)
- Koi-Koi (Ukiyo-e yaku cut-in banners, tatami rush weave, washitsu room bg)
"""

import math
import os
import random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SEED = 20261121
random.seed(SEED)

FONT_CANDIDATES = [
    '/System/Library/Fonts/Supplemental/Songti.ttc',
    '/System/Library/Fonts/Hiragino Sans GB.ttc',
    '/System/Library/Fonts/STHeiti Light.ttc',
    '/Library/Fonts/Arial Unicode.ttf',
]

def get_font(size: int, prefer_serif: bool = True) -> ImageFont.FreeTypeFont:
    for path in FONT_CANDIDATES:
        if prefer_serif and 'Songti' in path and os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
        elif not prefer_serif and 'Hiragino' in path and os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
    return ImageFont.load_default()


def create_wood_texture(width: int, height: int, base_rgb: tuple[int, int, int], grain_intensity: float = 0.15) -> Image.Image:
    """Create a rich polished wood surface with directional grain and subtle lighting."""
    img = Image.new('RGB', (width, height), base_rgb)
    draw = ImageDraw.Draw(img)
    
    # Layer horizontal grain lines
    r0, g0, b0 = base_rgb
    for y in range(0, height, 2):
        # Sine waves combined with random jitter
        wave = math.sin(y * 0.04) * 0.5 + math.sin(y * 0.12) * 0.25
        jitter = (random.random() - 0.5) * grain_intensity * 255
        delta = int(wave * grain_intensity * 60 + jitter)
        r = max(0, min(255, r0 + delta))
        g = max(0, min(255, g0 + int(delta * 0.85)))
        b = max(0, min(255, b0 + int(delta * 0.7)))
        draw.line([(0, y), (width, y)], fill=(r, g, b), width=2)
        
    # Subtle blur to smooth grain
    img = img.filter(ImageFilter.GaussianBlur(1.2))
    
    # Add ambient vignette and top-down spotlight
    vignette = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    vdraw = ImageDraw.Draw(vignette)
    cx, cy = width / 2.0, height / 2.2
    max_dist = math.sqrt(cx * cx + cy * cy)
    
    # Soft vignette gradient in radial steps
    for step in range(30):
        radius = max_dist * (1.0 - step / 30.0)
        alpha = int(140 * (step / 30.0) ** 1.8)
        bbox = [cx - radius, cy - radius * 0.7, cx + radius, cy + radius * 0.7]
        vdraw.ellipse(bbox, fill=(0, 0, 0, alpha))
        
    vignette = vignette.filter(ImageFilter.GaussianBlur(35.0))
    img.paste(Image.composite(Image.new('RGB', (width, height), (15, 10, 8)), img, vignette.split()[3]), (0, 0))
    return img


def generate_reversi_assets():
    print("Generating Reversi assets...")
    out_dir = "Games/Reversi/public"
    os.makedirs(out_dir, exist_ok=True)
    
    # 1. Piece Black (512x512): Obsidian turned stone
    size = 512
    im_black = Image.new('RGB', (size, size), (24, 24, 27))
    draw = ImageDraw.Draw(im_black)
    
    cx, cy = size / 2, size / 2
    r_outer = 236
    
    # Draw radial gradient with off-center specular spotlight
    hx, hy = size * 0.38, size * 0.35
    for r in range(r_outer, 0, -1):
        ratio = r / r_outer
        # Distance from highlight
        # Obsidian palette: from #3f3f46 down to deep jet black #09090b
        val = int(18 + 55 * ((1.0 - ratio) ** 1.5))
        edge_darken = int(25 * (ratio ** 3))
        cr = max(6, val - edge_darken)
        cg = max(6, val - edge_darken)
        cb = max(9, val + 4 - edge_darken)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(cr, cg, cb))
        
    # Concentric lathe micro-grooves
    for ring_r in [210, 190, 160, 130, 95]:
        draw.ellipse([cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r], outline=(45, 48, 56), width=1)
        draw.ellipse([cx - ring_r + 1, cy - ring_r + 1, cx + ring_r - 1, cy + ring_r - 1], outline=(12, 12, 15), width=1)
        
    # Smooth chamfered outer bevel ring
    draw.ellipse([cx - r_outer, cy - r_outer, cx + r_outer, cy + r_outer], outline=(68, 71, 80), width=3)
    draw.ellipse([cx - (r_outer - 3), cy - (r_outer - 3), cx + (r_outer - 3), cy + (r_outer - 3)], outline=(30, 32, 38), width=2)
    
    # Specular glass reflection arc
    spec = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(spec)
    sdraw.ellipse([hx - 90, hy - 70, hx + 90, hy + 70], fill=(255, 255, 255, 45))
    sdraw.ellipse([hx - 50, hy - 40, hx + 50, hy + 40], fill=(255, 255, 255, 80))
    spec = spec.filter(ImageFilter.GaussianBlur(16.0))
    im_black.paste(spec, (0, 0), spec)
    
    im_black.save(os.path.join(out_dir, "piece-black.jpg"), "JPEG", quality=95)
    
    # 2. Piece White (512x512): Ivory turned stone
    im_white = Image.new('RGB', (size, size), (241, 245, 249))
    draw = ImageDraw.Draw(im_white)
    
    for r in range(r_outer, 0, -1):
        ratio = r / r_outer
        # Ivory palette: from pure cream #ffffff down to pearl slate #cbd5e1
        val_r = int(255 - 45 * (ratio ** 1.3))
        val_g = int(252 - 42 * (ratio ** 1.3))
        val_b = int(245 - 35 * (ratio ** 1.3))
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(val_r, val_g, val_b))
        
    for ring_r in [210, 190, 160, 130, 95]:
        draw.ellipse([cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r], outline=(255, 255, 255), width=1)
        draw.ellipse([cx - ring_r + 1, cy - ring_r + 1, cx + ring_r - 1, cy + ring_r - 1], outline=(203, 213, 225), width=1)
        
    draw.ellipse([cx - r_outer, cy - r_outer, cx + r_outer, cy + r_outer], outline=(255, 255, 255), width=3)
    draw.ellipse([cx - (r_outer - 3), cy - (r_outer - 3), cx + (r_outer - 3), cy + (r_outer - 3)], outline=(195, 205, 218), width=2)
    
    spec = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(spec)
    sdraw.ellipse([hx - 90, hy - 70, hx + 90, hy + 70], fill=(255, 255, 255, 120))
    sdraw.ellipse([hx - 45, hy - 35, hx + 45, hy + 35], fill=(255, 255, 255, 190))
    spec = spec.filter(ImageFilter.GaussianBlur(14.0))
    im_white.paste(spec, (0, 0), spec)
    
    im_white.save(os.path.join(out_dir, "piece-white.jpg"), "JPEG", quality=95)
    
    # 3. Cell (512x512): Deep emerald green tournament felt with dark border
    im_cell = Image.new('RGB', (size, size), (16, 94, 60))
    cdraw = ImageDraw.Draw(im_cell)
    # Baize cloth texture
    for _ in range(12000):
        x = random.randint(0, size - 1)
        y = random.randint(0, size - 1)
        delta = random.randint(-18, 18)
        cdraw.point((x, y), fill=(max(0, min(255, 16 + delta)), max(0, min(255, 94 + delta)), max(0, min(255, 60 + delta))))
    im_cell = im_cell.filter(ImageFilter.GaussianBlur(0.8))
    
    cdraw = ImageDraw.Draw(im_cell)
    # Inset shadow / border groove
    cdraw.rectangle([0, 0, size - 1, size - 1], outline=(6, 46, 28), width=6)
    cdraw.rectangle([6, 6, size - 7, size - 7], outline=(20, 115, 75), width=2)
    im_cell.save(os.path.join(out_dir, "cell.jpg"), "JPEG", quality=95)
    
    # 4. Table BG (1350x900): Rich mahogany parlor table
    im_table = create_wood_texture(1350, 900, (48, 24, 18), grain_intensity=0.12)
    im_table.save(os.path.join(out_dir, "table-bg.jpg"), "JPEG", quality=92)


def generate_connect_four_assets():
    print("Generating Connect-Four assets...")
    out_dir = "Games/Connect-Four/public"
    os.makedirs(out_dir, exist_ok=True)
    size = 512
    cx, cy = size / 2, size / 2
    r_outer = 236
    
    # Helper to draw tactile gravity checker chip
    def draw_chip(base_hex, dark_hex, rim_hex, highlight_hex):
        im = Image.new('RGB', (size, size), (15, 23, 42))
        draw = ImageDraw.Draw(im)
        
        # Outer disc with stepped radial shading
        br, bg, bb = tuple(int(base_hex[i:i+2], 16) for i in (1, 3, 5))
        dr, dg, db = tuple(int(dark_hex[i:i+2], 16) for i in (1, 3, 5))
        for r in range(r_outer, 0, -1):
            ratio = r / r_outer
            cr = int(br * (1 - ratio * 0.45) + dr * (ratio * 0.45))
            cg = int(bg * (1 - ratio * 0.45) + dg * (ratio * 0.45))
            cb = int(bb * (1 - ratio * 0.45) + db * (ratio * 0.45))
            draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(cr, cg, cb))
            
        # Stepped circular grip ridges (tactile coin ridges)
        for ring_r in [210, 185, 160]:
            draw.ellipse([cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r], outline=(255, 255, 255), width=2)
            draw.ellipse([cx - ring_r + 2, cy - ring_r + 2, cx + ring_r - 2, cy + ring_r - 2], outline=(40, 10, 10), width=2)
            
        # Recessed center dish
        dish_r = 135
        for r in range(dish_r, 0, -1):
            ratio = r / dish_r
            cr = int(dr * (0.8 + ratio * 0.3))
            cg = int(dg * (0.8 + ratio * 0.3))
            cb = int(db * (0.8 + ratio * 0.3))
            draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(min(255, cr), min(255, cg), min(255, cb)))
            
        # Embossed 4-point star in center
        star_points = []
        for i in range(8):
            angle = i * math.pi / 4.0 - math.pi / 2.0
            rad = 85 if i % 2 == 0 else 32
            star_points.append((cx + rad * math.cos(angle), cy + rad * math.sin(angle)))
        draw.polygon(star_points, fill=tuple(int(highlight_hex[i:i+2], 16) for i in (1, 3, 5)))
        
        # Center pip
        draw.ellipse([cx - 16, cy - 16, cx + 16, cy + 16], fill=(255, 255, 255))
        
        # Outer rim bevel
        draw.ellipse([cx - r_outer, cy - r_outer, cx + r_outer, cy + r_outer], outline=tuple(int(rim_hex[i:i+2], 16) for i in (1, 3, 5)), width=5)
        
        # Gloss reflection
        spec = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        sdraw = ImageDraw.Draw(spec)
        sdraw.ellipse([cx - 120, cy - 160, cx + 80, cy - 60], fill=(255, 255, 255, 90))
        spec = spec.filter(ImageFilter.GaussianBlur(16.0))
        im.paste(spec, (0, 0), spec)
        return im

    # 1. Red piece
    im_red = draw_chip('#ef4444', '#7f1d1d', '#fca5a5', '#f87171')
    im_red.save(os.path.join(out_dir, "piece-red.jpg"), "JPEG", quality=95)
    
    # 2. Yellow piece
    im_yellow = draw_chip('#eab308', '#78350f', '#fef08a', '#facc15')
    im_yellow.save(os.path.join(out_dir, "piece-yellow.jpg"), "JPEG", quality=95)
    
    # 3. Frame (1024x682): Royal blue vertical chassis with cut-out slot wells
    fw, fh = 1024, 682
    im_frame = Image.new('RGB', (fw, fh), (30, 58, 138))
    fdraw = ImageDraw.Draw(im_frame)
    # Subtle vertical chassis gradient
    for y in range(fh):
        factor = y / fh
        r = int(30 * (1 - factor * 0.4))
        g = int(64 * (1 - factor * 0.3))
        b = int(175 * (1 - factor * 0.25))
        fdraw.line([(0, y), (fw, y)], fill=(r, g, b))
        
    # Grid of 7 columns x 6 rows of chamfered slot wells
    cols, rows = 7, 6
    cell_w = fw / cols
    cell_h = fh / rows
    slot_rad = min(cell_w, cell_h) * 0.38
    for c in range(cols):
        for r in range(rows):
            scx = (c + 0.5) * cell_w
            scy = (r + 0.5) * cell_h
            # Outer bevel shadow
            fdraw.ellipse([scx - slot_rad - 4, scy - slot_rad - 4, scx + slot_rad + 4, scy + slot_rad + 4], outline=(15, 23, 42), width=3)
            # Inner bevel highlight
            fdraw.ellipse([scx - slot_rad, scy - slot_rad, scx + slot_rad, scy + slot_rad], outline=(96, 165, 250), width=2)
            # Recessed slot cavity
            fdraw.ellipse([scx - slot_rad + 2, scy - slot_rad + 2, scx + slot_rad - 2, scy + slot_rad - 2], fill=(10, 15, 30))
            
    # Chassis rivets on corners & edges
    rivet_pos = [(24, 24), (fw - 24, 24), (24, fh - 24), (fw - 24, fh - 24), (fw/2, 24), (fw/2, fh - 24)]
    for rx, ry in rivet_pos:
        fdraw.ellipse([rx - 8, ry - 8, rx + 8, ry + 8], fill=(191, 219, 254), outline=(30, 58, 138), width=2)
        fdraw.ellipse([rx - 3, ry - 3, rx + 3, ry + 3], fill=(255, 255, 255))
        
    im_frame.save(os.path.join(out_dir, "frame.jpg"), "JPEG", quality=95)
    
    # 4. Table BG (1350x900): Deep arcade lounge walnut table
    im_table = create_wood_texture(1350, 900, (32, 28, 36), grain_intensity=0.10)
    im_table.save(os.path.join(out_dir, "table-bg.jpg"), "JPEG", quality=92)


def generate_dominoes_assets():
    print("Generating Dominoes assets...")
    out_dir = "Games/Dominoes/public"
    os.makedirs(out_dir, exist_ok=True)
    
    # 1. Tile Face (512x768): Authentic ivory bone domino tile
    w, h = 512, 768
    im_tile = Image.new('RGB', (w, h), (253, 248, 235))
    draw = ImageDraw.Draw(im_tile)
    
    # Ivory bone texture variation
    for _ in range(16000):
        x = random.randint(0, w - 1)
        y = random.randint(0, h - 1)
        delta = random.randint(-12, 12)
        draw.point((x, y), fill=(max(0, min(255, 253 + delta)), max(0, min(255, 248 + delta)), max(0, min(255, 235 + delta))))
    im_tile = im_tile.filter(ImageFilter.GaussianBlur(0.7))
    draw = ImageDraw.Draw(im_tile)
    
    # Smooth rounded border bevel
    draw.rounded_rectangle([12, 12, w - 13, h - 13], radius=32, outline=(220, 212, 192), width=6)
    draw.rounded_rectangle([6, 6, w - 7, h - 7], radius=36, outline=(180, 170, 150), width=3)
    
    # Center dividing trench
    mid_y = h // 2
    draw.line([(32, mid_y - 2), (w - 32, mid_y - 2)], fill=(160, 150, 130), width=2)
    draw.line([(32, mid_y), (w - 32, mid_y)], fill=(70, 65, 55), width=3)
    draw.line([(32, mid_y + 2), (w - 32, mid_y + 2)], fill=(255, 255, 255), width=2)
    
    # Classic double-six engraved pips
    def draw_pip(px, py, rad=24):
        # Engraved recessed black pip with inner shadow
        draw.ellipse([px - rad, py - rad, px + rad, py + rad], fill=(24, 24, 27))
        draw.ellipse([px - rad + 2, py - rad + 2, px + rad - 2, py + rad - 2], outline=(63, 63, 70), width=2)
        draw.ellipse([px - rad // 2, py - rad // 2, px - rad // 4, py - rad // 4], fill=(255, 255, 255))
        
    # Pips on top half (value 6)
    top_cx, top_cy = w // 2, mid_y // 2
    dx, dy = 110, 85
    for c_off in [-dx, dx]:
        for r_off in [-dy, 0, dy]:
            draw_pip(top_cx + c_off, top_cy + r_off)
            
    # Pips on bottom half (value 6)
    bot_cx, bot_cy = w // 2, mid_y + mid_y // 2
    for c_off in [-dx, dx]:
        for r_off in [-dy, 0, dy]:
            draw_pip(bot_cx + c_off, bot_cy + r_off)
            
    # Center brass spinner rivet
    rivet_r = 20
    draw.ellipse([w // 2 - rivet_r, mid_y - rivet_r, w // 2 + rivet_r, mid_y + rivet_r], fill=(234, 179, 8), outline=(133, 77, 14), width=3)
    draw.ellipse([w // 2 - rivet_r // 2, mid_y - rivet_r // 2, w // 2 + rivet_r // 4, mid_y + rivet_r // 4], fill=(254, 240, 138))
    
    im_tile.save(os.path.join(out_dir, "tile-face.jpg"), "JPEG", quality=95)
    
    # 2. Table BG (1350x900): Warm mahogany tavern parlor table
    im_table = create_wood_texture(1350, 900, (54, 28, 20), grain_intensity=0.14)
    im_table.save(os.path.join(out_dir, "table-bg.jpg"), "JPEG", quality=92)


def generate_koi_koi_assets():
    print("Generating Koi-Koi assets...")
    tex_dir = "Games/Koi-Koi/public/textures"
    yaku_dir = os.path.join(tex_dir, "yaku")
    os.makedirs(yaku_dir, exist_ok=True)
    
    # 1. Tatami (1350x900): Traditional igusa rush mat weave
    tw, th = 1350, 900
    im_tatami = Image.new('RGB', (tw, th), (74, 103, 65))
    tdraw = ImageDraw.Draw(im_tatami)
    
    # Weave pattern: fine horizontal straw ribs with chevron texture
    for y in range(0, th, 4):
        shade = 60 + int(math.sin(y * 0.25) * 12) + random.randint(-4, 4)
        g_val = min(255, max(0, int(shade * 1.35)))
        r_val = min(255, max(0, int(shade * 0.95)))
        b_val = min(255, max(0, int(shade * 0.8)))
        tdraw.line([(0, y), (tw, y)], fill=(r_val, g_val, b_val), width=2)
        tdraw.line([(0, y + 2), (tw, y + 2)], fill=(r_val - 12, g_val - 12, b_val - 10), width=2)
        
    # Heri (dark fabric border tape on top and bottom)
    heri_h = 32
    tdraw.rectangle([0, 0, tw, heri_h], fill=(24, 30, 22))
    tdraw.rectangle([0, th - heri_h, tw, th], fill=(24, 30, 22))
    # Golden thread crests on heri
    for x in range(30, tw, 80):
        tdraw.ellipse([x - 8, heri_h // 2 - 8, x + 8, heri_h // 2 + 8], outline=(180, 150, 80), width=1)
        tdraw.ellipse([x - 8, th - heri_h // 2 - 8, x + 8, th - heri_h // 2 + 8], outline=(180, 150, 80), width=1)
        
    im_tatami = im_tatami.filter(ImageFilter.GaussianBlur(0.6))
    im_tatami.save(os.path.join(tex_dir, "tatami.jpg"), "JPEG", quality=92)
    
    # 2. Room BG (1350x900): Traditional Japanese washitsu room at dusk
    im_room = Image.new('RGB', (tw, th), (28, 20, 24))
    rdraw = ImageDraw.Draw(im_room)
    # Twilight gradient background outside shoji
    for y in range(th):
        ratio = y / th
        r = int(24 + 30 * ratio)
        g = int(18 + 20 * ratio)
        b = int(36 + 15 * (1 - ratio))
        rdraw.line([(0, y), (tw, y)], fill=(r, g, b))
        
    # Shoji screen wooden grid in background
    col_w = tw // 12
    row_h = th // 8
    for c in range(13):
        rdraw.line([(c * col_w, 0), (c * col_w, th)], fill=(45, 32, 26), width=6)
    for r in range(9):
        rdraw.line([(0, r * row_h), (tw, r * row_h)], fill=(45, 32, 26), width=4)
        
    # Warm lantern glow at center
    glow = Image.new('RGBA', (tw, th), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gdraw.ellipse([tw // 2 - 450, th // 2 - 300, tw // 2 + 450, th // 2 + 300], fill=(255, 200, 100, 75))
    glow = glow.filter(ImageFilter.GaussianBlur(80.0))
    im_room.paste(glow, (0, 0), glow)
    im_room.save(os.path.join(tex_dir, "room-bg.jpg"), "JPEG", quality=92)
    
    # 3. Yaku Cut-In Banners (900x260): Japanese Ukiyo-e aesthetic horizontal cut-ins
    font_large = get_font(72, prefer_serif=True)
    font_mid = get_font(32, prefer_serif=True)
    font_seal = get_font(22, prefer_serif=True)
    
    yaku_definitions = [
        {
            "id": "gokou",
            "kanji": "五光",
            "romaji": "GOKOU · FIVE BRIGHTS",
            "pts": "10 分",
            "bg_color": (36, 20, 10),
            "accent": (234, 179, 8),
            "motif": "solar",
        },
        {
            "id": "shikou",
            "kanji": "四光",
            "romaji": "SHIKOU · FOUR BRIGHTS",
            "pts": "8 分",
            "bg_color": (28, 18, 30),
            "accent": (217, 119, 6),
            "motif": "quad",
        },
        {
            "id": "ame_shikou",
            "kanji": "雨四光",
            "romaji": "AME-SHIKOU · RAIN BRIGHTS",
            "pts": "7 分",
            "bg_color": (16, 28, 36),
            "accent": (56, 189, 248),
            "motif": "rain",
        },
        {
            "id": "sankou",
            "kanji": "三光",
            "romaji": "SANKOU · THREE BRIGHTS",
            "pts": "5 分",
            "bg_color": (32, 22, 16),
            "accent": (245, 158, 11),
            "motif": "tri",
        },
        {
            "id": "ino_shika_cho",
            "kanji": "豬鹿蝶",
            "romaji": "INO-SHIKA-CHO · BOAR DEER BUTTERFLY",
            "pts": "5 分",
            "bg_color": (36, 16, 20),
            "accent": (244, 63, 94),
            "motif": "nature",
        },
        {
            "id": "hanami_zake",
            "kanji": "花見酒",
            "romaji": "HANAMI-ZAKE · CHERRY SAKE",
            "pts": "5 分",
            "bg_color": (40, 14, 24),
            "accent": (251, 113, 133),
            "motif": "cherry",
        },
        {
            "id": "tsukimi_zake",
            "kanji": "月見酒",
            "romaji": "TSUKIMI-ZAKE · MOON SAKE",
            "pts": "5 分",
            "bg_color": (14, 20, 42),
            "accent": (147, 197, 253),
            "motif": "moon",
        },
        {
            "id": "akatan",
            "kanji": "赤短",
            "romaji": "AKATAN · RED POETRY RIBBONS",
            "pts": "5 分",
            "bg_color": (42, 14, 14),
            "accent": (239, 68, 68),
            "motif": "red_ribbon",
        },
        {
            "id": "aotan",
            "kanji": "青短",
            "romaji": "AOTAN · BLUE POETRY RIBBONS",
            "pts": "5 分",
            "bg_color": (14, 24, 46),
            "accent": (59, 130, 246),
            "motif": "blue_ribbon",
        },
    ]
    
    bw, bh = 900, 260
    for yk in yaku_definitions:
        im_banner = Image.new('RGB', (bw, bh), yk["bg_color"])
        bdraw = ImageDraw.Draw(im_banner)
        
        # Horizontal gradient & brush mist
        bg_r, bg_g, bg_b = yk["bg_color"]
        ac_r, ac_g, ac_b = yk["accent"]
        for x in range(bw):
            t = x / bw
            fade = math.sin(t * math.pi)
            r = int(bg_r * (1 - fade * 0.4) + ac_r * (fade * 0.25))
            g = int(bg_g * (1 - fade * 0.4) + ac_g * (fade * 0.25))
            b = int(bg_b * (1 - fade * 0.4) + ac_b * (fade * 0.25))
            bdraw.line([(x, 0), (x, bh)], fill=(r, g, b))
            
        # Traditional Japanese gold clouds (Suyari-gasumi)
        for _ in range(14):
            cx = random.randint(40, bw - 40)
            cy = random.randint(20, bh - 20)
            cw = random.randint(120, 280)
            ch = random.randint(20, 50)
            bdraw.rounded_rectangle([cx - cw // 2, cy - ch // 2, cx + cw // 2, cy + ch // 2], radius=16, fill=(min(255, ac_r + 40), min(255, ac_g + 40), min(255, ac_b + 40), 40))
            
        im_banner = im_banner.filter(ImageFilter.GaussianBlur(1.0))
        bdraw = ImageDraw.Draw(im_banner)
        
        # Outer golden borders
        bdraw.rectangle([4, 4, bw - 5, bh - 5], outline=yk["accent"], width=3)
        bdraw.rectangle([10, 10, bw - 11, bh - 11], outline=(255, 255, 255), width=1)
        
        # Motif special art
        motif = yk["motif"]
        if motif == "solar" or motif == "tri" or motif == "quad":
            # Golden sunburst rays
            for deg in range(0, 360, 18):
                rad = math.radians(deg)
                x2 = 180 + 350 * math.cos(rad)
                y2 = 130 + 350 * math.sin(rad)
                bdraw.line([(180, 130), (x2, y2)], fill=(254, 240, 138), width=2)
            bdraw.ellipse([180 - 60, 130 - 60, 180 + 60, 130 + 60], fill=(234, 179, 8), outline=(254, 240, 138), width=3)
        elif motif == "moon":
            # Full moon
            bdraw.ellipse([180 - 65, 130 - 65, 180 + 65, 130 + 65], fill=(254, 240, 138), outline=(255, 255, 255), width=3)
        elif motif == "cherry":
            # Cherry blossoms
            for bx, by in [(130, 80), (190, 140), (120, 180), (230, 90)]:
                bdraw.ellipse([bx - 22, by - 22, bx + 22, by + 22], fill=(251, 113, 133))
                bdraw.ellipse([bx - 8, by - 8, bx + 8, by + 8], fill=(255, 255, 255))
        elif motif == "rain":
            # Rain streaks
            for rx in range(40, 320, 18):
                bdraw.line([(rx, 20), (rx - 40, bh - 20)], fill=(125, 211, 252), width=3)
        elif motif == "red_ribbon" or motif == "blue_ribbon":
            # Flowing poetry ribbon scroll
            rib_col = (220, 38, 38) if motif == "red_ribbon" else (37, 99, 235)
            bdraw.rounded_rectangle([90, 45, 140, 215], radius=8, fill=rib_col, outline=(255, 255, 255), width=2)
            bdraw.rounded_rectangle([160, 35, 210, 205], radius=8, fill=rib_col, outline=(255, 255, 255), width=2)
            bdraw.rounded_rectangle([230, 55, 280, 225], radius=8, fill=rib_col, outline=(255, 255, 255), width=2)
        elif motif == "nature":
            # Triple nature emblems
            bdraw.ellipse([120, 80, 180, 140], fill=(225, 29, 72))
            bdraw.ellipse([180, 130, 240, 190], fill=(245, 158, 11))
            bdraw.ellipse([130, 150, 170, 190], fill=(168, 85, 247))
            
        # Vermilion seal square on right side
        seal_x, seal_y = bw - 110, bh // 2
        bdraw.rectangle([seal_x - 36, seal_y - 36, seal_x + 36, seal_y + 36], fill=(185, 28, 28), outline=(254, 202, 202), width=2)
        bdraw.text((seal_x, seal_y), "極", fill=(255, 255, 255), font=font_seal, anchor="mm")
        
        # Kanji typography
        kanji_x = 440
        bdraw.text((kanji_x + 2, 110 + 2), yk["kanji"], fill=(0, 0, 0), font=font_large, anchor="mm")
        bdraw.text((kanji_x, 110), yk["kanji"], fill=(255, 255, 255), font=font_large, anchor="mm")
        
        # Romaji & subtitle
        bdraw.text((kanji_x, 185), yk["romaji"], fill=yk["accent"], font=font_mid, anchor="mm")
        
        # Points badge on upper right
        pts_x = bw - 210
        bdraw.rounded_rectangle([pts_x - 65, 80, pts_x + 65, 135], radius=12, fill=(15, 23, 42), outline=yk["accent"], width=2)
        bdraw.text((pts_x, 107), yk["pts"], fill=(254, 240, 138), font=font_mid, anchor="mm")
        
        banner_path = os.path.join(yaku_dir, f"{yk['id']}.jpg")
        im_banner.save(banner_path, "JPEG", quality=95)
        print(f"Saved yaku banner: {banner_path}")


if __name__ == "__main__":
    generate_reversi_assets()
    generate_connect_four_assets()
    generate_dominoes_assets()
    generate_koi_koi_assets()
    print("All Wave 10 assets generated successfully!")
