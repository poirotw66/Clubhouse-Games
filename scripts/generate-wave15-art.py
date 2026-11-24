#!/usr/bin/env python3
"""
Wave 15 Multi-Battleground Art Generator
Generates high-resolution, tactile game assets adhering to Sakurai game design principles for:
- Dialed-Color (1350x900 Master Synthwave Chroma Optical Laboratory Studio background,
                512x512 optical dispersion prism crystal,
                512x512 high-precision circular glass dial plate,
                512x512 dedicated chromatic rank crests with Traditional Chinese seals:
                sovereign, commander, tuner, voyager, researcher, novice)
- Dynasty (1350x900 Grand General Manager Front Office War Room,
           1350x900 Championship stadium night lights,
           512x512 Taiwan Series Championship Golden Trophy,
           512x512 dedicated team heraldic emblems for 6 CPBL clubs: lions, angels, cannons, eagles, dolphins, volcano;
           512x512 front office staff portraits: gm, scout, owner)
- Mystery-Liquid-Sort (1350x900 Grand Alchemical Synthesizer Laboratory title hero,
                       1024x1024 tactile polished mahogany test tube laboratory rack surface,
                       512x512 high-purity borosilicate glass test tube texture,
                       512x512 elemental reagent emblems: crimson, azure, emerald, amber, amethyst, cyan, orange;
                       1350x900 upgraded thematic laboratory & cultural backdrops: alchemy-lab, neon-arcade,
                       aquarium, candy-shop, neon-rooftop, taiwan-night-market, taipei-street, taiwan-alley, bamboo-garden)
- Sailing (1350x900 Grand America's Cup coastal championship regatta hero,
           1024x1024 luxury teak marine deck texture,
           1024x1024 high-frequency ocean surface micro-caustics normal displacement,
           1024x1024 high-tech racing carbon-fiber ripstop grid weave sail texture,
           2048x1024 ultra-wide panoramic marine sky with atmospheric haze,
           512x512 dedicated maritime skipper portraits & regatta trophy: player, breeze, reach, gale, regatta-cup)

Architectural justification: High-fidelity procedural asset generation for 4 games in Wave 15
requires rich mathematical drawing routines, vector rendering, and localized font typography
within a single deterministic, reproducible generation pipeline, mirroring Waves 10 through 14.
"""

from __future__ import annotations

import math
import os
import random
from pathlib import Path
from typing import Sequence
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SEED = 20261125
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
    """Draw a Traditional Chinese red seal stamp with double border."""
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
    vignette = vignette.filter(ImageFilter.GaussianBlur(30.0))
    base_rgba = img.convert('RGBA')
    base_rgba.paste(vignette, (0, 0), vignette)
    return base_rgba.convert('RGB')


# ==============================================================================
# Game 1: Dialed-Color (色感記憶)
# ==============================================================================

