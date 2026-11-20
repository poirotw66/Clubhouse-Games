#!/usr/bin/env python3
"""
generate-toy-boxing-art.py

Generates high-resolution 2D art assets for "Toy-Boxing" (玩具拳擊),
strictly adhering to Sakurai visual design principles:
- skill-gfx-013: Silhouette-First Readability
- skill-gfx-002: Readability Before Decoration
- skill-gfx-001: Dramatic Lighting & Atmospheric Depth
- skill-gfx-007: Unified Stylized Retro/Steampunk Toy Boxing Aesthetic
"""

import os
import math
import random
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOXING_DIR = os.path.join(BASE_DIR, 'Games', 'Toy-Boxing')
PUBLIC_DIR = os.path.join(BOXING_DIR, 'public')
FIGHTERS_DIR = os.path.join(PUBLIC_DIR, 'fighters')
PORTRAITS_DIR = os.path.join(PUBLIC_DIR, 'portraits')
OPP_FIGHTERS_DIR = os.path.join(FIGHTERS_DIR, 'opponents')
OPP_PORTRAITS_DIR = os.path.join(PORTRAITS_DIR, 'opponents')

for d in [PUBLIC_DIR, FIGHTERS_DIR, PORTRAITS_DIR, OPP_FIGHTERS_DIR, OPP_PORTRAITS_DIR]:
    os.makedirs(d, exist_ok=True)

# Font setup
FONT_PATH = '/System/Library/Fonts/Hiragino Sans GB.ttc'
if not os.path.exists(FONT_PATH):
    FONT_PATH = '/System/Library/Fonts/STHeiti Medium.ttc'

def get_font(size):
    try:
        return ImageFont.truetype(FONT_PATH, size)
    except Exception:
        return ImageFont.load_default()

# -----------------------------------------------------------------------------
# Drawing Helpers
# -----------------------------------------------------------------------------

def round_rect(draw, xy, radius, fill=None, outline=None, width=1):
    x0, y0, x1, y1 = xy
    draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=fill, outline=outline, width=width)

def draw_radial_gradient(img, center, max_radius, inner_color, outer_color):
    """Draw a smooth radial glow centered at `center`."""
    w, h = img.size
    overlay = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    cx, cy = center
    steps = 40
    for i in range(steps, 0, -1):
        r = int(max_radius * (i / steps))
        factor = i / steps
        r_c = int(inner_color[0] * (1 - factor) + outer_color[0] * factor)
        g_c = int(inner_color[1] * (1 - factor) + outer_color[1] * factor)
        b_c = int(inner_color[2] * (1 - factor) + outer_color[2] * factor)
        a_c = int(inner_color[3] * (1 - factor) + outer_color[3] * factor) if len(inner_color) > 3 else 255
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(r_c, g_c, b_c, a_c))
    img.paste(Image.alpha_composite(img.convert('RGBA'), overlay).convert('RGB'))

