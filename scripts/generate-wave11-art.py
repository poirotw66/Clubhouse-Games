#!/usr/bin/env python3
"""
Wave 11 Multi-Battleground Art Generator
Generates high-resolution, tactile game assets for:
- Toy-Baseball (512x512 batter & pitcher portraits, infield clay, diamond turf, championship sky, menu hero)
- Fifteen-Puzzle (512x512 luxury hardwood tile-face, 1024x1024 master clubhouse painting, walnut board bg)
- Brick-Kart-Racing (512x512 4 racer portraits: red/green/yellow/blue, track skies, menu bg)
- Cyber-Neon-Rush (1024x1024 wet cyber road, 512x512 cyber car, drone, barrier, cone, menu bg)
"""

import math
import os
import random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SEED = 20261122
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
    r0, g0, b0 = base_rgb
    for y in range(0, height, 2):
        wave = math.sin(y * 0.04) * 0.5 + math.sin(y * 0.12) * 0.25
        jitter = (random.random() - 0.5) * grain_intensity * 255
        delta = int(wave * grain_intensity * 60 + jitter)
        r = max(0, min(255, r0 + delta))
        g = max(0, min(255, g0 + int(delta * 0.85)))
        b = max(0, min(255, b0 + int(delta * 0.7)))
        draw.line([(0, y), (width, y)], fill=(r, g, b), width=2)
        
    img = img.filter(ImageFilter.GaussianBlur(1.2))
    vignette = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    vdraw = ImageDraw.Draw(vignette)
    cx, cy = width / 2.0, height / 2.2
    max_dist = math.sqrt(cx * cx + cy * cy)
    for step in range(30):
        radius = max_dist * (1.0 - step / 30.0)
        alpha = int(140 * (step / 30.0) ** 1.8)
        bbox = [cx - radius, cy - radius * 0.7, cx + radius, cy + radius * 0.7]
        vdraw.ellipse(bbox, fill=(0, 0, 0, alpha))
        
    vignette = vignette.filter(ImageFilter.GaussianBlur(35.0))
    img.paste(Image.composite(Image.new('RGB', (width, height), (15, 10, 8)), img, vignette.split()[3]), (0, 0))
    return img


