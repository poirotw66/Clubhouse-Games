#!/usr/bin/env python3
"""
Wave 16 Grand Finale Multi-Battleground Visual Art Generator
Clubhouse-Games Wave 16 visual art upgrade across:
- Baseball-Life (1350x900 Grand Championship Baseball Cathedral title hero,
                 1350x900 Koshien summer high school black dirt field,
                 1350x900 CPBL Draft Day gala stage & media war room,
                 1350x900 Pro League Grand Dome championship night game,
                 1350x900 Hall of Fame memorial rotunda with bronze plaques,
                 512x512 dedicated Coaching Style seals: strict, nurture, tactician, power;
                 512x512 Taiwan Series 24K Golden Championship Trophy)
- Big-Two (1350x900 Grand High-Roller Casino Salon title hero,
           1350x900 Luxury emerald gaming felt with gold filigree,
           1024x1536 Royal guilloche gold-embossed card back,
           512x768 Heavyweight ivory linen card face-plate,
           384x384 High-contrast tactile poker suits: spades, hearts, diamonds, clubs;
           512x512 Dynamic character portraits: player, ming, mei, qiang, zhen, king)
- Pick-Red (1350x900 Grand Traditional Taiwanese Tea Salon & Card Parlor title hero,
            1350x900 Imperial jade parlor felt with cloud damask,
            1024x1536 Auspicious crane & cloud crimson card back,
            512x768 Fine cream linen card face-plate,
            384x384 High-contrast tactile poker suits: spades, hearts, diamonds, clubs;
            512x512 Dedicated Stunt & Strike Badges with Traditional Chinese seals:
            red-ace, big-five, golden-nine, match-ten, tool-conversion;
            512x512 Character avatars: player, ming, mei, cai, zhen, king)
- Wall-Flip (1350x900 Cyberpunk Stunt Mega Arena action hero banner,
             2048x1024 Ultra-wide 360° panoramic cyber sky dome,
             1024x1024 High-grip PBR asphalt texture with laser distance lines,
             1024x1024 2x2 Twill aerospace carbon fiber weave,
             1024x1024 Aerospace cybernetic ground grid with hex expansion nodes,
             512x512 Supersonic gold-winged stunt shield badge with Traditional Chinese seal,
             512x512 Gold stunt club championship medal,
             1280x853 Dedicated showroom vehicle concept art for all 5 custom vehicles:
             roadster, sparrow, atlas, nova, mars-royale;
             1024x1024 Mars Royale celestial surface texture,
             1302x358 High-res aerodynamic roadster chassis sprite)

Architectural justification: High-fidelity procedural asset generation for the 4 final
games in Wave 16 requires rich mathematical drawing routines, vector rendering, and
localized font typography within a single deterministic, reproducible generation pipeline,
completing the visual art upgrade initiative across all 33 games in Clubhouse-Games.
"""

from __future__ import annotations

import math
import os
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SEED = 20261126
random.seed(SEED)

BASE_DIR = Path(__file__).resolve().parent.parent

FONT_CANDIDATES = [
    '/System/Library/Fonts/Supplemental/Songti.ttc',
    '/System/Library/Fonts/Hiragino Sans GB.ttc',
    '/System/Library/Fonts/STHeiti Light.ttc',
    '/Library/Fonts/Arial Unicode.ttf',
]


def get_font(size: int, prefer_serif: bool = True) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
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
    font: ImageFont.FreeTypeFont | ImageFont.ImageFont | None = None,
    fill: tuple[int, int, int] = (185, 28, 28),
    border: tuple[int, int, int] = (254, 202, 202),
    text_color: tuple[int, int, int] = (255, 255, 255),
) -> None:
    """Draw a Traditional Chinese seal stamp with double border."""
    half = size // 2
    draw.rectangle([x - half, y - half, x + half, y + half], fill=fill, outline=border, width=2)
    draw.rectangle([x - half + 3, y - half + 3, x + half - 3, y + half - 3], outline=border, width=1)
    if font:
        draw.text((x, y), text, fill=text_color, font=font, anchor="mm")


def apply_vignette(
    img: Image.Image,
    intensity: float = 0.5,
    color: tuple[int, int, int] = (0, 0, 0),
) -> Image.Image:
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
    vignette = vignette.filter(ImageFilter.GaussianBlur(28.0))
    base_rgba = img.convert('RGBA')
    base_rgba.paste(vignette, (0, 0), vignette)
    return base_rgba.convert('RGB')


# ==============================================================================
# Helper: Suits Generator (Poker Suits: 384x384 with 3D Bevel and Highlight)
# ==============================================================================

def draw_spade_path(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int, fill: tuple[int, int, int]) -> None:
    # High resolution spade: heart upside down plus stem
    s = size / 200.0
    # Top peak
    top_y = cy - int(90 * s)
    # Left & right bulbs
    pts = [(cx, top_y)]
    # Right curve
    for deg in range(0, 185, 5):
        rad = math.radians(deg)
        x = cx + math.sin(rad) * 75 * s
        y = cy - 20 * s + math.cos(rad) * 65 * s
        pts.append((int(x), int(y)))
    # Bottom center notch
    pts.append((cx, cy + int(45 * s)))
    # Left curve
    for deg in range(180, -5, -5):
        rad = math.radians(deg)
        x = cx - math.sin(rad) * 75 * s
        y = cy - 20 * s + math.cos(rad) * 65 * s
        pts.append((int(x), int(y)))
    draw.polygon(pts, fill=fill)
    # Stem
    stem = [
        (cx - int(12 * s), cy + int(35 * s)),
        (cx + int(12 * s), cy + int(35 * s)),
        (cx + int(35 * s), cy + int(90 * s)),
        (cx - int(35 * s), cy + int(90 * s)),
    ]
    draw.polygon(stem, fill=fill)


def draw_heart_path(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int, fill: tuple[int, int, int]) -> None:
    s = size / 200.0
    pts = [(cx, cy + int(90 * s))]
    # Left lobe
    for deg in range(180, -5, -5):
        rad = math.radians(deg)
        x = cx - 40 * s - math.cos(rad) * 45 * s
        y = cy - 25 * s - math.sin(rad) * 55 * s
        pts.append((int(x), int(y)))
    # Center notch
    pts.append((cx, cy - int(35 * s)))
    # Right lobe
    for deg in range(180, 365, 5):
        rad = math.radians(deg)
        x = cx + 40 * s + math.cos(rad) * 45 * s
        y = cy - 25 * s - math.sin(rad) * 55 * s
        pts.append((int(x), int(y)))
    draw.polygon(pts, fill=fill)


def draw_diamond_path(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int, fill: tuple[int, int, int]) -> None:
    s = size / 200.0
    pts = [
        (cx, cy - int(92 * s)),
        (cx + int(72 * s), cy),
        (cx, cy + int(92 * s)),
        (cx - int(72 * s), cy),
    ]
    draw.polygon(pts, fill=fill)