def draw_clockwork_key(draw, cx, cy, scale=1.0, color=(245, 158, 11), outline=(120, 53, 15)):
    """Draw a classic wind-up toy key (handle loop + stem)."""
    sw = int(14 * scale)
    sh = int(45 * scale)
    # Stem
    round_rect(draw, (cx - sw // 2, cy - sh // 2, cx + sw // 2, cy + sh // 2), radius=int(4 * scale), fill=color, outline=outline, width=max(1, int(3 * scale)))
    
    # Left and Right Wings (loops)
    rw = int(32 * scale)
    rh = int(24 * scale)
    wing_y = cy - int(10 * scale)
    # Left wing
    draw.ellipse([cx - sw // 2 - rw, wing_y - rh // 2, cx - sw // 2, wing_y + rh // 2], fill=color, outline=outline, width=max(1, int(3 * scale)))
    draw.ellipse([cx - sw // 2 - int(rw * 0.7), wing_y - int(rh * 0.35), cx - sw // 2 - int(rw * 0.2), wing_y + int(rh * 0.35)], fill=(20, 25, 40))
    # Right wing
    draw.ellipse([cx + sw // 2, wing_y - rh // 2, cx + sw // 2 + rw, wing_y + rh // 2], fill=color, outline=outline, width=max(1, int(3 * scale)))
    draw.ellipse([cx + sw // 2 + int(rw * 0.2), wing_y - int(rh * 0.35), cx + sw // 2 + int(rw * 0.7), wing_y + int(rh * 0.35)], fill=(20, 25, 40))

def draw_character_badge(draw, cx, cy, char_text, bg_color, border_color, text_color=(255, 255, 255), radius=38):
    """Draw a circular metal / hanko badge with Traditional Chinese character."""
    # Outer ring
    draw.ellipse([cx - radius - 4, cy - radius - 4, cx + radius + 4, cy + radius + 4], fill=(15, 23, 42), outline=border_color, width=4)
    # Inner circle
    draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=bg_color, outline=(255, 255, 255, 120), width=2)
    # Character
    font = get_font(int(radius * 1.2))
    bbox = font.getbbox(char_text)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text((cx - tw / 2, cy - th / 2 - 4), char_text, font=font, fill=text_color)

# -----------------------------------------------------------------------------
# 1. Ring Backgrounds: ring-sky.jpg & ring-floor.jpg
# -----------------------------------------------------------------------------

def generate_ring_sky():
    print("Generating championship arena sky (ring-sky.jpg)...")
    w, h = 1350, 900
    img = Image.new('RGB', (w, h), (10, 14, 28))
    draw = ImageDraw.Draw(img)

    # Top gradient (dark rafters to arena haze)
    for y in range(h):
        t = y / h
        r = int(12 * (1 - t) + 26 * t)
        g = int(16 * (1 - t) + 38 * t)
        b = int(32 * (1 - t) + 64 * t)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    # Stadium floodlights / trusses at top
    truss_y = 120
    draw.line([(0, truss_y), (w, truss_y)], fill=(50, 60, 85), width=8)
    draw.line([(0, truss_y - 40), (w, truss_y - 40)], fill=(40, 50, 75), width=6)
    for x in range(0, w, 60):
        draw.line([(x, truss_y - 40), (x + 30, truss_y)], fill=(60, 75, 105), width=3)
        draw.line([(x + 30, truss_y - 40), (x, truss_y)], fill=(60, 75, 105), width=3)

    # Dual intense volumetric spotlights sweeping the ring
    spot_overlay = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    spot_draw = ImageDraw.Draw(spot_overlay)

    # Left spotlight (warm golden beam toward center-right)
    spot_draw.polygon([(280, truss_y), (380, truss_y), (950, h), (550, h)], fill=(255, 230, 150, 35))
    # Right spotlight (cool cyan-blue beam toward center-left)
    spot_draw.polygon([(970, truss_y), (1070, truss_y), (800, h), (400, h)], fill=(120, 210, 255, 40))
    # Center overhead rim cone
    spot_draw.polygon([(620, truss_y), (730, truss_y), (900, h), (450, h)], fill=(255, 255, 255, 30))

    # Spotlight lamps
    for lx in [330, 675, 1020]:
        spot_draw.ellipse([lx - 45, truss_y - 25, lx + 45, truss_y + 25], fill=(255, 255, 255, 230))
        spot_draw.ellipse([lx - 75, truss_y - 40, lx + 75, truss_y + 40], fill=(255, 230, 160, 90))

    # Crowd silhouettes in lower half
    crowd_top = int(h * 0.58)
    for cx in range(0, w, 24):
        cheight = random.randint(40, 90)
        cwidth = random.randint(18, 28)
        c_y = crowd_top + cheight
        # Body / head
        draw.ellipse([cx, c_y - 22, cx + cwidth, c_y + 12], fill=(16, 22, 38))
        draw.rectangle([cx - 4, c_y, cx + cwidth + 4, h], fill=(12, 16, 28))
        # Camera flash / light stick
        if random.random() < 0.25:
            fx = cx + random.randint(0, cwidth)
            fy = c_y - random.randint(15, 35)
            fcolor = random.choice([(255, 255, 255, 200), (251, 191, 36, 180), (56, 189, 248, 180), (236, 72, 153, 180)])
            spot_draw.ellipse([fx - 3, fy - 3, fx + 3, fy + 3], fill=fcolor)
            spot_draw.ellipse([fx - 8, fy - 8, fx + 8, fy + 8], fill=(fcolor[0], fcolor[1], fcolor[2], 50))

    img = Image.alpha_composite(img.convert('RGBA'), spot_overlay).convert('RGB')
    
    # Save ring-sky.jpg
    sky_path = os.path.join(PUBLIC_DIR, 'ring-sky.jpg')
    img.save(sky_path, 'JPEG', quality=92)
    print(f"Saved: {sky_path}")

def generate_ring_floor():
    print("Generating championship arena floor (ring-floor.jpg)...")
    w, h = 1350, 900
    img = Image.new('RGB', (w, h), (30, 41, 59))
    draw = ImageDraw.Draw(img)

    # Perspective canvas texture
    for y in range(h):
        t = y / h
        # Canvas color (deep tactical blue-gray with spotlight pool)
        r = int(51 * (1 - t * 0.4))
        g = int(65 * (1 - t * 0.4))
        b = int(85 * (1 - t * 0.4))
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    # Center championship spotlight bounce pool
    draw_radial_gradient(img, (w // 2, int(h * 0.45)), int(w * 0.4), (255, 255, 255, 60), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Championship Center Crest (Clockwork Gear + Stars)
    gear_cx, gear_cy = w // 2, int(h * 0.48)
    gear_r = 180
    gear_color = (245, 158, 11)
    # Gear outer rim
    draw.ellipse([gear_cx - gear_r, gear_cy - gear_r // 2, gear_cx + gear_r, gear_cy + gear_r // 2], outline=(245, 158, 11, 140), width=6)
    draw.ellipse([gear_cx - gear_r + 20, gear_cy - (gear_r - 20) // 2, gear_cx + gear_r - 20, gear_cy + (gear_r - 20) // 2], outline=(251, 191, 36, 120), width=3)

    # Gear teeth
    num_teeth = 16
    for i in range(num_teeth):
        angle = (i * 2 * math.pi) / num_teeth
        tx = gear_cx + int(math.cos(angle) * gear_r)
        ty = gear_cy + int(math.sin(angle) * (gear_r // 2))
        draw.ellipse([tx - 10, ty - 6, tx + 10, ty + 6], fill=(245, 158, 11))

    # Ring ropes perspective lines on left & right apron
    draw.line([(0, int(h * 0.15)), (w, int(h * 0.15))], fill=(239, 68, 68), width=5) # Red tape
    draw.line([(0, int(h * 0.28)), (w, int(h * 0.28))], fill=(255, 255, 255), width=4) # White tape
    draw.line([(0, int(h * 0.41)), (w, int(h * 0.41))], fill=(59, 130, 246), width=5) # Blue tape

    # Wood apron at bottom
    apron_y = int(h * 0.82)
    draw.rectangle([0, apron_y, w, h], fill=(45, 25, 15))
    draw.line([(0, apron_y), (w, apron_y)], fill=(180, 83, 9), width=4)
    for px in range(0, w, 120):
        draw.line([(px, apron_y), (px - 40, h)], fill=(30, 15, 8), width=2)

    # Save ring-floor.jpg
    floor_path = os.path.join(PUBLIC_DIR, 'ring-floor.jpg')
    img.save(floor_path, 'JPEG', quality=92)
    print(f"Saved: {floor_path}")

# -----------------------------------------------------------------------------
# 2. Character Portraits (512x512)
# -----------------------------------------------------------------------------

def generate_portrait(char_id, name_tc, badge_tc, main_color, accent_color, glove_color, out_path, is_opponent=False, opp_meta=None):
    size = (512, 512)
    img = Image.new('RGB', size, (12, 17, 30))
    draw = ImageDraw.Draw(img)

    # Themed background radial gradient
    cx, cy = 256, 256
    draw_radial_gradient(img, (cx, cy), 280, (main_color[0] // 3, main_color[1] // 3, main_color[2] // 3), (8, 11, 20))
    draw = ImageDraw.Draw(img)

    # Outer decorative ring (Championship emblem frame)
    border_r = 236
    draw.ellipse([cx - border_r, cy - border_r, cx + border_r, cy + border_r], outline=(main_color[0], main_color[1], main_color[2]), width=8)
    draw.ellipse([cx - border_r + 10, cy - border_r + 10, cx + border_r - 10, cy + border_r - 10], outline=(accent_color[0], accent_color[1], accent_color[2]), width=3)

    # Dramatic clockwork gear behind character
    gear_r = 170
    for i in range(12):
        angle = (i * 2 * math.pi) / 12
        tx = cx + int(math.cos(angle) * gear_r)
        ty = cy + int(math.sin(angle) * gear_r)
        draw.ellipse([tx - 12, ty - 12, tx + 12, ty + 12], fill=(accent_color[0] // 2, accent_color[1] // 2, accent_color[2] // 2))

    # Draw Big Clockwork Key behind head
    draw_clockwork_key(draw, cx + 85, cy - 110, scale=1.3, color=(245, 158, 11), outline=(120, 53, 15))

    # Character Head & Torso rendering based on toy archetype
    body_y = 310
    head_y = 200

    if 'bot' in char_id or char_id == 'needle' or char_id == 'champ':
        # Robot / Mecha archetype
        # Torso
        round_rect(draw, (cx - 95, body_y, cx + 95, body_y + 150), radius=20, fill=main_color, outline=(255, 255, 255, 100), width=4)
        # Chest plate & energy core
        round_rect(draw, (cx - 65, body_y + 20, cx + 65, body_y + 90), radius=12, fill=(20, 30, 50), outline=accent_color, width=3)
        draw.ellipse([cx - 28, body_y + 35, cx + 28, body_y + 75], fill=accent_color)
        draw.ellipse([cx - 16, body_y + 45, cx + 16, body_y + 65], fill=(255, 255, 255))
        # Head
        round_rect(draw, (cx - 75, head_y - 65, cx + 75, head_y + 65), radius=22, fill=(226, 232, 240), outline=main_color, width=5)
        # Antenna
        if char_id == 'needle':
            draw.line([(cx - 30, head_y - 65), (cx - 45, head_y - 125)], fill=(245, 158, 11), width=6)
            draw.line([(cx + 30, head_y - 65), (cx + 45, head_y - 125)], fill=(245, 158, 11), width=6)
            draw.ellipse([cx - 52, head_y - 132, cx - 38, head_y - 118], fill=(251, 191, 36))
            draw.ellipse([cx + 38, head_y - 132, cx + 52, head_y - 118], fill=(251, 191, 36))
        elif char_id == 'champ':
            # Crown exhaust
            draw.polygon([(cx - 45, head_y - 65), (cx - 55, head_y - 115), (cx - 20, head_y - 85), (cx, head_y - 125), (cx + 20, head_y - 85), (cx + 55, head_y - 115), (cx + 45, head_y - 65)], fill=(234, 179, 8), outline=(161, 98, 7), width=3)
        else:
            draw.line([(cx, head_y - 65), (cx, head_y - 115)], fill=(148, 163, 184), width=6)
            draw.ellipse([cx - 14, head_y - 125, cx + 14, head_y - 97], fill=accent_color)
        # Visor / Optics
        round_rect(draw, (cx - 55, head_y - 20, cx + 55, head_y + 20), radius=10, fill=(15, 23, 42))
        draw.ellipse([cx - 40, head_y - 12, cx - 16, head_y + 12], fill=accent_color)
        draw.ellipse([cx + 16, head_y - 12, cx + 40, head_y + 12], fill=accent_color)
        draw.ellipse([cx - 32, head_y - 6, cx - 24, head_y + 2], fill=(255, 255, 255))
        draw.ellipse([cx + 24, head_y - 6, cx + 32, head_y + 2], fill=(255, 255, 255))

    elif 'bear' in char_id or char_id == 'rush':
        # Bear archetype (plush velvet + stitching)
        # Ears
        draw.ellipse([cx - 95, head_y - 85, cx - 45, head_y - 35], fill=main_color, outline=accent_color, width=5)
        draw.ellipse([cx + 45, head_y - 85, cx + 95, head_y - 35], fill=main_color, outline=accent_color, width=5)
        draw.ellipse([cx - 82, head_y - 72, cx - 58, head_y - 48], fill=accent_color)
        draw.ellipse([cx + 58, head_y - 72, cx + 82, head_y - 48], fill=accent_color)
        # Torso
        round_rect(draw, (cx - 105, body_y, cx + 105, body_y + 155), radius=28, fill=main_color, outline=(255, 255, 255, 90), width=4)
        round_rect(draw, (cx - 65, body_y + 25, cx + 65, body_y + 120), radius=20, fill=accent_color)
        # Stitches on body
        for sy in range(body_y + 35, body_y + 115, 18):
            draw.line([(cx - 5, sy), (cx + 5, sy)], fill=(50, 20, 10), width=3)
        # Head
        draw.ellipse([cx - 85, head_y - 65, cx + 85, head_y + 65], fill=main_color, outline=(0, 0, 0, 120), width=4)
        # Muzzle
        draw.ellipse([cx - 48, head_y - 5, cx + 48, head_y + 55], fill=accent_color)
        draw.ellipse([cx - 16, head_y + 8, cx + 16, head_y + 32], fill=(30, 20, 15))
        # Button eyes (cross stitches)
        for ex in [cx - 36, cx + 36]:
            draw.ellipse([ex - 12, head_y - 25, ex + 12, head_y - 1], fill=(15, 23, 42))
            draw.line([(ex - 6, head_y - 19), (ex + 6, head_y - 7)], fill=(255, 255, 255), width=2)
            draw.line([(ex + 6, head_y - 19), (ex - 6, head_y - 7)], fill=(255, 255, 255), width=2)

    elif 'bunny' in char_id or char_id == 'pillow' or char_id == 'feint':
        # Rabbit archetype (long aerodynamic ears)
        # Ears
        ear_h = 135
        round_rect(draw, (cx - 65, head_y - ear_h, cx - 25, head_y - 20), radius=18, fill=main_color, outline=accent_color, width=4)
        round_rect(draw, (cx + 25, head_y - ear_h, cx + 65, head_y - 20), radius=18, fill=main_color, outline=accent_color, width=4)
        round_rect(draw, (cx - 55, head_y - ear_h + 15, cx - 35, head_y - 35), radius=10, fill=accent_color)
        round_rect(draw, (cx + 35, head_y - ear_h + 15, cx + 55, head_y - 35), radius=10, fill=accent_color)
        # Headgear if pillow
        if char_id == 'pillow':
            round_rect(draw, (cx - 80, head_y - 60, cx + 80, head_y + 60), radius=26, fill=(192, 132, 252), outline=(255, 255, 255), width=4)
        # Torso
        round_rect(draw, (cx - 85, body_y, cx + 85, body_y + 150), radius=24, fill=main_color, outline=(255, 255, 255, 90), width=4)
        # Head
        round_rect(draw, (cx - 70, head_y - 50, cx + 70, head_y + 55), radius=22, fill=(255, 228, 230) if char_id == 'bunny' else main_color, outline=accent_color, width=4)
        # Eyes
        if char_id == 'feint':
            # Phantom mask
            draw.polygon([(cx - 60, head_y - 25), (cx + 10, head_y - 25), (cx - 10, head_y + 25), (cx - 60, head_y + 20)], fill=(226, 232, 240), outline=(168, 85, 247), width=3)
            draw.ellipse([cx - 45, head_y - 12, cx - 25, head_y + 8], fill=(45, 212, 191))
            draw.ellipse([cx + 25, head_y - 12, cx + 45, head_y + 8], fill=(168, 85, 247))
        else:
            draw.ellipse([cx - 42, head_y - 14, cx - 22, head_y + 10], fill=(219, 39, 119) if char_id == 'bunny' else (147, 51, 234))
            draw.ellipse([cx + 22, head_y - 14, cx + 42, head_y + 10], fill=(219, 39, 119) if char_id == 'bunny' else (147, 51, 234))
            draw.ellipse([cx - 36, head_y - 10, cx - 30, head_y - 4], fill=(255, 255, 255))
            draw.ellipse([cx + 28, head_y - 10, cx + 34, head_y - 4], fill=(255, 255, 255))

    elif 'dino' in char_id or char_id == 'ironbelly':
        # Dinosaur archetype (spikes, heavy jaw, armored belly)
        # Dorsal spines behind head
        for i, sy in enumerate(range(head_y - 80, head_y + 60, 30)):
            sp_len = 35 - abs(i - 2) * 5
            draw.polygon([(cx - 70, sy), (cx - 70 - sp_len, sy + 15), (cx - 70, sy + 30)], fill=(15, 23, 42), outline=accent_color, width=2)
        # Torso
        round_rect(draw, (cx - 100, body_y, cx + 100, body_y + 155), radius=25, fill=main_color, outline=(255, 255, 255, 90), width=4)
        # Belly plate
        round_rect(draw, (cx - 60, body_y + 20, cx + 60, body_y + 125), radius=18, fill=(148, 163, 184) if char_id == 'ironbelly' else accent_color, outline=(20, 30, 40), width=4)
        if char_id == 'ironbelly':
            # Rivets on iron plate
            for rx in [cx - 45, cx + 45]:
                for ry in [body_y + 35, body_y + 70, body_y + 105]:
                    draw.ellipse([rx - 5, ry - 5, rx + 5, ry + 5], fill=(30, 41, 59))
        # Head
        draw.polygon([(cx - 65, head_y - 55), (cx + 65, head_y - 35), (cx + 85, head_y + 40), (cx - 45, head_y + 65)], fill=main_color, outline=accent_color, width=4)
        # Snout / Jaw
        round_rect(draw, (cx + 10, head_y + 5, cx + 80, head_y + 50), radius=12, fill=accent_color)
        # Fierce Eye
        draw.polygon([(cx - 15, head_y - 25), (cx + 25, head_y - 18), (cx + 10, head_y - 2)], fill=(250, 204, 21))
        draw.ellipse([cx + 2, head_y - 20, cx + 12, head_y - 10], fill=(15, 23, 42))

    # Foreground Boxing Gloves (guarded position)
    glove_y = 350
    # Left glove
    round_rect(draw, (cx - 130, glove_y - 30, cx - 55, glove_y + 45), radius=22, fill=glove_color, outline=(255, 255, 255, 140), width=4)
    # Right glove
    round_rect(draw, (cx + 55, glove_y - 30, cx + 130, glove_y + 45), radius=22, fill=glove_color, outline=(255, 255, 255, 140), width=4)

    # Championship Gold Belt if Champ
    if char_id == 'champ':
        belt_y = body_y + 85
        round_rect(draw, (cx - 95, belt_y, cx + 95, belt_y + 40), radius=8, fill=(234, 179, 8), outline=(161, 98, 7), width=3)
        draw.ellipse([cx - 25, belt_y - 8, cx + 25, belt_y + 48], fill=(250, 204, 21), outline=(161, 98, 7), width=3)
        draw.ellipse([cx - 12, belt_y + 5, cx + 12, belt_y + 35], fill=(220, 38, 38))

    # Name Banner Plate at bottom
    banner_y = 420
    round_rect(draw, (cx - 150, banner_y, cx + 150, banner_y + 60), radius=16, fill=(15, 23, 42), outline=accent_color, width=3)
    font_name = get_font(26)
    nbb = font_name.getbbox(name_tc)
    nw = nbb[2] - nbb[0]
    draw.text((cx - nw / 2, banner_y + 14), name_tc, font=font_name, fill=(255, 255, 255))

    # Character Emblem Badge at top-left
    draw_character_badge(draw, 75, 75, badge_tc, bg_color=main_color, border_color=accent_color, text_color=(255, 255, 255), radius=36)

    # Save image
    img.save(out_path, 'JPEG', quality=94)
    print(f"Saved: {out_path}")

# -----------------------------------------------------------------------------
# 3. Full-Body Battle Sprites (600x900)
# -----------------------------------------------------------------------------

def generate_fighter_sprite(char_id, name_tc, main_color, accent_color, glove_color, out_path, is_opponent=False):
    w, h = 600, 900
    img = Image.new('RGB', (w, h), (18, 24, 38))
    draw = ImageDraw.Draw(img)

    # Background gradient plate (clean contrast against canvas ring)
    cx, cy = w // 2, h // 2
    draw_radial_gradient(img, (cx, cy), 380, (main_color[0] // 4, main_color[1] // 4, main_color[2] // 4), (12, 16, 26))
    draw = ImageDraw.Draw(img)

    # Outer border ring for sprite card
    round_rect(draw, (15, 15, w - 15, h - 15), radius=28, outline=(main_color[0], main_color[1], main_color[2], 120), width=6)
    round_rect(draw, (28, 28, w - 28, h - 28), radius=20, outline=(accent_color[0], accent_color[1], accent_color[2], 80), width=2)

    # Large winding key on back
    draw_clockwork_key(draw, cx - 120, cy - 140, scale=1.9, color=(245, 158, 11), outline=(120, 53, 15))

    # Shadow under feet
    draw.ellipse([cx - 160, h - 130, cx + 160, h - 60], fill=(8, 11, 20))

    # Lower Body / Legs
    leg_w = 55
    leg_h = 170
    foot_y = h - 120
    round_rect(draw, (cx - 100, foot_y - leg_h, cx - 100 + leg_w, foot_y), radius=16, fill=(15, 23, 42), outline=main_color, width=4)
    round_rect(draw, (cx + 45, foot_y - leg_h, cx + 45 + leg_w, foot_y), radius=16, fill=(15, 23, 42), outline=main_color, width=4)
    # Heavy boxing boots / spring feet
    round_rect(draw, (cx - 125, foot_y - 35, cx - 100 + leg_w + 15, foot_y + 10), radius=12, fill=glove_color, outline=(255, 255, 255, 80), width=3)
    round_rect(draw, (cx + 30, foot_y - 35, cx + 45 + leg_w + 40, foot_y + 10), radius=12, fill=glove_color, outline=(255, 255, 255, 80), width=3)

    # Torso
    body_w = 210
    body_h = 290
    body_top = cy - 100
    round_rect(draw, (cx - body_w // 2, body_top, cx + body_w // 2, body_top + body_h), radius=35, fill=main_color, outline=(255, 255, 255, 120), width=6)
    # Chest plate
    round_rect(draw, (cx - 75, body_top + 35, cx + 75, body_top + 180), radius=22, fill=accent_color, outline=(20, 30, 45), width=4)

    # Head
    head_size = 180
    head_y = body_top - 125
    if 'bunny' in char_id or char_id == 'pillow' or char_id == 'feint':
        # Bunny Ears
        round_rect(draw, (cx - 85, head_y - 200, cx - 35, head_y - 30), radius=25, fill=main_color, outline=accent_color, width=5)
        round_rect(draw, (cx + 35, head_y - 200, cx + 85, head_y - 30), radius=25, fill=main_color, outline=accent_color, width=5)
        round_rect(draw, (cx - 70, head_y - 180, cx - 50, head_y - 50), radius=12, fill=accent_color)
        round_rect(draw, (cx + 50, head_y - 180, cx + 70, head_y - 50), radius=12, fill=accent_color)
        round_rect(draw, (cx - head_size // 2, head_y - 70, cx + head_size // 2, head_y + 70), radius=35, fill=(255, 228, 230) if char_id == 'bunny' else main_color, outline=accent_color, width=5)
    elif 'bear' in char_id or char_id == 'rush':
        # Bear ears
        draw.ellipse([cx - 125, head_y - 100, cx - 55, head_y - 30], fill=main_color, outline=accent_color, width=6)
        draw.ellipse([cx + 55, head_y - 100, cx + 125, head_y - 30], fill=main_color, outline=accent_color, width=6)
        draw.ellipse([cx - head_size // 2, head_y - 75, cx + head_size // 2, head_y + 75], fill=main_color, outline=(0, 0, 0, 120), width=6)
        draw.ellipse([cx - 55, head_y - 10, cx + 55, head_y + 65], fill=accent_color)
    elif 'dino' in char_id or char_id == 'ironbelly':
        # Spines
        for sp_i, sy in enumerate(range(head_y - 90, head_y + 80, 45)):
            draw.polygon([(cx - 95, sy), (cx - 145, sy + 22), (cx - 95, sy + 45)], fill=(15, 23, 42), outline=accent_color, width=3)
        draw.polygon([(cx - 85, head_y - 65), (cx + 85, head_y - 45), (cx + 105, head_y + 55), (cx - 65, head_y + 75)], fill=main_color, outline=accent_color, width=6)
    else:
        # Mecha
        round_rect(draw, (cx - head_size // 2, head_y - 75, cx + head_size // 2, head_y + 75), radius=30, fill=(226, 232, 240), outline=main_color, width=6)
        draw.line([(cx, head_y - 75), (cx, head_y - 145)], fill=(148, 163, 184), width=8)
        draw.ellipse([cx - 18, head_y - 160, cx + 18, head_y - 124], fill=accent_color)

    # Boxing Gloves (combat stance with high and low guards)
    # Lead Glove (forward)
    lead_gx, lead_gy = cx + 130, cy + 20
    round_rect(draw, (lead_gx - 55, lead_gy - 60, lead_gx + 55, lead_gy + 60), radius=30, fill=glove_color, outline=(255, 255, 255, 160), width=6)
    # Rear Glove (guarding chin)
    rear_gx, rear_gy = cx - 110, cy - 20
    round_rect(draw, (rear_gx - 50, rear_gy - 55, rear_gx + 50, rear_gy + 55), radius=28, fill=glove_color, outline=(255, 255, 255, 140), width=5)

    # Championship Gold Belt if Champ
    if char_id == 'champ':
        belt_y = body_top + 195
        round_rect(draw, (cx - 115, belt_y, cx + 115, belt_y + 55), radius=10, fill=(234, 179, 8), outline=(161, 98, 7), width=4)
        draw.ellipse([cx - 35, belt_y - 12, cx + 35, belt_y + 67], fill=(250, 204, 21), outline=(161, 98, 7), width=4)
        draw.ellipse([cx - 18, belt_y + 8, cx + 18, belt_y + 48], fill=(220, 38, 38))

    img.save(out_path, 'JPEG', quality=94)
    print(f"Saved: {out_path}")

# -----------------------------------------------------------------------------
# Execution
# -----------------------------------------------------------------------------

def main():
    print("=== Generating Toy-Boxing Art Upgrades ===")

    # 1. Ring Backgrounds
    generate_ring_sky()
    generate_ring_floor()

    # 2. Playable Characters
    playables = [
        ('bot', '藍拳機器人', '機', (59, 130, 246), (147, 197, 253), (29, 78, 216)),
        ('bear', '紅絨熊仔', '熊', (185, 28, 28), (251, 191, 36), (120, 53, 15)),
        ('bunny', '閃電兔', '兔', (244, 114, 182), (251, 207, 232), (219, 39, 119)),
        ('dino', '鐵拳恐龍', '龍', (22, 163, 74), (134, 239, 172), (20, 83, 45)),
    ]

    for cid, name, badge, main_c, accent_c, glove_c in playables:
        # Portrait
        p_path = os.path.join(PORTRAITS_DIR, f"{cid}.jpg")
        generate_portrait(cid, name, badge, main_c, accent_c, glove_c, p_path)
        # Fighter Sprite
        f_path = os.path.join(FIGHTERS_DIR, f"{cid}.jpg")
        generate_fighter_sprite(cid, name, main_c, accent_c, glove_c, f_path)

    # 3. League Opponents
    opponents = [
        ('pillow', '軟棉拳手', '綿', (168, 85, 247), (233, 213, 255), (244, 114, 182)),
        ('rush', '衝撞熊', '撞', (153, 27, 27), (234, 88, 12), (185, 28, 28)),
        ('needle', '刺拳機器', '刺', (217, 119, 6), (252, 211, 77), (245, 158, 11)),
        ('feint', '假動作兔', '幻', (107, 33, 168), (192, 132, 252), (147, 51, 234)),
        ('ironbelly', '鐵腹恐龍', '鐵', (30, 41, 59), (45, 212, 191), (15, 23, 42)),
        ('champ', '冠軍拳王', '王', (234, 179, 8), (254, 240, 138), (220, 38, 38)),
    ]

    for oid, name, badge, main_c, accent_c, glove_c in opponents:
        # Opponent Portrait
        op_path = os.path.join(OPP_PORTRAITS_DIR, f"{oid}.jpg")
        generate_portrait(oid, name, badge, main_c, accent_c, glove_c, op_path, is_opponent=True)
        # Opponent Fighter Sprite
        of_path = os.path.join(OPP_FIGHTERS_DIR, f"{oid}.jpg")
        generate_fighter_sprite(oid, name, main_c, accent_c, glove_c, of_path, is_opponent=True)

    print("=== All Toy-Boxing Assets Generated Successfully! ===")

if __name__ == '__main__':
    main()