def generate_toy_baseball_assets():
    print("Generating Toy-Baseball assets...")
    out_dir = "Games/Toy-Baseball/public"
    port_dir = os.path.join(out_dir, "portraits")
    os.makedirs(port_dir, exist_ok=True)
    
    font_seal = get_font(28, prefer_serif=True)
    font_name = get_font(32, prefer_serif=False)
    
    # 1. Batter Portrait (512x512): Toy Tiger Batter
    size = 512
    im_batter = Image.new('RGB', (size, size), (245, 158, 11))
    draw = ImageDraw.Draw(im_batter)
    # Background stadium flare radial gradient
    cx, cy = size // 2, size // 2
    for r in range(size, 0, -2):
        t = r / size
        # Gold to dark amber background
        cr = int(245 * (1 - t * 0.6))
        cg = int(158 * (1 - t * 0.7))
        cb = int(11 * (1 - t * 0.5))
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(cr, cg, cb))
        
    # Tiger stripes in background
    for ang in range(-45, 225, 30):
        rad = math.radians(ang)
        x1 = cx + 180 * math.cos(rad)
        y1 = cy + 180 * math.sin(rad)
        x2 = cx + 320 * math.cos(rad + 0.15)
        y2 = cy + 320 * math.sin(rad + 0.15)
        draw.line([(x1, y1), (x2, y2)], fill=(180, 83, 9), width=14)
        
    im_batter = im_batter.filter(ImageFilter.GaussianBlur(1.0))
    draw = ImageDraw.Draw(im_batter)
    
    # Heroic Toy Tiger Batter Figure
    # Tiger ears
    draw.ellipse([140, 90, 200, 160], fill=(217, 119, 6), outline=(120, 53, 15), width=4)
    draw.ellipse([155, 105, 185, 145], fill=(254, 215, 170))
    draw.ellipse([312, 90, 372, 160], fill=(217, 119, 6), outline=(120, 53, 15), width=4)
    draw.ellipse([327, 105, 357, 145], fill=(254, 215, 170))
    
    # Batting Helmet (Navy blue with gold tiger emblem)
    draw.ellipse([150, 110, 362, 300], fill=(30, 58, 138), outline=(245, 158, 11), width=6)
    # Helmet visor
    draw.chord([140, 190, 372, 320], 0, 180, fill=(30, 41, 59), outline=(245, 158, 11), width=4)
    # Ear flap protector on left (batter view)
    draw.ellipse([135, 180, 185, 270], fill=(30, 58, 138), outline=(245, 158, 11), width=4)
    
    # Face underneath
    draw.ellipse([190, 200, 322, 310], fill=(245, 158, 11))
    # Snout / muzzle
    draw.ellipse([215, 235, 297, 295], fill=(254, 243, 199))
    draw.polygon([(245, 245), (267, 245), (256, 260)], fill=(30, 20, 20))
    # Determined eyes
    draw.ellipse([210, 215, 240, 238], fill=(255, 255, 255))
    draw.ellipse([222, 220, 238, 235], fill=(15, 23, 42))
    draw.ellipse([272, 215, 302, 238], fill=(255, 255, 255))
    draw.ellipse([275, 220, 290, 235], fill=(15, 23, 42))
    
    # Wooden Bat resting on shoulder
    draw.line([(100, 140), (200, 360)], fill=(217, 119, 6), width=24)
    draw.line([(95, 135), (140, 210)], fill=(245, 158, 11), width=28)
    draw.line([(195, 350), (210, 380)], fill=(254, 243, 199), width=18)
    
    # Tiger Team Jersey
    draw.rounded_rectangle([150, 310, 362, 490], radius=32, fill=(245, 158, 11), outline=(30, 58, 138), width=5)
    # Jersey stripes
    draw.line([(256, 310), (256, 490)], fill=(30, 58, 138), width=4)
    draw.line([(205, 330), (205, 480)], fill=(30, 58, 138), width=3)
    draw.line([(307, 330), (307, 480)], fill=(30, 58, 138), width=3)
    
    # Red Chinese Seal on bottom right: 「打」 (Hit/Batter)
    seal_x, seal_y = size - 70, size - 70
    draw.rectangle([seal_x - 30, seal_y - 30, seal_x + 30, seal_y + 30], fill=(185, 28, 28), outline=(254, 202, 202), width=2)
    draw.text((seal_x, seal_y), "打", fill=(255, 255, 255), font=font_seal, anchor="mm")
    
    # Outer frame
    draw.rectangle([6, 6, size - 7, size - 7], outline=(245, 158, 11), width=4)
    im_batter.save(os.path.join(port_dir, "batter.jpg"), "JPEG", quality=95)
    
    # 2. Pitcher Portrait (512x512): Toy Tiger Ace Pitcher
    im_pitcher = Image.new('RGB', (size, size), (30, 58, 138))
    draw = ImageDraw.Draw(im_pitcher)
    for r in range(size, 0, -2):
        t = r / size
        cr = int(30 * (1 - t * 0.5))
        cg = int(58 * (1 - t * 0.6))
        cb = int(138 * (1 - t * 0.7) + 50 * (1 - t))
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(cr, cg, cb))
        
    im_pitcher = im_pitcher.filter(ImageFilter.GaussianBlur(1.0))
    draw = ImageDraw.Draw(im_pitcher)
    
    # Tiger ears
    draw.ellipse([140, 90, 200, 160], fill=(217, 119, 6), outline=(120, 53, 15), width=4)
    draw.ellipse([155, 105, 185, 145], fill=(254, 215, 170))
    draw.ellipse([312, 90, 372, 160], fill=(217, 119, 6), outline=(120, 53, 15), width=4)
    draw.ellipse([327, 105, 357, 145], fill=(254, 215, 170))
    
    # Baseball Pitcher Cap (Classic Navy & Gold Brim)
    draw.ellipse([150, 100, 362, 260], fill=(30, 58, 138), outline=(245, 158, 11), width=5)
    draw.ellipse([160, 180, 352, 230], fill=(245, 158, 11), outline=(180, 83, 9), width=3)
    # Cap button & emblem
    draw.ellipse([250, 96, 262, 108], fill=(245, 158, 11))
    draw.text((256, 145), "T", fill=(245, 158, 11), font=font_seal, anchor="mm")
    
    # Tiger Pitcher Face
    draw.ellipse([190, 190, 322, 305], fill=(245, 158, 11))
    draw.ellipse([215, 230, 297, 290], fill=(254, 243, 199))
    draw.polygon([(245, 240), (267, 240), (256, 255)], fill=(30, 20, 20))
    # Sharp pitching concentration eyes
    draw.ellipse([210, 208, 240, 230], fill=(255, 255, 255))
    draw.ellipse([224, 212, 238, 226], fill=(15, 23, 42))
    draw.ellipse([272, 208, 302, 230], fill=(255, 255, 255))
    draw.ellipse([274, 212, 288, 226], fill=(15, 23, 42))
    
    # Leather Pitcher Glove held up in ready stance
    draw.rounded_rectangle([290, 280, 410, 420], radius=28, fill=(120, 53, 15), outline=(245, 158, 11), width=4)
    # Leather glove lacing & baseball peaking out
    draw.ellipse([315, 300, 385, 370], fill=(255, 255, 255), outline=(220, 38, 38), width=2)
    # Red baseball stitches
    draw.arc([325, 310, 375, 360], 45, 225, fill=(220, 38, 38), width=2)
    
    # Team Jersey
    draw.rounded_rectangle([140, 305, 330, 490], radius=32, fill=(245, 158, 11), outline=(30, 58, 138), width=5)
    draw.line([(235, 305), (235, 490)], fill=(30, 58, 138), width=4)
    
    # Red Chinese Seal: 「投」 (Pitch/Pitcher)
    draw.rectangle([seal_x - 30, seal_y - 30, seal_x + 30, seal_y + 30], fill=(185, 28, 28), outline=(254, 202, 202), width=2)
    draw.text((seal_x, seal_y), "投", fill=(255, 255, 255), font=font_seal, anchor="mm")
    
    draw.rectangle([6, 6, size - 7, size - 7], outline=(245, 158, 11), width=4)
    im_pitcher.save(os.path.join(port_dir, "pitcher.jpg"), "JPEG", quality=95)
    
    # 3. Field Dirt (512x512): Raked clay infield dirt texture
    im_dirt = Image.new('RGB', (size, size), (161, 98, 54))
    ddraw = ImageDraw.Draw(im_dirt)
    for _ in range(18000):
        x = random.randint(0, size - 1)
        y = random.randint(0, size - 1)
        delta = random.randint(-18, 18)
        ddraw.point((x, y), fill=(max(0, min(255, 161 + delta)), max(0, min(255, 98 + delta)), max(0, min(255, 54 + delta))))
    # Rake streaks
    for y in range(0, size, 8):
        ddraw.line([(0, y), (size, y)], fill=(140, 80, 42), width=1)
    im_dirt = im_dirt.filter(ImageFilter.GaussianBlur(0.7))
    im_dirt.save(os.path.join(out_dir, "field-dirt.jpg"), "JPEG", quality=92)
    
    # 4. Field Grass (512x512): Major League diamond cut turf
    im_grass = Image.new('RGB', (size, size), (34, 130, 58))
    gdraw = ImageDraw.Draw(im_grass)
    # Alternating mowed stripes
    stripe_w = 48
    for i in range(0, size, stripe_w):
        shade = 12 if (i // stripe_w) % 2 == 0 else -12
        gdraw.rectangle([i, 0, i + stripe_w, size], fill=(34 + shade, 130 + shade * 2, 58 + shade))
    # Grass flecks
    for _ in range(15000):
        x = random.randint(0, size - 1)
        y = random.randint(0, size - 1)
        delta = random.randint(-15, 15)
        gdraw.point((x, y), fill=(max(0, min(255, 34 + delta)), max(0, min(255, 130 + delta * 2)), max(0, min(255, 58 + delta))))
    im_grass = im_grass.filter(ImageFilter.GaussianBlur(0.8))
    im_grass.save(os.path.join(out_dir, "field-grass.jpg"), "JPEG", quality=92)
    
    # 5. Field Sky (1350x900): Championship stadium dusk sky with floodlights
    tw, th = 1350, 900
    im_sky = Image.new('RGB', (tw, th), (20, 30, 60))
    sdraw = ImageDraw.Draw(im_sky)
    for y in range(th):
        t = y / th
        r = int(15 * (1 - t) + 45 * t)
        g = int(25 * (1 - t) + 85 * t)
        b = int(70 * (1 - t) + 160 * t)
        sdraw.line([(0, y), (tw, y)], fill=(r, g, b))
        
    # Stadium floodlight towers on left and right
    light = Image.new('RGBA', (tw, th), (0, 0, 0, 0))
    ldraw = ImageDraw.Draw(light)
    for lx in [200, tw - 200]:
        ldraw.ellipse([lx - 180, 80, lx + 180, 360], fill=(255, 255, 230, 90))
        ldraw.ellipse([lx - 80, 140, lx + 80, 280], fill=(255, 255, 255, 150))
    light = light.filter(ImageFilter.GaussianBlur(40.0))
    im_sky.paste(light, (0, 0), light)
    im_sky.save(os.path.join(out_dir, "field-sky.jpg"), "JPEG", quality=92)
    
    # 6. Menu Hero (1350x900): Championship Baseball Stadium
    im_hero = im_sky.copy()
    hdraw = ImageDraw.Draw(im_hero)
    # Lower stadium diamond field green & dirt
    hdraw.polygon([(0, 600), (tw, 600), (tw, th), (0, th)], fill=(28, 105, 45))
    hdraw.polygon([(tw // 2 - 350, th), (tw // 2 + 350, th), (tw // 2, 620)], fill=(161, 98, 54))
    # Chalk foul lines
    hdraw.line([(tw // 2, th - 40), (tw // 2 - 450, 600)], fill=(255, 255, 255), width=4)
    hdraw.line([(tw // 2, th - 40), (tw // 2 + 450, 600)], fill=(255, 255, 255), width=4)
    # Home plate
    hdraw.polygon([(tw // 2 - 25, th - 40), (tw // 2 + 25, th - 40), (tw // 2 + 25, th - 20), (tw // 2, th - 5), (tw // 2 - 25, th - 20)], fill=(255, 255, 255))
    im_hero.save(os.path.join(out_dir, "menu-hero.jpg"), "JPEG", quality=92)


def generate_fifteen_puzzle_assets():
    print("Generating Fifteen-Puzzle assets...")
    out_dir = "Games/Fifteen-Puzzle/public"
    os.makedirs(out_dir, exist_ok=True)
    
    # 1. Tile Face (512x512): Master cherry hardwood sliding tile with bevels
    size = 512
    im_tile = create_wood_texture(size, size, (139, 69, 19), grain_intensity=0.10)
    tdraw = ImageDraw.Draw(im_tile)
    # Rounded bevel perimeter
    tdraw.rounded_rectangle([12, 12, size - 13, size - 13], radius=32, outline=(180, 110, 60), width=6)
    tdraw.rounded_rectangle([18, 18, size - 19, size - 19], radius=26, outline=(245, 185, 130), width=2)
    tdraw.rounded_rectangle([6, 6, size - 7, size - 7], radius=36, outline=(70, 35, 10), width=4)
    
    # Recessed inner carved dish
    spec = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(spec)
    sdraw.ellipse([80, 60, size - 80, 220], fill=(255, 255, 255, 45))
    spec = spec.filter(ImageFilter.GaussianBlur(20.0))
    im_tile.paste(spec, (0, 0), spec)
    im_tile.save(os.path.join(out_dir, "tile-face.jpg"), "JPEG", quality=95)
    
    # 2. Puzzle Art (1024x1024): Majestic Clubhouse Games master painting
    # Features Clubhouse manor, starry sky, lawn, and clocktower
    pw, ph = 1024, 1024
    im_art = Image.new('RGB', (pw, ph), (15, 23, 42))
    adraw = ImageDraw.Draw(im_art)
    
    # Twilight gradient sky
    for y in range(ph // 2):
        t = y / (ph // 2)
        r = int(15 * (1 - t) + 40 * t)
        g = int(23 * (1 - t) + 30 * t)
        b = int(60 * (1 - t) + 80 * t)
        adraw.line([(0, y), (pw, y)], fill=(r, g, b))
        
    # Stars in sky
    for _ in range(80):
        sx = random.randint(20, pw - 20)
        sy = random.randint(20, ph // 2 - 60)
        srad = random.randint(1, 3)
        adraw.ellipse([sx - srad, sy - srad, sx + srad, sy + srad], fill=(254, 240, 138))
        
    # Full golden moon
    adraw.ellipse([800 - 65, 160 - 65, 800 + 65, 160 + 65], fill=(254, 243, 199), outline=(255, 255, 255), width=3)
    
    # Grand Clubhouse Manor
    # Central Hall
    adraw.rectangle([340, 360, 684, 680], fill=(226, 232, 240), outline=(51, 65, 85), width=4)
    # Left and Right Wings
    adraw.rectangle([160, 420, 340, 680], fill=(203, 213, 225), outline=(51, 65, 85), width=4)
    adraw.rectangle([684, 420, 864, 680], fill=(203, 213, 225), outline=(51, 65, 85), width=4)
    
    # Mansard Roof
    adraw.polygon([(320, 360), (704, 360), (620, 240), (404, 240)], fill=(71, 85, 105), outline=(30, 41, 59), width=4)
    # Clocktower in center
    adraw.rectangle([460, 160, 564, 250], fill=(203, 213, 225), outline=(51, 65, 85), width=3)
    adraw.polygon([(445, 160), (579, 160), (512, 90)], fill=(185, 28, 28), outline=(30, 41, 59), width=3)
    # Glowing clock face
    adraw.ellipse([485, 180, 539, 234], fill=(254, 240, 138), outline=(133, 77, 14), width=3)
    adraw.line([(512, 207), (512, 192)], fill=(30, 20, 20), width=2)
    adraw.line([(512, 207), (524, 207)], fill=(30, 20, 20), width=2)
    
    # Manor Windows with warm amber interior glow
    for wx in range(370, 660, 60):
        for wy in [400, 480, 560]:
            adraw.rounded_rectangle([wx, wy, wx + 36, wy + 52], radius=6, fill=(254, 240, 138), outline=(51, 65, 85), width=2)
            adraw.line([(wx + 18, wy), (wx + 18, wy + 52)], fill=(51, 65, 85), width=1)
            adraw.line([(wx, wy + 26), (wx + 36, wy + 26)], fill=(51, 65, 85), width=1)
            
    # Front Lawn & Fountain
    adraw.polygon([(0, 680), (pw, 680), (pw, ph), (0, ph)], fill=(22, 101, 52))
    # Stone pathway
    adraw.polygon([(460, 680), (564, 680), (640, ph), (384, ph)], fill=(148, 163, 184))
    
    # Grand Fountain in foreground
    adraw.ellipse([512 - 140, 820 - 45, 512 + 140, 820 + 45], fill=(30, 58, 138), outline=(226, 232, 240), width=6)
    adraw.ellipse([512 - 60, 820 - 20, 512 + 60, 820 + 20], fill=(56, 189, 248), outline=(255, 255, 255), width=2)
    
    im_art.save(os.path.join(out_dir, "puzzle-art.jpg"), "JPEG", quality=95)
    
    # 3. Board BG (1350x900): Rich walnut parlor table
    im_board = create_wood_texture(1350, 900, (45, 24, 16), grain_intensity=0.12)
    bdraw = ImageDraw.Draw(im_board)
    # Brass corner inlay brackets
    bdraw.rectangle([30, 30, 110, 40], fill=(234, 179, 8))
    bdraw.rectangle([30, 30, 40, 110], fill=(234, 179, 8))
    bdraw.rectangle([1350 - 110, 30, 1350 - 30, 40], fill=(234, 179, 8))
    bdraw.rectangle([1350 - 40, 30, 1350 - 30, 110], fill=(234, 179, 8))
    bdraw.rectangle([30, 900 - 40, 110, 900 - 30], fill=(234, 179, 8))
    bdraw.rectangle([30, 900 - 110, 40, 900 - 30], fill=(234, 179, 8))
    bdraw.rectangle([1350 - 110, 900 - 40, 1350 - 30, 900 - 30], fill=(234, 179, 8))
    bdraw.rectangle([1350 - 40, 900 - 110, 1350 - 30, 900 - 30], fill=(234, 179, 8))
    im_board.save(os.path.join(out_dir, "board-bg.jpg"), "JPEG", quality=92)


def generate_brick_kart_assets():
    print("Generating Brick-Kart-Racing assets...")
    out_dir = "Games/Brick-Kart-Racing/public"
    port_dir = os.path.join(out_dir, "portraits")
    track_dir = os.path.join(out_dir, "tracks")
    os.makedirs(port_dir, exist_ok=True)
    os.makedirs(track_dir, exist_ok=True)
    
    font_seal = get_font(26, prefer_serif=True)
    
    # 4 Racer Minifig Portraits (512x512)
    racers = [
        {"id": "red", "name": "紅", "color": (216, 53, 42), "accent": (242, 243, 245), "cap_color": (216, 53, 42), "type": "hat"},
        {"id": "green", "name": "綠", "color": (47, 160, 74), "accent": (23, 61, 34), "cap_color": (139, 217, 79), "type": "helmet"},
        {"id": "yellow", "name": "黃", "color": (244, 192, 36), "accent": (255, 126, 196), "cap_color": (255, 224, 102), "type": "crown"},
        {"id": "blue", "name": "藍", "color": (47, 111, 216), "accent": (242, 243, 245), "cap_color": (30, 58, 138), "type": "samurai"},
    ]
    
    size = 512
    cx, cy = size // 2, size // 2
    for r in racers:
        im_rac = Image.new('RGB', (size, size), (24, 24, 27))
        draw = ImageDraw.Draw(im_rac)
        
        # Radial speed burst background
        base_r, base_g, base_b = r["color"]
        for rad in range(size, 0, -3):
            t = rad / size
            cr = int(base_r * (1 - t * 0.75))
            cg = int(base_g * (1 - t * 0.75))
            cb = int(base_b * (1 - t * 0.75))
            draw.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=(cr, cg, cb))
            
        # Checkered flag pattern at edges
        chk_size = 24
        for x in range(0, size, chk_size):
            for y in [0, chk_size, size - chk_size * 2, size - chk_size]:
                if ((x // chk_size) + (y // chk_size)) % 2 == 0:
                    draw.rectangle([x, y, x + chk_size, y + chk_size], fill=(255, 255, 255, 40))
                    
        im_rac = im_rac.filter(ImageFilter.GaussianBlur(1.0))
        draw = ImageDraw.Draw(im_rac)
        
        # Minifig Cylindrical Head (Yellow skin)
        draw.rounded_rectangle([175, 160, 337, 310], radius=45, fill=(250, 204, 21), outline=(161, 98, 7), width=5)
        # Minifig Stud on top
        draw.rounded_rectangle([226, 130, 286, 165], radius=12, fill=(250, 204, 21), outline=(161, 98, 7), width=4)
        
        # Big expressive minifig eyes & smile
        draw.ellipse([200, 205, 230, 245], fill=(24, 24, 27))
        draw.ellipse([218, 212, 228, 222], fill=(255, 255, 255))
        draw.ellipse([282, 205, 312, 245], fill=(24, 24, 27))
        draw.ellipse([300, 212, 310, 222], fill=(255, 255, 255))
        # Grin
        draw.arc([220, 235, 292, 275], 10, 170, fill=(24, 24, 27), width=5)
        
        # Headgear
        htype = r["type"]
        if htype == "hat":
            # Red Engineer Cap
            draw.ellipse([140, 120, 372, 190], fill=r["cap_color"], outline=(120, 20, 20), width=4)
            draw.ellipse([160, 160, 352, 205], fill=(245, 158, 11), width=2)
        elif htype == "helmet":
            # Racing Full Visor Helmet
            draw.rounded_rectangle([160, 110, 352, 210], radius=32, fill=r["cap_color"], outline=(20, 80, 30), width=5)
            draw.rectangle([185, 160, 327, 200], fill=(15, 23, 42), outline=(255, 255, 255), width=2)
        elif htype == "crown":
            # Golden Tiara Crown
            crown_pts = [(180, 170), (200, 110), (225, 150), (256, 95), (287, 150), (312, 110), (332, 170)]
            draw.polygon(crown_pts, fill=r["cap_color"], outline=(161, 98, 7), width=4)
            draw.ellipse([250, 105, 262, 117], fill=(239, 68, 68))
        elif htype == "samurai":
            # Samurai Crest Helmet
            draw.rounded_rectangle([155, 110, 357, 195], radius=24, fill=r["cap_color"], outline=(245, 158, 11), width=4)
            draw.polygon([(256, 60), (275, 120), (237, 120)], fill=(245, 158, 11))
            
        # Minifig Torso (Trapezoid shape)
        torso_pts = [(165, 310), (347, 310), (380, 480), (132, 480)]
        draw.polygon(torso_pts, fill=r["color"], outline=(15, 23, 42), width=5)
        # Racing Harness / Decal
        draw.line([(256, 310), (256, 480)], fill=r["accent"], width=6)
        draw.ellipse([236, 360, 276, 400], fill=r["accent"], outline=(15, 23, 42), width=2)
        
        # Red Chinese Seal on bottom right
        seal_x, seal_y = size - 70, size - 70
        draw.rectangle([seal_x - 30, seal_y - 30, seal_x + 30, seal_y + 30], fill=(185, 28, 28), outline=(254, 202, 202), width=2)
        draw.text((seal_x, seal_y), r["name"], fill=(255, 255, 255), font=font_seal, anchor="mm")
        
        draw.rectangle([6, 6, size - 7, size - 7], outline=r["color"], width=4)
        p_path = os.path.join(port_dir, f"{r['id']}.jpg")
        im_rac.save(p_path, "JPEG", quality=95)
        print(f"Saved racer portrait: {p_path}")
        
    # Menu BG (1350x900): Stadium grandstand finish line
    mw, mh = 1350, 900
    im_mbg = Image.new('RGB', (mw, mh), (24, 24, 32))
    mdraw = ImageDraw.Draw(im_mbg)
    for y in range(mh):
        t = y / mh
        r = int(20 * (1 - t) + 60 * t)
        g = int(24 * (1 - t) + 40 * t)
        b = int(45 * (1 - t) + 80 * t)
        mdraw.line([(0, y), (mw, y)], fill=(r, g, b))
    # Grandstand & Checkered Arch
    mdraw.rectangle([0, mh - 300, mw, mh], fill=(30, 41, 59))
    # Checkered track surface
    for x in range(0, mw, 60):
        for y in range(mh - 260, mh, 60):
            if ((x // 60) + (y // 60)) % 2 == 0:
                mdraw.rectangle([x, y, x + 60, y + 60], fill=(245, 158, 11, 40))
    im_mbg.save(os.path.join(out_dir, "menu-bg.jpg"), "JPEG", quality=92)


def generate_cyber_neon_assets():
    print("Generating Cyber-Neon-Rush assets...")
    out_dir = "Games/Cyber-Neon-Rush/public"
    tex_dir = os.path.join(out_dir, "textures")
    os.makedirs(tex_dir, exist_ok=True)
    
    # 1. Road (1024x1024): Wet reflective cyber tarmac with pulsing neon gridlines
    rw, rh = 1024, 1024
    im_road = Image.new('RGB', (rw, rh), (10, 10, 15))
    rdraw = ImageDraw.Draw(im_road)
    
    # Asphalt noise texture
    for _ in range(40000):
        x = random.randint(0, rw - 1)
        y = random.randint(0, rh - 1)
        v = random.randint(8, 26)
        rdraw.point((x, y), fill=(v, v + 2, v + 6))
        
    # Glowing neon lane markers (Cyan and Magenta)
    # Center dividing double neon line
    for offset in [-12, 12]:
        cx = rw // 2 + offset
        rdraw.line([(cx, 0), (cx, rh)], fill=(6, 182, 212), width=6)
        rdraw.line([(cx, 0), (cx, rh)], fill=(207, 250, 254), width=2)
        
    # Outer neon lane borders
    for bx in [96, rw - 96]:
        rdraw.line([(bx, 0), (bx, rh)], fill=(236, 72, 153), width=8)
        rdraw.line([(bx, 0), (bx, rh)], fill=(253, 231, 243), width=2)
        
    # Lateral neon speed grid lines
    for y in range(0, rh, 128):
        rdraw.line([(96, y), (rw - 96, y)], fill=(34, 211, 238), width=3)
        
    im_road = im_road.filter(ImageFilter.GaussianBlur(0.8))
    im_road.save(os.path.join(tex_dir, "road.jpg"), "JPEG", quality=95)
    
    # 2. Cyber Car (512x512): Aerodynamic neon speeder
    cw, ch = 512, 512
    im_car = Image.new('RGB', (cw, ch), (15, 23, 42))
    cdraw = ImageDraw.Draw(im_car)
    # Streamlined body
    body_pts = [(150, 440), (120, 280), (160, 100), (352, 100), (392, 280), (362, 440)]
    cdraw.polygon(body_pts, fill=(24, 24, 27), outline=(6, 182, 212), width=6)
    # Windshield / Cockpit canopy
    cdraw.polygon([(180, 260), (200, 140), (312, 140), (332, 260)], fill=(6, 182, 212), outline=(207, 250, 254), width=3)
    # Cyber underglow light bars
    cdraw.line([(110, 290), (110, 420)], fill=(236, 72, 153), width=8)
    cdraw.line([(402, 290), (402, 420)], fill=(236, 72, 153), width=8)
    # Rear neon taillight strip
    cdraw.line([(150, 435), (362, 435)], fill=(239, 68, 68), width=10)
    im_car.save(os.path.join(tex_dir, "car.jpg"), "JPEG", quality=95)
    
    # 3. Drone (512x512): Cyber Surveillance Quad Drone
    im_drone = Image.new('RGB', (cw, ch), (15, 23, 42))
    ddraw = ImageDraw.Draw(im_drone)
    # Central fuselage
    ddraw.ellipse([180, 180, 332, 332], fill=(30, 41, 59), outline=(6, 182, 212), width=5)
    # Red optic scanner lens in center
    ddraw.ellipse([226, 226, 286, 286], fill=(239, 68, 68), outline=(254, 202, 202), width=3)
    ddraw.ellipse([246, 246, 266, 266], fill=(255, 255, 255))
    # 4 Thruster nacelles
    for tx, ty in [(110, 110), (402, 110), (110, 402), (402, 402)]:
        ddraw.line([(256, 256), (tx, ty)], fill=(71, 85, 105), width=8)
        ddraw.ellipse([tx - 45, ty - 45, tx + 45, ty + 45], fill=(15, 23, 42), outline=(34, 211, 238), width=4)
        ddraw.ellipse([tx - 25, ty - 25, tx + 25, ty + 25], fill=(34, 211, 238))
    im_drone.save(os.path.join(tex_dir, "drone.jpg"), "JPEG", quality=95)
    
    # 4. Barrier (512x512): Hazard plasma force barrier
    im_barr = Image.new('RGB', (cw, ch), (20, 20, 30))
    bdraw = ImageDraw.Draw(im_barr)
    # Diagonal hazard yellow/black stripes
    stripe_w = 40
    for i in range(-512, 1024, stripe_w * 2):
        pts = [(i, 0), (i + stripe_w, 0), (i + stripe_w - 512, 512), (i - 512, 512)]
        bdraw.polygon(pts, fill=(234, 179, 8))
    # Outer frame
    bdraw.rectangle([8, 8, cw - 9, ch - 9], outline=(239, 68, 68), width=8)
    bdraw.line([(0, ch // 2), (cw, ch // 2)], fill=(236, 72, 153), width=10)
    im_barr.save(os.path.join(tex_dir, "barrier.jpg"), "JPEG", quality=95)
    
    # 5. Cone (512x512): Luminous cyber pylon cone
    im_cone = Image.new('RGB', (cw, ch), (15, 23, 42))
    cdraw = ImageDraw.Draw(im_cone)
    # Base
    cdraw.ellipse([100, 400, 412, 490], fill=(30, 41, 59), outline=(249, 115, 22), width=6)
    # Cone body
    cone_pts = [(256, 60), (372, 430), (140, 430)]
    cdraw.polygon(cone_pts, fill=(249, 115, 22), outline=(254, 215, 170), width=4)
    # Reflective holographic bands
    cdraw.polygon([(216, 190), (296, 190), (324, 280), (188, 280)], fill=(255, 255, 255), outline=(6, 182, 212), width=3)
    im_cone.save(os.path.join(tex_dir, "cone.jpg"), "JPEG", quality=95)
    
    # 6. Menu BG (1350x900): Neo-Tokyo cyberpunk metropolis
    mw, mh = 1350, 900
    im_cbg = Image.new('RGB', (mw, mh), (10, 10, 20))
    cbdraw = ImageDraw.Draw(im_cbg)
    for y in range(mh):
        t = y / mh
        r = int(10 * (1 - t) + 40 * t)
        g = int(8 * (1 - t) + 15 * t)
        b = int(25 * (1 - t) + 65 * t)
        cbdraw.line([(0, y), (mw, y)], fill=(r, g, b))
    # Skyscraper silhouettes with glowing windows
    for bx in range(40, mw, 140):
        bw = random.randint(80, 130)
        bh = random.randint(300, 650)
        cbdraw.rectangle([bx, mh - bh, bx + bw, mh], fill=(15, 18, 30), outline=(6, 182, 212, 60), width=2)
        for wy in range(mh - bh + 30, mh - 50, 40):
            if random.random() > 0.4:
                cbdraw.rectangle([bx + 15, wy, bx + 35, wy + 20], fill=(236, 72, 153))
            if random.random() > 0.4:
                cbdraw.rectangle([bx + bw - 35, wy, bx + bw - 15, wy + 20], fill=(6, 182, 212))
    im_cbg.save(os.path.join(out_dir, "menu-bg.jpg"), "JPEG", quality=92)


if __name__ == "__main__":
    generate_toy_baseball_assets()
    generate_fifteen_puzzle_assets()
    generate_brick_kart_assets()
    generate_cyber_neon_assets()
    print("All Wave 11 assets generated successfully!")