def generate_dialed_color_assets() -> None:
    print("-> Generating Dialed-Color assets...")
    out_dir = BASE_DIR / "Games/Dialed-Color/public"
    ranks_dir = out_dir / "ranks"
    ranks_dir.mkdir(parents=True, exist_ok=True)

    font_seal = get_font(32, prefer_serif=True)
    font_large_seal = get_font(42, prefer_serif=True)
    font_ui = get_font(28, prefer_serif=False)

    # 1.1 studio-bg.jpg: 1350x900 Master Synthwave Chroma Optical Laboratory
    bg_w, bg_h = 1350, 900
    studio = Image.new('RGB', (bg_w, bg_h), (12, 10, 20))
    sdraw = ImageDraw.Draw(studio)

    # Ambient deep horizon gradient
    for y in range(bg_h):
        ratio = y / float(bg_h)
        r = int(14 * (1.0 - ratio) + 8 * ratio)
        g = int(10 * (1.0 - ratio) + 14 * ratio)
        b = int(28 * (1.0 - ratio) + 26 * ratio)
        sdraw.line([(0, y), (bg_w, y)], fill=(r, g, b))

    # Optical laser beam grid lines on floor (perspective grid)
    vanishing_y = int(bg_h * 0.42)
    vanishing_x = bg_w // 2
    grid_lines = 32
    for i in range(-grid_lines, grid_lines + 1):
        x_bottom = vanishing_x + i * 55
        alpha_color = (30, 45, 75) if abs(i) % 4 != 0 else (56, 189, 248)
        sdraw.line([(vanishing_x, vanishing_y), (x_bottom, bg_h)], fill=alpha_color, width=1 if abs(i) % 4 != 0 else 2)

    # Horizontal depth lines
    for h_step in range(1, 16):
        t = (h_step / 16.0) ** 2.2
        y_pos = int(vanishing_y + (bg_h - vanishing_y) * t)
        line_col = (40, 50, 80) if h_step % 2 == 0 else (70, 40, 90)
        sdraw.line([(0, y_pos), (bg_w, y_pos)], fill=line_col, width=1)

    # Overhead neon laser emitter tracks & glowing optical tubes
    for x_pos in [180, 360, bg_w - 360, bg_w - 180]:
        sdraw.line([(x_pos, 0), (x_pos, vanishing_y - 20)], fill=(30, 25, 45), width=6)
        sdraw.line([(x_pos, 0), (x_pos, vanishing_y - 20)], fill=(244, 63, 94) if x_pos < 500 else (6, 182, 212), width=2)
        # Glow halo
        sdraw.ellipse([x_pos - 12, vanishing_y - 28, x_pos + 12, vanishing_y - 4], fill=(255, 255, 255))

    # Center floating holographic chromatic vector scope ring
    cx, cy = vanishing_x, vanishing_y
    for r in range(160, 240, 10):
        sdraw.ellipse([cx - r, cy - int(r * 0.6), cx + r, cy + int(r * 0.6)], outline=(56, 189, 248), width=1)
    sdraw.ellipse([cx - 240, cy - int(240 * 0.6), cx + 240, cy + int(240 * 0.6)], outline=(217, 70, 239), width=2)

    # Laser spectrum beams shooting outwards
    for deg in range(0, 360, 30):
        rad = math.radians(deg)
        x2 = cx + int(320 * math.cos(rad))
        y2 = cy + int(190 * math.sin(rad))
        # Color corresponding to rainbow hue
        h_norm = deg / 360.0
        # Simple HSL to RGB approximation
        hue_r = int(127 + 127 * math.cos(2 * math.pi * h_norm))
        hue_g = int(127 + 127 * math.cos(2 * math.pi * (h_norm - 1 / 3)))
        hue_b = int(127 + 127 * math.cos(2 * math.pi * (h_norm - 2 / 3)))
        sdraw.line([(cx, cy), (x2, y2)], fill=(hue_r, hue_g, hue_b), width=2)

    studio = apply_vignette(studio, intensity=0.45)
    studio.save(out_dir / "studio-bg.jpg", "JPEG", quality=92)

    # 1.2 prism-core.jpg: 512x512 Tactile optical dispersion prism crystal
    p_size = 512
    prism = Image.new('RGB', (p_size, p_size), (8, 6, 16))
    pdraw = ImageDraw.Draw(prism)
    pcx, pcy = p_size // 2, p_size // 2

    # Draw dark radial glow
    for r in range(240, 20, -10):
        alpha = int(35 * (1.0 - r / 240.0))
        pdraw.ellipse([pcx - r, pcy - r, pcx + r, pcy + r], fill=(20 + alpha, 10 + alpha, 40 + alpha * 2))

    # Triangular crystal prism facets
    top_pt = (pcx, pcy - 160)
    bl_pt = (pcx - 140, pcy + 130)
    br_pt = (pcx + 140, pcy + 130)
    center_pt = (pcx, pcy + 30)

    # Facet 1: Left
    pdraw.polygon([top_pt, center_pt, bl_pt], fill=(30, 41, 69), outline=(96, 165, 250), width=3)
    # Facet 2: Right
    pdraw.polygon([top_pt, center_pt, br_pt], fill=(55, 30, 68), outline=(244, 114, 182), width=3)
    # Facet 3: Bottom
    pdraw.polygon([bl_pt, center_pt, br_pt], fill=(20, 25, 45), outline=(147, 197, 253), width=2)

    # Spectral light beam entering from left (white beam)
    pdraw.line([(0, pcy - 40), (pcx - 70, pcy - 15)], fill=(255, 255, 255), width=6)
    pdraw.line([(0, pcy - 40), (pcx - 70, pcy - 15)], fill=(224, 242, 254), width=10)

    # Refracted rainbow fan expanding out right
    rainbow_colors = [
        (239, 68, 68),   # Red
        (249, 115, 22),  # Orange
        (234, 179, 8),   # Yellow
        (34, 197, 94),   # Green
        (6, 182, 212),   # Cyan
        (59, 130, 246),  # Blue
        (168, 85, 247),  # Purple
    ]
    refract_origin = (pcx + 70, pcy - 15)
    for i, col in enumerate(rainbow_colors):
        angle = math.radians(-25 + i * 8)
        tgt_x = p_size
        tgt_y = int(pcy + math.tan(angle) * (p_size - refract_origin[0]))
        pdraw.line([refract_origin, (tgt_x, tgt_y)], fill=col, width=5)

    # Specular white stars on facets
    pdraw.ellipse([refract_origin[0] - 6, refract_origin[1] - 6, refract_origin[0] + 6, refract_origin[1] + 6], fill=(255, 255, 255))
    prism = apply_vignette(prism, intensity=0.3)
    prism.save(out_dir / "prism-core.jpg", "JPEG", quality=92)

    # 1.3 dial-glass.jpg: 512x512 High-precision circular glass dial plate
    d_size = 512
    dial = Image.new('RGB', (d_size, d_size), (10, 12, 18))
    ddraw = ImageDraw.Draw(dial)
    dcx, dcy = d_size // 2, d_size // 2

    # Outer bezel
    ddraw.ellipse([dcx - 240, dcy - 240, dcx + 240, dcy + 240], fill=(24, 28, 42), outline=(71, 85, 105), width=6)
    ddraw.ellipse([dcx - 232, dcy - 232, dcx + 232, dcy + 232], outline=(148, 163, 184), width=2)

    # Concentric micro-grooves
    for r in range(140, 225, 4):
        ddraw.ellipse([dcx - r, dcy - r, dcx + r, dcy + r], outline=(30, 36, 54), width=1)

    # Degree tick marks (360 degrees, every 5 deg and 30 deg)
    for deg in range(360):
        rad = math.radians(deg)
        if deg % 30 == 0:
            r1, r2 = 195, 222
            col = (56, 189, 248)
            w = 3
        elif deg % 5 == 0:
            r1, r2 = 205, 222
            col = (148, 163, 184)
            w = 1
        else:
            continue
        x1 = dcx + int(r1 * math.cos(rad))
        y1 = dcy + int(r1 * math.sin(rad))
        x2 = dcx + int(r2 * math.cos(rad))
        y2 = dcy + int(r2 * math.sin(rad))
        ddraw.line([(x1, y1), (x2, y2)], fill=col, width=w)

    # Inner circular dial core
    ddraw.ellipse([dcx - 130, dcy - 130, dcx + 130, dcy + 130], fill=(15, 23, 42), outline=(56, 189, 248), width=3)
    # Glass glare arc
    ddraw.arc([dcx - 120, dcy - 120, dcx + 120, dcy + 120], 190, 320, fill=(255, 255, 255), width=4)
    # Crosshair
    ddraw.line([(dcx - 100, dcy), (dcx + 100, dcy)], fill=(56, 189, 248), width=1)
    ddraw.line([(dcx, dcy - 100), (dcx, dcy + 100)], fill=(56, 189, 248), width=1)
    dial.save(out_dir / "dial-glass.jpg", "JPEG", quality=92)

    # 1.4 Dedicated Chromatic Rank Crests (512x512)
    rank_defs = [
        ("rank-sovereign.jpg", "尊", "光譜至尊", (217, 70, 239), (250, 204, 21), (30, 10, 40)),
        ("rank-commander.jpg", "令", "稜鏡指揮官", (6, 182, 212), (244, 63, 94), (10, 25, 45)),
        ("rank-tuner.jpg", "諧", "波長調諧師", (16, 185, 129), (245, 158, 11), (10, 35, 25)),
        ("rank-voyager.jpg", "航", "光學航行者", (59, 130, 246), (96, 165, 250), (12, 22, 48)),
        ("rank-researcher.jpg", "研", "色感研發員", (245, 158, 11), (251, 191, 36), (40, 28, 10)),
        ("rank-novice.jpg", "初", "光譜初生體", (148, 163, 184), (226, 232, 240), (20, 24, 32)),
    ]

    for fname, seal_txt, title_txt, primary_col, secondary_col, bg_col in rank_defs:
        r_img = Image.new('RGB', (512, 512), bg_col)
        rdraw = ImageDraw.Draw(r_img)
        rcx, rcy = 256, 256

        # Outer ornate heraldic polygon ring (Octagon / Hexagon)
        oct_pts = []
        for i in range(8):
            ang = math.radians(i * 45 + 22.5)
            rad = 220
            oct_pts.append((rcx + int(rad * math.cos(ang)), rcy + int(rad * math.sin(ang))))
        rdraw.polygon(oct_pts, outline=primary_col, width=6)

        inner_pts = []
        for i in range(8):
            ang = math.radians(i * 45 + 22.5)
            rad = 205
            inner_pts.append((rcx + int(rad * math.cos(ang)), rcy + int(rad * math.sin(ang))))
        rdraw.polygon(inner_pts, outline=secondary_col, width=2)

        # Multi-ray starburst in center
        for s in range(16):
            sang = math.radians(s * 22.5)
            rdraw.line([(rcx, rcy), (rcx + int(180 * math.cos(sang)), rcy + int(180 * math.sin(sang)))], fill=(*primary_col, 80), width=2)

        # Center circular shield
        rdraw.ellipse([rcx - 110, rcy - 110, rcx + 110, rcy + 110], fill=(15, 18, 30), outline=primary_col, width=4)
        rdraw.ellipse([rcx - 96, rcy - 96, rcx + 96, rcy + 96], outline=secondary_col, width=2)

        # Traditional Chinese seal stamp in center
        draw_seal(rdraw, seal_txt, rcx, rcy, size=90, font=font_large_seal, fill=primary_col, border=secondary_col)

        # Title banner at bottom
        rdraw.rectangle([rcx - 140, rcy + 145, rcx + 140, rcy + 185], fill=(10, 12, 22), outline=secondary_col, width=2)
        rdraw.text((rcx, rcy + 165), title_txt, fill=(255, 255, 255), font=font_ui, anchor="mm")

        r_img = apply_vignette(r_img, intensity=0.35)
        r_img.save(ranks_dir / fname, "JPEG", quality=92)


