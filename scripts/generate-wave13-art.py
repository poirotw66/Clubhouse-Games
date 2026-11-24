#!/usr/bin/env python3
"""
Wave 13 Multi-Battleground Art Generator
Generates high-resolution, tactile game assets adhering to Sakurai game design principles for:
- Tetris (1350x900 neon cyber cathedral menu hero, 1080x1620 cyber matrix well background, 512x512 jewel-cut beveled blocks: i, j, l, o, s, t, z, g)
- Block-the-smash (1350x900 championship coliseum menu hero, 1024x1024 tournament court, 1350x900 stadium canopy sky, 512x512 opponent portraits: hao, mei, gui, coach, lu, min, king)
- Roguelike-Snake (1350x900 serpent crypt title hero, 1024x1024 mossy dungeon pavers, 512x512 obsidian wall, 512x512 enemy portraits: boss, wisp, stalker, spitter, 512x512 sacred relics: 18 artifacts)
- Puyo-Puyo (1080x1620 celestial arcade stage background, 1376x768 fever burst banner, 1024x1024 character portraits: amit, witch, dark lord, 512x512 translucent jelly puyos: red, green, blue, yellow, purple, garbage)

Architectural justification: High-fidelity procedural asset generation for 4 games in Wave 13
requires rich mathematical drawing routines, vector rendering, and localized font typography
within a single deterministic, reproducible generation pipeline, mirroring Wave 10, Wave 11, and Wave 12.
"""

import math
import os
import random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SEED = 20261124
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


def draw_seal(
    draw: ImageDraw.ImageDraw,
    text: str,
    x: int,
    y: int,
    size: int = 56,
    font: ImageFont.FreeTypeFont = None,
    fill: tuple[int, int, int] = (185, 28, 28),
    border: tuple[int, int, int] = (254, 202, 202),
    text_color: tuple[int, int, int] = (255, 255, 255),
):
    """Draw a traditional Chinese red seal stamp with double border."""
    half = size // 2
    draw.rectangle([x - half, y - half, x + half, y + half], fill=fill, outline=border, width=2)
    draw.rectangle([x - half + 3, y - half + 3, x + half - 3, y + half - 3], outline=border, width=1)
    if font:
        draw.text((x, y), text, fill=text_color, font=font, anchor="mm")


def apply_vignette(img: Image.Image, intensity: float = 0.5, color: tuple[int, int, int] = (0, 0, 0)) -> Image.Image:
    w, h = img.size
    vignette = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    vdraw = ImageDraw.Draw(vignette)
    cx, cy = w / 2.0, h / 2.0
    max_dist = math.sqrt(cx * cx + cy * cy)
    steps = 25
    for s in range(steps):
        r = max_dist * (1.0 - s / float(steps))
        alpha = int(255 * intensity * ((s / float(steps)) ** 1.8))
        vdraw.ellipse([cx - r, cy - r * (h / w), cx + r, cy + r * (h / w)], fill=(*color, alpha))
    vignette = vignette.filter(ImageFilter.GaussianBlur(30.0))
    base_rgba = img.convert('RGBA')
    base_rgba.paste(vignette, (0, 0), vignette)
    return base_rgba.convert('RGB')


# ==============================================================================
# 1. Tetris Assets
# ==============================================================================

