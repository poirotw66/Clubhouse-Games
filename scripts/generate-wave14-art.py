#!/usr/bin/env python3
"""
Wave 14 Multi-Battleground Art Generator
Generates high-resolution, tactile game assets adhering to Sakurai game design principles for:
- Clockwork-Keep (1350x900 Victorian steampunk citadel setup background, 1024x1024 riveted mechanical grid pavers,
                  1024x1024 steampunk tower icons: crossbow, grinder, frost, coil, hammer, mortar;
                  512x512 mechanical enemy portraits: grunt, runner, ironclad, kite, gearbug, bloater, shellbug, boss)
- Toy-Boxing (1350x900 championship toy boxing stadium dome, 1350x900 professional ring canvas floor,
              512x512 toy boxer portraits: bot, bear, bunny, dino, and 6 league opponents: pillow, rush, needle, feint, ironbelly, champ;
              600x900 textured fighter bodies for all 4 playable toys and 6 league opponents)
- Instant-Flash (1350x900 sunset Japanese dojo arena background, 1350x900 dark cypress wood & tatami floor,
                 600x900 player & shadow duelist sprites, 512x512 player portrait,
                 512x512 ukiyo-e opponent portraits & 600x900 battle sprites: ronin, bait, delay, surge, mirror, twin, chaos, master;
                 512x512 forged ninja projectiles: shuriken, kunai, bomb, sickle)
- Coin-Cascade (1350x900 grand retro-arcade casino marquee title background, 1024x1024 brushed aerospace chrome pusher plate,
                1024x1024 luxury polished mahogany & acrylic tray shelf, 512x512 high-relief 3D embossed golden medallion coin)

Architectural justification: High-fidelity procedural asset generation for 4 games in Wave 14
requires rich mathematical drawing routines, vector rendering, and localized font typography
within a single deterministic, reproducible generation pipeline, mirroring Wave 10, Wave 11, Wave 12, and Wave 13.
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


def draw_gear(
    draw: ImageDraw.ImageDraw,
    cx: float,
    cy: float,
    radius: float,
    teeth: int = 12,
    tooth_depth: float = 16.0,
    hole_radius: float = 0.0,
    fill: tuple[int, int, int] = (180, 140, 80),
    outline: tuple[int, int, int] = (240, 200, 130),
    width: int = 2,
    rotation: float = 0.0,
):
    """Draw a detailed mechanical gear with trapezoidal teeth and central bore hole."""
    points = []
    num_pts = teeth * 4
    for i in range(num_pts):
        angle = rotation + (i / float(num_pts)) * 2 * math.pi
        tooth_phase = i % 4
        if tooth_phase in (1, 2):
            r = radius + tooth_depth
        else:
            r = radius
        px = cx + r * math.cos(angle)
        py = cy + r * math.sin(angle)
        points.append((px, py))

    draw.polygon(points, fill=fill, outline=outline)
    if width > 1:
        draw.line(points + [points[0]], fill=outline, width=width)

    # Inner recessed gear face ring
    if radius > 30:
        r_inner = radius * 0.72
        draw.ellipse([cx - r_inner, cy - r_inner, cx + r_inner, cy + r_inner], outline=outline, width=width)

    # Central hole
    if hole_radius > 0:
        draw.ellipse([cx - hole_radius, cy - hole_radius, cx + hole_radius, cy + hole_radius], fill=(20, 24, 32), outline=outline, width=width)
        # Axle keyway notch
        kw = hole_radius * 0.4
        draw.rectangle([cx - kw / 2, cy - hole_radius - kw, cx + kw / 2, cy - hole_radius + 2], fill=(20, 24, 32))


def draw_rivets(draw: ImageDraw.ImageDraw, coords: list[tuple[float, float]], r: float = 6.0, fill: tuple[int, int, int] = (210, 180, 120), outline: tuple[int, int, int] = (60, 45, 25)):
    """Draw industrial domed rivets with highlight and shadow."""
    for rx, ry in coords:
        draw.ellipse([rx - r, ry - r, rx + r, ry + r], fill=outline)
        draw.ellipse([rx - r + 1, ry - r + 1, rx + r - 1, ry + r - 1], fill=fill)
        draw.ellipse([rx - r * 0.4, ry - r * 0.4, rx - r * 0.1, ry - r * 0.1], fill=(255, 255, 255, 180))


# ==============================================================================
# 1. Clockwork-Keep Assets
# ==============================================================================

def generate_clockwork_keep_assets():
    print("Generating Clockwork-Keep assets...")
    out_dir = "Games/Clockwork-Keep/public"
    towers_dir = os.path.join(out_dir, "towers")
    enemies_dir = os.path.join(out_dir, "enemies")
    os.makedirs(towers_dir, exist_ok=True)
    os.makedirs(enemies_dir, exist_ok=True)

    font_title = get_font(44, prefer_serif=False)
    font_sub = get_font(22, prefer_serif=False)
    font_seal = get_font(28, prefer_serif=True)
    font_large_seal = get_font(48, prefer_serif=True)

    # 1.1 Setup Background (1350x900): Victorian Steampunk Clockwork Citadel & Master Workshop
    w, h = 1350, 900
    setup_bg = Image.new('RGB', (w, h), (18, 14, 24))
    draw = ImageDraw.Draw(setup_bg)

    # Deep twilight sunset gradient behind industrial arched observatory windows
    for y in range(h):
        ratio = y / float(h)
        r = int(22 + 45 * ratio + 30 * math.sin(ratio * math.pi))
        g = int(18 + 25 * ratio + 20 * math.sin(ratio * math.pi))
        b = int(32 + 15 * ratio)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    # Grand arched cathedral-style observatory window frames
    for i in range(3):
        win_cx = 250 + i * 420
        win_w = 340
        win_h = 580
        # Arch top
        draw.arc([win_cx - win_w / 2, 40, win_cx + win_w / 2, 40 + win_w], 180, 360, fill=(45, 35, 30), width=14)
        draw.line([(win_cx - win_w / 2, 40 + win_w / 2), (win_cx - win_w / 2, win_h)], fill=(45, 35, 30), width=14)
        draw.line([(win_cx + win_w / 2, 40 + win_w / 2), (win_cx + win_w / 2, win_h)], fill=(45, 35, 30), width=14)
        # Window mullions (vertical and horizontal brass bars)
        draw.line([(win_cx, 40), (win_cx, win_h)], fill=(65, 52, 40), width=6)
        draw.line([(win_cx - win_w / 2, 280), (win_cx + win_w / 2, 280)], fill=(65, 52, 40), width=6)
        draw.line([(win_cx - win_w / 2, 440), (win_cx + win_w / 2, 440)], fill=(65, 52, 40), width=6)

    # Silhouette of distant clockwork towers & smog stacks against sunset
    draw.polygon([(120, 480), (160, 240), (200, 480)], fill=(32, 24, 30))
    draw.rectangle([150, 360, 170, 480], fill=(28, 20, 26))
    draw.polygon([(820, 500), (860, 290), (900, 500)], fill=(30, 22, 28))
    draw.polygon([(1120, 510), (1170, 210), (1220, 510)], fill=(35, 26, 32))

    # Massive brass gears mounted inside the workshop observatory
    draw_gear(draw, 140, 680, radius=220, teeth=18, tooth_depth=35, hole_radius=60, fill=(120, 85, 45), outline=(190, 145, 80), width=4, rotation=0.2)
    draw_gear(draw, 380, 780, radius=160, teeth=14, tooth_depth=28, hole_radius=45, fill=(145, 105, 55), outline=(210, 165, 95), width=3, rotation=0.5)
    draw_gear(draw, 1220, 660, radius=240, teeth=20, tooth_depth=38, hole_radius=70, fill=(110, 80, 40), outline=(180, 135, 75), width=4, rotation=0.8)
    draw_gear(draw, 980, 760, radius=150, teeth=12, tooth_depth=26, hole_radius=40, fill=(135, 95, 50), outline=(200, 155, 90), width=3, rotation=0.1)

    # Steam pipes running along ceiling and floor
    draw.line([(0, 60), (w, 60)], fill=(160, 110, 60), width=18)
    draw.line([(0, 55), (w, 55)], fill=(220, 180, 110), width=4)
    draw.line([(0, 80), (w, 80)], fill=(120, 80, 40), width=12)

    # Pressure gauges on pipes
    for gx in [300, 720, 1080]:
        draw.ellipse([gx - 32, 60 - 32, gx + 32, 60 + 32], fill=(245, 235, 215), outline=(160, 110, 60), width=5)
        draw.ellipse([gx - 28, 60 - 28, gx + 28, 60 + 28], outline=(180, 140, 90), width=2)
        # Needle pointing in high pressure zone
        draw.line([(gx, 60), (gx + 16, 60 - 16)], fill=(220, 38, 38), width=3)
        draw.ellipse([gx - 5, 60 - 5, gx + 5, 60 + 5], fill=(40, 30, 20))

    # Foreground workbench tabletop (aged mahogany)
    draw.rectangle([0, 780, w, 900], fill=(42, 28, 20))
    draw.line([(0, 780), (w, 780)], fill=(180, 130, 70), width=5)
    draw.line([(0, 786), (w, 786)], fill=(80, 55, 35), width=2)

    # Blueprint schematics laid out on workbench
    draw.polygon([(460, 800), (880, 800), (910, 890), (430, 890)], fill=(20, 48, 85), outline=(60, 120, 190), width=2)
    # Blueprint grid & technical compass lines
    for bx in range(480, 870, 30):
        draw.line([(bx, 805), (bx - 20, 885)], fill=(35, 75, 130), width=1)
    for by in range(815, 885, 20):
        draw.line([(450, by), (895, by)], fill=(35, 75, 130), width=1)
    # Glowing vacuum tubes on right desk corner
    for tx in [1020, 1060, 1100]:
        draw.rectangle([tx - 10, 740, tx + 10, 785], fill=(254, 215, 170, 160), outline=(210, 160, 90), width=2)
        draw.ellipse([tx - 10, 730, tx + 10, 750], fill=(254, 240, 138), outline=(210, 160, 90), width=2)
        draw.line([(tx, 745), (tx, 775)], fill=(234, 88, 12), width=3)

    # Floating steam wisps and amber embers
    for _ in range(70):
        ex = random.randint(50, w - 50)
        ey = random.randint(100, 750)
        er = random.randint(2, 6)
        draw.ellipse([ex - er, ey - er, ex + er, ey + er], fill=(251, 191, 36, random.randint(60, 180)))

    # Title Banner Seal: 堡 (Clockwork Keep)
    draw_seal(draw, "堡", 1250, 120, size=72, font=font_large_seal, fill=(180, 83, 9), border=(251, 191, 36))

    setup_bg = apply_vignette(setup_bg, intensity=0.45)
    setup_bg.save(os.path.join(out_dir, "setup-bg.jpg"), "JPEG", quality=92)

    # 1.2 Board Floor (1024x1024): Riveted Mechanical Grid Pavers
    bw, bh = 1024, 1024
    board_floor = Image.new('RGB', (bw, bh), (28, 30, 36))
    bdraw = ImageDraw.Draw(board_floor)

    # Base grid tiles (16x16 modular tile texture)
    grid_count = 8
    tile_size = bw // grid_count
    for gy in range(grid_count):
        for gx in range(grid_count):
            tx0 = gx * tile_size
            ty0 = gy * tile_size
            tx1 = tx0 + tile_size
            ty1 = ty0 + tile_size
            # Subtle stone/iron tone variation
            val = 32 + ((gx * 7 + gy * 13) % 18)
            bdraw.rectangle([tx0, ty0, tx1, ty1], fill=(val, val + 2, val + 6), outline=(15, 17, 22), width=3)
            # Inner beveled border
            bdraw.rectangle([tx0 + 4, ty0 + 4, tx1 - 4, ty1 - 4], outline=(val + 18, val + 20, val + 24), width=1)

            # Center clockwork emblem or steam vent in alternating tiles
            if (gx + gy) % 2 == 0:
                cx, cy = (tx0 + tx1) / 2, (ty0 + ty1) / 2
                draw_gear(bdraw, cx, cy, radius=tile_size * 0.28, teeth=8, tooth_depth=6, hole_radius=8, fill=(70, 55, 40), outline=(130, 105, 65), width=2)
            else:
                # Ventilation grate slats
                for sy in range(ty0 + 24, ty1 - 24, 14):
                    bdraw.line([(tx0 + 20, sy), (tx1 - 20, sy)], fill=(14, 16, 20), width=4)
                    bdraw.line([(tx0 + 20, sy + 2), (tx1 - 20, sy + 2)], fill=(65, 75, 88), width=1)

            # Corner rivets for each tile
            rivets = [
                (tx0 + 10, ty0 + 10),
                (tx1 - 10, ty0 + 10),
                (tx0 + 10, ty1 - 10),
                (tx1 - 10, ty1 - 10),
            ]
            draw_rivets(bdraw, rivets, r=3.5, fill=(180, 150, 95), outline=(30, 25, 20))

    # Power conduits with subtle amber/cyan glow running along grid lines
    for cl in range(tile_size, bw, tile_size * 2):
        bdraw.line([(cl, 0), (cl, bh)], fill=(217, 119, 6), width=2)
        bdraw.line([(0, cl), (bw, cl)], fill=(56, 189, 248), width=2)

    board_floor = apply_vignette(board_floor, intensity=0.35)
    board_floor.save(os.path.join(out_dir, "board-floor.jpg"), "JPEG", quality=92)

    # 1.3 Six Tower Icons (1024x1024): High-resolution Steampunk Defensive Structures
    towers_data = [
        ('crossbow', '弩', (217, 119, 6), (251, 191, 36), 'Repeating Brass Ballista'),
        ('grinder', '齒', (148, 163, 184), (226, 232, 240), 'Serrated Grinding Wheels'),
        ('frost', '霜', (56, 189, 248), (186, 230, 253), 'Cryogenic Frost Condenser'),
        ('coil', '雷', (168, 85, 247), (216, 180, 254), 'Tesla Arc Induction Coil'),
        ('hammer', '槌', (194, 65, 12), (251, 146, 60), 'Pneumatic Steam Forge Hammer'),
        ('mortar', '砲', (101, 163, 13), (190, 242, 100), 'Heavy Rifled Bomb Mortar'),
    ]

    for tid, seal_char, prim_color, accent_color, desc in towers_data:
        tw_img = Image.new('RGB', (1024, 1024), (20, 22, 28))
        tdraw = ImageDraw.Draw(tw_img)

        # Background radial gradient glow
        cx, cy = 512, 512
        for r_step in range(480, 50, -15):
            ratio = r_step / 480.0
            r_c = int(prim_color[0] * 0.25 * (1 - ratio) + 16)
            g_c = int(prim_color[1] * 0.25 * (1 - ratio) + 18)
            b_c = int(prim_color[2] * 0.25 * (1 - ratio) + 24)
            tdraw.ellipse([cx - r_step, cy - r_step, cx + r_step, cy + r_step], fill=(r_c, g_c, b_c))

        # Heavy circular bronze bezel / mounting turret frame
        tdraw.ellipse([cx - 440, cy - 440, cx + 440, cy + 440], outline=(75, 60, 45), width=24)
        tdraw.ellipse([cx - 425, cy - 425, cx + 425, cy + 425], outline=prim_color, width=8)
        tdraw.ellipse([cx - 400, cy - 400, cx + 400, cy + 400], outline=(30, 34, 42), width=16)

        # Perimeter mounting bolt rivets
        bolt_coords = []
        for a_idx in range(16):
            ang = (a_idx / 16.0) * math.pi * 2
            bx = cx + 420 * math.cos(ang)
            by = cy + 420 * math.sin(ang)
            bolt_coords.append((bx, by))
        draw_rivets(tdraw, bolt_coords, r=8.0, fill=accent_color, outline=(35, 25, 15))

        # Turret Base Plate
        tdraw.polygon([(360, 780), (664, 780), (740, 880), (284, 880)], fill=(45, 38, 32), outline=(120, 95, 65), width=6)
        tdraw.rectangle([340, 720, 684, 780], fill=(65, 55, 45), outline=prim_color, width=4)

        # Draw specific weapon apparatus
        if tid == 'crossbow':
            # Heavy double recurve steel bow limbs and golden bolt
            tdraw.arc([cx - 320, cy - 280, cx + 320, cy + 280], 200, 340, fill=(180, 140, 70), width=32)
            tdraw.arc([cx - 340, cy - 300, cx + 340, cy + 300], 205, 335, fill=accent_color, width=10)
            # Bowstring (steel cable)
            tdraw.line([(240, 320), (cx, 580)], fill=(240, 240, 255), width=4)
            tdraw.line([(800, 320), (cx, 580)], fill=(240, 240, 255), width=4)
            # Main central flight track & loaded massive steel bolt
            tdraw.rectangle([cx - 24, 200, cx + 24, 680], fill=(70, 75, 85), outline=(180, 190, 205), width=4)
            # Barbed arrowhead
            tdraw.polygon([(cx, 120), (cx - 55, 240), (cx + 55, 240)], fill=(220, 230, 245), outline=accent_color, width=5)
            # Tension gear wheel on stock
            draw_gear(tdraw, cx, 580, radius=90, teeth=12, tooth_depth=18, hole_radius=25, fill=(180, 130, 60), outline=accent_color, width=4)

        elif tid == 'grinder':
            # Interlocking massive steel gears with razor teeth and sparks
            draw_gear(tdraw, cx - 110, cy - 40, radius=210, teeth=14, tooth_depth=40, hole_radius=60, fill=(80, 90, 105), outline=(200, 215, 235), width=6, rotation=0.1)
            draw_gear(tdraw, cx + 110, cy + 60, radius=190, teeth=12, tooth_depth=38, hole_radius=50, fill=(65, 75, 90), outline=(170, 190, 210), width=6, rotation=0.35)
            # Sparks flying from mesh point
            for _ in range(40):
                ang = random.uniform(-math.pi / 2, math.pi / 2)
                sp_len = random.uniform(30, 180)
                tdraw.line([(cx, cy), (cx + sp_len * math.cos(ang), cy + sp_len * math.sin(ang))], fill=accent_color, width=random.randint(2, 5))

        elif tid == 'frost':
            # Cryogenic condenser with brass casing and glowing cyan frost crystals
            tdraw.rectangle([cx - 160, 280, cx + 160, 680], fill=(30, 50, 75), outline=(180, 140, 80), width=10)
            # Glass containment chamber with cyan glowing fluid
            tdraw.rectangle([cx - 120, 320, cx + 120, 640], fill=(14, 116, 144), outline=(125, 211, 252), width=6)
            # Glowing crystalline core
            tdraw.polygon([(cx, 340), (cx + 90, 480), (cx, 620), (cx - 90, 480)], fill=(224, 242, 254), outline=(255, 255, 255), width=5)
            # Coiled copper cooling pipes around cylinder
            for y_pipe in range(350, 620, 50):
                tdraw.arc([cx - 150, y_pipe - 25, cx + 150, y_pipe + 25], 0, 180, fill=(217, 119, 6), width=12)

        elif tid == 'coil':
            # Tesla coil stepped windings and spherical discharge electrode
            # Ceramic stepped base insulators
            for step_i in range(5):
                sy = 650 - step_i * 45
                sw = 220 - step_i * 24
                tdraw.rectangle([cx - sw, sy, cx + sw, sy + 35], fill=(70, 60, 50), outline=(200, 160, 100), width=4)
            # Tightly wound copper induction solenoid
            tdraw.rectangle([cx - 70, 280, cx + 70, 470], fill=(180, 83, 9), outline=(251, 191, 36), width=6)
            for cy_line in range(290, 465, 14):
                tdraw.line([(cx - 70, cy_line), (cx + 70, cy_line)], fill=(245, 158, 11), width=5)
            # Spherical silver apex discharge terminal
            tdraw.ellipse([cx - 110, 140, cx + 110, 360], fill=(226, 232, 240), outline=(255, 255, 255), width=8)
            # Violet and cyan electric lightning arcs
            for _ in range(12):
                arc_pts = [(cx, 250)]
                cur_x, cur_y = cx, 250
                for _ in range(4):
                    cur_x += random.randint(-80, 80)
                    cur_y += random.randint(-60, 60)
                    arc_pts.append((cur_x, cur_y))
                tdraw.line(arc_pts, fill=accent_color, width=random.randint(3, 7))

        elif tid == 'hammer':
            # Heavy pneumatic steam forge hammer with piston valves
            # Heavy side gantry columns
            tdraw.rectangle([cx - 240, 260, cx - 160, 760], fill=(60, 65, 75), outline=(160, 175, 195), width=6)
            tdraw.rectangle([cx + 160, 260, cx + 240, 760], fill=(60, 65, 75), outline=(160, 175, 195), width=6)
            # Top crossbeam & steam piston cylinder
            tdraw.rectangle([cx - 260, 220, cx + 260, 300], fill=(80, 85, 95), outline=(200, 150, 80), width=6)
            tdraw.rectangle([cx - 70, 280, cx + 70, 480], fill=(194, 65, 12), outline=accent_color, width=6)
            # Massive forged steel hammer head
            tdraw.polygon([(cx - 150, 480), (cx + 150, 480), (cx + 120, 650), (cx - 120, 650)], fill=(40, 44, 52), outline=(240, 245, 255), width=8)
            # Glowing impact blast at anvil
            tdraw.ellipse([cx - 180, 680, cx + 180, 780], fill=(249, 115, 22, 180))

        elif tid == 'mortar':
            # Heavy rifled bronze mortar cannon barrel angled upward
            tdraw.arc([cx - 220, cy - 220, cx + 220, cy + 220], 30, 150, fill=(120, 85, 45), width=45)
            # Angled barrel
            barrel_pts = [
                (cx - 140, 680),
                (cx + 140, 680),
                (cx + 80, 200),
                (cx - 80, 200),
            ]
            tdraw.polygon(barrel_pts, fill=(130, 95, 45), outline=(230, 190, 110), width=8)
            # Muzzle rim
            tdraw.ellipse([cx - 95, 170, cx + 95, 230], fill=(30, 25, 20), outline=accent_color, width=10)
            # Elevation gear quadrant
            draw_gear(tdraw, cx - 180, 620, radius=90, teeth=10, tooth_depth=16, hole_radius=20, fill=(160, 120, 60), outline=accent_color, width=4)

        # Corner Traditional Chinese Seal
        draw_seal(tdraw, seal_char, 880, 140, size=90, font=font_large_seal, fill=prim_color, border=accent_color)

        tw_img = apply_vignette(tw_img, intensity=0.4)
        tw_img.save(os.path.join(towers_dir, f"{tid}.jpg"), "JPEG", quality=92)

    # 1.4 Eight Enemy Bestiary Portraits (512x512): Mechanical Clockwork Adversaries
    enemies_data = [
        ('grunt', '兵', (245, 158, 11), 'Clockwork Scout Grunt'),
        ('runner', '捷', (244, 114, 182), 'Clockwork Assassin Hare'),
        ('ironclad', '甲', (100, 116, 139), 'Iron Dreadnought Golem'),
        ('kite', '翼', (94, 234, 212), 'Winged Ornithopter Glider'),
        ('gearbug', '蛛', (196, 181, 253), 'Multi-legged Clockwork Spider'),
        ('bloater', '爆', (180, 83, 9), 'High-Pressure Boiler Automaton'),
        ('shellbug', '盾', (71, 85, 105), 'Armored Clockwork Tortoise Tank'),
        ('boss', '王', (239, 68, 68), 'Titan Clockwork Lord Commander'),
    ]

    for eid, e_seal, e_accent, e_desc in enemies_data:
        e_img = Image.new('RGB', (512, 512), (18, 20, 26))
        edraw = ImageDraw.Draw(e_img)

        ecx, ecy = 256, 256
        # Background gradient halo
        for er_i in range(230, 20, -10):
            ratio = er_i / 230.0
            r_val = int(e_accent[0] * 0.28 * (1 - ratio) + 14)
            g_val = int(e_accent[1] * 0.28 * (1 - ratio) + 16)
            b_val = int(e_accent[2] * 0.28 * (1 - ratio) + 22)
            edraw.ellipse([ecx - er_i, ecy - er_i, ecx + er_i, ecy + er_i], fill=(r_val, g_val, b_val))

        # Circular gear frame
        draw_gear(edraw, ecx, ecy, radius=210, teeth=16, tooth_depth=16, hole_radius=0, fill=(35, 40, 50), outline=e_accent, width=3)
        edraw.ellipse([ecx - 195, ecy - 195, ecx + 195, ecy + 195], outline=(15, 18, 24), width=6)

        # Draw enemy specific anatomy
        if eid == 'grunt':
            # Brass dome helm with glowing visor slit and wind-up key
            edraw.ellipse([ecx - 110, ecy - 90, ecx + 110, ecy + 130], fill=(160, 115, 55), outline=(245, 195, 110), width=5)
            # Visor slot
            edraw.rectangle([ecx - 70, ecy, ecx + 70, ecy + 24], fill=(15, 20, 25), outline=(251, 191, 36), width=2)
            edraw.rectangle([ecx - 50, ecy + 5, ecx + 50, ecy + 19], fill=(245, 158, 11))
            # Wind-up key atop head
            edraw.rectangle([ecx - 10, ecy - 160, ecx + 10, ecy - 90], fill=(217, 119, 6), outline=(251, 191, 36), width=2)
            edraw.ellipse([ecx - 45, ecy - 190, ecx + 45, ecy - 140], outline=(251, 191, 36), width=7)

        elif eid == 'runner':
            # Sleek aerodynamic bronze hare with razor ears and glowing eyes
            # Long ear blades
            edraw.polygon([(ecx - 60, ecy - 40), (ecx - 110, ecy - 190), (ecx - 30, ecy - 80)], fill=(180, 100, 130), outline=e_accent, width=3)
            edraw.polygon([(ecx + 60, ecy - 40), (ecx + 110, ecy - 190), (ecx + 30, ecy - 80)], fill=(180, 100, 130), outline=e_accent, width=3)
            # Angular face
            edraw.polygon([(ecx, ecy + 130), (ecx - 90, ecy - 40), (ecx + 90, ecy - 40)], fill=(140, 70, 95), outline=e_accent, width=4)
            # Glowing razor eyes
            edraw.line([(ecx - 55, ecy), (ecx - 15, ecy + 10)], fill=(255, 255, 255), width=4)
            edraw.line([(ecx + 55, ecy), (ecx + 15, ecy + 10)], fill=(255, 255, 255), width=4)

        elif eid == 'ironclad':
            # Heavy dreadnought iron golem with riveted plate armor
            edraw.polygon([(ecx - 140, ecy + 140), (ecx + 140, ecy + 140), (ecx + 120, ecy - 100), (ecx - 120, ecy - 100)], fill=(50, 58, 70), outline=(160, 175, 195), width=7)
            # Shoulder iron pads
            edraw.rectangle([ecx - 160, ecy - 80, ecx - 110, ecy + 60], fill=(70, 80, 95), outline=(200, 215, 235), width=3)
            edraw.rectangle([ecx + 110, ecy - 80, ecx + 160, ecy + 60], fill=(70, 80, 95), outline=(200, 215, 235), width=3)
            # Heavy cross visor slit with red glow
            edraw.line([(ecx - 70, ecy), (ecx + 70, ecy)], fill=(239, 68, 68), width=6)
            edraw.line([(ecx, ecy - 40), (ecx, ecy + 40)], fill=(239, 68, 68), width=6)

        elif eid == 'kite':
            # Winged ornithopter with rib copper wings and propeller
            # Stretched membrane wings
            edraw.polygon([(ecx, ecy), (ecx - 180, ecy - 120), (ecx - 120, ecy + 40)], fill=(20, 85, 80), outline=e_accent, width=4)
            edraw.polygon([(ecx, ecy), (ecx + 180, ecy - 120), (ecx + 120, ecy + 40)], fill=(20, 85, 80), outline=e_accent, width=4)
            # Fuselage
            edraw.ellipse([ecx - 45, ecy - 80, ecx + 45, ecy + 120], fill=(160, 120, 60), outline=(245, 215, 140), width=4)
            # Spinning nose propeller
            edraw.ellipse([ecx - 80, ecy - 90, ecx + 80, ecy - 70], outline=(200, 255, 245), width=3)

        elif eid == 'gearbug':
            # Multi-legged mechanical spider with exposed gear carapace
            # Spidery articulated legs
            for leg_ang in [0.7, 1.2, 1.7, 2.2, 3.8, 4.3, 4.8, 5.3]:
                lx1 = ecx + 110 * math.cos(leg_ang)
                ly1 = ecy + 110 * math.sin(leg_ang)
                lx2 = ecx + 175 * math.cos(leg_ang)
                ly2 = ecy + 175 * math.sin(leg_ang) + 20
                edraw.line([(ecx, ecy), (lx1, ly1), (lx2, ly2)], fill=(140, 120, 180), width=5)
            # Central spinning gear shell
            draw_gear(edraw, ecx, ecy, radius=75, teeth=10, tooth_depth=16, hole_radius=20, fill=(90, 75, 130), outline=e_accent, width=4)

        elif eid == 'bloater':
            # Volatile steam boiler sphere bulging with pressure gauges
            edraw.ellipse([ecx - 125, ecy - 110, ecx + 125, ecy + 140], fill=(150, 70, 20), outline=(245, 158, 11), width=6)
            # Reinforcing iron bands
            edraw.arc([ecx - 120, ecy - 100, ecx + 120, ecy + 130], 20, 160, fill=(60, 30, 10), width=12)
            # Danger pressure gauges
            edraw.ellipse([ecx - 45, ecy - 50, ecx + 45, ecy + 40], fill=(255, 240, 220), outline=(180, 50, 10), width=4)
            edraw.line([(ecx, ecy - 5), (ecx + 25, ecy - 30)], fill=(220, 38, 38), width=3)

        elif eid == 'shellbug':
            # Heavy hemispherical tortoiseshell armor with iron studs
            edraw.arc([ecx - 150, ecy - 120, ecx + 150, ecy + 180], 180, 360, fill=(60, 70, 85), width=24)
            edraw.polygon([(ecx - 145, ecy + 30), (ecx + 145, ecy + 30), (ecx + 110, ecy + 120), (ecx - 110, ecy + 120)], fill=(45, 52, 65), outline=e_accent, width=5)
            # Plate seams and defensive spikes
            for spk_x in range(ecx - 100, ecx + 110, 50):
                edraw.polygon([(spk_x - 12, ecy - 60), (spk_x + 12, ecy - 60), (spk_x, ecy - 110)], fill=(180, 195, 215), outline=(30, 35, 45), width=2)

        elif eid == 'boss':
            # Titan Clockwork Lord commander with golden crown and ocular core
            # Crown points
            crown_pts = [
                (ecx - 120, ecy - 100),
                (ecx - 90, ecy - 180),
                (ecx - 40, ecy - 120),
                (ecx, ecy - 200),
                (ecx + 40, ecy - 120),
                (ecx + 90, ecy - 180),
                (ecx + 120, ecy - 100),
            ]
            edraw.polygon(crown_pts, fill=(234, 179, 8), outline=(254, 240, 138), width=5)
            # Massive horned titan chassis
            edraw.polygon([(ecx - 150, ecy + 140), (ecx + 150, ecy + 140), (ecx + 110, ecy - 80), (ecx - 110, ecy - 80)], fill=(35, 22, 28), outline=(239, 68, 68), width=7)
            # Glowing core ocular array
            edraw.ellipse([ecx - 55, ecy - 20, ecx + 55, ecy + 90], fill=(239, 68, 68), outline=(254, 202, 202), width=5)
            edraw.ellipse([ecx - 25, ecy + 10, ecx + 25, ecy + 60], fill=(255, 255, 255))

        # Traditional Chinese seal stamp in top-right
        draw_seal(edraw, e_seal, 430, 80, size=56, font=font_seal, fill=(180, 30, 30), border=e_accent)

        e_img = apply_vignette(e_img, intensity=0.35)
        e_img.save(os.path.join(enemies_dir, f"{eid}.jpg"), "JPEG", quality=92)


# ==============================================================================
# 2. Toy-Boxing Assets
# ==============================================================================

def generate_toy_boxing_assets():
    print("Generating Toy-Boxing assets...")
    out_dir = "Games/Toy-Boxing/public"
    portraits_dir = os.path.join(out_dir, "portraits")
    opp_portraits_dir = os.path.join(portraits_dir, "opponents")
    fighters_dir = os.path.join(out_dir, "fighters")
    opp_fighters_dir = os.path.join(fighters_dir, "opponents")

    os.makedirs(portraits_dir, exist_ok=True)
    os.makedirs(opp_portraits_dir, exist_ok=True)
    os.makedirs(fighters_dir, exist_ok=True)
    os.makedirs(opp_fighters_dir, exist_ok=True)

    font_title = get_font(42, prefer_serif=False)
    font_seal = get_font(28, prefer_serif=True)
    font_large_seal = get_font(48, prefer_serif=True)

    # 2.1 Ring Sky (1350x900): Championship Toy Stadium Dome with Laser Beams & Spotlights
    w, h = 1350, 900
    ring_sky = Image.new('RGB', (w, h), (10, 14, 24))
    draw = ImageDraw.Draw(ring_sky)

    # Deep indigo night stadium dome gradient
    for y in range(h):
        ratio = y / float(h)
        r = int(8 + 22 * ratio)
        g = int(12 + 28 * ratio)
        b = int(24 + 48 * ratio)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    # Architectural stadium roof trusses
    for tx in range(0, w, 150):
        draw.line([(tx, 0), (tx + 80, 280)], fill=(30, 42, 65), width=6)
        draw.line([(tx + 80, 280), (tx + 150, 0)], fill=(30, 42, 65), width=6)
        draw.line([(tx, 280), (tx + 150, 280)], fill=(45, 60, 90), width=4)

    # Towering grandstands with cheering crowd silhouettes and camera flashes
    for row in range(7):
        gy = 340 + row * 22
        draw.line([(0, gy), (w, gy)], fill=(18, 25, 42), width=20)
        for cx in range(15, w, 22):
            if (cx + row * 17) % 5 == 0:
                flash_col = random.choice([(255, 255, 255), (250, 204, 21), (59, 130, 246), (236, 72, 153), (16, 185, 129)])
                draw.ellipse([cx, gy - 6, cx + 4, gy - 2], fill=flash_col)

    # Sweeping dynamic spotlights angling from stadium ceiling
    spotlight_sources = [
        (180, 40, (59, 130, 246), 480),
        (480, 30, (234, 179, 8), 650),
        (870, 30, (236, 72, 153), 720),
        (1170, 40, (16, 185, 129), 880),
    ]
    for sx, sy, s_col, target_x in spotlight_sources:
        beam_poly = [
            (sx - 15, sy),
            (sx + 15, sy),
            (target_x + 180, 900),
            (target_x - 180, 900),
        ]
        draw.polygon(beam_poly, fill=(*s_col, 28))

    # Suspended giant arena scoreboard / neon banner
    draw.rectangle([w // 2 - 280, 60, w // 2 + 280, 160], fill=(15, 20, 32), outline=(59, 130, 246), width=4)
    draw.rectangle([w // 2 - 270, 70, w // 2 + 270, 150], fill=(10, 14, 22), outline=(96, 165, 250), width=1)
    draw.text((w // 2, 110), "TOY BOXING CHAMPIONSHIP", fill=(255, 255, 255), font=font_title, anchor="mm")

    # Confetti particles drifting in the air
    for _ in range(120):
        conf_x = random.randint(20, w - 20)
        conf_y = random.randint(80, 850)
        c_w = random.randint(4, 9)
        c_h = random.randint(6, 14)
        c_col = random.choice([(239, 68, 68), (59, 130, 246), (234, 179, 8), (236, 72, 153), (16, 185, 129), (255, 255, 255)])
        draw.rectangle([conf_x, conf_y, conf_x + c_w, conf_y + c_h], fill=c_col)

    ring_sky = apply_vignette(ring_sky, intensity=0.45)
    ring_sky.save(os.path.join(out_dir, "ring-sky.jpg"), "JPEG", quality=92)

    # 2.2 Ring Floor (1350x900): Championship Boxing Ring Canvas
    ring_floor = Image.new('RGB', (w, h), (24, 32, 48))
    fdraw = ImageDraw.Draw(ring_floor)

    # Ring canvas texture with subtle perspective weave lines
    for y in range(h):
        ratio = y / float(h)
        r = int(28 + 18 * ratio)
        g = int(36 + 24 * ratio)
        b = int(52 + 32 * ratio)
        fdraw.line([(0, y), (w, y)], fill=(r, g, b))

    # Red Corner (Left) & Blue Corner (Right) diagonal pads
    fdraw.polygon([(0, 0), (280, 0), (0, 280)], fill=(185, 28, 28))
    fdraw.polygon([(w, 0), (w - 280, 0), (w, 280)], fill=(29, 78, 216))
    fdraw.line([(0, 280), (280, 0)], fill=(239, 68, 68), width=6)
    fdraw.line([(w, 280), (w - 280, 0)], fill=(59, 130, 246), width=6)

    # Center championship emblem: concentric gold circles & star crest
    fcx, fcy = w // 2, h // 2
    fdraw.ellipse([fcx - 260, fcy - 260, fcx + 260, fcy + 260], outline=(234, 179, 8), width=8)
    fdraw.ellipse([fcx - 240, fcy - 240, fcx + 240, fcy + 240], outline=(254, 240, 138), width=2)
    fdraw.ellipse([fcx - 180, fcy - 180, fcx + 180, fcy + 180], outline=(202, 138, 4), width=4)

    # Eight-pointed gold championship star in ring center
    star_pts = []
    for s_idx in range(16):
        s_ang = (s_idx / 16.0) * math.pi * 2
        s_r = 150 if s_idx % 2 == 0 else 65
        star_pts.append((fcx + s_r * math.cos(s_ang), fcy + s_r * math.sin(s_ang)))
    fdraw.polygon(star_pts, fill=(234, 179, 8, 120), outline=(254, 240, 138), width=4)

    # Traditional Chinese center seal stamp: 拳 (Boxing)
    draw_seal(fdraw, "拳", fcx, fcy, size=88, font=font_large_seal, fill=(185, 28, 28), border=(254, 240, 138))

    # Crisp perimeter ring boundary markings
    fdraw.rectangle([60, 60, w - 60, h - 60], outline=(255, 255, 255, 180), width=6)
    fdraw.rectangle([72, 72, w - 72, h - 72], outline=(148, 163, 184), width=2)

    ring_floor = apply_vignette(ring_floor, intensity=0.35)
    ring_floor.save(os.path.join(out_dir, "ring-floor.jpg"), "JPEG", quality=92)

    # 2.3 Four Playable Toy Fighters (Portraits 512x512 & Bodies 600x900)
    playable_toys = [
        ('bot', '藍', (59, 130, 246), (147, 197, 253), 'Blue Robot Tin Toy'),
        ('bear', '熊', (220, 38, 38), (252, 165, 165), 'Red Velvet Plush Bear'),
        ('bunny', '兔', (236, 72, 153), (249, 168, 212), 'Pink Action Vinyl Bunny'),
        ('dino', '龍', (34, 197, 94), (134, 239, 172), 'Green Vinyl Dino T-Rex'),
    ]

    for fid, f_seal, prim_c, acc_c, desc in playable_toys:
        # Portrait (512x512)
        p_img = Image.new('RGB', (512, 512), (18, 22, 32))
        pdraw = ImageDraw.Draw(p_img)
        pcx, pcy = 256, 256

        # Circular metallic toy badge
        for pr_i in range(230, 20, -10):
            ratio = pr_i / 230.0
            pdraw.ellipse([pcx - pr_i, pcy - pr_i, pcx + pr_i, pcy + pr_i], fill=(int(prim_c[0] * 0.3 * (1 - ratio) + 14), int(prim_c[1] * 0.3 * (1 - ratio) + 16), int(prim_c[2] * 0.3 * (1 - ratio) + 24)))
        pdraw.ellipse([pcx - 220, pcy - 220, pcx + 220, pcy + 220], outline=prim_c, width=6)
        pdraw.ellipse([pcx - 205, pcy - 205, pcx + 205, pcy + 205], outline=acc_c, width=2)

        # Toy face
        if fid == 'bot':
            pdraw.rectangle([pcx - 90, pcy - 80, pcx + 90, pcy + 90], fill=prim_c, outline=acc_c, width=5)
            # Optical visor
            pdraw.ellipse([pcx - 55, pcy - 25, pcx - 15, pcy + 15], fill=(34, 211, 238), outline=(255, 255, 255), width=3)
            pdraw.ellipse([pcx + 15, pcy - 25, pcx + 55, pcy + 15], fill=(34, 211, 238), outline=(255, 255, 255), width=3)
            # Antenna & bolt ears
            pdraw.line([(pcx, pcy - 80), (pcx, pcy - 140)], fill=acc_c, width=6)
            pdraw.ellipse([pcx - 15, pcy - 165, pcx + 15, pcy - 135], fill=(239, 68, 68), outline=(255, 255, 255), width=2)
            pdraw.rectangle([pcx - 110, pcy - 20, pcx - 90, pcy + 20], fill=(203, 213, 225))
            pdraw.rectangle([pcx + 90, pcy - 20, pcx + 110, pcy + 20], fill=(203, 213, 225))
        elif fid == 'bear':
            pdraw.ellipse([pcx - 100, pcy - 80, pcx + 100, pcy + 100], fill=prim_c, outline=(254, 202, 202), width=5)
            # Plush ears
            pdraw.ellipse([pcx - 115, pcy - 130, pcx - 45, pcy - 60], fill=prim_c, outline=(254, 202, 202), width=4)
            pdraw.ellipse([pcx + 45, pcy - 130, pcx + 115, pcy - 60], fill=prim_c, outline=(254, 202, 202), width=4)
            # Button eyes & stitched felt nose
            pdraw.ellipse([pcx - 45, pcy - 20, pcx - 15, pcy + 10], fill=(24, 24, 27), outline=(255, 255, 255), width=2)
            pdraw.ellipse([pcx + 15, pcy - 20, pcx + 45, pcy + 10], fill=(24, 24, 27), outline=(255, 255, 255), width=2)
            pdraw.ellipse([pcx - 25, pcy + 15, pcx + 25, pcy + 45], fill=(254, 240, 138))
        elif fid == 'bunny':
            # Long vinyl action bunny ears
            pdraw.ellipse([pcx - 70, pcy - 180, pcx - 20, pcy - 40], fill=prim_c, outline=acc_c, width=4)
            pdraw.ellipse([pcx + 20, pcy - 180, pcx + 70, pcy - 40], fill=prim_c, outline=acc_c, width=4)
            pdraw.ellipse([pcx - 85, pcy - 70, pcx + 85, pcy + 90], fill=prim_c, outline=acc_c, width=5)
            # Cyber action goggles
            pdraw.rounded_rectangle([pcx - 75, pcy - 30, pcx + 75, pcy + 20], radius=15, fill=(30, 41, 59), outline=(56, 189, 248), width=4)
            pdraw.line([(pcx - 60, pcy - 5), (pcx + 60, pcy - 5)], fill=(125, 211, 252), width=3)
        elif fid == 'dino':
            # Chunky green T-Rex with horn ridges and teeth
            pdraw.ellipse([pcx - 100, pcy - 90, pcx + 100, pcy + 90], fill=prim_c, outline=acc_c, width=5)
            # Horn ridges
            for h_ang in [-1.8, -1.57, -1.3]:
                hx = pcx + 105 * math.cos(h_ang)
                hy = pcy + 95 * math.sin(h_ang)
                pdraw.polygon([(hx - 12, hy + 10), (hx + 12, hy + 10), (hx, hy - 25)], fill=(250, 204, 21))
            # Fierce eyes & toothy grin
            pdraw.ellipse([pcx - 55, pcy - 30, pcx - 20, pcy], fill=(234, 179, 8))
            pdraw.ellipse([pcx + 20, pcy - 30, pcx + 55, pcy], fill=(234, 179, 8))
            pdraw.arc([pcx - 60, pcy, pcx + 60, pcy + 60], 10, 170, fill=(255, 255, 255), width=8)

        draw_seal(pdraw, f_seal, 430, 80, size=56, font=font_seal, fill=(185, 28, 28), border=acc_c)
        p_img = apply_vignette(p_img, intensity=0.35)
        p_img.save(os.path.join(portraits_dir, f"{fid}.jpg"), "JPEG", quality=92)

        # Fighter Body (600x900): Full-body Plate with Chunky Gloves
        b_img = Image.new('RGB', (600, 900), (14, 18, 26))
        bdraw = ImageDraw.Draw(b_img)
        bcx = 300

        # Torso & Head
        bdraw.ellipse([bcx - 110, 180, bcx + 110, 360], fill=prim_c, outline=acc_c, width=6)
        bdraw.rectangle([bcx - 90, 350, bcx + 90, 560], fill=prim_c, outline=acc_c, width=6)
        # Big chunky boxing gloves in guard stance
        bdraw.ellipse([bcx - 190, 420, bcx - 70, 560], fill=(220, 38, 38), outline=(254, 202, 202), width=6)
        bdraw.ellipse([bcx + 70, 420, bcx + 190, 560], fill=(220, 38, 38), outline=(254, 202, 202), width=6)
        # Legs / Platform base
        bdraw.rectangle([bcx - 80, 560, bcx - 20, 720], fill=(30, 41, 59), outline=acc_c, width=4)
        bdraw.rectangle([bcx + 20, 560, bcx + 80, 720], fill=(30, 41, 59), outline=acc_c, width=4)
        bdraw.ellipse([bcx - 120, 700, bcx + 120, 780], fill=(15, 23, 42), outline=(148, 163, 184), width=4)

        draw_seal(bdraw, f_seal, 520, 90, size=64, font=font_seal, fill=(185, 28, 28), border=acc_c)
        b_img = apply_vignette(b_img, intensity=0.4)
        b_img.save(os.path.join(fighters_dir, f"{fid}.jpg"), "JPEG", quality=92)

    # 2.4 Six League Opponents (Portraits 512x512 & Bodies 600x900)
    league_opponents = [
        ('pillow', '羽', (244, 114, 182), (251, 207, 232), 'Fluffy Memory Foam Pillow Boxer'),
        ('rush', '狂', (245, 158, 11), (253, 224, 71), 'Brass Wind-up Cymbal Monkey'),
        ('needle', '針', (20, 184, 166), (153, 246, 228), 'Spiky Magnetic Pin Hedgehog'),
        ('feint', '影', (168, 85, 247), (233, 213, 255), 'Purple Harlequin Marionette Puppet'),
        ('ironbelly', '鐵', (100, 116, 139), (203, 213, 225), 'Cast-Iron Piggy Bank Sumo Toy'),
        ('champ', '冠', (234, 179, 8), (254, 240, 138), 'Supreme Gold Championship Trophy Figure'),
    ]

    for opp_id, o_seal, prim_c, acc_c, desc in league_opponents:
        # Opponent Portrait (512x512)
        op_img = Image.new('RGB', (512, 512), (18, 20, 28))
        opdraw = ImageDraw.Draw(op_img)
        opcx, opcy = 256, 256

        # Halo background
        for opr_i in range(230, 20, -10):
            ratio = opr_i / 230.0
            opdraw.ellipse([opcx - opr_i, opcy - opr_i, opcx + opr_i, opcy + opr_i], fill=(int(prim_c[0] * 0.3 * (1 - ratio) + 14), int(prim_c[1] * 0.3 * (1 - ratio) + 16), int(prim_c[2] * 0.3 * (1 - ratio) + 24)))
        opdraw.ellipse([opcx - 220, opcy - 220, opcx + 220, opcy + 220], outline=prim_c, width=6)

        # Character features
        if opp_id == 'pillow':
            opdraw.rounded_rectangle([opcx - 110, opcy - 80, opcx + 110, opcy + 80], radius=30, fill=prim_c, outline=acc_c, width=5)
            # Pastel stripes & sleepy eyes
            opdraw.arc([opcx - 65, opcy - 10, opcx - 20, opcy + 25], 180, 360, fill=(75, 85, 99), width=4)
            opdraw.arc([opcx + 20, opcy - 10, opcx + 65, opcy + 25], 180, 360, fill=(75, 85, 99), width=4)
        elif opp_id == 'rush':
            # Wind-up monkey head with spinning top key
            opdraw.ellipse([opcx - 95, opcy - 70, opcx + 95, opcy + 90], fill=(180, 120, 50), outline=prim_c, width=5)
            opdraw.ellipse([opcx - 120, opcy - 40, opcx - 80, opcy + 20], fill=(245, 158, 11))
            opdraw.ellipse([opcx + 80, opcy - 40, opcx + 120, opcy + 20], fill=(245, 158, 11))
            # Wind-up key
            opdraw.ellipse([opcx - 35, opcy - 145, opcx + 35, opcy - 105], outline=acc_c, width=6)
            opdraw.line([(opcx, opcy - 105), (opcx, opcy - 70)], fill=acc_c, width=6)
        elif opp_id == 'needle':
            # Hedgehog with metallic quills
            for q_ang in range(-160, -20, 20):
                rad = math.radians(q_ang)
                qx = opcx + 125 * math.cos(rad)
                qy = opcy + 125 * math.sin(rad)
                opdraw.line([(opcx, opcy), (qx, qy)], fill=acc_c, width=5)
            opdraw.ellipse([opcx - 85, opcy - 60, opcx + 85, opcy + 80], fill=prim_c, outline=acc_c, width=5)
        elif opp_id == 'feint':
            # Harlequin puppet with purple diamond patterns
            opdraw.polygon([(opcx, opcy - 110), (opcx + 85, opcy), (opcx, opcy + 100), (opcx - 85, opcy)], fill=prim_c, outline=acc_c, width=5)
            opdraw.line([(opcx - 45, opcy - 20), (opcx - 15, opcy)], fill=(255, 255, 255), width=4)
            opdraw.line([(opcx + 45, opcy - 20), (opcx + 15, opcy)], fill=(255, 255, 255), width=4)
        elif opp_id == 'ironbelly':
            # Heavy cast-iron pig with coin slot
            opdraw.ellipse([opcx - 110, opcy - 80, opcx + 110, opcy + 90], fill=(71, 85, 105), outline=acc_c, width=6)
            # Golden coin slot
            opdraw.rectangle([opcx - 45, opcy - 60, opcx + 45, opcy - 45], fill=(234, 179, 8), outline=(254, 240, 138), width=2)
            opdraw.ellipse([opcx - 35, opcy, opcx + 35, opcy + 45], fill=(100, 116, 139), outline=acc_c, width=3)
        elif opp_id == 'champ':
            # Gold trophy figure with ruby crown
            crown_pts = [(opcx - 70, opcy - 80), (opcx - 50, opcy - 140), (opcx - 20, opcy - 100), (opcx, opcy - 150), (opcx + 20, opcy - 100), (opcx + 50, opcy - 140), (opcx + 70, opcy - 80)]
            opdraw.polygon(crown_pts, fill=(239, 68, 68), outline=acc_c, width=4)
            opdraw.ellipse([opcx - 85, opcy - 70, opcx + 85, opcy + 90], fill=(234, 179, 8), outline=(255, 255, 255), width=6)

        draw_seal(opdraw, o_seal, 430, 80, size=56, font=font_seal, fill=(185, 28, 28), border=acc_c)
        op_img = apply_vignette(op_img, intensity=0.35)
        op_img.save(os.path.join(opp_portraits_dir, f"{opp_id}.jpg"), "JPEG", quality=92)

        # Opponent Fighter Body (600x900)
        ob_img = Image.new('RGB', (600, 900), (14, 18, 26))
        obdraw = ImageDraw.Draw(ob_img)
        obcx = 300

        obdraw.ellipse([obcx - 110, 180, obcx + 110, 360], fill=prim_c, outline=acc_c, width=6)
        obdraw.rectangle([obcx - 95, 350, obcx + 95, 560], fill=prim_c, outline=acc_c, width=6)
        # Giant gloves
        obdraw.ellipse([obcx - 190, 420, obcx - 70, 560], fill=(185, 28, 28), outline=(254, 202, 202), width=6)
        obdraw.ellipse([obcx + 70, 420, obcx + 190, 560], fill=(185, 28, 28), outline=(254, 202, 202), width=6)
        # Stance base
        obdraw.rectangle([obcx - 80, 560, obcx - 20, 720], fill=(30, 41, 59), outline=acc_c, width=4)
        obdraw.rectangle([obcx + 20, 560, obcx + 80, 720], fill=(30, 41, 59), outline=acc_c, width=4)
        obdraw.ellipse([obcx - 120, 700, obcx + 120, 780], fill=(15, 23, 42), outline=(148, 163, 184), width=4)

        draw_seal(obdraw, o_seal, 520, 90, size=64, font=font_seal, fill=(185, 28, 28), border=acc_c)
        ob_img = apply_vignette(ob_img, intensity=0.4)
        ob_img.save(os.path.join(opp_fighters_dir, f"{opp_id}.jpg"), "JPEG", quality=92)


# ==============================================================================
# 3. Instant-Flash Assets
# ==============================================================================

def generate_instant_flash_assets():
    print("Generating Instant-Flash assets...")
    out_dir = "Games/Instant-Flash/public"
    opp_dir = os.path.join(out_dir, "opponents")
    proj_dir = os.path.join(out_dir, "projectiles")
    os.makedirs(opp_dir, exist_ok=True)
    os.makedirs(proj_dir, exist_ok=True)

    font_title = get_font(42, prefer_serif=True)
    font_seal = get_font(28, prefer_serif=True)
    font_large_seal = get_font(48, prefer_serif=True)

    # 3.1 Dojo Background (1350x900): Sunset Twilight Japanese Dojo with Shoji Screens & Gold Cloud Leaf
    w, h = 1350, 900
    dojo_bg = Image.new('RGB', (w, h), (26, 16, 20))
    draw = ImageDraw.Draw(dojo_bg)

    # Golden amber sunset sky outside dojo screens
    for y in range(h):
        ratio = y / float(h)
        r = int(55 + 90 * ratio + 40 * math.sin(ratio * math.pi))
        g = int(25 + 50 * ratio + 25 * math.sin(ratio * math.pi))
        b = int(20 + 20 * ratio)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    # Silhouetted bamboo stalks outside
    for bx in range(80, w, 120):
        draw.line([(bx, 0), (bx, h)], fill=(35, 18, 15), width=10)
        # Bamboo nodes
        for by in range(60, h, 80):
            draw.line([(bx - 12, by), (bx + 12, by)], fill=(48, 25, 20), width=4)

    # Traditional sliding Shoji lattice screens
    screen_w = 260
    for s_idx in range(5):
        sx0 = 40 + s_idx * screen_w
        sx1 = sx0 + screen_w - 20
        # Paper screen translucent fill
        draw.rectangle([sx0, 60, sx1, 740], fill=(254, 243, 199, 130), outline=(50, 26, 18), width=8)
        # Lattice wooden bars (Kumiko grid)
        for kx in range(sx0 + 20, sx1, 30):
            draw.line([(kx, 60), (kx, 740)], fill=(75, 42, 28), width=3)
        for ky in range(80, 740, 30):
            draw.line([(sx0, ky), (sx1, ky)], fill=(75, 42, 28), width=3)

    # Heavy wooden cedar posts and lintels
    draw.line([(0, 60), (w, 60)], fill=(45, 25, 18), width=16)
    draw.line([(0, 740), (w, 740)], fill=(45, 25, 18), width=20)

    # Traditional hanging calligraphy scroll in central alcove (Tokonoma)
    draw.rectangle([w // 2 - 80, 100, w // 2 + 80, 480], fill=(245, 235, 215), outline=(55, 30, 20), width=6)
    draw.text((w // 2, 220), "一", fill=(20, 20, 20), font=font_title, anchor="mm")
    draw.text((w // 2, 340), "閃", fill=(20, 20, 20), font=font_title, anchor="mm")
    draw_seal(draw, "劍", w // 2, 420, size=42, font=font_seal, fill=(185, 28, 28), border=(254, 202, 202))

    # Gold leaf cloud patterns (Ukiyo-e Yamato-e scalloped clouds)
    for c_y in [120, 680]:
        for c_x in range(100, w, 220):
            draw.ellipse([c_x - 70, c_y - 25, c_x + 70, c_y + 25], fill=(217, 119, 6, 90))

    # Drifting cherry blossom petals
    for _ in range(50):
        px = random.randint(30, w - 30)
        py = random.randint(80, 720)
        draw.ellipse([px - 5, py - 3, px + 5, py + 3], fill=(251, 113, 133, 180))

    dojo_bg = apply_vignette(dojo_bg, intensity=0.45)
    dojo_bg.save(os.path.join(out_dir, "dojo-bg.jpg"), "JPEG", quality=92)

    # 3.2 Floor (1350x900): Polished Dark Cypress Wood & Tatami Border
    floor_img = Image.new('RGB', (w, h), (32, 20, 16))
    fdraw = ImageDraw.Draw(floor_img)

    # Dark lacquered cypress wood planks with warm sunset reflections
    plank_h = 75
    for py in range(0, h, plank_h):
        ratio = py / float(h)
        val_r = int(38 + 25 * ratio)
        val_g = int(22 + 15 * ratio)
        val_b = int(16 + 10 * ratio)
        fdraw.rectangle([0, py, w, py + plank_h], fill=(val_r, val_g, val_b), outline=(20, 10, 8), width=3)
        # Woodgrain streaks
        for _ in range(6):
            wx = random.randint(0, w - 200)
            fdraw.line([(wx, py + random.randint(10, 60)), (wx + 180, py + random.randint(10, 60))], fill=(val_r + 14, val_g + 8, val_b + 5), width=1)

    # Tatami mat woven borders (Heri) along bottom and sides
    fdraw.rectangle([0, h - 120, w, h], fill=(30, 45, 35), outline=(15, 25, 18), width=6)
    # Woven rush straw lines
    for ty in range(h - 110, h, 8):
        fdraw.line([(0, ty), (w, ty)], fill=(45, 65, 48), width=2)
    # Black brocade binding trim
    fdraw.line([(0, h - 120), (w, h - 120)], fill=(12, 12, 12), width=10)

    floor_img = apply_vignette(floor_img, intensity=0.35)
    floor_img.save(os.path.join(out_dir, "floor.jpg"), "JPEG", quality=92)

    # 3.3 Player (600x900) & Shadow Duelist (600x900)
    # Player: Master Swordsman in deep indigo hakama in ready battojutsu stance
    p_img = Image.new('RGB', (600, 900), (14, 18, 26))
    pdraw = ImageDraw.Draw(p_img)
    pcx = 300

    # Flowing dark hair & headband
    pdraw.ellipse([pcx - 45, 160, pcx + 45, 250], fill=(24, 24, 27), outline=(217, 119, 6), width=3)
    pdraw.line([(pcx - 45, 200), (pcx + 45, 200)], fill=(255, 255, 255), width=6)
    # Indigo Kimono & Hakama
    pdraw.polygon([(pcx, 240), (pcx - 110, 480), (pcx + 110, 480)], fill=(30, 58, 138), outline=(96, 165, 250), width=5)
    pdraw.polygon([(pcx - 110, 480), (pcx - 140, 780), (pcx - 20, 780), (pcx, 480)], fill=(15, 23, 42), outline=(59, 130, 246), width=4)
    pdraw.polygon([(pcx, 480), (pcx + 20, 780), (pcx + 140, 780), (pcx + 110, 480)], fill=(15, 23, 42), outline=(59, 130, 246), width=4)
    # Katana at waist in ready draw stance (Tsuka hilt & Saya scabbard)
    pdraw.line([(pcx - 150, 460), (pcx + 120, 520)], fill=(15, 15, 15), width=14)
    pdraw.line([(pcx - 150, 460), (pcx - 90, 440)], fill=(234, 179, 8), width=10)  # Wrapped hilt
    pdraw.ellipse([pcx - 95, 435, pcx - 85, 450], fill=(217, 119, 6))  # Tsuba sword guard

    draw_seal(pdraw, "斬", 520, 90, size=64, font=font_large_seal, fill=(185, 28, 28), border=(96, 165, 250))
    p_img = apply_vignette(p_img, intensity=0.4)
    p_img.save(os.path.join(out_dir, "player.jpg"), "JPEG", quality=92)

    # Opponents Player Portrait (512x512)
    pp_img = Image.new('RGB', (512, 512), (18, 22, 34))
    ppdraw = ImageDraw.Draw(pp_img)
    ppdraw.ellipse([256 - 120, 256 - 120, 256 + 120, 256 + 120], fill=(30, 58, 138), outline=(96, 165, 250), width=6)
    ppdraw.ellipse([256 - 50, 256 - 80, 256 + 50, 256 + 20], fill=(24, 24, 27))
    draw_seal(ppdraw, "斬", 430, 80, size=56, font=font_seal, fill=(185, 28, 28), border=(96, 165, 250))
    pp_img = apply_vignette(pp_img, intensity=0.35)
    pp_img.save(os.path.join(opp_dir, "player.jpg"), "JPEG", quality=92)

    # Shadow Duelist (enemy.jpg - 600x900)
    e_img = Image.new('RGB', (600, 900), (24, 10, 14))
    edraw = ImageDraw.Draw(e_img)
    edraw.polygon([(300, 220), (180, 780), (420, 780)], fill=(127, 29, 29), outline=(239, 68, 68), width=6)
    edraw.ellipse([250, 160, 350, 240], fill=(15, 15, 15), outline=(239, 68, 68), width=4)
    # Burning crimson eyes
    edraw.line([(275, 195), (295, 195)], fill=(255, 255, 255), width=3)
    edraw.line([(305, 195), (325, 195)], fill=(255, 255, 255), width=3)
    e_img = apply_vignette(e_img, intensity=0.45)
    e_img.save(os.path.join(out_dir, "enemy.jpg"), "JPEG", quality=92)

    # 3.4 Eight Opponents (512x512 Portraits & 600x900 Sprites)
    opponents_data = [
        ('ronin', '浪', (134, 239, 172), 'Wandering Straw-hat Ronin'),
        ('bait', '影', (244, 114, 182), 'Tricky Shinobi Assassin'),
        ('delay', '蓄', (251, 191, 36), 'Armored Heavy Samurai Master'),
        ('surge', '風', (52, 211, 153), 'Swift Jade Wind Swordsman'),
        ('mirror', '鏡', (226, 232, 240), 'Spectral White Kimono Duelist'),
        ('twin', '雙', (248, 113, 113), 'Yin-Yang Dual-bladed Warrior'),
        ('chaos', '狂', (192, 132, 252), 'Mountain Ascetic Yamabushi Monk'),
        ('master', '極', (250, 204, 21), 'Supreme Kensei Sword Saint'),
    ]

    for opp_id, opp_seal, opp_col, desc in opponents_data:
        # Portrait (512x512)
        op_img = Image.new('RGB', (512, 512), (20, 18, 24))
        opdraw = ImageDraw.Draw(op_img)
        opcx, opcy = 256, 256

        # Atmospheric brushed circle
        for r_i in range(220, 20, -10):
            ratio = r_i / 220.0
            opdraw.ellipse([opcx - r_i, opcy - r_i, opcx + r_i, opcy + r_i], fill=(int(opp_col[0] * 0.28 * (1 - ratio) + 16), int(opp_col[1] * 0.28 * (1 - ratio) + 14), int(opp_col[2] * 0.28 * (1 - ratio) + 20)))
        opdraw.ellipse([opcx - 210, opcy - 210, opcx + 210, opcy + 210], outline=opp_col, width=5)

        # Draw distinct headwear / posture
        if opp_id == 'ronin':
            # Wide conical straw hat (Kasa)
            opdraw.polygon([(opcx - 140, opcy + 20), (opcx + 140, opcy + 20), (opcx, opcy - 90)], fill=(180, 140, 80), outline=(230, 190, 120), width=4)
        elif opp_id == 'bait':
            # Ninja mask & hood with sharp eyes
            opdraw.ellipse([opcx - 80, opcy - 80, opcx + 80, opcy + 80], fill=(24, 24, 27), outline=opp_col, width=4)
            opdraw.line([(opcx - 50, opcy - 10), (opcx + 50, opcy - 10)], fill=(244, 114, 182), width=4)
        elif opp_id == 'delay':
            # Heavy Kabuto helmet with golden crescent horn
            opdraw.ellipse([opcx - 90, opcy - 70, opcx + 90, opcy + 90], fill=(45, 35, 30), outline=(234, 179, 8), width=5)
            opdraw.arc([opcx - 110, opcy - 140, opcx + 110, opcy + 20], 200, 340, fill=(234, 179, 8), width=10)
        elif opp_id == 'surge':
            # Flowing green headband with wind trails
            opdraw.ellipse([opcx - 85, opcy - 70, opcx + 85, opcy + 80], fill=(20, 83, 45), outline=opp_col, width=5)
            opdraw.line([(opcx - 85, opcy - 20), (opcx - 160, opcy - 50)], fill=opp_col, width=6)
        elif opp_id == 'mirror':
            # Silver hair & porcelain theater mask
            opdraw.ellipse([opcx - 80, opcy - 75, opcx + 80, opcy + 85], fill=(241, 245, 249), outline=(148, 163, 184), width=5)
        elif opp_id == 'twin':
            # Half-red half-blue split mask
            opdraw.chord([opcx - 80, opcy - 75, opcx + 80, opcy + 85], 90, 270, fill=(185, 28, 28), outline=opp_col, width=4)
            opdraw.chord([opcx - 80, opcy - 75, opcx + 80, opcy + 85], 270, 90, fill=(29, 78, 216), outline=opp_col, width=4)
        elif opp_id == 'chaos':
            # Wild wild mountain monk hair with prayer beads
            opdraw.ellipse([opcx - 95, opcy - 75, opcx + 95, opcy + 85], fill=(88, 28, 135), outline=opp_col, width=5)
            for ba in range(0, 360, 45):
                rad = math.radians(ba)
                opdraw.ellipse([opcx + 115 * math.cos(rad) - 10, opcy + 115 * math.sin(rad) - 10, opcx + 115 * math.cos(rad) + 10, opcy + 115 * math.sin(rad) + 10], fill=(217, 119, 6))
        elif opp_id == 'master':
            # Golden brocade & radiating sword aura
            opdraw.ellipse([opcx - 90, opcy - 75, opcx + 90, opcy + 85], fill=(234, 179, 8), outline=(255, 255, 255), width=6)
            for ray in range(0, 360, 30):
                r_rad = math.radians(ray)
                opdraw.line([(opcx + 110 * math.cos(r_rad), opcy + 110 * math.sin(r_rad)), (opcx + 160 * math.cos(r_rad), opcy + 160 * math.sin(r_rad))], fill=(254, 240, 138), width=3)

        draw_seal(opdraw, opp_seal, 430, 80, size=56, font=font_seal, fill=(185, 28, 28), border=opp_col)
        op_img = apply_vignette(op_img, intensity=0.35)
        op_img.save(os.path.join(opp_dir, f"{opp_id}.jpg"), "JPEG", quality=92)

        # Battle Sprite (600x900)
        sp_img = Image.new('RGB', (600, 900), (14, 16, 22))
        spdraw = ImageDraw.Draw(sp_img)
        spcx = 300

        # Robes / Stance
        spdraw.polygon([(spcx, 220), (spcx - 120, 780), (spcx + 120, 780)], fill=(30, 35, 45), outline=opp_col, width=5)
        spdraw.ellipse([spcx - 50, 160, spcx + 50, 240], fill=(20, 22, 28), outline=opp_col, width=4)
        # Katana blade in battle ready stance
        spdraw.line([(spcx + 80, 380), (spcx - 140, 680)], fill=(226, 232, 240), width=6)
        spdraw.line([(spcx + 80, 380), (spcx + 140, 340)], fill=opp_col, width=10)

        draw_seal(spdraw, opp_seal, 520, 90, size=64, font=font_seal, fill=(185, 28, 28), border=opp_col)
        sp_img = apply_vignette(sp_img, intensity=0.4)
        sp_img.save(os.path.join(opp_dir, f"{opp_id}-sprite.jpg"), "JPEG", quality=92)

    # 3.5 Four Projectiles (512x512)
    proj_data = [
        ('shuriken', 'Four-pointed Forged Ninja Star'),
        ('kunai', 'Diamond-headed Throwing Dagger'),
        ('bomb', 'Spherical Ceramic Fuse Bomb'),
        ('sickle', 'Curved Chain Kusarigama Sickle'),
    ]

    for pid, pdesc in proj_data:
        pr_img = Image.new('RGB', (512, 512), (16, 18, 24))
        pdraw = ImageDraw.Draw(pr_img)
        cx, cy = 256, 256

        # Subtle halo
        pdraw.ellipse([cx - 200, cy - 200, cx + 200, cy + 200], fill=(28, 32, 42))

        if pid == 'shuriken':
            # Four-pointed sharp star with center hole
            pts = []
            for i in range(8):
                ang = (i / 8.0) * math.pi * 2
                r = 180 if i % 2 == 0 else 45
                pts.append((cx + r * math.cos(ang), cy + r * math.sin(ang)))
            pdraw.polygon(pts, fill=(71, 85, 105), outline=(226, 232, 240), width=6)
            pdraw.ellipse([cx - 25, cy - 25, cx + 25, cy + 25], fill=(16, 18, 24), outline=(226, 232, 240), width=4)

        elif pid == 'kunai':
            # Diamond blade, grip and ring with tassel
            pdraw.polygon([(cx, cy - 180), (cx + 55, cy - 40), (cx, cy + 20), (cx - 55, cy - 40)], fill=(148, 163, 184), outline=(241, 245, 249), width=6)
            pdraw.rectangle([cx - 12, cy + 20, cx + 12, cy + 120], fill=(71, 85, 105), outline=(30, 41, 59), width=3)
            pdraw.ellipse([cx - 30, cy + 120, cx + 30, cy + 180], outline=(203, 213, 225), width=6)

        elif pid == 'bomb':
            # Cast iron sphere with burning spark fuse
            pdraw.ellipse([cx - 120, cy - 80, cx + 120, cy + 160], fill=(30, 41, 59), outline=(100, 116, 139), width=8)
            # Neck & burning fuse
            pdraw.rectangle([cx - 25, cy - 110, cx + 25, cy - 80], fill=(71, 85, 105))
            pdraw.arc([cx, cy - 180, cx + 80, cy - 100], 180, 360, fill=(217, 119, 6), width=6)
            pdraw.ellipse([cx + 70, cy - 190, cx + 100, cy - 160], fill=(239, 68, 68), outline=(254, 240, 138), width=3)

        elif pid == 'sickle':
            # Curved sickle blade with trailing iron chain
            pdraw.arc([cx - 140, cy - 140, cx + 140, cy + 140], 200, 350, fill=(203, 213, 225), width=32)
            pdraw.line([(cx, cy), (cx, cy + 150)], fill=(120, 85, 45), width=18)
            # Chain links
            for ch_y in range(cy + 150, cy + 230, 20):
                pdraw.ellipse([cx - 10, ch_y, cx + 10, ch_y + 18], outline=(148, 163, 184), width=4)

        pr_img = apply_vignette(pr_img, intensity=0.35)
        pr_img.save(os.path.join(proj_dir, f"{pid}.jpg"), "JPEG", quality=92)


# ==============================================================================
# 4. Coin-Cascade Assets
# ==============================================================================

def generate_coin_cascade_assets():
    print("Generating Coin-Cascade assets...")
    out_dir = "Games/Coin-Cascade/public"
    os.makedirs(out_dir, exist_ok=True)

    font_title = get_font(56, prefer_serif=False)
    font_sub = get_font(26, prefer_serif=False)
    font_seal = get_font(36, prefer_serif=True)
    font_large_seal = get_font(52, prefer_serif=True)

    # 4.1 Title Background (1350x900): Grand Retro-Arcade Casino Marquee & Carnival Palace
    w, h = 1350, 900
    title_bg = Image.new('RGB', (w, h), (14, 10, 24))
    draw = ImageDraw.Draw(title_bg)

    # Deep violet-indigo to warm amber carnival hall lighting
    for y in range(h):
        ratio = y / float(h)
        r = int(18 + 50 * ratio + 35 * math.sin(ratio * math.pi))
        g = int(12 + 25 * ratio + 20 * math.sin(ratio * math.pi))
        b = int(28 + 15 * ratio)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    # Overhead spotlights angling downward
    for sx, sy, sc, tx in [(200, 40, (234, 179, 8), 500), (1150, 40, (236, 72, 153), 850)]:
        draw.polygon([(sx - 20, sy), (sx + 20, sy), (tx + 220, 900), (tx - 220, 900)], fill=(*sc, 24))

    # Grand Glowing Neon Marquee Signboard
    draw.rounded_rectangle([w // 2 - 420, 100, w // 2 + 420, 320], radius=35, fill=(15, 12, 26), outline=(245, 158, 11), width=8)
    draw.rounded_rectangle([w // 2 - 405, 115, w // 2 + 405, 305], radius=25, fill=(24, 16, 38), outline=(236, 72, 153), width=4)

    # Marquee incandescent light bulb perimeter
    bulb_coords = []
    for bx in range(w // 2 - 390, w // 2 + 400, 32):
        bulb_coords.append((bx, 115))
        bulb_coords.append((bx, 305))
    for by in range(130, 295, 30):
        bulb_coords.append((w // 2 - 405, by))
        bulb_coords.append((w // 2 + 405, by))
    for bx, by in bulb_coords:
        draw.ellipse([bx - 6, by - 6, bx + 6, by + 6], fill=(254, 240, 138), outline=(245, 158, 11), width=2)
        draw.ellipse([bx - 2, by - 2, bx + 2, by + 2], fill=(255, 255, 255))

    # Bold Neon Typography: COIN CASCADE & 幣潮
    draw.text((w // 2, 175), "COIN CASCADE", fill=(254, 240, 138), font=font_title, anchor="mm")
    draw.text((w // 2, 245), "★ JACKPOT 777 ★ CARNIVAL ★", fill=(244, 114, 182), font=font_sub, anchor="mm")

    # Traditional Chinese seals: 潮 (Tide) & 金 (Gold)
    draw_seal(draw, "潮", w // 2 - 320, 210, size=64, font=font_large_seal, fill=(180, 83, 9), border=(251, 191, 36))
    draw_seal(draw, "金", w // 2 + 320, 210, size=64, font=font_large_seal, fill=(180, 83, 9), border=(251, 191, 36))

    # Cascade waterfall of glittering golden coins pouring from marquee into foreground
    for _ in range(180):
        cx = random.randint(120, w - 120)
        cy = random.randint(360, 880)
        cr = random.randint(12, 28)
        # 3D tilted coin ellipse
        draw.ellipse([cx - cr, cy - cr * 0.6, cx + cr, cy + cr * 0.6], fill=(234, 179, 8), outline=(254, 240, 138), width=3)
        draw.ellipse([cx - cr * 0.7, cy - cr * 0.4, cx + cr * 0.7, cy + cr * 0.4], outline=(202, 138, 4), width=1)
        # Specular glint
        draw.ellipse([cx - cr * 0.4, cy - cr * 0.25, cx - cr * 0.1, cy - cr * 0.05], fill=(255, 255, 255))

    title_bg = apply_vignette(title_bg, intensity=0.4)
    title_bg.save(os.path.join(out_dir, "title-bg.jpg"), "JPEG", quality=92)

    # 4.2 Metal (1024x1024): Brushed Aerospace Chrome / Stainless Steel Pusher Plate
    mw, mh = 1024, 1024
    metal_img = Image.new('RGB', (mw, mh), (180, 190, 205))
    mdraw = ImageDraw.Draw(metal_img)

    # Horizontal fine brushed grain texture
    for y in range(mh):
        grain_val = random.randint(-18, 18)
        # Longitudinal specular highlight bands (cylindrical reflection)
        spec = int(45 * math.sin((y / float(mh)) * math.pi * 3))
        col = max(0, min(255, 185 + grain_val + spec))
        mdraw.line([(0, y), (mw, y)], fill=(col, col + 2, col + 6))

    # Industrial beveled perimeter chamfer
    mdraw.rectangle([0, 0, mw, mh], outline=(245, 248, 252), width=12)
    mdraw.rectangle([12, 12, mw - 12, mh - 12], outline=(100, 116, 139), width=8)

    # Countersunk industrial hex bolt heads along edges
    bolt_coords = []
    for x in range(60, mw, 180):
        bolt_coords.append((x, 30))
        bolt_coords.append((x, mh - 30))
    for y in range(80, mh - 60, 180):
        bolt_coords.append((30, y))
        bolt_coords.append((mw - 30, y))

    for bx, by in bolt_coords:
        # Hexagon bolt
        hex_pts = []
        for hi in range(6):
            hang = (hi / 6.0) * math.pi * 2
            hex_pts.append((bx + 18 * math.cos(hang), by + 18 * math.sin(hang)))
        mdraw.polygon(hex_pts, fill=(148, 163, 184), outline=(255, 255, 255), width=2)
        mdraw.ellipse([bx - 8, by - 8, bx + 8, by + 8], fill=(71, 85, 105))

    metal_img = apply_vignette(metal_img, intensity=0.25)
    metal_img.save(os.path.join(out_dir, "metal.jpg"), "JPEG", quality=92)

    # 4.3 Shelf (1024x1024): Luxury Polished Mahogany & Acrylic Mirror Tray
    sw, sh = 1024, 1024
    shelf_img = Image.new('RGB', (sw, sh), (52, 28, 20))
    sdraw = ImageDraw.Draw(shelf_img)

    # Rich polished mahogany woodgrain planks
    plank_w = sw // 8
    for px in range(0, sw, plank_w):
        val_r = 58 + random.randint(-8, 8)
        val_g = 30 + random.randint(-5, 5)
        val_b = 20 + random.randint(-4, 4)
        sdraw.rectangle([px, 0, px + plank_w, sh], fill=(val_r, val_g, val_b), outline=(32, 16, 12), width=3)
        # Deep organic grain curves
        for _ in range(8):
            gy = random.randint(0, sh - 150)
            sdraw.line([(px + random.randint(5, plank_w - 5), gy), (px + random.randint(5, plank_w - 5), gy + 140)], fill=(val_r + 16, val_g + 10, val_b + 8), width=2)

    # Laser-etched golden alignment measurement lines
    for ly in range(120, sh, 120):
        sdraw.line([(40, ly), (sw - 40, ly)], fill=(234, 179, 8, 140), width=2)
        # Distance tick marks
        for tx in range(60, sw - 40, 40):
            sdraw.line([(tx, ly - 6), (tx, ly + 6)], fill=(254, 240, 138), width=1)

    # Embedded neon edge-lit acrylic light-pipe channels on left and right
    sdraw.rectangle([10, 0, 34, sh], fill=(236, 72, 153, 180), outline=(251, 207, 232), width=2)
    sdraw.rectangle([sw - 34, 0, sw - 10, sh], fill=(56, 189, 248, 180), outline=(186, 230, 253), width=2)

    # Polished brass front edge bumper
    sdraw.rectangle([0, sh - 30, sw, sh], fill=(217, 119, 6), outline=(254, 240, 138), width=3)

    shelf_img = apply_vignette(shelf_img, intensity=0.3)
    shelf_img.save(os.path.join(out_dir, "shelf.jpg"), "JPEG", quality=92)

    # 4.4 Golden Coin (512x512): High-Relief 3D Embossed Golden Arcade Medallion
    cw, ch = 512, 512
    coin_img = Image.new('RGB', (cw, ch), (22, 18, 12))
    cdraw = ImageDraw.Draw(coin_img)
    ccx, ccy = 256, 256

    # Heavy raised outer rim with precision reeded/milled edge notches
    outer_r = 240
    for r_i in range(outer_r, 40, -8):
        ratio = r_i / float(outer_r)
        cr_val = int(245 * ratio + 10)
        cg_val = int(185 * ratio + 8)
        cb_val = int(15 * ratio + 4)
        cdraw.ellipse([ccx - r_i, ccy - r_i, ccx + r_i, ccy + r_i], fill=(cr_val, cg_val, cb_val))

    # Precision milled edge serrations
    num_teeth = 72
    for ti in range(num_teeth):
        tang = (ti / float(num_teeth)) * math.pi * 2
        tx1 = ccx + 236 * math.cos(tang)
        ty1 = ccy + 236 * math.sin(tang)
        tx2 = ccx + 242 * math.cos(tang)
        ty2 = ccy + 242 * math.sin(tang)
        cdraw.line([(tx1, ty1), (tx2, ty2)], fill=(254, 240, 138), width=3)

    # Inner circular bead ring
    cdraw.ellipse([ccx - 200, ccy - 200, ccx + 200, ccy + 200], outline=(180, 83, 9), width=8)
    cdraw.ellipse([ccx - 188, ccy - 188, ccx + 188, ccy + 188], outline=(254, 240, 138), width=3)
    for bi in range(36):
        bang = (bi / 36.0) * math.pi * 2
        bx = ccx + 194 * math.cos(bang)
        by = ccy + 194 * math.sin(bang)
        cdraw.ellipse([bx - 4, by - 4, bx + 4, by + 4], fill=(255, 255, 255))

    # Majestic Eight-pointed star medallion crest with diamond facet cuts
    star_pts = []
    for si in range(16):
        sang = (si / 16.0) * math.pi * 2
        sr = 150 if si % 2 == 0 else 60
        star_pts.append((ccx + sr * math.cos(sang), ccy + sr * math.sin(sang)))
    cdraw.polygon(star_pts, fill=(254, 240, 138), outline=(217, 119, 6), width=4)

    # Facet shade lines
    for si in range(8):
        sang = (si / 8.0) * math.pi * 2
        cdraw.line([(ccx, ccy), (ccx + 150 * math.cos(sang), ccy + 150 * math.sin(sang))], fill=(180, 83, 9), width=3)

    # Center arcade seal stamp: 幣 (Coin)
    draw_seal(cdraw, "幣", ccx, ccy, size=72, font=font_seal, fill=(180, 83, 9), border=(255, 255, 255))

    # Specular radial highlight band across top-left
    cdraw.arc([ccx - 170, ccy - 170, ccx + 170, ccy + 170], 190, 290, fill=(255, 255, 255), width=10)

    coin_img = apply_vignette(coin_img, intensity=0.25)
    coin_img.save(os.path.join(out_dir, "coin-gold.jpg"), "JPEG", quality=92)


# ==============================================================================
# Main Orchestrator
# ==============================================================================

def main():
    print("=== Wave 14 Art Generator Started ===")
    generate_clockwork_keep_assets()
    generate_toy_boxing_assets()
    generate_instant_flash_assets()
    generate_coin_cascade_assets()
    print("=== Wave 14 Art Generation Completed Successfully ===")


if __name__ == '__main__':
    main()