# ==============================================================================
# Game 2: Dynasty (球團王朝)
# ==============================================================================

def generate_dynasty_assets() -> None:
    print("-> Generating Dynasty assets...")
    out_dir = BASE_DIR / "Games/Dynasty/public"
    clubs_dir = out_dir / "clubs"
    staff_dir = out_dir / "staff"
    clubs_dir.mkdir(parents=True, exist_ok=True)
    staff_dir.mkdir(parents=True, exist_ok=True)

    font_seal = get_font(36, prefer_serif=True)
    font_large_seal = get_font(48, prefer_serif=True)
    font_ui = get_font(30, prefer_serif=False)

    # 2.1 title-bg.jpg: 1350x900 Grand General Manager Front Office War Room
    tw, th = 1350, 900
    war_room = Image.new('RGB', (tw, th), (8, 14, 18))
    wdraw = ImageDraw.Draw(war_room)

    # Atmospheric twilight stadium panorama seen through glass windows
    for y in range(th):
        rat = y / float(th)
        r = int(6 * (1.0 - rat) + 16 * rat)
        g = int(14 * (1.0 - rat) + 32 * rat)
        b = int(24 * (1.0 - rat) + 22 * rat)
        wdraw.line([(0, y), (tw, y)], fill=(r, g, b))

    # Stadium floodlights shining through window
    for lx in [250, tw - 250]:
        wdraw.ellipse([lx - 90, 80, lx + 90, 160], fill=(254, 240, 138))
        # Beam cast downwards
        wdraw.polygon([(lx - 40, 160), (lx - 250, th), (lx + 250, th), (lx + 40, 160)], fill=(20, 45, 40))

    # Window mullions & architectural frame
    mullion_col = (18, 26, 32)
    wdraw.rectangle([0, 0, tw, 30], fill=mullion_col)
    wdraw.line([(tw // 3, 0), (tw // 3, th)], fill=mullion_col, width=16)
    wdraw.line([(tw * 2 // 3, 0), (tw * 2 // 3, th)], fill=mullion_col, width=16)
    wdraw.line([(0, int(th * 0.45)), (tw, int(th * 0.45))], fill=mullion_col, width=14)

    # Executive War Room table at bottom
    table_y = int(th * 0.72)
    wdraw.polygon([(0, th), (tw, th), (tw, table_y), (0, table_y + 40)], fill=(28, 20, 16))
    wdraw.line([(0, table_y + 40), (tw, table_y)], fill=(80, 55, 40), width=4)

    # Tactical strategy tablet & clipboards on desk
    wdraw.rectangle([tw // 2 - 180, table_y + 50, tw // 2 + 180, th - 20], fill=(12, 16, 22), outline=(52, 211, 153), width=3)
    wdraw.text((tw // 2, table_y + 80), "戰術決策戰情台", fill=(52, 211, 153), font=font_ui, anchor="mm")

    war_room = apply_vignette(war_room, intensity=0.4)
    war_room.save(out_dir / "title-bg.jpg", "JPEG", quality=92)

    # 2.2 stadium-night.jpg: 1350x900 Championship stadium night lights
    stadium = Image.new('RGB', (tw, th), (10, 18, 28))
    sdraw = ImageDraw.Draw(stadium)
    # Sky dome
    for y in range(int(th * 0.55)):
        r = int(12 + y * 0.05)
        g = int(24 + y * 0.08)
        b = int(48 + y * 0.06)
        sdraw.line([(0, y), (tw, y)], fill=(r, g, b))

    # Grandstand silhouettes with thousands of spectator flashbulbs
    stand_top = int(th * 0.35)
    sdraw.rectangle([0, stand_top, tw, int(th * 0.55)], fill=(18, 24, 36))
    for _ in range(350):
        fx = random.randint(0, tw)
        fy = random.randint(stand_top, int(th * 0.55))
        sdraw.ellipse([fx - 1, fy - 1, fx + 1, fy + 1], fill=(255, 255, 220))

    # Immaculate diamond infield turf
    sdraw.polygon([(0, th), (tw, th), (tw, int(th * 0.55)), (0, int(th * 0.55))], fill=(20, 83, 45))
    # Infield clay diamond
    icx, icy = tw // 2, int(th * 0.78)
    sdraw.polygon([(icx, icy - 140), (icx + 220, icy), (icx, icy + 90), (icx - 220, icy)], fill=(180, 83, 9))
    sdraw.polygon([(icx, icy - 100), (icx + 160, icy), (icx, icy + 60), (icx - 160, icy)], fill=(22, 101, 52))

    stadium = apply_vignette(stadium, intensity=0.35)
    stadium.save(out_dir / "stadium-night.jpg", "JPEG", quality=92)

    # 2.3 trophy.jpg: 512x512 Taiwan Series Championship Golden Trophy
    trophy = Image.new('RGB', (512, 512), (16, 12, 8))
    tdraw = ImageDraw.Draw(trophy)
    tcx, tcy = 256, 256

    # Radial golden aura
    for r in range(220, 40, -10):
        tdraw.ellipse([tcx - r, tcy - r, tcx + r, tcy + r], fill=(45, 30 + r // 10, 10))

    # Ornate trophy cup body
    cup_top = tcy - 120
    cup_bottom = tcy + 50
    tdraw.polygon([(tcx - 90, cup_top), (tcx + 90, cup_top), (tcx + 55, cup_bottom), (tcx - 55, cup_bottom)], fill=(245, 158, 11), outline=(254, 240, 138), width=4)
    # Cup handles
    tdraw.arc([tcx - 130, cup_top + 10, tcx - 50, cup_bottom - 20], 90, 270, fill=(254, 240, 138), width=8)
    tdraw.arc([tcx + 50, cup_top + 10, tcx + 130, cup_bottom - 20], 270, 90, fill=(254, 240, 138), width=8)

    # Stem and pedestal
    tdraw.rectangle([tcx - 20, cup_bottom, tcx + 20, cup_bottom + 50], fill=(217, 119, 6), outline=(254, 240, 138), width=2)
    tdraw.rectangle([tcx - 80, cup_bottom + 50, tcx + 80, cup_bottom + 100], fill=(120, 53, 15), outline=(254, 240, 138), width=4)

    # Baseball sphere crowning the trophy
    tdraw.ellipse([tcx - 45, cup_top - 65, tcx + 45, cup_top + 25], fill=(255, 255, 255), outline=(245, 158, 11), width=4)
    # Seams on baseball
    tdraw.arc([tcx - 40, cup_top - 55, tcx - 5, cup_top + 15], 280, 80, fill=(220, 38, 38), width=3)
    tdraw.arc([tcx + 5, cup_top - 55, tcx + 40, cup_top + 15], 100, 260, fill=(220, 38, 38), width=3)

    # Center trophy seal
    draw_seal(tdraw, "冠", tcx, cup_bottom + 75, size=46, font=font_seal, fill=(180, 83, 9), border=(254, 240, 138))
    trophy = apply_vignette(trophy, intensity=0.3)
    trophy.save(out_dir / "trophy.jpg", "JPEG", quality=92)

    # 2.4 Dedicated 6 CPBL Club Heraldic Emblems (512x512)
    club_defs = [
        ("lions.jpg", "獅", "南方猛獅", (245, 158, 11), (30, 58, 138), (15, 23, 42)),
        ("angels.jpg", "天", "桃園天使", (56, 189, 248), (250, 204, 21), (12, 28, 48)),
        ("cannons.jpg", "砲", "台中巨砲", (220, 38, 38), (148, 163, 184), (35, 12, 14)),
        ("eagles.jpg", "鷹", "台南飛鷹", (16, 185, 129), (245, 158, 11), (10, 35, 25)),
        ("dolphins.jpg", "豚", "新北海豚", (6, 182, 212), (59, 130, 246), (8, 25, 45)),
        ("volcano.jpg", "炎", "高雄火山", (234, 88, 12), (239, 68, 68), (38, 15, 10)),
    ]

    for fname, seal_txt, club_name, p_col, s_col, bg_col in club_defs:
        c_img = Image.new('RGB', (512, 512), bg_col)
        cdraw = ImageDraw.Draw(c_img)
        ccx, ccy = 256, 256

        # Heraldic shield outline
        shield_pts = [
            (ccx - 170, ccy - 180),
            (ccx + 170, ccy - 180),
            (ccx + 170, ccy + 40),
            (ccx, ccy + 210),
            (ccx - 170, ccy + 40),
        ]
        cdraw.polygon(shield_pts, fill=(20, 25, 35), outline=p_col, width=8)

        inner_shield = [
            (ccx - 152, ccy - 165),
            (ccx + 152, ccy - 165),
            (ccx + 152, ccy + 35),
            (ccx, ccy + 190),
            (ccx - 152, ccy + 35),
        ]
        cdraw.polygon(inner_shield, outline=s_col, width=3)

        # Baseball stitches across shield
        cdraw.ellipse([ccx - 110, ccy - 110, ccx + 110, ccy + 110], fill=(28, 35, 48), outline=p_col, width=4)
        cdraw.arc([ccx - 100, ccy - 100, ccx - 20, ccy + 100], 290, 70, fill=s_col, width=3)
        cdraw.arc([ccx + 20, ccy - 100, ccx + 100, ccy + 100], 110, 250, fill=s_col, width=3)

        # Club Traditional Chinese seal in center
        draw_seal(cdraw, seal_txt, ccx, ccy, size=92, font=font_large_seal, fill=p_col, border=(255, 255, 255))

        # Club name banner
        cdraw.rectangle([ccx - 130, ccy + 130, ccx + 130, ccy + 175], fill=(12, 16, 24), outline=p_col, width=2)
        cdraw.text((ccx, ccy + 152), club_name, fill=(255, 255, 255), font=font_ui, anchor="mm")

        c_img = apply_vignette(c_img, intensity=0.3)
        c_img.save(clubs_dir / fname, "JPEG", quality=92)

    # 2.5 Front Office Key Staff Portraits (512x512)
    staff_defs = [
        ("gm.jpg", "總", "球團總經理", (52, 211, 153), (15, 23, 42)),
        ("scout.jpg", "探", "首席球探", (245, 158, 11), (25, 20, 15)),
        ("owner.jpg", "董", "球團董事長", (217, 70, 239), (28, 15, 35)),
    ]

    for fname, seal_txt, role_name, accent_col, bg_col in staff_defs:
        st_img = Image.new('RGB', (512, 512), bg_col)
        sdraw = ImageDraw.Draw(st_img)
        scx, scy = 256, 256

        # Executive portrait frame
        sdraw.ellipse([scx - 190, scy - 190, scx + 190, scy + 190], fill=(20, 28, 38), outline=accent_col, width=6)
        sdraw.ellipse([scx - 176, scy - 176, scx + 176, scy + 176], outline=(148, 163, 184), width=2)

        # Silhouette torso & shoulders
        sdraw.polygon([(scx - 110, scy + 160), (scx + 110, scy + 160), (scx + 75, scy + 30), (scx - 75, scy + 30)], fill=(35, 45, 60))
        # Head / face silhouette
        sdraw.ellipse([scx - 55, scy - 85, scx + 55, scy + 35], fill=(240, 210, 180))

        # Tie & lapel collar
        sdraw.polygon([(scx - 25, scy + 35), (scx + 25, scy + 35), (scx, scy + 120)], fill=accent_col)

        # Traditional Chinese seal stamp on portrait
        draw_seal(sdraw, seal_txt, scx + 110, scy - 100, size=72, font=font_large_seal, fill=accent_col, border=(255, 255, 255))

        # Role label bar
        sdraw.rectangle([scx - 130, scy + 130, scx + 130, scy + 175], fill=(10, 14, 22), outline=accent_col, width=2)
        sdraw.text((scx, scy + 152), role_name, fill=(255, 255, 255), font=font_ui, anchor="mm")

        st_img = apply_vignette(st_img, intensity=0.3)
        st_img.save(staff_dir / fname, "JPEG", quality=92)


# ==============================================================================
# Game 3: Mystery-Liquid-Sort (神秘液體排序)
# ==============================================================================

def generate_mystery_liquid_sort_assets() -> None:
    print("-> Generating Mystery-Liquid-Sort assets...")
    out_dir = BASE_DIR / "Games/Mystery-Liquid-Sort/public"
    bg_dir = out_dir / "backgrounds"
    reagents_dir = out_dir / "reagents"
    bg_dir.mkdir(parents=True, exist_ok=True)
    reagents_dir.mkdir(parents=True, exist_ok=True)

    font_seal = get_font(36, prefer_serif=True)
    font_large_seal = get_font(48, prefer_serif=True)
    font_ui = get_font(28, prefer_serif=False)

    # 3.1 alchemy-hero.jpg: 1350x900 Grand Alchemical Synthesizer Laboratory
    lw, lh = 1350, 900
    lab = Image.new('RGB', (lw, lh), (10, 12, 22))
    ldraw = ImageDraw.Draw(lab)

    # Ambient deep laboratory gradient
    for y in range(lh):
        rat = y / float(lh)
        r = int(14 * (1.0 - rat) + 8 * rat)
        g = int(18 * (1.0 - rat) + 26 * rat)
        b = int(36 * (1.0 - rat) + 40 * rat)
        ldraw.line([(0, y), (lw, y)], fill=(r, g, b))

    # Shelves with glowing multi-colored alchemical glass flasks
    for s_y in [180, 360]:
        ldraw.line([(0, s_y), (lw, s_y)], fill=(75, 55, 40), width=12)
        ldraw.line([(0, s_y - 6), (lw, s_y - 6)], fill=(120, 85, 55), width=2)
        # Flasks on shelves
        for fx in range(90, lw - 90, 110):
            flask_h = random.choice([Color.RED if 'Color' in globals() else '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'])
            # Flask silhouette
            ldraw.ellipse([fx - 22, s_y - 60, fx + 22, s_y - 10], fill=(30, 40, 60), outline=(200, 220, 255), width=2)
            ldraw.rectangle([fx - 8, s_y - 80, fx + 8, s_y - 50], fill=(30, 40, 60), outline=(200, 220, 255), width=1)

    # Central giant glowing alchemical distillation matrix
    lcx, lcy = lw // 2, int(lh * 0.58)
    for r in range(240, 40, -15):
        ldraw.ellipse([lcx - r, lcy - r, lcx + r, lcy + r], fill=(20, 35 + r // 10, 60 + r // 8))

    # Glass condenser coil spiraling across center
    for i in range(12):
        coil_y = lcy - 120 + i * 20
        ldraw.arc([lcx - 70, coil_y, lcx + 70, coil_y + 35], 0, 180, fill=(147, 197, 253), width=4)

    lab = apply_vignette(lab, intensity=0.45)
    lab.save(out_dir / "alchemy-hero.jpg", "JPEG", quality=92)

    # 3.2 rack-wood.jpg: 1024x1024 Tactile polished mahogany test tube laboratory rack
    rw, rh = 1024, 1024
    rack = Image.new('RGB', (rw, rh), (45, 24, 16))
    rdraw = ImageDraw.Draw(rack)

    # Mahogany wood grain horizontal streaks
    for y in range(rh):
        grain = int(12 * math.sin(y * 0.05) + 6 * math.sin(y * 0.18))
        r = min(255, max(0, 55 + grain))
        g = min(255, max(0, 28 + grain // 2))
        b = min(255, max(0, 18 + grain // 3))
        rdraw.line([(0, y), (rw, y)], fill=(r, g, b))

    # Circular routed tube sockets with bevel shadows
    for row in range(3):
        ry = 180 + row * 280
        for col in range(4):
            rx = 160 + col * 230
            # Bevel shadow
            rdraw.ellipse([rx - 65, ry - 65, rx + 65, ry + 65], fill=(25, 12, 8), outline=(90, 50, 35), width=4)
            rdraw.ellipse([rx - 55, ry - 55, rx + 55, ry + 55], fill=(15, 8, 5))
            # Brass ring around socket
            rdraw.ellipse([rx - 70, ry - 70, rx + 70, ry + 70], outline=(245, 158, 11), width=2)

    rack = apply_vignette(rack, intensity=0.3)
    rack.save(out_dir / "rack-wood.jpg", "JPEG", quality=92)

    # 3.3 glass-texture.jpg: 512x512 High-purity borosilicate glass test tube texture
    gw, gh = 512, 512
    glass = Image.new('RGB', (gw, gh), (18, 26, 36))
    gdraw = ImageDraw.Draw(glass)

    # Vertical cylindrical reflections & meniscus highlights
    for x in range(gw):
        t = abs(x - gw / 2.0) / (gw / 2.0)
        # Specular edge highlights
        alpha = int(80 * (t ** 2.5))
        gdraw.line([(x, 0), (x, gh)], fill=(20 + alpha, 30 + alpha, 45 + alpha * 2))

    # Etched volumetric graduation ticks (ml scale)
    for ml in range(20, 480, 20):
        w = 40 if ml % 100 == 0 else 20
        gdraw.line([(60, ml), (60 + w, ml)], fill=(226, 232, 240), width=2)
        if ml % 100 == 0:
            gdraw.text((60 + w + 10, ml), f"{ml}ml", fill=(203, 213, 225), font=font_seal, anchor="lm")

    glass.save(out_dir / "glass-texture.jpg", "JPEG", quality=92)

    # 3.4 Reagent Emblems (512x512)
    reagent_defs = [
        ("reagent-crimson.jpg", "緋", "緋紅之淚", (239, 68, 68), (254, 202, 202), (35, 12, 14)),
        ("reagent-azure.jpg", "湛", "湛藍精萃", (59, 130, 246), (191, 219, 254), (10, 20, 40)),
        ("reagent-emerald.jpg", "翠", "翠綠靈露", (16, 185, 129), (167, 243, 208), (8, 32, 20)),
        ("reagent-amber.jpg", "澄", "澄黃琥珀", (245, 158, 11), (254, 240, 138), (38, 26, 8)),
        ("reagent-amethyst.jpg", "紫", "紫晶星塵", (168, 85, 247), (233, 213, 255), (28, 12, 38)),
        ("reagent-cyan.jpg", "碧", "青碧冰魄", (6, 182, 212), (165, 243, 252), (8, 30, 38)),
        ("reagent-orange.jpg", "橙", "暖橙精油", (249, 115, 22), (254, 215, 170), (40, 20, 8)),
    ]

    for fname, seal_txt, r_name, p_col, s_col, bg_col in reagent_defs:
        r_img = Image.new('RGB', (512, 512), bg_col)
        rdraw = ImageDraw.Draw(r_img)
        rcx, rcy = 256, 256

        # Circular ornate reagent seal
        rdraw.ellipse([rcx - 200, rcy - 200, rcx + 200, rcy + 200], fill=(16, 20, 30), outline=p_col, width=6)
        rdraw.ellipse([rcx - 185, rcy - 185, rcx + 185, rcy + 185], outline=s_col, width=2)

        # Droplet / Flask motif
        drop_top = (rcx, rcy - 120)
        drop_bl = (rcx - 80, rcy + 40)
        drop_br = (rcx + 80, rcy + 40)
        rdraw.polygon([drop_top, drop_bl, (rcx, rcy + 90), drop_br], fill=(*p_col, 120))
        rdraw.ellipse([rcx - 80, rcy - 30, rcx + 80, rcy + 90], fill=p_col)

        # Seal in center
        draw_seal(rdraw, seal_txt, rcx, rcy + 20, size=76, font=font_large_seal, fill=p_col, border=s_col)

        # Name label
        rdraw.rectangle([rcx - 120, rcy + 130, rcx + 120, rcy + 175], fill=(12, 16, 24), outline=p_col, width=2)
        rdraw.text((rcx, rcy + 152), r_name, fill=(255, 255, 255), font=font_ui, anchor="mm")

        r_img = apply_vignette(r_img, intensity=0.3)
        r_img.save(reagents_dir / fname, "JPEG", quality=92)

    # 3.5 Upgrade high-resolution thematic backdrops (1350x900)
    bg_defs = [
        ("alchemy-lab.jpg", (15, 20, 35), (168, 85, 247), "鍊金實驗室"),
        ("neon-arcade.jpg", (25, 10, 30), (236, 72, 153), "霓虹電玩城"),
        ("aquarium.jpg", (8, 28, 48), (6, 182, 212), "深海水族館"),
        ("candy-shop.jpg", (38, 16, 28), (244, 114, 182), "夢幻糖果屋"),
        ("neon-rooftop.jpg", (12, 16, 32), (59, 130, 246), "夜景天台"),
        ("taiwan-night-market.jpg", (32, 18, 10), (234, 88, 12), "台灣夜市"),
        ("taipei-street.jpg", (20, 24, 34), (56, 189, 248), "台北街景"),
        ("taiwan-alley.jpg", (28, 22, 18), (245, 158, 11), "老街巷弄"),
        ("bamboo-garden.jpg", (10, 28, 20), (34, 197, 94), "青翠竹林"),
    ]

    for fname, base_col, neon_col, title_txt in bg_defs:
        b_img = Image.new('RGB', (1350, 900), base_col)
        bdraw = ImageDraw.Draw(b_img)

        for y in range(900):
            rat = y / 900.0
            r = int(base_col[0] * (1.2 - rat * 0.4))
            g = int(base_col[1] * (1.2 - rat * 0.4))
            b = int(base_col[2] * (1.2 - rat * 0.4))
            bdraw.line([(0, y), (1350, y)], fill=(r, g, b))

        # Ambient decorative geometric silhouettes
        for step in range(8):
            bdraw.line([(step * 180, 0), (step * 180 + 200, 900)], fill=(*neon_col, 35), width=2)

        # Distant soft neon orbs
        for _ in range(6):
            ox = random.randint(100, 1250)
            oy = random.randint(150, 650)
            orad = random.randint(60, 140)
            bdraw.ellipse([ox - orad, oy - orad, ox + orad, oy + orad], fill=(*neon_col, 20))

        b_img = apply_vignette(b_img, intensity=0.4)
        b_img.save(bg_dir / fname, "JPEG", quality=90)


# ==============================================================================
# Game 4: Sailing (海灣帆航)
# ==============================================================================

def generate_sailing_assets() -> None:
    print("-> Generating Sailing assets...")
    out_dir = BASE_DIR / "Games/Sailing/public"
    tex_dir = out_dir / "textures"
    portraits_dir = out_dir / "portraits"
    tex_dir.mkdir(parents=True, exist_ok=True)
    portraits_dir.mkdir(parents=True, exist_ok=True)

    font_seal = get_font(36, prefer_serif=True)
    font_large_seal = get_font(48, prefer_serif=True)
    font_ui = get_font(28, prefer_serif=False)

    # 4.1 menu-bg.jpg: 1350x900 Grand America's Cup coastal championship regatta hero
    sw, sh = 1350, 900
    regatta = Image.new('RGB', (sw, sh), (12, 35, 65))
    sdraw = ImageDraw.Draw(regatta)

    # Sky gradient down to sea horizon
    horizon_y = int(sh * 0.52)
    for y in range(horizon_y):
        t = y / float(horizon_y)
        r = int(50 * (1.0 - t) + 160 * t)
        g = int(120 * (1.0 - t) + 200 * t)
        b = int(210 * (1.0 - t) + 245 * t)
        sdraw.line([(0, y), (sw, y)], fill=(r, g, b))

    # Dramatic coastal headland & lighthouse on the right
    sdraw.polygon([(sw - 380, horizon_y), (sw, horizon_y - 120), (sw, horizon_y)], fill=(30, 48, 55))
    # Lighthouse
    lh_x = sw - 120
    sdraw.rectangle([lh_x - 14, horizon_y - 210, lh_x + 14, horizon_y - 120], fill=(240, 240, 245), outline=(180, 40, 40), width=3)
    sdraw.polygon([(lh_x - 18, horizon_y - 210), (lh_x + 18, horizon_y - 210), (lh_x, horizon_y - 235)], fill=(180, 40, 40))

    # Sea ocean gradient with Gerstner wave crests
    for y in range(horizon_y, sh):
        t = (y - horizon_y) / float(sh - horizon_y)
        r = int(14 * (1.0 - t) + 6 * t)
        g = int(75 * (1.0 - t) + 40 * t)
        b = int(120 * (1.0 - t) + 70 * t)
        sdraw.line([(0, y), (sw, y)], fill=(r, g, b))

    # White-cap foam ripples on sea
    for wave in range(60):
        wx = random.randint(0, sw)
        wy = random.randint(horizon_y + 10, sh)
        ww = random.randint(30, 120)
        sdraw.arc([wx - ww // 2, wy - 3, wx + ww // 2, wy + 3], 0, 180, fill=(230, 245, 255), width=2)

    # Majestic racing yacht hull and twin billowing sails
    bx, by = int(sw * 0.42), int(sh * 0.62)
    # Sleek dark blue racing hull
    sdraw.polygon([(bx - 160, by + 45), (bx + 190, by + 20), (bx + 140, by + 55), (bx - 130, by + 65)], fill=(15, 23, 42), outline=(56, 189, 248), width=3)
    # Main Mast
    mast_top = (bx - 10, by - 360)
    sdraw.line([(bx - 10, by + 30), mast_top], fill=(220, 225, 230), width=6)
    # Mainsail
    sdraw.polygon([mast_top, (bx - 140, by + 10), (bx - 10, by + 25)], fill=(245, 245, 240), outline=(148, 163, 184), width=2)
    # Jib / Spinnaker sail
    sdraw.polygon([mast_top, (bx + 170, by + 15), (bx + 20, by + 25)], fill=(254, 240, 138), outline=(217, 119, 6), width=2)

    regatta = apply_vignette(regatta, intensity=0.35)
    regatta.save(out_dir / "menu-bg.jpg", "JPEG", quality=92)

    # 4.2 deck.png: 1024x1024 Luxury teak marine deck texture
    dw, dh = 1024, 1024
    deck = Image.new('RGB', (dw, dh), (180, 135, 85))
    ddraw = ImageDraw.Draw(deck)

    plank_w = 64
    for px in range(0, dw, plank_w):
        # Dark caulking seam
        ddraw.line([(px, 0), (px, dh)], fill=(40, 28, 20), width=4)
        # Teak wood grain within plank
        for x_offset in range(4, plank_w - 4):
            x_pos = px + x_offset
            # Subtle grain noise
            for y in range(dh):
                g_noise = int(8 * math.sin(y * 0.08 + px))
                r = min(255, max(0, 185 + g_noise))
                g = min(255, max(0, 140 + g_noise))
                b = min(255, max(0, 90 + g_noise))
                ddraw.point((x_pos, y), fill=(r, g, b))

    deck.save(tex_dir / "deck.png", "PNG")

    # 4.3 ripples.png: 1024x1024 High-frequency ocean surface micro-caustics
    ripples = Image.new('RGB', (1024, 1024), (128, 128, 255))
    rdraw = ImageDraw.Draw(ripples)
    for _ in range(800):
        rx = random.randint(0, 1024)
        ry = random.randint(0, 1024)
        rw = random.randint(20, 80)
        rh = random.randint(6, 25)
        # Normal map tint for wave facets
        rdraw.ellipse([rx - rw, ry - rh, rx + rw, ry + rh], outline=(140, 120, 245), width=2)
    ripples = ripples.filter(ImageFilter.GaussianBlur(3.0))
    ripples.save(tex_dir / "ripples.png", "PNG")

    # 4.4 sail.png: 1024x1024 High-tech racing carbon-fiber ripstop grid weave
    sail = Image.new('RGB', (1024, 1024), (242, 244, 246))
    sdraw_tex = ImageDraw.Draw(sail)
    # Carbon fiber ripstop grid
    grid_size = 32
    for x in range(0, 1024, grid_size):
        sdraw_tex.line([(x, 0), (x, 1024)], fill=(210, 215, 222), width=1)
    for y in range(0, 1024, grid_size):
        sdraw_tex.line([(0, y), (1024, y)], fill=(210, 215, 222), width=1)
    # Kevlar structural load path curved strands
    for k in range(8):
        sdraw_tex.arc([100, -200 + k * 120, 924, 800 + k * 120], 30, 150, fill=(245, 158, 11), width=3)
    sail.save(tex_dir / "sail.png", "PNG")

    # 4.5 sky.png: 2048x1024 Ultra-wide panoramic marine sky
    skw, skh = 2048, 1024
    sky = Image.new('RGB', (skw, skh), (110, 160, 225))
    skdraw = ImageDraw.Draw(sky)
    for y in range(skh):
        t = y / float(skh)
        r = int(55 * (1.0 - t) + 210 * t)
        g = int(120 * (1.0 - t) + 230 * t)
        b = int(205 * (1.0 - t) + 250 * t)
        skdraw.line([(0, y), (skw, y)], fill=(r, g, b))
    # Soft cumulus clouds near horizon
    for _ in range(35):
        cx = random.randint(0, skw)
        cy = random.randint(int(skh * 0.45), int(skh * 0.85))
        c_rad = random.randint(80, 220)
        skdraw.ellipse([cx - c_rad, cy - c_rad // 3, cx + c_rad, cy + c_rad // 3], fill=(255, 255, 255))
    sky = sky.filter(ImageFilter.GaussianBlur(12.0))
    sky.save(tex_dir / "sky.png", "PNG")

    # 4.6 Dedicated Skipper Portraits & Regatta Cup (512x512)
    skipper_defs = [
        ("player.jpg", "航", "船長", (56, 189, 248), (15, 23, 42)),
        ("breeze.jpg", "微", "微風", (147, 197, 253), (12, 35, 55)),
        ("reach.jpg", "疾", "橫風手", (245, 158, 11), (35, 28, 12)),
        ("gale.jpg", "烈", "烈風", (239, 68, 68), (38, 14, 16)),
        ("regatta-cup.jpg", "盃", "海灣盃金盃", (250, 204, 21), (25, 20, 10)),
    ]

    for fname, seal_txt, role_name, accent_col, bg_col in skipper_defs:
        p_img = Image.new('RGB', (512, 512), bg_col)
        pdraw = ImageDraw.Draw(p_img)
        pcx, pcy = 256, 256

        # Marine helm wheel border
        pdraw.ellipse([pcx - 195, pcy - 195, pcx + 195, pcy + 195], fill=(20, 28, 42), outline=accent_col, width=6)
        pdraw.ellipse([pcx - 180, pcy - 180, pcx + 180, pcy + 180], outline=(148, 163, 184), width=2)
        # Helm spokes
        for spk in range(8):
            ang = math.radians(spk * 45)
            pdraw.line([(pcx + int(180 * math.cos(ang)), pcy + int(180 * math.sin(ang))),
                        (pcx + int(220 * math.cos(ang)), pcy + int(220 * math.sin(ang)))], fill=accent_col, width=6)

        if fname == "regatta-cup.jpg":
            # Trophy illustration
            pdraw.polygon([(pcx - 70, pcy - 90), (pcx + 70, pcy - 90), (pcx + 40, pcy + 40), (pcx - 40, pcy + 40)], fill=(245, 158, 11), outline=(254, 240, 138), width=3)
            pdraw.rectangle([pcx - 60, pcy + 40, pcx + 60, pcy + 90], fill=(120, 53, 15), outline=(254, 240, 138), width=3)
        else:
            # Skipper profile silhouette
            pdraw.polygon([(pcx - 100, pcy + 160), (pcx + 100, pcy + 160), (pcx + 65, pcy + 30), (pcx - 65, pcy + 30)], fill=(32, 45, 65))
            # Head with captain cap
            pdraw.ellipse([pcx - 50, pcy - 75, pcx + 50, pcy + 35], fill=(240, 210, 180))
            # Captain cap visor
            pdraw.rectangle([pcx - 55, pcy - 85, pcx + 55, pcy - 60], fill=(15, 23, 42))

        # Seal
        draw_seal(pdraw, seal_txt, pcx + 110, pcy - 90, size=72, font=font_large_seal, fill=accent_col, border=(255, 255, 255))

        # Label
        pdraw.rectangle([pcx - 120, pcy + 130, pcx + 120, pcy + 175], fill=(12, 16, 26), outline=accent_col, width=2)
        pdraw.text((pcx, pcy + 152), role_name, fill=(255, 255, 255), font=font_ui, anchor="mm")

        p_img = apply_vignette(p_img, intensity=0.3)
        p_img.save(portraits_dir / fname, "JPEG", quality=92)


# ==============================================================================
# Main Orchestrator
# ==============================================================================

def main() -> None:
    print("=== Wave 15 Art Generator Started ===")
    generate_dialed_color_assets()
    generate_dynasty_assets()
    generate_mystery_liquid_sort_assets()
    generate_sailing_assets()
    print("=== Wave 15 Art Generation Completed Successfully ===")


if __name__ == '__main__':
    main()
