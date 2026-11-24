#!/usr/bin/env python3
"""
Wave 12 Multi-Battleground Art Generator
Generates high-resolution, tactile game assets adhering to Sakurai game design principles for:
- Clip-Clop (1350x900 royal derby menu hero, 512x512 fairway turf, raked dirt track, hurdle, 1024x512 sky, 512x512 steed portraits: thunder/shadow)
- Switchpoint-Run (1350x900 dispatch yard title hero, 512x512 granite ballast, switch signal, 512x512 runner portraits: standard/freight/courier/express)
- Danmaku-Abyss (1350x900 deep abyss cosmic nebula title hero, 1024x1024 starfield, 512x512 craft portraits: swift/cannon/stitch, 512x512 boss portraits: lantern/tide/frost/ash/abyss)
- Every-Corner (1350x900 cyber circuit title hero, 1350x900 wafer board background, 512x512 circuit tile floor, 512x512 beacon portraits: start/node/end)

Architectural justification: High-fidelity procedural asset generation for 4 games in Wave 12
requires rich mathematical drawing routines, vector rendering, and localized font typography
within a single deterministic, reproducible generation pipeline, mirroring Wave 10 and Wave 11.
"""

import math
import os
import random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SEED = 20261123
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
    # Inner thin seal border
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
# 1. Clip-Clop Assets
# ==============================================================================