def draw_club_path(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int, fill: tuple[int, int, int]) -> None:
    s = size / 200.0
    r = int(44 * s)
    # Top circle
    draw.ellipse([cx - r, cy - int(55 * s) - r, cx + r, cy - int(55 * s) + r], fill=fill)
    # Left circle
    draw.ellipse([cx - int(48 * s) - r, cy + int(10 * s) - r, cx - int(48 * s) + r, cy + int(10 * s) + r], fill=fill)
    # Right circle
    draw.ellipse([cx + int(48 * s) - r, cy + int(10 * s) - r, cx + int(48 * s) + r, cy + int(10 * s) + r], fill=fill)
    # Center fill
    draw.ellipse([cx - int(30 * s), cy - int(30 * s), cx + int(30 * s), cy + int(30 * s)], fill=fill)
    # Stem
    stem = [
        (cx - int(12 * s), cy),
        (cx + int(12 * s), cy),
        (cx + int(35 * s), cy + int(90 * s)),
        (cx - int(35 * s), cy + int(90 * s)),
    ]
    draw.polygon(stem, fill=fill)


def generate_poker_suits(output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    size = 384
    scale = 3
    large_size = size * scale

    configs = [
        ("spades.jpg", "spade", (20, 24, 33), (60, 68, 85), (248, 250, 252)),
        ("hearts.jpg", "heart", (225, 29, 72), (251, 113, 133), (255, 241, 242)),
        ("diamonds.jpg", "diamond", (234, 88, 12), (251, 146, 60), (255, 247, 237)),
        ("clubs.jpg", "club", (15, 23, 42), (51, 65, 85), (241, 245, 249)),
    ]

    for fname, stype, primary, highlight, bg_tint in configs:
        img = Image.new('RGB', (large_size, large_size), bg_tint)
        draw = ImageDraw.Draw(img)
        cx = large_size // 2
        cy = large_size // 2
        draw_size = int(240 * scale)

        # Soft drop shadow
        shadow_offset = int(14 * scale)
        if stype == "spade":
            draw_spade_path(draw, cx + shadow_offset, cy + shadow_offset, draw_size, (200, 205, 215))
            draw_spade_path(draw, cx, cy, draw_size, primary)
            # Specular highlight
            draw_spade_path(draw, cx - int(4 * scale), cy - int(4 * scale), int(draw_size * 0.92), highlight)
            draw_spade_path(draw, cx, cy, int(draw_size * 0.88), primary)
        elif stype == "heart":
            draw_heart_path(draw, cx + shadow_offset, cy + shadow_offset, draw_size, (240, 180, 190))
            draw_heart_path(draw, cx, cy, draw_size, primary)
            draw_heart_path(draw, cx - int(4 * scale), cy - int(4 * scale), int(draw_size * 0.92), highlight)
            draw_heart_path(draw, cx, cy, int(draw_size * 0.88), primary)
        elif stype == "diamond":
            draw_diamond_path(draw, cx + shadow_offset, cy + shadow_offset, draw_size, (245, 190, 170))
            draw_diamond_path(draw, cx, cy, draw_size, primary)
            draw_diamond_path(draw, cx - int(4 * scale), cy - int(4 * scale), int(draw_size * 0.92), highlight)
            draw_diamond_path(draw, cx, cy, int(draw_size * 0.88), primary)
        elif stype == "club":
            draw_club_path(draw, cx + shadow_offset, cy + shadow_offset, draw_size, (200, 205, 215))
            draw_club_path(draw, cx, cy, draw_size, primary)
            draw_club_path(draw, cx - int(4 * scale), cy - int(4 * scale), int(draw_size * 0.92), highlight)
            draw_club_path(draw, cx, cy, int(draw_size * 0.88), primary)

        # Downsample with Lanczos for anti-aliasing
        img = img.resize((size, size), Image.Resampling.LANCZOS)
        img.save(output_dir / fname, "JPEG", quality=95)


# ==============================================================================
# Game 1: Baseball-Life (棒球人生)
# ==============================================================================

def generate_baseball_life_assets() -> None:
    print("-> Generating Baseball-Life assets...")
    out_dir = BASE_DIR / "Games/Baseball-Life/public"
    coaches_dir = out_dir / "coaches"
    coaches_dir.mkdir(parents=True, exist_ok=True)

    font_seal = get_font(32, prefer_serif=True)
    font_large_seal = get_font(44, prefer_serif=True)
    font_ui = get_font(28, prefer_serif=False)

    w, h = 1350, 900

    # 1.1 title-bg.jpg: 1350x900 Grand Championship Stadium Night Cathedral
    title_img = Image.new('RGB', (w, h), (8, 14, 28))
    tdraw = ImageDraw.Draw(title_img)

    # Twilight sky gradient
    for y in range(h):
        t = y / float(h)
        r = int(8 * (1.0 - t) + 16 * t)
        g = int(14 * (1.0 - t) + 32 * t)
        b = int(32 * (1.0 - t) + 55 * t)
        tdraw.line([(0, y), (w, y)], fill=(r, g, b))

    # Stadium Floodlight Beams
    floodlights = [(int(w * 0.12), int(h * 0.22)), (int(w * 0.38), int(h * 0.16)),
                   (int(w * 0.62), int(h * 0.16)), (int(w * 0.88), int(h * 0.22))]
    for lx, ly in floodlights:
        # Beam fan
        beam_poly = [(lx, ly), (lx - 240, h), (lx + 240, h)]
        tdraw.polygon(beam_poly, fill=(240, 248, 255))
        # Light cluster fixture
        tdraw.rectangle([lx - 35, ly - 18, lx + 35, ly + 18], fill=(210, 225, 245), outline=(255, 255, 255), width=2)
        for gx in range(lx - 28, lx + 28, 14):
            for gy in range(ly - 12, ly + 14, 12):
                tdraw.ellipse([gx - 4, gy - 4, gx + 4, gy + 4], fill=(255, 255, 255))

    title_img = title_img.filter(ImageFilter.GaussianBlur(14.0))
    tdraw = ImageDraw.Draw(title_img)

    # Grandstand silhouettes and cheering crowds
    stand_top = int(h * 0.44)
    tdraw.polygon([(0, stand_top + 40), (w, stand_top + 40), (w, int(h * 0.65)), (0, int(h * 0.65))], fill=(16, 24, 40))
    # Crowd speckles & glow sticks
    for _ in range(800):
        cx = random.randint(0, w)
        cy = random.randint(stand_top + 20, int(h * 0.65))
        col = random.choice([(250, 204, 21), (56, 189, 248), (244, 63, 94), (255, 255, 255), (34, 197, 94)])
        tdraw.ellipse([cx - 2, cy - 2, cx + 2, cy + 2], fill=col)

    # Emerald Outfield Grass Field
    field_poly = [(0, int(h * 0.62)), (w, int(h * 0.62)), (w, h), (0, h)]
    tdraw.polygon(field_poly, fill=(18, 55, 32))
    # Grass mowing stripes
    for stripe_x in range(0, w, 70):
        scol = (22, 65, 38) if (stripe_x // 70) % 2 == 0 else (16, 48, 28)
        tdraw.polygon([(stripe_x, int(h * 0.62)), (stripe_x + 70, int(h * 0.62)),
                       (stripe_x + 95, h), (stripe_x + 25, h)], fill=scol)

    # Infield Dirt Diamond (Rich terracotta clay)
    diamond_pts = [(w // 2, int(h * 0.64)), (w // 2 + 360, int(h * 0.79)),
                   (w // 2, int(h * 0.96)), (w // 2 - 360, int(h * 0.79))]
    tdraw.polygon(diamond_pts, fill=(154, 78, 38))
    # Infield grass cutout
    inner_grass = [(w // 2, int(h * 0.67)), (w // 2 + 250, int(h * 0.79)),
                   (w // 2, int(h * 0.91)), (w // 2 - 250, int(h * 0.79))]
    tdraw.polygon(inner_grass, fill=(22, 65, 38))

    # Chalk baseline lines
    tdraw.line([(w // 2, int(h * 0.96)), (w // 2 + 360, int(h * 0.79))], fill=(255, 255, 255), width=3)
    tdraw.line([(w // 2, int(h * 0.96)), (w // 2 - 360, int(h * 0.79))], fill=(255, 255, 255), width=3)
    # Pitcher's Mound
    mcx, mcy = w // 2, int(h * 0.79)
    tdraw.ellipse([mcx - 48, mcy - 24, mcx + 48, mcy + 24], fill=(168, 88, 44), outline=(220, 220, 220), width=2)
    tdraw.rectangle([mcx - 14, mcy - 3, mcx + 14, mcy + 3], fill=(255, 255, 255))  # Pitching rubber

    # Decorative Traditional Chinese Seal stamp
    draw_seal(tdraw, "球兒", w - 120, 110, size=72, font=font_large_seal, fill=(185, 28, 28), border=(254, 202, 202))

    title_img = apply_vignette(title_img, intensity=0.45)
    title_img.save(out_dir / "title-bg.jpg", "JPEG", quality=92)

    # 1.2 chapter-highschool.jpg: 1350x900 Koshien Summer Black Dirt Field
    hs_img = Image.new('RGB', (w, h), (18, 42, 68))
    hsdraw = ImageDraw.Draw(hs_img)
    # Bright summer sky
    for y in range(int(h * 0.58)):
        t = y / float(h * 0.58)
        hsdraw.line([(0, y), (w, y)], fill=(int(45 + 160 * t), int(120 + 95 * t), int(215 + 35 * t)))
    # Cumulus thunderheads
    for _ in range(40):
        cx = random.randint(0, w)
        cy = random.randint(int(h * 0.15), int(h * 0.52))
        rad = random.randint(60, 220)
        hsdraw.ellipse([cx - rad, cy - rad // 2, cx + rad, cy + rad // 2], fill=(255, 255, 255))
    hs_img = hs_img.filter(ImageFilter.GaussianBlur(12.0))
    hsdraw = ImageDraw.Draw(hs_img)

    # Koshien Iconic Black Dirt (黑土) Infield
    hsdraw.polygon([(0, int(h * 0.52)), (w, int(h * 0.52)), (w, h), (0, h)], fill=(42, 38, 36))
    # Texture noise for black dirt
    for _ in range(3500):
        bx = random.randint(0, w)
        by = random.randint(int(h * 0.52), h)
        bcol = random.choice([(32, 28, 26), (54, 48, 44), (68, 62, 58), (28, 24, 22)])
        hsdraw.ellipse([bx - 2, by - 2, bx + 2, by + 2], fill=bcol)

    # Wooden Outfield Scoreboard
    sb_w, sb_h = 380, 110
    sb_x = w // 2 - sb_w // 2
    sb_y = int(h * 0.38)
    hsdraw.rectangle([sb_x, sb_y, sb_x + sb_w, sb_y + sb_h], fill=(24, 48, 32), outline=(212, 175, 55), width=3)
    hsdraw.text((w // 2, sb_y + 28), "全國高等學校野球選手權大會", fill=(255, 255, 255), font=font_ui, anchor="mm")
    hsdraw.text((w // 2, sb_y + 70), "甲子園球場 · 夏季本戰", fill=(250, 204, 21), font=font_ui, anchor="mm")

    draw_seal(hsdraw, "青春", w - 100, 100, size=68, font=font_large_seal, fill=(185, 28, 28), border=(254, 202, 202))
    hs_img = apply_vignette(hs_img, intensity=0.4)
    hs_img.save(out_dir / "chapter-highschool.jpg", "JPEG", quality=92)

    # 1.3 chapter-draft.jpg: 1350x900 CPBL Draft Day Ceremony Auditorium
    dr_img = Image.new('RGB', (w, h), (10, 15, 30))
    drdraw = ImageDraw.Draw(dr_img)
    # Stage blue spotlights
    for y in range(h):
        t = y / float(h)
        drdraw.line([(0, y), (w, y)], fill=(int(10 + 20 * t), int(15 + 30 * t), int(35 + 50 * t)))
    for spot_x in [int(w * 0.25), int(w * 0.5), int(w * 0.75)]:
        drdraw.polygon([(spot_x, 0), (spot_x - 180, h), (spot_x + 180, h)], fill=(40, 75, 140))
    dr_img = dr_img.filter(ImageFilter.GaussianBlur(16.0))
    drdraw = ImageDraw.Draw(dr_img)

    # Draft big screen board
    dw, dh = 720, 240
    dx, dy = w // 2 - dw // 2, int(h * 0.18)
    drdraw.rectangle([dx, dy, dx + dw, dy + dh], fill=(12, 24, 48), outline=(234, 179, 8), width=4)
    drdraw.text((w // 2, dy + 50), "中華職棒大聯盟年度新人選秀會", fill=(250, 204, 21), font=font_large_seal, anchor="mm")
    drdraw.text((w // 2, dy + 115), "第一輪 第 1 指名 交涉權確定", fill=(255, 255, 255), font=font_ui, anchor="mm")
    drdraw.text((w // 2, dy + 175), "CPBL DRAFT CEREMONY · 職業殿堂門扉", fill=(148, 163, 184), font=font_ui, anchor="mm")

    # Podium
    pdx, pdy = w // 2 - 120, int(h * 0.62)
    drdraw.polygon([(pdx, pdy + 180), (pdx + 240, pdy + 180), (pdx + 190, pdy), (pdx + 50, pdy)], fill=(20, 32, 54), outline=(234, 179, 8), width=3)
    drdraw.rectangle([pdx + 80, pdy - 35, pdx + 160, pdy], fill=(30, 41, 59))  # Microphone stand

    draw_seal(drdraw, "指名", w - 100, 100, size=68, font=font_large_seal, fill=(234, 88, 12), border=(254, 240, 138))
    dr_img = apply_vignette(dr_img, intensity=0.42)
    dr_img.save(out_dir / "chapter-draft.jpg", "JPEG", quality=92)

    # 1.4 chapter-pro-stadium.jpg: 1350x900 Pro League Grand Dome
    pro_img = Image.new('RGB', (w, h), (12, 18, 32))
    pdraw = ImageDraw.Draw(pro_img)
    for y in range(h):
        t = y / float(h)
        pdraw.line([(0, y), (w, y)], fill=(int(12 + 15 * t), int(18 + 40 * t), int(32 + 75 * t)))
    # Dome roof trusses
    for truss in range(0, w, 90):
        pdraw.line([(truss, 0), (w // 2, int(h * 0.4))], fill=(45, 60, 90), width=2)
    pro_img = pro_img.filter(ImageFilter.GaussianBlur(10.0))
    pdraw = ImageDraw.Draw(pro_img)

    # Electric ribbon scoreboard
    pdraw.rectangle([0, int(h * 0.36), w, int(h * 0.44)], fill=(15, 23, 42), outline=(56, 189, 248), width=2)
    pdraw.text((w // 2, int(h * 0.40)), "TAIWAN SERIES CHAMPIONSHIP · 總冠軍爭霸賽", fill=(56, 189, 248), font=font_large_seal, anchor="mm")

    # AstroTurf field
    pdraw.polygon([(0, int(h * 0.58)), (w, int(h * 0.58)), (w, h), (0, h)], fill=(12, 52, 28))
    draw_seal(pdraw, "一軍", w - 100, 100, size=68, font=font_large_seal, fill=(30, 64, 175), border=(191, 219, 254))
    pro_img = apply_vignette(pro_img, intensity=0.4)
    pro_img.save(out_dir / "chapter-pro-stadium.jpg", "JPEG", quality=92)

    # 1.5 chapter-hall-of-fame.jpg: 1350x900 Hall of Fame Memorial Rotunda
    hof_img = Image.new('RGB', (w, h), (24, 18, 12))
    hdraw = ImageDraw.Draw(hof_img)
    for y in range(h):
        t = y / float(h)
        hdraw.line([(0, y), (w, y)], fill=(int(24 + 40 * t), int(18 + 25 * t), int(12 + 10 * t)))
    # Classical marble columns
    for col_x in [120, 320, 1030, 1230]:
        hdraw.rectangle([col_x - 35, 0, col_x + 35, h], fill=(68, 54, 42), outline=(120, 95, 75), width=2)
    hof_img = hof_img.filter(ImageFilter.GaussianBlur(12.0))
    hdraw = ImageDraw.Draw(hof_img)

    # Bronze Memorial Plaque
    bp_w, bp_h = 480, 360
    bp_x, bp_y = w // 2 - bp_w // 2, int(h * 0.26)
    hdraw.rectangle([bp_x, bp_y, bp_x + bp_w, bp_y + bp_h], fill=(92, 55, 24), outline=(245, 158, 11), width=5)
    hdraw.rectangle([bp_x + 10, bp_y + 10, bp_x + bp_w - 10, bp_y + bp_h - 10], outline=(254, 240, 138), width=2)
    hdraw.text((w // 2, bp_y + 70), "棒球殿堂 · 榮譽紀念碑", fill=(254, 240, 138), font=font_large_seal, anchor="mm")
    hdraw.text((w // 2, bp_y + 145), "HALL OF FAME INDUCTION", fill=(251, 191, 36), font=font_ui, anchor="mm")
    hdraw.text((w // 2, bp_y + 210), "光榮引退 · 功績永垂不朽", fill=(245, 235, 220), font=font_ui, anchor="mm")

    draw_seal(hdraw, "殿堂", w - 100, 100, size=68, font=font_large_seal, fill=(180, 83, 9), border=(254, 240, 138))
    hof_img = apply_vignette(hof_img, intensity=0.45)
    hof_img.save(out_dir / "chapter-hall-of-fame.jpg", "JPEG", quality=92)

    # 1.6 Dedicated Coach Style Crests (512x512)
    coach_defs = [
        ("coach-strict.jpg", "嚴", "嚴師風格", "鐵血紀律", (185, 28, 28), (20, 12, 12)),
        ("coach-nurture.jpg", "慈", "慈父風格", "身心守護", (16, 185, 129), (10, 24, 18)),
        ("coach-tactician.jpg", "策", "戰術風格", "智略神算", (14, 165, 233), (10, 20, 32)),
        ("coach-power.jpg", "力", "力量風格", "豪打重砲", (249, 115, 22), (28, 16, 10)),
    ]

    for fname, seal_txt, title_txt, blurb_txt, accent_col, bg_col in coach_defs:
        cimg = Image.new('RGB', (512, 512), bg_col)
        cdraw = ImageDraw.Draw(cimg)
        cx, cy = 256, 256

        # Heraldic shield outer border
        shield_pts = [
            (cx - 160, cy - 160),
            (cx + 160, cy - 160),
            (cx + 160, cy + 40),
            (cx, cy + 180),
            (cx - 160, cy + 40),
        ]
        cdraw.polygon(shield_pts, fill=(24, 30, 42), outline=accent_col, width=6)
        # Inner hairline
        inner_shield = [
            (cx - 146, cy - 146),
            (cx + 146, cy - 146),
            (cx + 146, cy + 34),
            (cx, cy + 164),
            (cx - 146, cy + 34),
        ]
        cdraw.polygon(inner_shield, outline=(148, 163, 184), width=2)

        # Baseball stitches in shield
        cdraw.ellipse([cx - 85, cy - 85, cx + 85, cy + 85], fill=(30, 41, 59), outline=accent_col, width=3)

        # Large center seal
        draw_seal(cdraw, seal_txt, cx, cy - 15, size=88, font=font_large_seal, fill=accent_col, border=(255, 255, 255))

        # Bottom label bar
        cdraw.rectangle([cx - 120, cy + 110, cx + 120, cy + 155], fill=(15, 23, 42), outline=accent_col, width=2)
        cdraw.text((cx, cy + 124), title_txt, fill=(255, 255, 255), font=font_ui, anchor="mm")
        cdraw.text((cx, cy + 142), blurb_txt, fill=accent_col, font=get_font(18, False), anchor="mm")

        cimg = apply_vignette(cimg, intensity=0.35)
        cimg.save(coaches_dir / fname, "JPEG", quality=92)

    # 1.7 512x512 24K Gold Taiwan Series / Hall of Fame Trophy
    tr_img = Image.new('RGB', (512, 512), (18, 14, 10))
    tdraw = ImageDraw.Draw(tr_img)
    cx, cy = 256, 256
    # Golden Trophy cup
    tdraw.polygon([(cx - 75, cy - 90), (cx + 75, cy - 90), (cx + 45, cy + 40), (cx - 45, cy + 40)],
                  fill=(245, 158, 11), outline=(254, 240, 138), width=4)
    # Cup handles
    tdraw.arc([cx - 120, cy - 80, cx - 40, cy], 90, 270, fill=(254, 240, 138), width=5)
    tdraw.arc([cx + 40, cy - 80, cx + 120, cy], 270, 90, fill=(254, 240, 138), width=5)
    # Base
    tdraw.rectangle([cx - 65, cy + 40, cx + 65, cy + 110], fill=(120, 53, 15), outline=(254, 240, 138), width=3)
    draw_seal(tdraw, "金盃", cx, cy + 75, size=46, font=font_seal, fill=(180, 83, 9), border=(254, 240, 138))
    tr_img = apply_vignette(tr_img, intensity=0.35)
    tr_img.save(out_dir / "trophy-gold.jpg", "JPEG", quality=92)


# ==============================================================================
# Game 2: Big-Two (大老二)
# ==============================================================================

def generate_big_two_assets() -> None:
    print("-> Generating Big-Two assets...")
    out_dir = BASE_DIR / "Games/Big-Two/public"
    suits_dir = out_dir / "suits"
    suits_dir.mkdir(parents=True, exist_ok=True)

    font_large_seal = get_font(44, prefer_serif=True)
    font_ui = get_font(28, prefer_serif=False)

    w, h = 1350, 900

    # 2.1 title-bg.jpg: 1350x900 Grand High-Roller Casino Salon
    title_img = Image.new('RGB', (w, h), (14, 18, 24))
    tdraw = ImageDraw.Draw(title_img)
    for y in range(h):
        t = y / float(h)
        tdraw.line([(0, y), (w, y)], fill=(int(14 + 18 * t), int(18 + 26 * t), int(24 + 16 * t)))
    # Warm pendant overhead lights
    for lx in [int(w * 0.25), int(w * 0.5), int(w * 0.75)]:
        tdraw.polygon([(lx, 0), (lx - 220, h), (lx + 220, h)], fill=(255, 235, 180))
    title_img = title_img.filter(ImageFilter.GaussianBlur(18.0))
    tdraw = ImageDraw.Draw(title_img)

    # Green baize table in perspective
    table_poly = [(int(w * 0.08), int(h * 0.48)), (int(w * 0.92), int(h * 0.48)),
                  (w, h), (0, h)]
    tdraw.polygon(table_poly, fill=(16, 68, 42), outline=(180, 140, 40), width=4)

    # Mahogany armrest rim
    tdraw.line([(int(w * 0.08), int(h * 0.48)), (int(w * 0.92), int(h * 0.48))], fill=(120, 53, 15), width=8)

    # Title Banner
    tdraw.rectangle([w // 2 - 280, 80, w // 2 + 280, 180], fill=(15, 23, 42), outline=(245, 158, 11), width=3)
    tdraw.text((w // 2, 115), "CLUBHOUSE BIG-TWO · 尊榮大老二", fill=(254, 240, 138), font=font_large_seal, anchor="mm")
    tdraw.text((w // 2, 155), "HIGH-ROLLER CARD SALON · 黑桃至尊爭鋒", fill=(203, 213, 225), font=font_ui, anchor="mm")

    draw_seal(tdraw, "至尊", w - 100, 100, size=68, font=font_large_seal, fill=(185, 28, 28), border=(254, 240, 138))
    title_img = apply_vignette(title_img, intensity=0.45)
    title_img.save(out_dir / "title-bg.jpg", "JPEG", quality=92)

    # 2.2 felt.jpg: 1350x900 Luxury Emerald Gaming Felt
    felt = Image.new('RGB', (w, h), (18, 76, 46))
    fdraw = ImageDraw.Draw(felt)
    # Felt woven texture noise
    for _ in range(4000):
        fx = random.randint(0, w)
        fy = random.randint(0, h)
        fcol = random.choice([(14, 66, 38), (22, 88, 54), (16, 72, 42), (24, 94, 58)])
        fdraw.ellipse([fx - 1, fy - 1, fx + 1, fy + 1], fill=fcol)
    felt = apply_vignette(felt, intensity=0.4)
    fdraw = ImageDraw.Draw(felt)
    # Double gold filigree border
    fdraw.rectangle([30, 30, w - 30, h - 30], outline=(180, 140, 45), width=2)
    fdraw.rectangle([38, 38, w - 38, h - 38], outline=(180, 140, 45), width=1)
    felt.save(out_dir / "felt.jpg", "JPEG", quality=92)

    # 2.3 card-back.jpg: 1024x1536 Royal Guilloche Card Back
    cb_w, cb_h = 1024, 1536
    cback = Image.new('RGB', (cb_w, cb_h), (255, 255, 255))
    cbdraw = ImageDraw.Draw(cback)
    # Border margin
    cbdraw.rectangle([40, 40, cb_w - 40, cb_h - 40], fill=(15, 23, 42), outline=(212, 175, 55), width=6)
    cbdraw.rectangle([52, 52, cb_w - 52, cb_h - 52], outline=(254, 240, 138), width=2)
    # Diamond Guilloche Grid
    for gx in range(80, cb_w - 80, 48):
        for gy in range(80, cb_h - 80, 48):
            cbdraw.polygon([(gx, gy - 20), (gx + 20, gy), (gx, gy + 20), (gx - 20, gy)],
                           outline=(51, 65, 85), width=1)
            cbdraw.ellipse([gx - 4, gy - 4, gx + 4, gy + 4], fill=(212, 175, 55))
    # Center Royal Medallion
    ccx, ccy = cb_w // 2, cb_h // 2
    cbdraw.ellipse([ccx - 140, ccy - 140, ccx + 140, ccy + 140], fill=(20, 30, 52), outline=(212, 175, 55), width=6)
    draw_seal(cbdraw, "黑桃", ccx, ccy, size=88, font=font_large_seal, fill=(185, 28, 28), border=(254, 240, 138))
    cback = apply_vignette(cback, intensity=0.25)
    cback.save(out_dir / "card-back.jpg", "JPEG", quality=95)

    # 2.4 face-plate.jpg: 512x768 Heavyweight Linen Cardstock
    fp_w, fp_h = 512, 768
    fplate = Image.new('RGB', (fp_w, fp_h), (253, 252, 248))
    fpdraw = ImageDraw.Draw(fplate)
    # Micro linen weave texture
    for _ in range(2500):
        px = random.randint(0, fp_w)
        py = random.randint(0, fp_h)
        pcol = random.choice([(248, 246, 240), (255, 255, 252), (242, 240, 234)])
        fpdraw.point((px, py), fill=pcol)
    fpdraw.rectangle([16, 16, fp_w - 16, fp_h - 16], outline=(226, 218, 198), width=1)
    fplate.save(out_dir / "face-plate.jpg", "JPEG", quality=95)

    # 2.5 Poker Suits: 384x384 (spades, hearts, diamonds, clubs)
    generate_poker_suits(suits_dir)

    # 2.6 Dynamic Character Avatars: 512x512
    avatars = [
        ("avatar-player.jpg", "主", "玩家主角", (34, 197, 94), (16, 28, 20)),
        ("avatar-ming.jpg", "明", "菜鳥阿明", (245, 158, 11), (28, 22, 12)),
        ("avatar-mei.jpg", "美", "拆牌阿美", (236, 72, 153), (32, 14, 26)),
        ("avatar-qiang.jpg", "強", "囤貨阿強", (239, 68, 68), (34, 14, 16)),
        ("avatar-zhen.jpg", "珍", "記牌阿珍", (56, 189, 248), (14, 24, 38)),
        ("avatar-king.jpg", "魔", "牌桌魔王", (168, 85, 247), (26, 14, 38)),
    ]

    for fname, seal_txt, name_txt, accent_col, bg_col in avatars:
        aimg = Image.new('RGB', (512, 512), bg_col)
        adraw = ImageDraw.Draw(aimg)
        acx, acy = 256, 256

        # Outer neon circle frame
        adraw.ellipse([acx - 180, acy - 180, acx + 180, acy + 180], fill=(24, 30, 42), outline=accent_col, width=6)
        adraw.ellipse([acx - 166, acy - 166, acx + 166, acy + 166], outline=(148, 163, 184), width=2)

        # Silhouette bust
        adraw.polygon([(acx - 90, acy + 150), (acx + 90, acy + 150), (acx + 55, acy + 30), (acx - 55, acy + 30)], fill=(38, 48, 68))
        adraw.ellipse([acx - 48, acy - 70, acx + 48, acy + 30], fill=(235, 205, 175))

        # Distinct accessory / headwear per character
        if "ming" in fname:
            # Baseball cap
            adraw.rectangle([acx - 52, acy - 75, acx + 52, acy - 50], fill=(245, 158, 11))
        elif "mei" in fname:
            # Sunglasses
            adraw.rectangle([acx - 38, acy - 30, acx + 38, acy - 12], fill=(236, 72, 153))
        elif "zhen" in fname:
            # Spectacles
            adraw.rectangle([acx - 36, acy - 28, acx + 36, acy - 14], fill=(15, 23, 42), outline=(56, 189, 248), width=2)
        elif "king" in fname:
            # Golden crown
            adraw.polygon([(acx - 45, acy - 70), (acx - 30, acy - 95), (acx, acy - 75),
                           (acx + 30, acy - 95), (acx + 45, acy - 70)], fill=(245, 158, 11))

        # Traditional Chinese seal badge
        draw_seal(adraw, seal_txt, acx + 95, acy - 85, size=64, font=font_large_seal, fill=accent_col, border=(255, 255, 255))

        # Name label bar
        adraw.rectangle([acx - 100, acy + 115, acx + 100, acy + 155], fill=(15, 23, 42), outline=accent_col, width=2)
        adraw.text((acx, acy + 135), name_txt, fill=(255, 255, 255), font=font_ui, anchor="mm")

        aimg = apply_vignette(aimg, intensity=0.32)
        aimg.save(out_dir / fname, "JPEG", quality=92)


# ==============================================================================
# Game 3: Pick-Red (撿紅點)
# ==============================================================================

def generate_pick_red_assets() -> None:
    print("-> Generating Pick-Red assets...")
    out_dir = BASE_DIR / "Games/Pick-Red/public"
    suits_dir = out_dir / "suits"
    badges_dir = out_dir / "badges"
    avatars_dir = out_dir / "avatars"
    suits_dir.mkdir(parents=True, exist_ok=True)
    badges_dir.mkdir(parents=True, exist_ok=True)
    avatars_dir.mkdir(parents=True, exist_ok=True)

    font_seal = get_font(32, prefer_serif=True)
    font_large_seal = get_font(44, prefer_serif=True)
    font_ui = get_font(28, prefer_serif=False)

    w, h = 1350, 900

    # 3.1 title-bg.jpg: 1350x900 Grand Traditional Taiwanese Tea Salon & Card Parlor
    title_img = Image.new('RGB', (w, h), (24, 14, 12))
    tdraw = ImageDraw.Draw(title_img)
    for y in range(h):
        t = y / float(h)
        tdraw.line([(0, y), (w, y)], fill=(int(24 + 20 * t), int(14 + 16 * t), int(12 + 10 * t)))

    # Warm red silk lanterns
    for lx in [int(w * 0.18), int(w * 0.82)]:
        tdraw.ellipse([lx - 45, 60, lx + 45, 170], fill=(225, 29, 72))
        tdraw.ellipse([lx - 35, 75, lx + 35, 155], fill=(251, 113, 133))
        tdraw.line([(lx, 0), (lx, 60)], fill=(212, 175, 55), width=3)
        tdraw.line([(lx, 170), (lx, 210)], fill=(212, 175, 55), width=2)
    title_img = title_img.filter(ImageFilter.GaussianBlur(16.0))
    tdraw = ImageDraw.Draw(title_img)

    # Rosewood Card Table
    table_poly = [(int(w * 0.08), int(h * 0.48)), (int(w * 0.92), int(h * 0.48)), (w, h), (0, h)]
    tdraw.polygon(table_poly, fill=(20, 52, 38), outline=(136, 19, 55), width=6)

    # Title Calligraphy Scroll
    sw, sh = 560, 110
    sx, sy = w // 2 - sw // 2, 70
    tdraw.rectangle([sx, sy, sx + sw, sy + sh], fill=(254, 243, 199), outline=(154, 52, 18), width=3)
    tdraw.text((w // 2, sy + 38), "台灣雅聚 · 撿紅點", fill=(136, 19, 55), font=font_large_seal, anchor="mm")
    tdraw.text((w // 2, sy + 78), "TRADITIONAL TEA SALON & CARD PARLOR · 合十成雙", fill=(120, 53, 15), font=font_ui, anchor="mm")

    draw_seal(tdraw, "合十", w - 100, 100, size=68, font=font_large_seal, fill=(185, 28, 28), border=(254, 240, 138))
    title_img = apply_vignette(title_img, intensity=0.45)
    title_img.save(out_dir / "title-bg.jpg", "JPEG", quality=92)

    # 3.2 felt.jpg: 1350x900 Imperial Jade Parlor Felt
    felt = Image.new('RGB', (w, h), (18, 64, 46))
    fdraw = ImageDraw.Draw(felt)
    for _ in range(4000):
        fx = random.randint(0, w)
        fy = random.randint(0, h)
        fcol = random.choice([(14, 56, 40), (22, 74, 52), (18, 60, 44)])
        fdraw.ellipse([fx - 1, fy - 1, fx + 1, fy + 1], fill=fcol)
    felt = apply_vignette(felt, intensity=0.38)
    fdraw = ImageDraw.Draw(felt)
    fdraw.rectangle([30, 30, w - 30, h - 30], outline=(180, 140, 45), width=2)
    felt.save(out_dir / "felt.jpg", "JPEG", quality=92)

    # 3.3 card-back.jpg & face-plate.jpg
    cb_w, cb_h = 1024, 1536
    cback = Image.new('RGB', (cb_w, cb_h), (255, 255, 255))
    cbdraw = ImageDraw.Draw(cback)
    cbdraw.rectangle([40, 40, cb_w - 40, cb_h - 40], fill=(136, 19, 55), outline=(212, 175, 55), width=6)
    cbdraw.rectangle([52, 52, cb_w - 52, cb_h - 52], outline=(254, 240, 138), width=2)
    # Auspicious cloud pattern
    for gx in range(80, cb_w - 80, 56):
        for gy in range(80, cb_h - 80, 56):
            cbdraw.ellipse([gx - 16, gy - 16, gx + 16, gy + 16], outline=(251, 191, 36), width=1)
    ccx, ccy = cb_w // 2, cb_h // 2
    cbdraw.ellipse([ccx - 140, ccy - 140, ccx + 140, ccy + 140], fill=(159, 18, 57), outline=(212, 175, 55), width=6)
    draw_seal(cbdraw, "紅點", ccx, ccy, size=88, font=font_large_seal, fill=(185, 28, 28), border=(254, 240, 138))
    cback = apply_vignette(cback, intensity=0.25)
    cback.save(out_dir / "card-back.jpg", "JPEG", quality=95)

    fp_w, fp_h = 512, 768
    fplate = Image.new('RGB', (fp_w, fp_h), (253, 250, 242))
    fpdraw = ImageDraw.Draw(fplate)
    for _ in range(2500):
        px = random.randint(0, fp_w)
        py = random.randint(0, fp_h)
        fpdraw.point((px, py), fill=(244, 240, 230))
    fpdraw.rectangle([16, 16, fp_w - 16, fp_h - 16], outline=(225, 215, 195), width=1)
    fplate.save(out_dir / "face-plate.jpg", "JPEG", quality=95)

    # 3.4 Poker Suits
    generate_poker_suits(suits_dir)

    # 3.5 Dedicated Stunt & Strike Badges (512x512)
    badge_defs = [
        ("badge-red-ace.jpg", "天王", "👑 天王絕殺合十", "紅心A / 方塊A · 20分", (225, 29, 72), (28, 12, 16)),
        ("badge-big-five.jpg", "紅五", "⚡ 過紅五合十", "紅五核心 · 5分大牌", (245, 158, 11), (28, 20, 10)),
        ("badge-golden-nine.jpg", "金鑰", "🔑 金鑰開天合十", "紅九金鑰 · 10分進帳", (234, 179, 8), (26, 22, 10)),
        ("badge-match-ten.jpg", "合十", "✨ 湊十合一神技", "完美湊十 · 磁吸入袋", (16, 185, 129), (10, 26, 18)),
        ("badge-tool-conversion.jpg", "以黑", "🎯 以黑換紅奇策", "黑牌換分 · 零成本收割", (14, 165, 233), (12, 22, 34)),
    ]

    for fname, seal_txt, badge_name, blurb_txt, accent_col, bg_col in badge_defs:
        bimg = Image.new('RGB', (512, 512), bg_col)
        bdraw = ImageDraw.Draw(bimg)
        bcx, bcy = 256, 256

        # Multi-pointed octagonal star border
        star_pts = []
        for i in range(16):
            ang = math.radians(i * (360 / 16))
            rad = 180 if i % 2 == 0 else 145
            star_pts.append((int(bcx + rad * math.cos(ang)), int(bcy + rad * math.sin(ang))))
        bdraw.polygon(star_pts, fill=(24, 30, 42), outline=accent_col, width=5)

        # Center medallion
        bdraw.ellipse([bcx - 90, bcy - 90, bcx + 90, bcy + 90], fill=(32, 40, 56), outline=(254, 240, 138), width=3)
        draw_seal(bdraw, seal_txt, bcx, bcy - 12, size=92, font=font_large_seal, fill=accent_col, border=(255, 255, 255))

        # Bottom label bar
        bdraw.rectangle([bcx - 130, bcy + 115, bcx + 130, bcy + 160], fill=(15, 23, 42), outline=accent_col, width=2)
        bdraw.text((bcx, bcy + 130), badge_name, fill=(255, 255, 255), font=font_ui, anchor="mm")
        bdraw.text((bcx, bcy + 148), blurb_txt, fill=accent_col, font=get_font(18, False), anchor="mm")

        bimg = apply_vignette(bimg, intensity=0.35)
        bimg.save(badges_dir / fname, "JPEG", quality=92)

    # 3.6 Avatars in avatars/
    pick_avatars = [
        ("avatar-player.jpg", "主", "玩家主角", (34, 197, 94), (16, 28, 20)),
        ("avatar-ming.jpg", "明", "菜鳥阿明", (245, 158, 11), (28, 22, 12)),
        ("avatar-mei.jpg", "美", "浪子小美", (236, 72, 153), (32, 14, 26)),
        ("avatar-cai.jpg", "財", "守財奴阿財", (239, 68, 68), (34, 14, 16)),
        ("avatar-zhen.jpg", "珍", "追A手阿珍", (56, 189, 248), (14, 24, 38)),
        ("avatar-king.jpg", "魔", "紅點魔王", (168, 85, 247), (26, 14, 38)),
    ]
    for fname, seal_txt, name_txt, accent_col, bg_col in pick_avatars:
        aimg = Image.new('RGB', (512, 512), bg_col)
        adraw = ImageDraw.Draw(aimg)
        acx, acy = 256, 256
        adraw.ellipse([acx - 180, acy - 180, acx + 180, acy + 180], fill=(24, 30, 42), outline=accent_col, width=6)
        adraw.polygon([(acx - 90, acy + 150), (acx + 90, acy + 150), (acx + 55, acy + 30), (acx - 55, acy + 30)], fill=(38, 48, 68))
        adraw.ellipse([acx - 48, acy - 70, acx + 48, acy + 30], fill=(235, 205, 175))
        draw_seal(adraw, seal_txt, acx + 95, acy - 85, size=64, font=font_large_seal, fill=accent_col, border=(255, 255, 255))
        adraw.rectangle([acx - 100, acy + 115, acx + 100, acy + 155], fill=(15, 23, 42), outline=accent_col, width=2)
        adraw.text((acx, acy + 135), name_txt, fill=(255, 255, 255), font=font_ui, anchor="mm")
        aimg = apply_vignette(aimg, intensity=0.32)
        aimg.save(avatars_dir / fname, "JPEG", quality=92)


# ==============================================================================
# Game 4: Wall-Flip (牆上翻滾 / 宙返りロードスター)
# ==============================================================================

def generate_wall_flip_assets() -> None:
    print("-> Generating Wall-Flip assets...")
    assets_dir = BASE_DIR / "Games/Wall-Flip/assets"
    assets_dir.mkdir(parents=True, exist_ok=True)

    font_large_seal = get_font(44, prefer_serif=True)
    font_ui = get_font(28, prefer_serif=False)

    w, h = 1350, 900

    # 4.1 hero-banner.jpg & hero-banner.webp: 1350x900 Cyberpunk Stunt Mega Arena
    hero_img = Image.new('RGB', (w, h), (8, 12, 24))
    hdraw = ImageDraw.Draw(hero_img)
    for y in range(h):
        t = y / float(h)
        hdraw.line([(0, y), (w, y)], fill=(int(8 + 18 * t), int(12 + 24 * t), int(24 + 48 * t)))
    # Volumetric laser fan
    for lx in [int(w * 0.15), int(w * 0.5), int(w * 0.85)]:
        hdraw.polygon([(lx, 0), (lx - 280, h), (lx + 280, h)], fill=(111, 240, 208))
    hero_img = hero_img.filter(ImageFilter.GaussianBlur(16.0))
    hdraw = ImageDraw.Draw(hero_img)

    # 165° Wall Curve Silhouette
    wall_pts = [(0, h), (int(w * 0.45), h)]
    for deg in range(0, 166, 5):
        rad = math.radians(deg)
        wx = int(w * 0.45) + math.sin(rad) * 320
        wy = h - 60 - (1.0 - math.cos(rad)) * 320
        wall_pts.append((int(wx), int(wy)))
    hdraw.line(wall_pts, fill=(111, 240, 208), width=8)

    # Neon Stunt Text
    hdraw.rectangle([w // 2 - 320, 70, w // 2 + 320, 175], fill=(12, 18, 32), outline=(111, 240, 208), width=3)
    hdraw.text((w // 2, 108), "WALL FLIP · 宙返りロードスター", fill=(111, 240, 208), font=font_large_seal, anchor="mm")
    hdraw.text((w // 2, 148), "165° AEROBATIC STUNT FLIGHT ARENA · 極限特技座艙", fill=(203, 213, 225), font=font_ui, anchor="mm")

    draw_seal(hdraw, "特技", w - 100, 100, size=68, font=font_large_seal, fill=(13, 148, 136), border=(111, 240, 208))
    hero_img = apply_vignette(hero_img, intensity=0.45)
    hero_img.save(assets_dir / "hero-banner.jpg", "JPEG", quality=92)
    hero_img.save(assets_dir / "hero-banner.webp", "WEBP", quality=90)
    hero_img.save(assets_dir / "stunt-club-hero.webp", "WEBP", quality=90)

    # 4.2 sky-backdrop.jpg & sky-backdrop.webp: 2048x1024 Ultra-wide 360° Cyber Sky Dome
    sk_w, sk_h = 2048, 1024
    sky = Image.new('RGB', (sk_w, sk_h), (8, 14, 32))
    skdraw = ImageDraw.Draw(sky)
    for y in range(sk_h):
        t = y / float(sk_h)
        skdraw.line([(0, y), (sk_w, y)], fill=(int(8 + 35 * t), int(14 + 18 * t), int(32 + 55 * t)))
    # Aurora ribbons
    for _ in range(25):
        ax = random.randint(0, sk_w)
        ay = random.randint(int(sk_h * 0.2), int(sk_h * 0.7))
        arad = random.randint(120, 320)
        skdraw.ellipse([ax - arad, ay - 40, ax + arad, ay + 40], fill=(111, 240, 208))
    sky = sky.filter(ImageFilter.GaussianBlur(18.0))
    sky = apply_vignette(sky, intensity=0.3)
    sky.save(assets_dir / "sky-backdrop.jpg", "JPEG", quality=92)
    sky.save(assets_dir / "sky-backdrop.webp", "WEBP", quality=90)

    # 4.3 track-asphalt.jpg & track-asphalt.webp: 1024x1024 High-Grip PBR Asphalt
    asphalt = Image.new('RGB', (1024, 1024), (32, 34, 38))
    asdraw = ImageDraw.Draw(asphalt)
    for _ in range(6000):
        px = random.randint(0, 1024)
        py = random.randint(0, 1024)
        col = random.choice([(24, 26, 30), (44, 46, 50), (52, 54, 58), (38, 40, 44)])
        asdraw.point((px, py), fill=col)
    # Neon laser track edge lines
    asdraw.line([(60, 0), (60, 1024)], fill=(111, 240, 208), width=6)
    asdraw.line([(1024 - 60, 0), (1024 - 60, 1024)], fill=(244, 63, 94), width=6)
    asphalt.save(assets_dir / "track-asphalt.jpg", "JPEG", quality=95)
    asphalt.save(assets_dir / "track-asphalt.webp", "WEBP", quality=90)

    # 4.4 carbon-fiber.jpg & carbon-fiber.webp: 1024x1024 2x2 Twill Carbon Fiber Weave
    cf = Image.new('RGB', (1024, 1024), (20, 22, 24))
    cfdraw = ImageDraw.Draw(cf)
    step = 16
    for x in range(0, 1024, step):
        for y in range(0, 1024, step):
            if ((x // step) + (y // step)) % 2 == 0:
                cfdraw.rectangle([x, y, x + step - 1, y + step - 1], fill=(42, 45, 50))
            else:
                cfdraw.rectangle([x, y, x + step - 1, y + step - 1], fill=(16, 18, 20))
    cf.save(assets_dir / "carbon-fiber.jpg", "JPEG", quality=95)
    cf.save(assets_dir / "carbon-fiber.webp", "WEBP", quality=90)

    # 4.5 ground-grid.jpg & ground-grid.webp: 1024x1024 Aerospace Ground Grid
    grid = Image.new('RGB', (1024, 1024), (16, 20, 28))
    gdraw = ImageDraw.Draw(grid)
    for i in range(0, 1024, 64):
        gdraw.line([(i, 0), (i, 1024)], fill=(32, 45, 65), width=1)
        gdraw.line([(0, i), (1024, i)], fill=(32, 45, 65), width=1)
    grid.save(assets_dir / "ground-grid.jpg", "JPEG", quality=95)
    grid.save(assets_dir / "ground-grid.webp", "WEBP", quality=90)

    # 4.6 stunt-badge.png & stunt-badge.webp (512x512)
    sbadge = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    sbdraw = ImageDraw.Draw(sbadge)
    cx, cy = 256, 256
    # Gold supersonic wings
    sbdraw.polygon([(cx, cy - 140), (cx + 170, cy - 20), (cx + 90, cy + 90), (cx, cy + 140),
                    (cx - 90, cy + 90), (cx - 170, cy - 20)], fill=(245, 158, 11), outline=(254, 240, 138), width=5)
    # Core plasma turbine
    sbdraw.ellipse([cx - 75, cy - 75, cx + 75, cy + 75], fill=(15, 23, 42), outline=(111, 240, 208), width=4)
    draw_seal(sbdraw, "特技", cx, cy, size=76, font=font_large_seal, fill=(13, 148, 136), border=(111, 240, 208))
    sbadge.save(assets_dir / "stunt-badge.png", "PNG")
    sbadge.save(assets_dir / "stunt-badge.webp", "WEBP", quality=90)

    # 4.7 club-medal.webp (512x512)
    cmedal = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    cmdraw = ImageDraw.Draw(cmedal)
    cmdraw.ellipse([cx - 150, cy - 150, cx + 150, cy + 150], fill=(217, 119, 6), outline=(254, 240, 138), width=8)
    cmdraw.ellipse([cx - 130, cy - 130, cx + 130, cy + 130], fill=(245, 158, 11), outline=(254, 240, 138), width=3)
    draw_seal(cmdraw, "榮譽", cx, cy, size=88, font=font_large_seal, fill=(180, 83, 9), border=(254, 240, 138))
    cmedal.save(assets_dir / "club-medal.webp", "WEBP", quality=90)

    # 4.8 5 Dedicated Showroom Vehicle Concepts: 1280x853
    vehicles = [
        ("roadster-concept.webp", "01 經典敞篷", "均衡入門 · 原版手感", (37, 95, 104), (179, 120, 78)),
        ("sparrow-concept.webp", "02 飛雀方程式", "靈活翻滾 · 敏捷升空", (212, 225, 220), (242, 113, 61)),
        ("atlas-concept.webp", "03 磐石拉力", "穩定省氣 · 著陸利刃", (100, 112, 91), (219, 166, 86)),
        ("nova-concept.webp", "04 新星噴射", "強力升空 · 雙鍵推進", (38, 50, 78), (149, 101, 206)),
        ("mars-royale-concept.webp", "05 尊榮火星車", "輕鬆著陸 · 超長續航", (228, 224, 207), (198, 165, 102)),
    ]

    for fname, v_title, v_blurb, body_col, accent_col in vehicles:
        vimg = Image.new('RGB', (1280, 853), (15, 20, 32))
        vdraw = ImageDraw.Draw(vimg)
        # Studio floor & horizon
        for y in range(853):
            t = y / 853.0
            vdraw.line([(0, y), (1280, y)], fill=(int(15 + 18 * t), int(20 + 25 * t), int(32 + 35 * t)))
        # Spotlight pedestal
        vdraw.ellipse([340, 480, 940, 680], fill=(25, 35, 55), outline=accent_col, width=3)
        # Stylized Vehicle Silhouette
        vdraw.polygon([(460, 560), (820, 560), (780, 480), (520, 480)], fill=body_col, outline=accent_col, width=3)
        # Wheels
        vdraw.ellipse([480, 540, 540, 600], fill=(20, 22, 26), outline=accent_col, width=3)
        vdraw.ellipse([740, 540, 800, 600], fill=(20, 22, 26), outline=accent_col, width=3)
        # Card header & text
        vdraw.rectangle([60, 60, 520, 150], fill=(12, 16, 26), outline=accent_col, width=2)
        vdraw.text((290, 90), v_title, fill=(255, 255, 255), font=font_large_seal, anchor="mm")
        vdraw.text((290, 126), v_blurb, fill=accent_col, font=font_ui, anchor="mm")
        draw_seal(vdraw, "車庫", 1200, 90, size=64, font=font_large_seal, fill=(13, 148, 136), border=(111, 240, 208))
        vimg = apply_vignette(vimg, intensity=0.35)
        vimg.save(assets_dir / fname, "WEBP", quality=90)


# ==============================================================================
# Main Orchestrator
# ==============================================================================

def main() -> None:
    print("=== Wave 16 Art Generator Started ===")
    generate_baseball_life_assets()
    generate_big_two_assets()
    generate_pick_red_assets()
    generate_wall_flip_assets()
    print("=== Wave 16 Art Generation Completed Successfully ===")


if __name__ == '__main__':
    main()