def generate_tetris_assets():
    print("Generating Tetris assets...")
    out_dir = "Games/Tetris/public"
    block_dir = os.path.join(out_dir, "blocks")
    os.makedirs(block_dir, exist_ok=True)

    font_title = get_font(42, prefer_serif=False)
    font_sub = get_font(20, prefer_serif=False)
    font_seal = get_font(28, prefer_serif=True)

    # 1.1 Menu Background (1350x900): Neo-Constructivist Cyber Cathedral
    w, h = 1350, 900
    menu_bg = Image.new('RGB', (w, h), (4, 7, 20))
    draw = ImageDraw.Draw(menu_bg)

    # Gradient background with deep indigo to midnight cyan
    for y in range(h):
        ratio = y / float(h)
        r = int(4 + 18 * ratio)
        g = int(7 + 25 * ratio)
        b = int(20 + 45 * ratio)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    # Architectural spire silhouettes in constructivist angular geometry
    spires = [
        (150, 900, 160, 420),
        (320, 900, 220, 310),
        (540, 900, 260, 480),
        (820, 900, 280, 520),
        (1080, 900, 200, 360),
        (1240, 900, 180, 440),
    ]
    for sx, sy, sw, sh in spires:
        # Base column
        draw.polygon([(sx - sw // 2, sy), (sx - sw // 3, sy - sh), (sx + sw // 3, sy - sh), (sx + sw // 2, sy)], fill=(10, 18, 42))
        # Spire peak
        draw.polygon([(sx - sw // 3, sy - sh), (sx, sy - sh - 110), (sx + sw // 3, sy - sh)], fill=(16, 28, 64), outline=(56, 189, 248), width=1)
        # Onion dome arc / geometric faceted crown
        draw.ellipse([sx - sw // 4, sy - sh - 70, sx + sw // 4, sy - sh - 10], outline=(250, 204, 21), width=2)

    # Laser grid ground plane
    for gy in range(650, 900, 25):
        alpha_y = int(40 + (gy - 650) * 0.7)
        draw.line([(0, gy), (w, gy)], fill=(14, 165, 233), width=1)
    for gx in range(-300, w + 300, 55):
        draw.line([(w // 2, 600), (gx, 900)], fill=(14, 165, 233), width=1)

    # Falling neon tetromino silhouettes with kinetic light trails
    tetro_shapes = [
        # (type, x, y, size, color)
        ([(0,0),(1,0),(2,0),(3,0)], 240, 220, 26, (6, 182, 212)),      # I cyan
        ([(0,0),(0,1),(1,1),(2,1)], 980, 180, 26, (37, 99, 235)),     # J blue
        ([(2,0),(0,1),(1,1),(2,1)], 440, 150, 26, (249, 115, 22)),    # L orange
        ([(0,0),(1,0),(0,1),(1,1)], 720, 260, 28, (234, 179, 8)),     # O yellow
        ([(1,0),(2,0),(0,1),(1,1)], 1180, 270, 24, (34, 197, 94)),    # S green
        ([(1,0),(0,1),(1,1),(2,1)], 860, 360, 24, (168, 85, 247)),    # T purple
        ([(0,0),(1,0),(1,1),(2,1)], 140, 380, 24, (239, 68, 68)),     # Z red
    ]
    for shape, ox, oy, sz, col in tetro_shapes:
        for bx, by in shape:
            px = ox + bx * sz
            py = oy + by * sz
            # Motion trail
            draw.line([(px + sz // 2, py - 40), (px + sz // 2, py + sz // 2)], fill=(*col, 120), width=sz // 2)
            draw.rectangle([px, py, px + sz - 2, py + sz - 2], fill=col, outline=(255, 255, 255), width=2)

    # Grand Title & Seal
    draw.text((w // 2, 110), "TETRIS GRANDMASTER", fill=(240, 249, 255), font=font_title, anchor="mm")
    draw.text((w // 2, 155), "CYBER MATRIX · RUSSIAN CONSTRUCTIVIST SKYLINE", fill=(125, 211, 252), font=font_sub, anchor="mm")
    draw_seal(draw, "塊", w // 2 + 300, 110, size=52, font=font_seal, fill=(185, 28, 28), border=(254, 202, 202))

    menu_bg = apply_vignette(menu_bg, intensity=0.55)
    menu_bg.save(os.path.join(out_dir, "menu-bg.jpg"), "JPEG", quality=92)

    # 1.2 Well Background (1080x1620): Cyber Carbon Matrix Grid
    ww, wh = 1080, 1620
    well_bg = Image.new('RGB', (ww, wh), (8, 12, 24))
    wdraw = ImageDraw.Draw(well_bg)

    # Vertical gradient
    for y in range(wh):
        c = int(8 + 12 * (y / float(wh)))
        wdraw.line([(0, y), (ww, y)], fill=(c, c + 3, c + 14))

    # Carbon weave pattern
    for cy in range(0, wh, 8):
        for cx in range(0, ww, 8):
            if (cx // 8 + cy // 8) % 2 == 0:
                wdraw.rectangle([cx, cy, cx + 7, cy + 7], fill=(14, 20, 36))

    # 10x20 cell guides
    cell_w = ww / 10.0
    cell_h = wh / 20.0
    for col in range(11):
        x = int(col * cell_w)
        wdraw.line([(x, 0), (x, wh)], fill=(30, 41, 59), width=1)
    for row in range(21):
        y = int(row * cell_h)
        # Row 4 is the 16H Danger Zone line
        if row == 4:
            wdraw.line([(0, y), (ww, y)], fill=(244, 63, 94), width=3)
        else:
            wdraw.line([(0, y), (ww, y)], fill=(30, 41, 59), width=1)

    # Height scale ticks on outer border
    font_gauge = get_font(18, prefer_serif=False)
    for row in range(1, 20):
        y = int(row * cell_h)
        h_label = f"{20 - row}H"
        color = (244, 63, 94) if row <= 4 else (100, 116, 139)
        wdraw.text((12, y), h_label, fill=color, font=font_gauge, anchor="lm")
        wdraw.text((ww - 12, y), h_label, fill=color, font=font_gauge, anchor="rm")

    well_bg = apply_vignette(well_bg, intensity=0.45)
    well_bg.save(os.path.join(out_dir, "well-bg.jpg"), "JPEG", quality=92)

    # 1.3 Eight Tetromino Crystalline Blocks (512x512)
    # Beveled jewel-cut arcade block with inner refraction, tactile diamond facet & rim
    blocks = [
        ("i", (6, 182, 212), (165, 243, 252), (8, 80, 96)),      # Cyan
        ("j", (37, 99, 235), (191, 219, 254), (18, 45, 115)),     # Blue
        ("l", (249, 115, 22), (254, 215, 170), (124, 45, 12)),    # Orange
        ("o", (234, 179, 8), (254, 240, 138), (113, 63, 10)),     # Yellow
        ("s", (34, 197, 94), (187, 247, 208), (16, 85, 38)),      # Green
        ("t", (168, 85, 247), (233, 213, 255), (88, 28, 135)),    # Purple
        ("z", (239, 68, 68), (254, 202, 202), (127, 29, 29)),     # Red
        ("g", (100, 116, 139), (226, 232, 240), (30, 41, 59)),    # Garbage (Titanium)
    ]

    bsize = 512
    margin = 16
    for bname, base_col, light_col, dark_col in blocks:
        bim = Image.new('RGB', (bsize, bsize), (15, 23, 42))
        bdraw = ImageDraw.Draw(bim)

        # Outer dark shadow base
        bdraw.rounded_rectangle([margin, margin, bsize - margin, bsize - margin], radius=28, fill=dark_col)

        # Outer beveled facets (Top & Left highlight, Bottom & Right shadow)
        bevel_w = 48
        # Top bevel
        bdraw.polygon([
            (margin, margin),
            (bsize - margin, margin),
            (bsize - margin - bevel_w, margin + bevel_w),
            (margin + bevel_w, margin + bevel_w),
        ], fill=light_col)
        # Left bevel
        bdraw.polygon([
            (margin, margin),
            (margin + bevel_w, margin + bevel_w),
            (margin + bevel_w, bsize - margin - bevel_w),
            (margin, bsize - margin),
        ], fill=tuple(int((a + b) / 2) for a, b in zip(base_col, light_col)))
        # Right bevel
        bdraw.polygon([
            (bsize - margin, margin),
            (bsize - margin, bsize - margin),
            (bsize - margin - bevel_w, bsize - margin - bevel_w),
            (bsize - margin - bevel_w, margin + bevel_w),
        ], fill=base_col)
        # Bottom bevel
        bdraw.polygon([
            (margin, bsize - margin),
            (margin + bevel_w, bsize - margin - bevel_w),
            (bsize - margin - bevel_w, bsize - margin - bevel_w),
            (bsize - margin, bsize - margin),
        ], fill=dark_col)

        # Central jewel facet plate
        bdraw.rounded_rectangle([
            margin + bevel_w,
            margin + bevel_w,
            bsize - margin - bevel_w,
            bsize - margin - bevel_w,
        ], radius=16, fill=base_col)

        # Inner diamond jewel facet
        cx, cy = bsize // 2, bsize // 2
        d_rad = 110
        bdraw.polygon([
            (cx, cy - d_rad),
            (cx + d_rad, cy),
            (cx, cy + d_rad),
            (cx - d_rad, cy),
        ], fill=tuple(min(255, int(c * 1.15)) for c in base_col), outline=light_col, width=3)

        # Inner jewel highlight glint
        bdraw.polygon([
            (cx, cy - d_rad),
            (cx + d_rad, cy),
            (cx, cy),
        ], fill=light_col)

        # If garbage block: add industrial steel rivets at four corners
        if bname == "g":
            rivet_coords = [
                (margin + bevel_w + 24, margin + bevel_w + 24),
                (bsize - margin - bevel_w - 24, margin + bevel_w + 24),
                (margin + bevel_w + 24, bsize - margin - bevel_w - 24),
                (bsize - margin - bevel_w - 24, bsize - margin - bevel_w - 24),
            ]
            for rx, ry in rivet_coords:
                bdraw.ellipse([rx - 12, ry - 12, rx + 12, ry + 12], fill=(203, 213, 225), outline=(51, 65, 85), width=2)
                bdraw.ellipse([rx - 4, ry - 4, rx + 4, ry + 4], fill=(71, 85, 105))

        # Precision crisp borders
        bdraw.rounded_rectangle([margin, margin, bsize - margin, bsize - margin], radius=28, outline=(255, 255, 255), width=3)

        bim.save(os.path.join(block_dir, f"{bname}.jpg"), "JPEG", quality=92)


# ==============================================================================
# 2. Block-the-smash Assets
# ==============================================================================

def generate_block_the_smash_assets():
    print("Generating Block-the-smash assets...")
    out_dir = "Games/Block-the-smash/public"
    tex_dir = os.path.join(out_dir, "textures")
    opp_dir = os.path.join(out_dir, "opponents")
    os.makedirs(tex_dir, exist_ok=True)
    os.makedirs(opp_dir, exist_ok=True)

    font_title = get_font(42, prefer_serif=False)
    font_sub = get_font(20, prefer_serif=False)
    font_seal = get_font(28, prefer_serif=True)
    font_name = get_font(24, prefer_serif=False)

    # 2.1 Menu Hero (1350x900): Championship Badminton Coliseum
    w, h = 1350, 900
    menu_bg = Image.new('RGB', (w, h), (12, 18, 28))
    draw = ImageDraw.Draw(menu_bg)

    # Upper arena ceiling & floodlight beams
    for y in range(450):
        ratio = y / 450.0
        draw.line([(0, y), (w, y)], fill=(int(10 + 20 * ratio), int(15 + 30 * ratio), int(25 + 40 * ratio)))

    # Towering grandstands with crowd dots
    for row in range(8):
        gy = 280 + row * 20
        draw.line([(0, gy), (w, gy)], fill=(20, 28, 45), width=18)
        for cx in range(20, w, 24):
            if (cx + row * 11) % 3 == 0:
                dot_c = random.choice([(220, 38, 38), (37, 99, 235), (234, 179, 8), (255, 255, 255), (16, 185, 129)])
                draw.ellipse([cx, gy - 6, cx + 5, gy - 1], fill=dot_c)

    # Spotlights angling from ceiling
    spotlight_origins = [(200, 60), (450, 40), (900, 40), (1150, 60)]
    for sx, sy in spotlight_origins:
        draw.polygon([(sx, sy), (sx - 180, 850), (sx + 180, 850)], fill=(254, 240, 138, 35))

    # Tournament court perspective floor (green sports mat with parquet boundary)
    court_poly = [(180, 460), (w - 180, 460), (w - 40, 900), (40, 900)]
    draw.polygon(court_poly, fill=(21, 128, 61))  # Emerald green court
    # Court perimeter boundary lines (Crisp white lines)
    draw.line([(240, 480), (w - 240, 480)], fill=(255, 255, 255), width=4)
    draw.line([(80, 860), (w - 80, 860)], fill=(255, 255, 255), width=6)
    draw.line([(240, 480), (80, 860)], fill=(255, 255, 255), width=5)
    draw.line([(w - 240, 480), (w - 80, 860)], fill=(255, 255, 255), width=5)
    # Center service line
    draw.line([(w // 2, 480), (w // 2, 860)], fill=(255, 255, 255), width=4)

    # High-Velocity Smash Shuttlecock & Golden Streak
    shuttle_x, shuttle_y = w // 2 - 40, 520
    # Aerodynamic motion shockwave
    for st in range(6):
        sw_len = 160 + st * 40
        draw.line([
            (shuttle_x - sw_len, shuttle_y - 80 - st * 15),
            (shuttle_x, shuttle_y),
        ], fill=(253, 224, 71), width=max(1, 6 - st))
    # Shuttlecock head (cork sphere)
    draw.ellipse([shuttle_x - 18, shuttle_y - 18, shuttle_x + 18, shuttle_y + 18], fill=(255, 255, 255), outline=(234, 179, 8), width=3)
    # Feather skirt
    draw.polygon([
        (shuttle_x, shuttle_y),
        (shuttle_x - 55, shuttle_y - 45),
        (shuttle_x - 45, shuttle_y - 65),
    ], fill=(241, 245, 249), outline=(203, 213, 225), width=2)

    # Title & Badminton Seal
    draw.text((w // 2, 120), "BLOCK THE SMASH", fill=(255, 255, 255), font=font_title, anchor="mm")
    draw.text((w // 2, 170), "CHAMPIONSHIP COLISEUM · 3D COURT SMASH", fill=(134, 239, 172), font=font_sub, anchor="mm")
    draw_seal(draw, "羽", w // 2 + 250, 120, size=52, font=font_seal, fill=(22, 101, 52), border=(187, 247, 208))

    menu_bg = apply_vignette(menu_bg, intensity=0.45)
    menu_bg.save(os.path.join(out_dir, "menu-bg.jpg"), "JPEG", quality=92)

    # 2.2 Court Texture (1024x1024): Non-slip tournament green mat with parquet perimeter
    cw, ch = 1024, 1024
    court_tex = Image.new('RGB', (cw, ch), (22, 101, 52))
    cdraw = ImageDraw.Draw(court_tex)

    # Synthetic textured pebble grid
    for cy in range(0, ch, 6):
        for cx in range(0, cw, 6):
            if (cx + cy) % 12 == 0:
                cdraw.rectangle([cx, cy, cx + 2, cy + 2], fill=(21, 128, 61))

    # Parquet border outer trim
    border_thickness = 96
    cdraw.rectangle([0, 0, cw, border_thickness], fill=(120, 53, 15))
    cdraw.rectangle([0, ch - border_thickness, cw, ch], fill=(120, 53, 15))
    cdraw.rectangle([0, 0, border_thickness, ch], fill=(120, 53, 15))
    cdraw.rectangle([cw - border_thickness, 0, cw, ch], fill=(120, 53, 15))

    # White court line boundaries
    line_col = (255, 255, 255)
    lw = 8
    # Outer court doubles line
    cdraw.rectangle([border_thickness + 16, border_thickness + 16, cw - border_thickness - 16, ch - border_thickness - 16], outline=line_col, width=lw)
    # Inner singles sideline
    cdraw.rectangle([border_thickness + 64, border_thickness + 16, cw - border_thickness - 64, ch - border_thickness - 16], outline=line_col, width=lw)
    # Center service line
    cdraw.line([(cw // 2, border_thickness + 16), (cw // 2, ch - border_thickness - 16)], fill=line_col, width=lw)
    # Short service line
    cdraw.line([(border_thickness + 16, ch // 2), (cw - border_thickness - 16, ch // 2)], fill=line_col, width=lw)

    court_tex.save(os.path.join(tex_dir, "court.jpg"), "JPEG", quality=92)

    # 2.3 Sky Texture (1350x900): Stadium Canopy with Catwalks & Halogen Floodlights
    sw, sh = 1350, 900
    sky_tex = Image.new('RGB', (sw, sh), (8, 14, 24))
    sdraw = ImageDraw.Draw(sky_tex)

    # Vaulted ceiling metal trusses
    for tx in range(0, sw, 150):
        sdraw.line([(tx, 0), (tx + 120, sh)], fill=(24, 38, 60), width=6)
        sdraw.line([(tx + 120, 0), (tx, sh)], fill=(24, 38, 60), width=6)
    for ty in range(0, sh, 120):
        sdraw.line([(0, ty), (sw, ty)], fill=(30, 48, 75), width=8)

    # Bank of Halogen Arena Floodlights
    light_banks = [
        (250, 180), (550, 160), (800, 160), (1100, 180),
    ]
    for lx, ly in light_banks:
        # Housing bracket
        sdraw.rectangle([lx - 70, ly - 35, lx + 70, ly + 35], fill=(51, 65, 85), outline=(148, 163, 184), width=3)
        # 6 bright halogen bulb lenses
        for bx in range(-45, 55, 20):
            sdraw.ellipse([lx + bx - 8, ly - 8, lx + bx + 8, ly + 8], fill=(254, 240, 138), outline=(255, 255, 255), width=2)
        # Glow halo
        sdraw.ellipse([lx - 120, ly - 80, lx + 120, ly + 80], outline=(254, 240, 138), width=1)

    sky_tex = apply_vignette(sky_tex, intensity=0.5)
    sky_tex.save(os.path.join(tex_dir, "sky.jpg"), "JPEG", quality=92)

    # 2.4 Seven Opponent Portraits (512x512)
    opponents = [
        {"id": "hao", "name": "閃電阿豪", "seal": "豪", "aura": (220, 38, 38), "theme": "直線重殺", "bg": (35, 15, 18)},
        {"id": "mei", "name": "斜線美美", "seal": "美", "aura": (14, 165, 233), "theme": "邊線獵手", "bg": (12, 28, 42)},
        {"id": "gui", "name": "假動作阿鬼", "seal": "鬼", "aura": (168, 85, 247), "theme": "騙招專家", "bg": (28, 15, 42)},
        {"id": "coach", "name": "鐵壁教練", "seal": "壁", "aura": (217, 119, 6), "theme": "鐵壁防守", "bg": (38, 26, 12)},
        {"id": "lu", "name": "節奏阿律", "seal": "律", "aura": (20, 184, 166), "theme": "節奏變化", "bg": (12, 34, 32)},
        {"id": "min", "name": "追身小敏", "seal": "敏", "aura": (234, 179, 8), "theme": "追身壓迫", "bg": (38, 32, 10)},
        {"id": "king", "name": "羽球魔王", "seal": "魔", "aura": (190, 18, 60), "theme": "全能終關", "bg": (30, 8, 18)},
    ]

    size = 512
    cx, cy = size // 2, size // 2
    for opp in opponents:
        oim = Image.new('RGB', (size, size), opp["bg"])
        odraw = ImageDraw.Draw(oim)

        # Radial aura gradient
        ar, ag, ab = opp["aura"]
        for r in range(size // 2, 0, -4):
            t = r / float(size // 2)
            c = (int(ar * (1 - t * 0.7)), int(ag * (1 - t * 0.7)), int(ab * (1 - t * 0.7)))
            odraw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=c)

        # Athletic Character Silhouette & Headband/Visor
        # Torso & sports jersey
        odraw.polygon([(cx - 140, size - 20), (cx + 140, size - 20), (cx + 100, 310), (cx - 100, 310)], fill=(15, 23, 42))
        # Jersey collar V-neck & accent trim
        odraw.polygon([(cx - 45, 310), (cx, 380), (cx + 45, 310)], fill=opp["aura"])
        # Head / face oval
        odraw.ellipse([cx - 75, 140, cx + 75, 310], fill=(254, 215, 170))
        # Athletic hair / visor
        odraw.polygon([
            (cx - 85, 180),
            (cx - 70, 110),
            (cx, 90),
            (cx + 70, 110),
            (cx + 85, 180),
            (cx, 150),
        ], fill=(30, 41, 59))
        # Sport Headband with character signature accent
        odraw.rectangle([cx - 80, 175, cx + 80, 205], fill=opp["aura"], outline=(255, 255, 255), width=2)
        # Racket frame angled in foreground
        odraw.ellipse([cx + 70, 220, cx + 180, 380], outline=(255, 255, 255), width=6)
        # Racket strings
        for rx in range(cx + 85, cx + 175, 15):
            odraw.line([(rx, 240), (rx, 360)], fill=(203, 213, 225), width=1)
        for ry in range(240, 365, 15):
            odraw.line([(cx + 85, ry), (cx + 165, ry)], fill=(203, 213, 225), width=1)

        # Dedicated Traditional Chinese Seal in top right
        draw_seal(odraw, opp["seal"], size - 56, 56, size=56, font=font_seal, fill=opp["aura"], border=(255, 255, 255))

        # Bottom Name Banner
        odraw.rectangle([0, size - 64, size, size], fill=(15, 23, 42, 230))
        odraw.line([(0, size - 64), (size, size - 64)], fill=opp["aura"], width=3)
        odraw.text((cx, size - 36), f"{opp['name']} · {opp['theme']}", fill=(255, 255, 255), font=font_name, anchor="mm")

        oim = apply_vignette(oim, intensity=0.35)
        oim.save(os.path.join(opp_dir, f"{opp['id']}.jpg"), "JPEG", quality=92)


# ==============================================================================
# 3. Roguelike-Snake Assets
# ==============================================================================

def generate_roguelike_snake_assets():
    print("Generating Roguelike-Snake assets...")
    out_dir = "Games/Roguelike-Snake/public"
    enemy_dir = os.path.join(out_dir, "enemies")
    relic_dir = os.path.join(out_dir, "relics")
    os.makedirs(enemy_dir, exist_ok=True)
    os.makedirs(relic_dir, exist_ok=True)

    font_title = get_font(42, prefer_serif=False)
    font_sub = get_font(20, prefer_serif=False)
    font_seal = get_font(28, prefer_serif=True)
    font_name = get_font(24, prefer_serif=False)

    # 3.1 Title Hero (1350x900): Ancient Serpentine Crypt Portal
    w, h = 1350, 900
    title_bg = Image.new('RGB', (w, h), (10, 15, 18))
    draw = ImageDraw.Draw(title_bg)

    # Deep underground cavern gradient
    for y in range(h):
        ratio = y / float(h)
        draw.line([(0, y), (w, y)], fill=(int(6 + 14 * ratio), int(12 + 25 * ratio), int(14 + 20 * ratio)))

    # Flanking stone dragon-serpent pillars
    pillar_w = 160
    # Left pillar
    draw.rectangle([60, 120, 60 + pillar_w, h], fill=(20, 30, 36), outline=(13, 148, 136), width=3)
    # Right pillar
    draw.rectangle([w - 60 - pillar_w, 120, w - 60, h], fill=(20, 30, 36), outline=(13, 148, 136), width=3)
    # Coiled glowing snake motif on pillars
    for py in range(160, h - 80, 70):
        draw.ellipse([70, py, 70 + pillar_w - 20, py + 40], outline=(16, 185, 129), width=4)
        draw.ellipse([w - 70 - pillar_w + 20, py, w - 70, py + 40], outline=(16, 185, 129), width=4)

    # Central Arcane Serpent Altar Portal
    cx, cy = w // 2, 480
    portal_r = 260
    for r in range(portal_r, 0, -5):
        t = r / float(portal_r)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(int(6 + 28 * (1 - t)), int(78 * (1 - t)), int(59 * (1 - t))))

    # Concentric glowing magical rune circles
    for rad in [280, 230, 180, 120]:
        draw.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], outline=(52, 211, 153), width=2)

    # Giant serpentine head emerging from portal
    draw.polygon([
        (cx, cy - 140),
        (cx - 90, cy + 30),
        (cx - 60, cy + 110),
        (cx + 60, cy + 110),
        (cx + 90, cy + 30),
    ], fill=(6, 78, 59), outline=(110, 231, 183), width=4)
    # Slit glowing red-gold eyes
    draw.ellipse([cx - 45, cy - 30, cx - 15, cy - 10], fill=(234, 179, 8))
    draw.ellipse([cx + 15, cy - 30, cx + 45, cy - 10], fill=(234, 179, 8))
    draw.line([(cx - 30, cy - 32), (cx - 30, cy - 8)], fill=(185, 28, 28), width=3)
    draw.line([(cx + 30, cy - 32), (cx + 30, cy - 8)], fill=(185, 28, 28), width=3)

    # Title & Traditional Seal
    draw.text((w // 2, 100), "ROGUELIKE SNAKE", fill=(236, 253, 245), font=font_title, anchor="mm")
    draw.text((w // 2, 150), "SERPENTINE CRYPT · ANCIENT RELICS & BEASTS", fill=(110, 231, 183), font=font_sub, anchor="mm")
    draw_seal(draw, "蛇", w // 2 + 250, 100, size=52, font=font_seal, fill=(6, 95, 70), border=(167, 243, 208))

    title_bg = apply_vignette(title_bg, intensity=0.55)
    title_bg.save(os.path.join(out_dir, "title-bg.jpg"), "JPEG", quality=92)

    # 3.2 Dungeon Floor (1024x1024): Mossy Chiseled Flagstone Pavers
    fw, fh = 1024, 1024
    floor_tex = Image.new('RGB', (fw, fh), (18, 24, 28))
    fdraw = ImageDraw.Draw(floor_tex)

    # Stone slabs grid (8x8 tiles)
    tile_sz = 128
    for ty in range(0, fh, tile_sz):
        for tx in range(0, fw, tile_sz):
            # Slab base with subtle random grey-green variation
            tone = random.randint(22, 35)
            fdraw.rectangle([tx + 2, ty + 2, tx + tile_sz - 2, ty + tile_sz - 2], fill=(tone, tone + 4, tone + 2))
            # Bevel highlights
            fdraw.line([(tx + 2, ty + 2), (tx + tile_sz - 2, ty + 2)], fill=(tone + 18, tone + 22, tone + 18), width=1)
            fdraw.line([(tx + 2, ty + 2), (tx + 2, ty + tile_sz - 2)], fill=(tone + 18, tone + 22, tone + 18), width=1)
            # Moss in mortar cracks
            if random.random() < 0.45:
                fdraw.rectangle([tx, ty, tx + tile_sz, ty + 4], fill=(16, 78, 48))
                fdraw.rectangle([tx, ty, tx + 4, ty + tile_sz], fill=(16, 78, 48))
            # Arcane serpentine spiral engraving on occasional stones
            if (tx + ty) % 256 == 0:
                cx, cy = tx + tile_sz // 2, ty + tile_sz // 2
                fdraw.ellipse([cx - 30, cy - 30, cx + 30, cy + 30], outline=(16, 185, 129), width=2)
                fdraw.ellipse([cx - 15, cy - 15, cx + 15, cy + 15], outline=(16, 185, 129), width=1)

    floor_tex.save(os.path.join(out_dir, "dungeon-floor.jpg"), "JPEG", quality=92)

    # 3.3 Dungeon Wall (512x512): Heavy Chiseled Obsidian Masonry
    ww, wh = 512, 512
    wall_tex = Image.new('RGB', (ww, wh), (12, 16, 20))
    wdraw = ImageDraw.Draw(wall_tex)

    # 4 rows of offset heavy ashlar blocks
    row_h = 128
    for r in range(4):
        ry = r * row_h
        offset = (r % 2) * 128
        for x in range(-offset, ww, 256):
            wdraw.rectangle([x + 3, ry + 3, x + 253, ry + row_h - 3], fill=(28, 36, 44), outline=(15, 23, 42), width=3)
            # Top edge stone bevel
            wdraw.line([(x + 3, ry + 3), (x + 253, ry + 3)], fill=(51, 65, 85), width=2)
            # Glowing green lichen seam
            if r % 2 == 1:
                wdraw.line([(x + 20, ry + row_h - 2), (x + 120, ry + row_h - 2)], fill=(52, 211, 153), width=2)

    wall_tex.save(os.path.join(out_dir, "wall.jpg"), "JPEG", quality=92)

    # 3.4 Four Enemy Bestiary Portraits (512x512)
    enemies = [
        {"id": "boss", "name": "腐化核心", "seal": "核", "aura": (225, 29, 72), "bg": (38, 10, 20)},
        {"id": "wisp", "name": "幽光游靈", "seal": "靈", "aura": (6, 182, 212), "bg": (10, 28, 38)},
        {"id": "stalker", "name": "暗影追獵者", "seal": "獵", "aura": (168, 85, 247), "bg": (28, 12, 42)},
        {"id": "spitter", "name": "劇毒噴吐者", "seal": "毒", "aura": (34, 197, 94), "bg": (12, 38, 22)},
    ]

    esize = 512
    ecx, ecy = esize // 2, esize // 2
    for en in enemies:
        eim = Image.new('RGB', (esize, esize), en["bg"])
        edraw = ImageDraw.Draw(eim)

        # Pulsing aura glow
        ar, ag, ab = en["aura"]
        for r in range(esize // 2, 0, -4):
            t = r / float(esize // 2)
            edraw.ellipse([ecx - r, ecy - r, ecx + r, ecy + r], fill=(int(ar * (1 - t * 0.7)), int(ag * (1 - t * 0.7)), int(ab * (1 - t * 0.7))))

        if en["id"] == "boss":
            # Giant pulsating eldritch eye core with jagged tentacles
            for ang in range(0, 360, 30):
                rad = math.radians(ang)
                tx = ecx + 180 * math.cos(rad)
                ty = ecy + 180 * math.sin(rad)
                edraw.line([(ecx, ecy), (tx, ty)], fill=(136, 19, 55), width=16)
            edraw.ellipse([ecx - 110, ecy - 110, ecx + 110, ecy + 110], fill=(225, 29, 72), outline=(255, 255, 255), width=4)
            # Center demonic iris
            edraw.ellipse([ecx - 50, ecy - 50, ecx + 50, ecy + 50], fill=(76, 5, 25))
            edraw.ellipse([ecx - 15, ecy - 35, ecx + 15, ecy + 35], fill=(255, 241, 242))
        elif en["id"] == "wisp":
            # Ethereal floating cyan wisp with phantom flame tendrils
            for ang in range(0, 360, 45):
                rad = math.radians(ang)
                edraw.ellipse([ecx + 60 * math.cos(rad) - 30, ecy + 60 * math.sin(rad) - 30, ecx + 60 * math.cos(rad) + 30, ecy + 60 * math.sin(rad) + 30], fill=(34, 211, 238, 120))
            edraw.ellipse([ecx - 70, ecy - 85, ecx + 70, ecy + 85], fill=(165, 243, 252), outline=(255, 255, 255), width=3)
            # Gentle blue eyes
            edraw.ellipse([ecx - 30, ecy - 15, ecx - 10, ecy + 15], fill=(8, 145, 178))
            edraw.ellipse([ecx + 10, ecy - 15, ecx + 30, ecy + 15], fill=(8, 145, 178))
        elif en["id"] == "stalker":
            # Sleek shadow serpent assassin with sharp fangs
            edraw.polygon([(ecx, ecy - 120), (ecx - 80, ecy + 50), (ecx + 80, ecy + 50)], fill=(88, 28, 135), outline=(192, 132, 252), width=3)
            # Glowing violet fangs
            edraw.polygon([(ecx - 35, ecy + 50), (ecx - 20, ecy + 100), (ecx - 5, ecy + 50)], fill=(255, 255, 255))
            edraw.polygon([(ecx + 5, ecy + 50), (ecx + 20, ecy + 100), (ecx + 35, ecy + 50)], fill=(255, 255, 255))
        elif en["id"] == "spitter":
            # Toxic spitting viper with distended venom throat
            edraw.ellipse([ecx - 90, ecy - 40, ecx + 90, ecy + 100], fill=(21, 128, 61), outline=(134, 239, 172), width=4)
            # Venom droplets
            for dy in range(ecy + 90, ecy + 150, 20):
                edraw.ellipse([ecx - 10, dy, ecx + 10, dy + 16], fill=(74, 222, 128))

        # Traditional Seal
        draw_seal(edraw, en["seal"], esize - 56, 56, size=56, font=font_seal, fill=en["aura"], border=(255, 255, 255))

        # Bottom label
        edraw.rectangle([0, esize - 64, esize, esize], fill=(15, 23, 42, 220))
        edraw.line([(0, esize - 64), (esize, esize - 64)], fill=en["aura"], width=3)
        edraw.text((ecx, esize - 36), en["name"], fill=(255, 255, 255), font=font_name, anchor="mm")

        eim = apply_vignette(eim, intensity=0.35)
        eim.save(os.path.join(enemy_dir, f"{en['id']}.jpg"), "JPEG", quality=92)

    # 3.5 Eighteen Sacred Relic Icons (512x512)
    relics = [
        ("alchemy", "金融煉金符", "金", (234, 179, 8), (42, 34, 10)),
        ("ascetic", "苦修縛索", "苦", (168, 85, 247), (32, 15, 42)),
        ("bag", "無底行囊", "囊", (180, 83, 9), (38, 22, 10)),
        ("blood", "猩紅血晶", "血", (225, 29, 72), (42, 10, 18)),
        ("core", "泰坦重核", "核", (100, 116, 139), (24, 30, 38)),
        ("echo", "迴音震鐘", "音", (56, 189, 248), (12, 32, 44)),
        ("fang", "劇毒毒牙", "牙", (34, 197, 94), (10, 38, 20)),
        ("ghost", "幻影披風", "幻", (148, 163, 184), (20, 26, 34)),
        ("gluttony", "饕餮魔面", "餮", (217, 119, 6), (40, 24, 8)),
        ("heart", "活力生命符", "生", (244, 63, 94), (42, 12, 24)),
        ("hourglass", "停滯沙漏", "時", (250, 204, 21), (38, 32, 10)),
        ("magnet", "磁引玄石", "磁", (59, 130, 246), (12, 24, 44)),
        ("mend", "治癒聖泉", "癒", (16, 185, 129), (10, 36, 26)),
        ("shed", "蛻變鱗片", "蛻", (45, 212, 191), (10, 36, 34)),
        ("swift", "疾風羽翼", "風", (56, 189, 248), (14, 32, 42)),
        ("thorn", "荊棘護甲", "棘", (120, 53, 15), (32, 18, 10)),
        ("torpor", "霜凍遲緩符", "霜", (96, 165, 250), (14, 26, 42)),
        ("warp", "空間躍遷儀", "躍", (192, 132, 252), (32, 14, 44)),
    ]

    rsize = 512
    rcx, rcy = rsize // 2, rsize // 2
    for rid, rname, rseal, rcol, rbg in relics:
        rim = Image.new('RGB', (rsize, rsize), rbg)
        rdraw = ImageDraw.Draw(rim)

        # Ornate gold filigree border frame
        rdraw.rounded_rectangle([20, 20, rsize - 20, rsize - 20], radius=36, fill=(15, 23, 42), outline=rcol, width=6)
        rdraw.rounded_rectangle([32, 32, rsize - 32, rsize - 32], radius=28, outline=(255, 255, 255), width=2)

        # Central radiating relic glow
        rar, rag, rab = rcol
        for r in range(160, 0, -4):
            t = r / 160.0
            rdraw.ellipse([rcx - r, rcy - r, rcx + r, rcy + r], fill=(int(rar * (1 - t * 0.7)), int(rag * (1 - t * 0.7)), int(rab * (1 - t * 0.7))))

        # Tactile relic icon center glyph / gemstone
        rdraw.polygon([
            (rcx, rcy - 90),
            (rcx + 80, rcy),
            (rcx, rcy + 90),
            (rcx - 80, rcy),
        ], fill=(255, 255, 255), outline=rcol, width=4)
        # Inner faceted core
        rdraw.polygon([
            (rcx, rcy - 60),
            (rcx + 50, rcy),
            (rcx, rcy + 60),
            (rcx - 50, rcy),
        ], fill=rcol)

        # Seal stamp in top right
        draw_seal(rdraw, rseal, rsize - 60, 60, size=52, font=font_seal, fill=rcol, border=(255, 255, 255))

        # Bottom label
        rdraw.rectangle([24, rsize - 72, rsize - 24, rsize - 24], fill=(15, 23, 42, 230), outline=rcol, width=1)
        rdraw.text((rcx, rsize - 48), rname, fill=(255, 255, 255), font=font_name, anchor="mm")

        rim = apply_vignette(rim, intensity=0.3)
        rim.save(os.path.join(relic_dir, f"{rid}.jpg"), "JPEG", quality=92)


# ==============================================================================
# 4. Puyo-Puyo Assets
# ==============================================================================

def generate_puyo_puyo_assets():
    print("Generating Puyo-Puyo assets...")
    out_dir = "Games/Puyo-Puyo/src/art"
    puyo_dir = os.path.join(out_dir, "puyo")
    char_dir = os.path.join(out_dir, "characters")
    os.makedirs(puyo_dir, exist_ok=True)
    os.makedirs(char_dir, exist_ok=True)

    font_title = get_font(42, prefer_serif=False)
    font_sub = get_font(22, prefer_serif=False)
    font_seal = get_font(28, prefer_serif=True)
    font_name = get_font(28, prefer_serif=False)

    # 4.1 Stage Background (1080x1620): Celestial Candy Arcade Stage
    w, h = 1080, 1620
    stage_bg = Image.new('RGB', (w, h), (10, 6, 28))
    draw = ImageDraw.Draw(stage_bg)

    # Gradient starry night
    for y in range(h):
        ratio = y / float(h)
        draw.line([(0, y), (w, y)], fill=(int(10 + 25 * ratio), int(6 + 18 * ratio), int(28 + 45 * ratio)))

    # Distant glowing nebula clouds
    for _ in range(25):
        nx = random.randint(100, w - 100)
        ny = random.randint(100, h - 100)
        nr = random.randint(120, 280)
        c = random.choice([
            (126, 34, 206),  # deep violet
            (219, 39, 119),  # neon pink
            (37, 99, 235),   # blue
        ])
        draw.ellipse([nx - nr, ny - nr // 2, nx + nr, ny + nr // 2], fill=c)
    stage_bg = stage_bg.filter(ImageFilter.GaussianBlur(45.0))
    draw = ImageDraw.Draw(stage_bg)

    # Floating starfield sparkles
    for _ in range(600):
        sx = random.randint(0, w - 1)
        sy = random.randint(0, h - 1)
        draw.point((sx, sy), fill=random.choice([(255, 255, 255), (254, 240, 138), (199, 210, 254)]))

    # Flanking candy marble columns with glowing spiraled stripes
    col_w = 120
    for cx_base in [60, w - 60 - col_w]:
        draw.rectangle([cx_base, 0, cx_base + col_w, h], fill=(30, 20, 56), outline=(219, 39, 119), width=3)
        for cy in range(0, h, 60):
            draw.line([(cx_base, cy), (cx_base + col_w, cy + 40)], fill=(244, 114, 182), width=8)

    # Celestial stained glass arches
    acx = w // 2
    for arad in [460, 360, 260]:
        draw.ellipse([acx - arad, 160 - arad, acx + arad, 160 + arad], outline=(250, 204, 21), width=4)

    stage_bg = apply_vignette(stage_bg, intensity=0.45)
    stage_bg.save(os.path.join(out_dir, "stage-bg.jpg"), "JPEG", quality=92)

    # 4.2 Fever Mode Burst Banner (1376x768)
    bw, bh = 1376, 768
    fever_banner = Image.new('RGB', (bw, bh), (30, 8, 20))
    bdraw = ImageDraw.Draw(fever_banner)

    # Sunburst rays radiating from center
    bcx, bcy = bw // 2, bh // 2
    for ang in range(0, 360, 10):
        rad1 = math.radians(ang)
        rad2 = math.radians(ang + 5)
        r_far = 900
        p1 = (bcx + r_far * math.cos(rad1), bcy + r_far * math.sin(rad1))
        p2 = (bcx + r_far * math.cos(rad2), bcy + r_far * math.sin(rad2))
        ray_col = (245, 158, 11) if (ang // 10) % 2 == 0 else (225, 29, 72)
        bdraw.polygon([(bcx, bcy), p1, p2], fill=ray_col)

    # Explosive Golden Shockwave Rings
    for ring_r in [180, 280, 380, 480]:
        bdraw.ellipse([bcx - ring_r, bcy - ring_r, bcx + ring_r, bcy + ring_r], outline=(254, 240, 138), width=6)

    # Big Energetic Title Text
    bdraw.text((bcx, bcy - 40), "FEVER MODE!!", fill=(255, 255, 255), font=font_title, anchor="mm")
    bdraw.text((bcx, bcy + 30), "MEGA CHAIN COMBO BURST", fill=(254, 240, 138), font=font_sub, anchor="mm")
    draw_seal(bdraw, "狂", bcx + 240, bcy - 40, size=64, font=font_seal, fill=(185, 28, 28), border=(254, 202, 202))

    fever_banner = apply_vignette(fever_banner, intensity=0.35)
    fever_banner.save(os.path.join(out_dir, "banner-fever.jpg"), "JPEG", quality=92)

    # 4.3 Three Character Portraits (1024x1024)
    characters = [
        {"id": "player-amit", "name": "見習魔導士 亞米特", "seal": "米", "aura": (14, 165, 233), "bg": (12, 28, 48)},
        {"id": "cpu-witch", "name": "占星魔女 阿露", "seal": "露", "aura": (168, 85, 247), "bg": (32, 14, 48)},
        {"id": "cpu-dark-lord", "name": "暗黑魔王 巴哈姆", "seal": "霸", "aura": (225, 29, 72), "bg": (42, 10, 22)},
    ]

    csize = 1024
    ccx, ccy = csize // 2, csize // 2
    for char in characters:
        cim = Image.new('RGB', (csize, csize), char["bg"])
        cdraw = ImageDraw.Draw(cim)

        # Swirling magical aura
        car, cag, cab = char["aura"]
        for r in range(csize // 2, 0, -6):
            t = r / float(csize // 2)
            cdraw.ellipse([ccx - r, ccy - r, ccx + r, ccy + r], fill=(int(car * (1 - t * 0.7)), int(cag * (1 - t * 0.7)), int(cab * (1 - t * 0.7))))

        # High-Fidelity Character Silhouette & Costume
        # Robe / shoulders
        cdraw.polygon([
            (ccx - 300, csize - 40),
            (ccx + 300, csize - 40),
            (ccx + 220, 620),
            (ccx - 220, 620),
        ], fill=(15, 23, 42), outline=char["aura"], width=6)

        # Head / face
        cdraw.ellipse([ccx - 160, 300, ccx + 160, 640], fill=(254, 215, 170))

        if char["id"] == "player-amit":
            # Pointed Blue Wizard Hat
            cdraw.polygon([
                (ccx, 80),
                (ccx - 260, 360),
                (ccx + 260, 360),
            ], fill=(2, 132, 199), outline=(255, 255, 255), width=6)
            # Hat brim
            cdraw.ellipse([ccx - 280, 330, ccx + 280, 400], fill=(3, 105, 161), outline=(254, 240, 138), width=5)
            # Warm sparkling eyes
            cdraw.ellipse([ccx - 80, 460, ccx - 30, 530], fill=(234, 179, 8))
            cdraw.ellipse([ccx + 30, 460, ccx + 80, 530], fill=(234, 179, 8))
        elif char["id"] == "cpu-witch":
            # Purple Astrological Hood & Crescent Crown
            cdraw.polygon([
                (ccx, 100),
                (ccx - 240, 370),
                (ccx + 240, 370),
            ], fill=(126, 34, 206), outline=(233, 213, 255), width=6)
            # Golden crescent moon on forehead
            cdraw.ellipse([ccx - 40, 300, ccx + 40, 380], fill=(250, 204, 21))
            cdraw.ellipse([ccx - 20, 300, ccx + 40, 380], fill=(126, 34, 206))
            # Playful violet eyes
            cdraw.ellipse([ccx - 80, 460, ccx - 30, 530], fill=(147, 51, 234))
            cdraw.ellipse([ccx + 30, 460, ccx + 80, 530], fill=(147, 51, 234))
        elif char["id"] == "cpu-dark-lord":
            # Demonic Obsidian Horns & Crimson Spiked Crown
            cdraw.polygon([(ccx - 120, 340), (ccx - 260, 120), (ccx - 80, 260)], fill=(30, 10, 15), outline=(225, 29, 72), width=6)
            cdraw.polygon([(ccx + 120, 340), (ccx + 260, 120), (ccx + 80, 260)], fill=(30, 10, 15), outline=(225, 29, 72), width=6)
            # Fierce glowing crimson eyes
            cdraw.ellipse([ccx - 90, 460, ccx - 30, 520], fill=(225, 29, 72))
            cdraw.ellipse([ccx + 30, 460, ccx + 90, 520], fill=(225, 29, 72))

        # Traditional Chinese Character Seal
        draw_seal(cdraw, char["seal"], csize - 110, 110, size=96, font=font_seal, fill=char["aura"], border=(255, 255, 255))

        # Bottom Name Card
        cdraw.rectangle([0, csize - 120, csize, csize], fill=(15, 23, 42, 235))
        cdraw.line([(0, csize - 120), (csize, csize - 120)], fill=char["aura"], width=5)
        cdraw.text((ccx, csize - 60), char["name"], fill=(255, 255, 255), font=font_name, anchor="mm")

        cim = apply_vignette(cim, intensity=0.35)
        cim.save(os.path.join(char_dir, f"{char['id']}.jpg"), "JPEG", quality=92)

    # 4.4 Six Glossy Translucent Jelly Puyo Textures (512x512)
    puyos = [
        ("red", (239, 68, 68), (254, 202, 202), (153, 27, 27)),
        ("green", (34, 197, 94), (187, 247, 208), (20, 83, 45)),
        ("blue", (59, 130, 246), (191, 219, 254), (29, 78, 216)),
        ("yellow", (234, 179, 8), (254, 240, 138), (133, 77, 14)),
        ("purple", (168, 85, 247), (233, 213, 255), (107, 33, 168)),
        ("garbage", (148, 163, 184), (241, 245, 249), (51, 65, 85)),
    ]

    psize = 512
    pcx, pcy = psize // 2, psize // 2
    for pname, base_col, light_col, dark_col in puyos:
        pim = Image.new('RGB', (psize, psize), (12, 10, 24))
        pdraw = ImageDraw.Draw(pim)

        # Translucent bouncy teardrop/oval slime body
        prad_x, prad_y = 200, 190
        # Shadow base
        pdraw.ellipse([pcx - prad_x, pcy - prad_y + 15, pcx + prad_x, pcy + prad_y + 15], fill=dark_col)
        # Main gelatinous body with gradient fill
        for s in range(prad_x, 0, -4):
            t = s / float(prad_x)
            col = tuple(int(b * (1 - t * 0.45) + l * (t * 0.45)) for b, l in zip(base_col, light_col))
            sy = int(s * (prad_y / float(prad_x)))
            pdraw.ellipse([pcx - s, pcy - sy, pcx + s, pcy + sy], fill=col)

        # Large glossy specular white shine bubble in upper-left
        pdraw.ellipse([pcx - 120, pcy - 120, pcx - 40, pcy - 60], fill=(255, 255, 255, 220))
        pdraw.ellipse([pcx - 45, pcy - 50, pcx - 20, pcy - 25], fill=(255, 255, 255, 180))

        # Cute expressive cartoon eyes
        if pname == "garbage":
            # Dazed comical swirl eyes for garbage stone puyo
            pdraw.ellipse([pcx - 80, pcy - 20, pcx - 20, pcy + 40], outline=(30, 41, 59), width=5)
            pdraw.ellipse([pcx + 20, pcy - 20, pcx + 80, pcy + 40], outline=(30, 41, 59), width=5)
            pdraw.line([(pcx - 60, pcy + 10), (pcx - 40, pcy + 10)], fill=(30, 41, 59), width=4)
            pdraw.line([(pcx + 40, pcy + 10), (pcx + 60, pcy + 10)], fill=(30, 41, 59), width=4)
        else:
            # Round friendly white sclera
            pdraw.ellipse([pcx - 85, pcy - 30, pcx - 25, pcy + 45], fill=(255, 255, 255), outline=dark_col, width=3)
            pdraw.ellipse([pcx + 25, pcy - 30, pcx + 85, pcy + 45], fill=(255, 255, 255), outline=dark_col, width=3)
            # Black pupils looking slightly forward
            pdraw.ellipse([pcx - 65, pcy - 10, pcx - 35, pcy + 30], fill=(15, 23, 42))
            pdraw.ellipse([pcx + 35, pcy - 10, pcx + 65, pcy + 30], fill=(15, 23, 42))
            # Catchlight twinkles
            pdraw.ellipse([pcx - 60, pcy - 5, pcx - 50, pcy + 5], fill=(255, 255, 255))
            pdraw.ellipse([pcx + 40, pcy - 5, pcx + 50, pcy + 5], fill=(255, 255, 255))
            # Sweet smile mouth
            pdraw.arc([pcx - 25, pcy + 40, pcx + 25, pcy + 75], start=0, end=180, fill=dark_col, width=4)

        # Smooth crisp slime contour border
        pdraw.ellipse([pcx - prad_x, pcy - prad_y, pcx + prad_x, pcy + prad_y], outline=(255, 255, 255), width=3)

        pim.save(os.path.join(puyo_dir, f"{pname}.jpg"), "JPEG", quality=92)


# ==============================================================================
# Main Orchestration
# ==============================================================================

def main():
    print("=" * 60)
    print("Wave 13 Multi-Battleground Art Generator Starting...")
    print("=" * 60)
    generate_tetris_assets()
    generate_block_the_smash_assets()
    generate_roguelike_snake_assets()
    generate_puyo_puyo_assets()
    print("=" * 60)
    print("Wave 13 Art Generation Completed Successfully!")
    print("=" * 60)


if __name__ == '__main__':
    main()