def generate_clip_clop_assets():
    print("Generating Clip-Clop assets...")
    out_dir = "Games/Clip-Clop/public"
    tex_dir = os.path.join(out_dir, "textures")
    port_dir = os.path.join(out_dir, "portraits")
    os.makedirs(tex_dir, exist_ok=True)
    os.makedirs(port_dir, exist_ok=True)

    font_seal = get_font(26, prefer_serif=True)
    font_title = get_font(36, prefer_serif=False)

    # 1. Menu Hero (1350x900): Royal Derby Championship Grass Track & Grandstand
    w, h = 1350, 900
    hero = Image.new('RGB', (w, h), (14, 25, 45))
    draw = ImageDraw.Draw(hero)

    # Sunset sky gradient
    for y in range(h // 2 + 50):
        t = y / (h // 2 + 50)
        r = int(28 * (1 - t) + 245 * t * 0.9)
        g = int(60 * (1 - t) + 160 * t * 0.8)
        b = int(120 * (1 - t) + 70 * t * 0.3)
        draw.line([(0, y), (w, y)], fill=(min(255, r), min(255, g), min(255, b)))

    # Golden Sun
    draw.ellipse([w // 2 - 120, h // 3 - 60, w // 2 + 120, h // 3 + 180], fill=(254, 240, 138))

    # Grandstand & Distant Woodland Silhouettes
    for x in range(0, w, 20):
        tree_h = random.randint(320, 370)
        draw.ellipse([x - 25, tree_h - 25, x + 25, tree_h + 30], fill=(20, 48, 30))
    draw.rectangle([100, 330, 480, 450], fill=(30, 40, 60))
    # Grandstand roof angle
    draw.polygon([(80, 330), (500, 330), (450, 270), (130, 270)], fill=(45, 55, 80))

    # Rolling Derby Grass Track
    draw.polygon([(0, 420), (w, 420), (w, h), (0, h)], fill=(34, 120, 50))
    # Mowing stripes
    for stripe in range(0, w, 90):
        draw.polygon([(stripe, 420), (stripe + 45, 420), (stripe + 120, h), (stripe + 75, h)], fill=(40, 140, 60))

    # Raked Clay Track in foreground
    draw.polygon([(0, 680), (w, 680), (w, h), (0, h)], fill=(180, 110, 50))
    for ty in range(680, h, 8):
        draw.line([(0, ty), (w, ty)], fill=(150, 90, 40), width=2)

    # Steeplechase white hurdle & green box hedge
    draw.rectangle([w // 2 - 280, 610, w // 2 + 280, 650], fill=(30, 90, 40))
    draw.rectangle([w // 2 - 290, 580, w // 2 + 290, 605], fill=(245, 245, 245), outline=(50, 50, 50), width=3)
    # Red hazard bands on hurdle
    for hx in [w // 2 - 220, w // 2 - 100, w // 2 + 20, w // 2 + 140]:
        draw.rectangle([hx, 580, hx + 40, 605], fill=(220, 38, 38))

    # Royal Golden Laurel Crest
    cx, cy = w // 2, 160
    draw.ellipse([cx - 90, cy - 70, cx + 90, cy + 70], outline=(234, 179, 8), width=5)
    draw.text((cx, cy - 15), "ROYAL DERBY", fill=(254, 240, 138), font=font_title, anchor="mm")
    draw_seal(draw, "達", cx, cy + 30, size=46, font=font_seal, fill=(185, 28, 28))

    hero = apply_vignette(hero, 0.45)
    hero.save(os.path.join(out_dir, "menu-hero.jpg"), "JPEG", quality=93)

    # 2. Turf Texture (512x512): Manicured Kentucky bluegrass fairway turf
    turf = Image.new('RGB', (512, 512), (34, 110, 48))
    tdraw = ImageDraw.Draw(turf)
    # Alternating mower stripes
    for x in range(0, 512, 64):
        tdraw.rectangle([x, 0, x + 32, 512], fill=(42, 128, 56))
    # Blade noise & dew glints
    for _ in range(4000):
        bx = random.randint(0, 511)
        by = random.randint(0, 511)
        c = random.choice([(30, 95, 40), (50, 145, 62), (65, 165, 75), (200, 240, 210)])
        tdraw.line([(bx, by), (bx, by + random.randint(2, 5))], fill=c, width=1)
    turf = turf.filter(ImageFilter.GaussianBlur(0.8))
    turf.save(os.path.join(tex_dir, "turf.jpg"), "JPEG", quality=92)

    # 3. Dirt Track Texture (512x512): Raked golden-brown clay sand
    dirt = Image.new('RGB', (512, 512), (180, 120, 65))
    ddraw = ImageDraw.Draw(dirt)
    # Rake comb lines
    for y in range(0, 512, 6):
        c = (150 + random.randint(-10, 10), 95 + random.randint(-8, 8), 50 + random.randint(-6, 6))
        ddraw.line([(0, y), (512, y)], fill=c, width=2)
    # Granular sand flecks
    for _ in range(3500):
        px = random.randint(0, 511)
        py = random.randint(0, 511)
        c = random.choice([(210, 150, 90), (140, 85, 40), (120, 70, 30)])
        ddraw.point((px, py), fill=c)
    dirt = dirt.filter(ImageFilter.GaussianBlur(0.6))
    dirt.save(os.path.join(tex_dir, "dirt.jpg"), "JPEG", quality=92)

    # 4. Sky Texture (1024x512): Atmospheric Royal Derby Summer Sky
    sky = Image.new('RGB', (1024, 512), (80, 160, 230))
    sdraw = ImageDraw.Draw(sky)
    for y in range(512):
        t = y / 512.0
        r = int(90 * (1 - t) + 240 * t)
        g = int(170 * (1 - t) + 215 * t)
        b = int(240 * (1 - t) + 160 * t)
        sdraw.line([(0, y), (1024, y)], fill=(r, g, b))
    # Soft cumulus clouds
    for _ in range(16):
        clx = random.randint(40, 980)
        cly = random.randint(80, 360)
        cl_rad = random.randint(50, 110)
        sdraw.ellipse([clx - cl_rad, cly - cl_rad // 2, clx + cl_rad, cly + cl_rad // 2], fill=(255, 255, 255))
    sky = sky.filter(ImageFilter.GaussianBlur(18.0))
    sky.save(os.path.join(tex_dir, "sky.jpg"), "JPEG", quality=92)

    # 5. Hurdle Texture (512x512): Traditional steeplechase timber & hedge
    hurdle = Image.new('RGB', (512, 512), (245, 245, 245))
    hdraw = ImageDraw.Draw(hurdle)
    # Timber horizontal slats
    for y in [60, 160, 260]:
        hdraw.rectangle([0, y, 512, y + 60], fill=(235, 235, 240), outline=(80, 80, 80), width=3)
        # Diagonal red hazard stripes
        for x in range(-100, 600, 120):
            hdraw.polygon([(x, y), (x + 50, y), (x + 90, y + 60), (x + 40, y + 60)], fill=(220, 38, 38))
    # Green hedge base
    hdraw.rectangle([0, 350, 512, 512], fill=(25, 80, 35))
    for _ in range(1200):
        hx = random.randint(0, 511)
        hy = random.randint(350, 511)
        hdraw.point((hx, hy), fill=random.choice([(40, 130, 55), (15, 60, 25), (60, 170, 75)]))
    hurdle.save(os.path.join(tex_dir, "hurdle.jpg"), "JPEG", quality=92)

    # 6. Thoroughbred Portrait: Thunder "疾風" (512x512)
    p_size = 512
    im_thunder = Image.new('RGB', (p_size, p_size), (24, 18, 12))
    pdraw = ImageDraw.Draw(im_thunder)
    # Radial gold flare
    cx, cy = p_size // 2, p_size // 2
    for r in range(p_size, 0, -3):
        t = r / p_size
        pdraw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(int(217 * (1 - t)), int(119 * (1 - t * 0.8)), int(6 * (1 - t))))
    # Thoroughbred Steed Silhouette & Head
    # Head & Neck
    pdraw.polygon([(160, 480), (220, 220), (330, 220), (410, 320), (370, 480)], fill=(150, 75, 25), outline=(60, 30, 10), width=4)
    # Ears
    pdraw.polygon([(220, 220), (235, 140), (265, 210)], fill=(140, 70, 20), outline=(60, 30, 10), width=3)
    pdraw.polygon([(265, 210), (285, 135), (310, 205)], fill=(155, 80, 25), outline=(60, 30, 10), width=3)
    # Muzzle & Nose
    pdraw.ellipse([340, 280, 420, 350], fill=(130, 65, 20), outline=(50, 25, 10), width=3)
    pdraw.ellipse([385, 310, 405, 330], fill=(40, 20, 10))
    # Eye
    pdraw.ellipse([285, 245, 310, 270], fill=(25, 15, 8))
    pdraw.ellipse([292, 250, 298, 256], fill=(255, 255, 255))
    # Golden Mane
    for my in range(180, 420, 16):
        pdraw.line([(220, my), (140, my + 35)], fill=(245, 158, 11), width=6)
    # Leather Bridle with brass studs
    pdraw.line([(250, 210), (370, 320)], fill=(80, 40, 15), width=5)
    pdraw.line([(310, 260), (350, 240)], fill=(80, 40, 15), width=4)
    pdraw.ellipse([360, 310, 375, 325], fill=(234, 179, 8), outline=(120, 80, 10), width=2)
    # Seal: 「風」
    draw_seal(pdraw, "風", p_size - 65, p_size - 65, size=52, font=font_seal, fill=(185, 28, 28))
    # Outer frame
    pdraw.rectangle([6, 6, p_size - 7, p_size - 7], outline=(234, 179, 8), width=5)
    im_thunder.save(os.path.join(port_dir, "thunder.jpg"), "JPEG", quality=95)

    # 7. Thoroughbred Portrait: Shadow "夜影" (512x512)
    im_shadow = Image.new('RGB', (p_size, p_size), (12, 14, 24))
    sdraw = ImageDraw.Draw(im_shadow)
    for r in range(p_size, 0, -3):
        t = r / p_size
        sdraw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(int(88 * (1 - t * 0.7)), int(28 * (1 - t)), int(135 * (1 - t * 0.6))))
    # Black Steed
    sdraw.polygon([(160, 480), (220, 220), (330, 220), (410, 320), (370, 480)], fill=(30, 32, 40), outline=(15, 16, 22), width=4)
    sdraw.polygon([(220, 220), (235, 140), (265, 210)], fill=(25, 27, 35), outline=(15, 16, 22), width=3)
    sdraw.polygon([(265, 210), (285, 135), (310, 205)], fill=(28, 30, 38), outline=(15, 16, 22), width=3)
    sdraw.ellipse([340, 280, 420, 350], fill=(25, 27, 34), outline=(10, 10, 15), width=3)
    sdraw.ellipse([385, 310, 405, 330], fill=(10, 10, 15))
    sdraw.ellipse([285, 245, 310, 270], fill=(15, 15, 20))
    sdraw.ellipse([292, 250, 298, 256], fill=(192, 132, 252))
    # Silver-grey braided mane
    for my in range(180, 420, 16):
        sdraw.line([(220, my), (140, my + 35)], fill=(203, 213, 225), width=6)
    # Crimson Bridle & Ribbon
    sdraw.line([(250, 210), (370, 320)], fill=(190, 24, 93), width=5)
    sdraw.ellipse([360, 310, 375, 325], fill=(244, 114, 182), outline=(131, 24, 67), width=2)
    # Seal: 「影」
    draw_seal(sdraw, "影", p_size - 65, p_size - 65, size=52, font=font_seal, fill=(131, 24, 67))
    sdraw.rectangle([6, 6, p_size - 7, p_size - 7], outline=(192, 132, 252), width=5)
    im_shadow.save(os.path.join(port_dir, "shadow.jpg"), "JPEG", quality=95)


# ==============================================================================
# 2. Switchpoint-Run Assets
# ==============================================================================

def generate_switchpoint_run_assets():
    print("Generating Switchpoint-Run assets...")
    out_dir = "Games/Switchpoint-Run/public"
    run_dir = os.path.join(out_dir, "runners")
    tex_dir = os.path.join(out_dir, "textures")
    os.makedirs(run_dir, exist_ok=True)
    os.makedirs(tex_dir, exist_ok=True)

    font_seal = get_font(26, prefer_serif=True)
    font_title = get_font(34, prefer_serif=False)

    # 1. Title BG (1350x900): High-speed Railway Dispatch Center & Convergence Tracks
    w, h = 1350, 900
    title_bg = Image.new('RGB', (w, h), (8, 14, 22))
    draw = ImageDraw.Draw(title_bg)

    # Midnight cyber sky with neon grid skyline
    for y in range(h // 2):
        t = y / (h // 2)
        r = int(10 * (1 - t) + 20 * t)
        g = int(15 * (1 - t) + 40 * t)
        b = int(35 * (1 - t) + 75 * t)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    # Distant skyline towers
    for tx in range(0, w, 55):
        th = random.randint(220, 380)
        draw.rectangle([tx, th, tx + 45, 450], fill=(16, 26, 42))
        for wy in range(th + 10, 440, 24):
            if random.random() > 0.4:
                draw.rectangle([tx + 8, wy, tx + 20, wy + 14], fill=(52, 211, 153))

    # Dispatch Control Tower
    draw.rectangle([w // 2 - 120, 140, w // 2 + 120, 450], fill=(25, 38, 58), outline=(52, 211, 153), width=2)
    # Luminous route board
    draw.rectangle([w // 2 - 90, 180, w // 2 + 90, 260], fill=(6, 78, 59), outline=(110, 231, 183), width=2)
    draw.text((w // 2, 220), "CENTRAL DISPATCH", fill=(167, 243, 208), font=font_title, anchor="mm")

    # Multi-lane Railway Bed Converging to Perspective Horizon
    draw.polygon([(0, 450), (w, 450), (w, h), (0, h)], fill=(18, 24, 32))
    # Ballast gravel texture
    for _ in range(5000):
        gx = random.randint(0, w - 1)
        gy = random.randint(450, h - 1)
        draw.point((gx, gy), fill=random.choice([(35, 45, 58), (22, 30, 40), (55, 65, 80)]))

    # Perspective Tracks & Wooden Ties
    cx = w // 2
    for step in range(450, h, 14):
        tw = (step - 450) * 1.8 + 80
        draw.rectangle([cx - tw, step, cx + tw, step + 6], fill=(45, 32, 20), outline=(20, 15, 10))

    # Glowing Rails (3 converging pairs)
    for offset in [-0.65, 0.0, 0.65]:
        draw.line([(cx + offset * 60, 450), (cx + offset * 700 - 30, h)], fill=(52, 211, 153), width=4)
        draw.line([(cx + offset * 60 + 20, 450), (cx + offset * 700 + 30, h)], fill=(52, 211, 153), width=4)

    # Approaching Bullet Train with Blinding Headlights
    draw.polygon([(cx - 70, 390), (cx + 70, 390), (cx + 90, 490), (cx - 90, 490)], fill=(226, 232, 240), outline=(30, 41, 59), width=3)
    draw.ellipse([cx - 55, 440, cx - 25, 470], fill=(254, 240, 138))
    draw.ellipse([cx + 25, 440, cx + 55, 470], fill=(254, 240, 138))

    title_bg = apply_vignette(title_bg, 0.45)
    title_bg.save(os.path.join(out_dir, "title-bg.jpg"), "JPEG", quality=92)

    # 2. Ballast Texture (512x512): Granite railway ballast gravel & steel tie-plates
    ballast = Image.new('RGB', (512, 512), (32, 35, 42))
    bdraw = ImageDraw.Draw(ballast)
    for _ in range(8000):
        bx = random.randint(0, 511)
        by = random.randint(0, 511)
        c = random.choice([(45, 50, 60), (22, 24, 30), (60, 68, 80), (18, 20, 25), (75, 85, 100)])
        bdraw.rectangle([bx, by, bx + random.randint(2, 5), by + random.randint(2, 5)], fill=c)
    # Creosote timber tie
    bdraw.rectangle([0, 200, 512, 290], fill=(42, 28, 18), outline=(20, 12, 8), width=3)
    # Steel tie plate
    bdraw.rectangle([120, 195, 200, 295], fill=(75, 85, 95), outline=(30, 35, 40), width=2)
    bdraw.ellipse([135, 210, 147, 222], fill=(20, 25, 30))
    bdraw.ellipse([175, 210, 187, 222], fill=(20, 25, 30))
    bdraw.ellipse([135, 270, 147, 282], fill=(20, 25, 30))
    bdraw.ellipse([175, 270, 187, 282], fill=(20, 25, 30))
    ballast = ballast.filter(ImageFilter.GaussianBlur(0.7))
    ballast.save(os.path.join(tex_dir, "ballast.jpg"), "JPEG", quality=92)

    # 3. Signal Indicator Texture (512x512)
    sig = Image.new('RGB', (512, 512), (20, 24, 32))
    sdraw = ImageDraw.Draw(sig)
    # Triple signal housing
    sdraw.rounded_rectangle([180, 40, 332, 472], radius=40, fill=(15, 18, 24), outline=(80, 90, 105), width=6)
    # Red lens (stop/hazard)
    sdraw.ellipse([206, 65, 306, 165], fill=(239, 68, 68), outline=(153, 27, 27), width=4)
    # Amber lens (caution)
    sdraw.ellipse([206, 205, 306, 305], fill=(245, 158, 11), outline=(180, 83, 9), width=4)
    # Green lens (clear go)
    sdraw.ellipse([206, 345, 306, 445], fill=(16, 185, 129), outline=(4, 120, 87), width=4)
    sig = sig.filter(ImageFilter.GaussianBlur(0.8))
    sig.save(os.path.join(tex_dir, "signal.jpg"), "JPEG", quality=92)

    # 4. Four Unlockable Runner Portraits (512x512)
    runners = [
        {"id": "standard", "name": "標準", "color": (16, 185, 129), "accent": (5, 150, 105), "seal": "標", "type": "switcher"},
        {"id": "freight", "name": "重載", "color": (245, 158, 11), "accent": (180, 83, 9), "seal": "載", "type": "hauler"},
        {"id": "courier", "name": "迅捷", "color": (6, 182, 212), "accent": (8, 145, 178), "seal": "捷", "type": "maglev"},
        {"id": "express", "name": "特快", "color": (168, 85, 247), "accent": (126, 34, 206), "seal": "特", "type": "bullet"},
    ]

    size = 512
    cx, cy = size // 2, size // 2
    for r in runners:
        im_run = Image.new('RGB', (size, size), (12, 16, 24))
        rdraw = ImageDraw.Draw(im_run)
        cr, cg, cb = r["color"]
        for rad in range(size, 0, -3):
            t = rad / size
            rdraw.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=(int(cr * (1 - t * 0.8)), int(cg * (1 - t * 0.8)), int(cb * (1 - t * 0.8))))

        # High-Tech Rail Cart / Locomotive Body
        rdraw.rounded_rectangle([110, 160, 402, 380], radius=32, fill=(30, 41, 59), outline=r["color"], width=5)
        # Cockpit Window Canopy
        rdraw.rounded_rectangle([150, 190, 362, 270], radius=16, fill=(15, 23, 42), outline=(148, 163, 184), width=3)
        # Dual Searchlights
        rdraw.ellipse([135, 300, 195, 360], fill=(254, 240, 138), outline=r["color"], width=4)
        rdraw.ellipse([317, 300, 377, 360], fill=(254, 240, 138), outline=r["color"], width=4)
        # Cowcatcher / Track plow at bottom
        rdraw.polygon([(100, 390), (412, 390), (370, 440), (142, 440)], fill=(71, 85, 105), outline=(30, 41, 59), width=3)
        # Hazard stripes
        for sx in range(120, 390, 40):
            rdraw.polygon([(sx, 390), (sx + 20, 390), (sx + 10, 440), (sx - 10, 440)], fill=r["accent"])

        # Character seal
        draw_seal(rdraw, r["seal"], size - 65, size - 65, size=52, font=font_seal, fill=(185, 28, 28))
        # Frame
        rdraw.rectangle([6, 6, size - 7, size - 7], outline=r["color"], width=5)
        im_run.save(os.path.join(run_dir, f"{r['id']}.jpg"), "JPEG", quality=95)


# ==============================================================================
# 3. Danmaku-Abyss Assets
# ==============================================================================

def generate_danmaku_abyss_assets():
    print("Generating Danmaku-Abyss assets...")
    out_dir = "Games/Danmaku-Abyss/public"
    craft_dir = os.path.join(out_dir, "crafts")
    boss_dir = os.path.join(out_dir, "bosses")
    tex_dir = os.path.join(out_dir, "textures")
    os.makedirs(craft_dir, exist_ok=True)
    os.makedirs(boss_dir, exist_ok=True)
    os.makedirs(tex_dir, exist_ok=True)

    font_seal = get_font(26, prefer_serif=True)
    font_title = get_font(34, prefer_serif=False)

    # 1. Title BG (1350x900): Deep Cosmic Abyss Nebula & Arcane Danmaku Circles
    w, h = 1350, 900
    title_bg = Image.new('RGB', (w, h), (4, 4, 14))
    draw = ImageDraw.Draw(title_bg)

    # Swirling cosmic nebula layers
    cx, cy = w // 2, h // 2
    for _ in range(35):
        nx = random.randint(100, w - 100)
        ny = random.randint(100, h - 100)
        nr = random.randint(140, 320)
        c = random.choice([
            (76, 29, 149),   # deep violet
            (219, 39, 119),  # neon magenta
            (14, 116, 144),  # abyssal cyan
            (30, 27, 75),    # dark indigo
        ])
        draw.ellipse([nx - nr, ny - nr // 2, nx + nr, ny + nr // 2], fill=c)
    title_bg = title_bg.filter(ImageFilter.GaussianBlur(55.0))
    draw = ImageDraw.Draw(title_bg)

    # Dense Starfield
    for _ in range(800):
        sx = random.randint(0, w - 1)
        sy = random.randint(0, h - 1)
        draw.point((sx, sy), fill=random.choice([(255, 255, 255), (199, 210, 254), (253, 230, 138), (165, 243, 252)]))

    # Arcane Danmaku Spellcard Circles (Concentric geometric runes)
    for rad in [140, 240, 360, 480]:
        draw.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], outline=(244, 114, 182), width=2)
    # Radial Danmaku Emitters
    for angle in range(0, 360, 30):
        rad = math.radians(angle)
        x1 = cx + 140 * math.cos(rad)
        y1 = cy + 140 * math.sin(rad)
        x2 = cx + 480 * math.cos(rad)
        y2 = cy + 480 * math.sin(rad)
        draw.line([(x1, y1), (x2, y2)], fill=(34, 211, 238), width=1)

    # Title Crest & Seal
    draw.text((cx, 160), "DANMAKU ABYSS", fill=(165, 243, 252), font=font_title, anchor="mm")
    draw_seal(draw, "淵", cx, 220, size=52, font=font_seal, fill=(112, 26, 117), border=(244, 114, 182))

    title_bg = apply_vignette(title_bg, 0.4)
    title_bg.save(os.path.join(out_dir, "title-bg.jpg"), "JPEG", quality=92)

    # 2. Starfield Texture (1024x1024): Seamless infinite deep cosmos
    sf = Image.new('RGB', (1024, 1024), (5, 6, 16))
    sdraw = ImageDraw.Draw(sf)
    for _ in range(1500):
        sx = random.randint(0, 1023)
        sy = random.randint(0, 1023)
        srad = 1 if random.random() > 0.1 else 2
        sdraw.ellipse([sx - srad, sy - srad, sx + srad, sy + srad], fill=random.choice([(255, 255, 255), (165, 243, 252), (244, 114, 182), (253, 230, 138)]))
    sf = sf.filter(ImageFilter.GaussianBlur(0.5))
    sf.save(os.path.join(tex_dir, "starfield.jpg"), "JPEG", quality=92)

    # 3. Three Playable Crafts (512x512)
    crafts = [
        {"id": "swift", "name": "迅羽", "color": (34, 211, 238), "hull": (15, 23, 42), "seal": "羽"},
        {"id": "cannon", "name": "重炮", "color": (239, 68, 68), "hull": (30, 20, 24), "seal": "炮"},
        {"id": "stitch", "name": "縫影", "color": (168, 85, 247), "hull": (24, 16, 36), "seal": "影"},
    ]

    size = 512
    cx, cy = size // 2, size // 2
    for c in crafts:
        im_cr = Image.new('RGB', (size, size), (6, 9, 20))
        cdraw = ImageDraw.Draw(im_cr)
        pr, pg, pb = c["color"]
        for r in range(size, 0, -3):
            t = r / size
            cdraw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(int(pr * (1 - t * 0.8)), int(pg * (1 - t * 0.8)), int(pb * (1 - t * 0.8))))

        # High-Fidelity Starfighter
        # Main Forward Fuselage
        cdraw.polygon([(cx, 80), (cx - 65, 360), (cx + 65, 360)], fill=c["hull"], outline=c["color"], width=4)
        # Swept Energy Wings
        cdraw.polygon([(cx - 50, 240), (cx - 200, 380), (cx - 40, 360)], fill=c["color"])
        cdraw.polygon([(cx + 50, 240), (cx + 200, 380), (cx + 40, 360)], fill=c["color"])
        # Cockpit canopy (Glass cyan glow)
        cdraw.ellipse([cx - 25, 170, cx + 25, 270], fill=(14, 165, 233), outline=(255, 255, 255), width=2)
        # Core Hitbox Point (Precision pink core)
        cdraw.ellipse([cx - 8, cy - 8, cx + 8, cy + 8], fill=(244, 114, 182), outline=(255, 255, 255), width=2)

        draw_seal(cdraw, c["seal"], size - 65, size - 65, size=52, font=font_seal, fill=(112, 26, 117), border=(244, 114, 182))
        cdraw.rectangle([6, 6, size - 7, size - 7], outline=c["color"], width=5)
        im_cr.save(os.path.join(craft_dir, f"{c['id']}.jpg"), "JPEG", quality=95)

    # 4. Five Boss Portraits (512x512)
    bosses = [
        {"id": "lantern", "name": "燈守", "color": (245, 158, 11), "seal": "燈"},
        {"id": "tide", "name": "潮鳴", "color": (6, 182, 212), "seal": "潮"},
        {"id": "frost", "name": "刃霜", "color": (96, 165, 250), "seal": "霜"},
        {"id": "ash", "name": "燼裔", "color": (239, 68, 68), "seal": "燼"},
        {"id": "abyss", "name": "深淵", "color": (217, 70, 239), "seal": "淵"},
    ]

    for b in bosses:
        im_b = Image.new('RGB', (size, size), (10, 8, 22))
        bdraw = ImageDraw.Draw(im_b)
        br, bg, bb = b["color"]
        for r in range(size, 0, -3):
            t = r / size
            bdraw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(int(br * (1 - t * 0.75)), int(bg * (1 - t * 0.75)), int(bb * (1 - t * 0.75))))

        # Celestial Entity / Leviathan Core
        bdraw.ellipse([cx - 110, cy - 110, cx + 110, cy + 110], fill=(24, 18, 38), outline=b["color"], width=5)
        # Orbiting runic blades / talismans
        for angle in range(0, 360, 45):
            rad = math.radians(angle)
            ox = cx + int(170 * math.cos(rad))
            oy = cy + int(170 * math.sin(rad))
            bdraw.polygon([(ox, oy - 25), (ox + 18, oy + 25), (ox - 18, oy + 25)], fill=b["color"])
        # Inner Singularity Eye
        bdraw.ellipse([cx - 50, cy - 50, cx + 50, cy + 50], fill=(255, 255, 255), outline=b["color"], width=4)

        draw_seal(bdraw, b["seal"], size - 65, size - 65, size=52, font=font_seal, fill=(112, 26, 117), border=(244, 114, 182))
        bdraw.rectangle([6, 6, size - 7, size - 7], outline=b["color"], width=5)
        im_b.save(os.path.join(boss_dir, f"{b['id']}.jpg"), "JPEG", quality=95)


# ==============================================================================
# 4. Every-Corner Assets
# ==============================================================================

def generate_every_corner_assets():
    print("Generating Every-Corner assets...")
    out_dir = "Games/Every-Corner/public"
    beacon_dir = os.path.join(out_dir, "beacons")
    os.makedirs(beacon_dir, exist_ok=True)

    font_seal = get_font(26, prefer_serif=True)
    font_title = get_font(34, prefer_serif=False)
    font_num = get_font(42, prefer_serif=False)

    # 1. Title BG (1350x900): Cyber Circuit Matrix with Pulsing Traces
    w, h = 1350, 900
    title_bg = Image.new('RGB', (w, h), (12, 9, 22))
    draw = ImageDraw.Draw(title_bg)

    # Dark cyber violet gradient
    for y in range(h):
        t = y / float(h)
        r = int(12 * (1 - t) + 26 * t)
        g = int(9 * (1 - t) + 18 * t)
        b = int(22 * (1 - t) + 48 * t)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    # Grid Lines (Wafer Substrate)
    cell = 60
    for x in range(0, w, cell):
        draw.line([(x, 0), (x, h)], fill=(36, 26, 61), width=1)
    for y in range(0, h, cell):
        draw.line([(0, y), (w, y)], fill=(36, 26, 61), width=1)

    # Luminous Circuit Paths with glow
    paths = [
        [(180, 240), (420, 240), (420, 480), (780, 480), (780, 720), (1140, 720)],
        [(240, 660), (240, 420), (600, 420), (600, 180), (960, 180)],
    ]
    for p in paths:
        for idx in range(len(p) - 1):
            draw.line([p[idx], p[idx + 1]], fill=(167, 139, 250), width=6)
            draw.line([p[idx], p[idx + 1]], fill=(255, 255, 255), width=2)

    # Milestone Checkpoint Nodes
    cx, cy = w // 2, 170
    draw.text((cx, cy - 20), "CYBER CIRCUIT MATRIX", fill=(167, 139, 250), font=font_title, anchor="mm")
    draw_seal(draw, "通", cx, cy + 35, size=48, font=font_seal, fill=(76, 29, 149), border=(196, 181, 253))

    title_bg = apply_vignette(title_bg, 0.45)
    title_bg.save(os.path.join(out_dir, "title-bg.jpg"), "JPEG", quality=92)

    # 2. Board BG (1350x900): Semiconductor Wafer Master Board
    board_bg = Image.new('RGB', (w, h), (18, 14, 30))
    bdraw = ImageDraw.Draw(board_bg)
    # Subtle silicon wafer grain
    for _ in range(6000):
        px = random.randint(0, w - 1)
        py = random.randint(0, h - 1)
        bdraw.point((px, py), fill=random.choice([(25, 20, 40), (14, 11, 24), (32, 25, 52)]))
    # Outer brass corner mounts
    bdraw.rectangle([30, 30, 120, 42], fill=(234, 179, 8))
    bdraw.rectangle([30, 30, 42, 120], fill=(234, 179, 8))
    bdraw.rectangle([w - 120, 30, w - 30, 42], fill=(234, 179, 8))
    bdraw.rectangle([w - 42, 30, w - 30, 120], fill=(234, 179, 8))
    bdraw.rectangle([30, h - 42, 120, h - 30], fill=(234, 179, 8))
    bdraw.rectangle([30, h - 120, 42, h - 30], fill=(234, 179, 8))
    bdraw.rectangle([w - 120, h - 42, w - 30, h - 30], fill=(234, 179, 8))
    bdraw.rectangle([w - 42, h - 120, w - 30, h - 30], fill=(234, 179, 8))
    board_bg = board_bg.filter(ImageFilter.GaussianBlur(0.6))
    board_bg.save(os.path.join(out_dir, "board-bg.jpg"), "JPEG", quality=92)

    # 3. Tile Floor Texture (512x512): Precision Silicon Wafer Cell Tile
    tile = Image.new('RGB', (512, 512), (28, 22, 46))
    tdraw = ImageDraw.Draw(tile)
    # Beveled edges
    tdraw.rectangle([16, 16, 496, 496], fill=(36, 28, 60), outline=(88, 68, 130), width=4)
    # Gold contact pins on corners
    for px, py in [(32, 32), (480, 32), (32, 480), (480, 480)]:
        tdraw.ellipse([px - 14, py - 14, px + 14, py + 14], fill=(234, 179, 8), outline=(133, 77, 14), width=2)
    # Center copper dissipation pad
    tdraw.rounded_rectangle([180, 180, 332, 332], radius=18, fill=(180, 83, 9), outline=(245, 158, 11), width=3)
    tile = tile.filter(ImageFilter.GaussianBlur(0.6))
    tile.save(os.path.join(out_dir, "tile-floor.jpg"), "JPEG", quality=92)

    # 4. Checkpoint Node Beacons (512x512): Start (始), Node (通), End (終)
    beacons = [
        {"id": "checkpoint-start", "num": "1", "seal": "始", "color": (34, 211, 238), "core": (6, 78, 59)},
        {"id": "checkpoint-node", "num": "★", "seal": "通", "color": (168, 85, 247), "core": (76, 29, 149)},
        {"id": "checkpoint-end", "num": "Ω", "seal": "終", "color": (245, 158, 11), "core": (120, 53, 15)},
    ]

    size = 512
    cx, cy = size // 2, size // 2
    for b in beacons:
        im_b = Image.new('RGB', (size, size), (15, 12, 28))
        bdraw = ImageDraw.Draw(im_b)
        br, bg, bb = b["color"]
        for r in range(size, 0, -3):
            t = r / size
            bdraw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(int(br * (1 - t * 0.7)), int(bg * (1 - t * 0.7)), int(bb * (1 - t * 0.7))))

        # High-Voltage Quantum Emitter Beacon
        bdraw.ellipse([cx - 130, cy - 130, cx + 130, cy + 130], fill=b["core"], outline=b["color"], width=8)
        bdraw.ellipse([cx - 85, cy - 85, cx + 85, cy + 85], fill=(255, 255, 255), outline=b["color"], width=4)
        bdraw.text((cx, cy), b["num"], fill=b["color"], font=font_num, anchor="mm")

        draw_seal(bdraw, b["seal"], size - 65, size - 65, size=52, font=font_seal, fill=(185, 28, 28))
        bdraw.rectangle([6, 6, size - 7, size - 7], outline=b["color"], width=5)
        im_b.save(os.path.join(beacon_dir, f"{b['id']}.jpg"), "JPEG", quality=95)


def main():
    print("=== Starting Wave 12 Art Generation ===")
    generate_clip_clop_assets()
    generate_switchpoint_run_assets()
    generate_danmaku_abyss_assets()
    generate_every_corner_assets()
    print("=== Wave 12 Art Generation Complete! ===")


if __name__ == "__main__":
    main()
