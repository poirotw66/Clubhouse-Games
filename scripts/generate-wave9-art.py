#!/usr/bin/env python3
"""
generate-wave9-art.py

Multi-Battleground Art Upgrade Generator for:
1. Blackjack (黑傑克)
2. Memory-Match (記憶翻牌)
3. Checkers (西洋跳棋)
4. Klondike & FreeCell (經典接龍雙雄)

Strictly adheres to Sakurai visual design principles:
- skill-gfx-013: Silhouette-First Readability
- skill-gfx-002: Readability Before Decoration
- skill-gfx-001: Dramatic Lighting & Atmospheric Depth
- skill-gfx-007: Unified Aesthetic
"""

import os
import math
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Fonts
FONT_PATH = '/System/Library/Fonts/Hiragino Sans GB.ttc'
if not os.path.exists(FONT_PATH):
    FONT_PATH = '/System/Library/Fonts/STHeiti Medium.ttc'

def get_font(size):
    try:
        return ImageFont.truetype(FONT_PATH, size)
    except Exception:
        return ImageFont.load_default()

def draw_radial_gradient(img, center, max_radius, inner_color, outer_color):
    w, h = img.size
    overlay = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    cx, cy = center
    steps = 35
    for i in range(steps, 0, -1):
        r = int(max_radius * (i / steps))
        factor = i / steps
        r_c = int(inner_color[0] * (1 - factor) + outer_color[0] * factor)
        g_c = int(inner_color[1] * (1 - factor) + outer_color[1] * factor)
        b_c = int(inner_color[2] * (1 - factor) + outer_color[2] * factor)
        a_c = int(inner_color[3] * (1 - factor) + outer_color[3] * factor) if len(inner_color) > 3 else 255
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(r_c, g_c, b_c, a_c))
    img.paste(Image.alpha_composite(img.convert('RGBA'), overlay).convert('RGB'))

def round_rect(draw, xy, radius, fill=None, outline=None, width=1):
    x0, y0, x1, y1 = xy
    draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=fill, outline=outline, width=width)

# =============================================================================
# PART 1: HIGH-RES POKER SUITS (384x384) & CARDS (Card-Back, Face-Plate, Felt)
# =============================================================================

def generate_poker_suits(output_dir):
    os.makedirs(output_dir, exist_ok=True)
    size = (384, 384)
    cx, cy = 192, 192

    # 1. Spades (♠)
    img_spades = Image.new('RGB', size, (255, 255, 255))
    draw_s = ImageDraw.Draw(img_spades)
    # Spade lobes & tip
    draw_s.ellipse([cx - 105, cy - 25, cx, cy + 95], fill=(15, 23, 42))
    draw_s.ellipse([cx, cy - 25, cx + 105, cy + 95], fill=(15, 23, 42))
    draw_s.polygon([(cx - 104, cy + 35), (cx + 104, cy + 35), (cx, cy - 125)], fill=(15, 23, 42))
    # Stem
    draw_s.polygon([(cx - 22, cy + 50), (cx + 22, cy + 50), (cx + 55, cy + 130), (cx - 55, cy + 130)], fill=(15, 23, 42))
    # Subtle inner bevel highlight
    draw_s.polygon([(cx - 10, cy - 100), (cx - 60, cy + 15), (cx - 10, cy + 15)], fill=(51, 65, 85))
    img_spades.save(os.path.join(output_dir, 'spades.jpg'), 'JPEG', quality=95)

    # 2. Hearts (♥)
    img_hearts = Image.new('RGB', size, (255, 255, 255))
    draw_h = ImageDraw.Draw(img_hearts)
    draw_h.ellipse([cx - 110, cy - 110, cx, cy + 10], fill=(225, 29, 72))
    draw_h.ellipse([cx, cy - 110, cx + 110, cy + 10], fill=(225, 29, 72))
    draw_h.polygon([(cx - 108, cy - 40), (cx + 108, cy - 40), (cx, cy + 125)], fill=(225, 29, 72))
    # Heart gloss highlight
    draw_h.ellipse([cx - 75, cy - 85, cx - 35, cy - 45], fill=(251, 113, 133))
    img_hearts.save(os.path.join(output_dir, 'hearts.jpg'), 'JPEG', quality=95)

    # 3. Diamonds (♦)
    img_diamonds = Image.new('RGB', size, (255, 255, 255))
    draw_d = ImageDraw.Draw(img_diamonds)
    draw_d.polygon([(cx, cy - 135), (cx + 105, cy), (cx, cy + 135), (cx - 105, cy)], fill=(225, 29, 72))
    # Diamond facet highlight
    draw_d.polygon([(cx, cy - 135), (cx - 105, cy), (cx, cy)], fill=(244, 63, 94))
    draw_d.polygon([(cx, cy - 135), (cx + 105, cy), (cx, cy)], fill=(225, 29, 72))
    img_diamonds.save(os.path.join(output_dir, 'diamonds.jpg'), 'JPEG', quality=95)

    # 4. Clubs (♣)
    img_clubs = Image.new('RGB', size, (255, 255, 255))
    draw_c = ImageDraw.Draw(img_clubs)
    cr = 64
    # Three leaves
    draw_c.ellipse([cx - cr, cy - 125, cx + cr, cy - 125 + cr * 2], fill=(15, 23, 42))
    draw_c.ellipse([cx - 115, cy - 35, cx - 115 + cr * 2, cy - 35 + cr * 2], fill=(15, 23, 42))
    draw_c.ellipse([cx + 115 - cr * 2, cy - 35, cx + 115, cy - 35 + cr * 2], fill=(15, 23, 42))
    draw_c.polygon([(cx - 30, cy - 40), (cx + 30, cy - 40), (cx + 30, cy + 40), (cx - 30, cy + 40)], fill=(15, 23, 42))
    # Stem
    draw_c.polygon([(cx - 20, cy + 20), (cx + 20, cy + 20), (cx + 50, cy + 130), (cx - 50, cy + 130)], fill=(15, 23, 42))
    # Highlight on top leaf
    draw_c.ellipse([cx - 35, cy - 105, cx - 10, cy - 80], fill=(51, 65, 85))
    img_clubs.save(os.path.join(output_dir, 'clubs.jpg'), 'JPEG', quality=95)

def generate_felt_table(out_path, color=(6, 78, 59), border_line=True):
    w, h = 1350, 900
    img = Image.new('RGB', (w, h), color)
    draw_radial_gradient(img, (w // 2, h // 2), int(w * 0.7), (color[0] + 15, color[1] + 20, color[2] + 15), (color[0] // 3, color[1] // 3, color[2] // 3))
    draw = ImageDraw.Draw(img)

    if border_line:
        # Golden casino rail line
        gold = (245, 158, 11)
        round_rect(draw, (40, 40, w - 40, h - 40), radius=50, outline=(gold[0], gold[1], gold[2], 90), width=4)
        round_rect(draw, (55, 55, w - 55, h - 55), radius=42, outline=(gold[0], gold[1], gold[2], 50), width=2)
    img.save(out_path, 'JPEG', quality=92)
    print(f"Saved: {out_path}")

def generate_card_back(out_path, primary_color=(30, 58, 138), gold_border=True):
    w, h = 1024, 1536
    img = Image.new('RGB', (w, h), (255, 255, 255))
    draw = ImageDraw.Draw(img)

    # Outer white card margin
    round_rect(draw, (20, 20, w - 20, h - 20), radius=40, fill=(255, 255, 255))
    # Inner colored field
    inset = 45
    gold = (217, 119, 6)
    fill_c = primary_color
    round_rect(draw, (inset, inset, w - inset, h - inset), radius=30, fill=fill_c, outline=gold if gold_border else (255, 255, 255), width=8)

    # Symmetric geometric diamond filigree
    cx, cy = w // 2, h // 2
    step = 48
    for x in range(inset + 30, w - inset - 30, step):
        for y in range(inset + 30, h - inset - 30, step):
            draw.polygon([(x, y - 18), (x + 18, y), (x, y + 18), (x - 18, y)], outline=(255, 255, 255, 60), width=2)

    # Central medallion
    round_rect(draw, (cx - 180, cy - 240, cx + 180, cy + 240), radius=30, fill=fill_c, outline=gold, width=6)
    draw.ellipse([cx - 120, cy - 120, cx + 120, cy + 120], outline=gold, width=4)
    draw.ellipse([cx - 70, cy - 70, cx + 70, cy + 70], fill=gold)
    draw.ellipse([cx - 40, cy - 40, cx + 40, cy + 40], fill=fill_c)

    img.save(out_path, 'JPEG', quality=94)
    print(f"Saved: {out_path}")

def generate_face_plate(out_path):
    w, h = 746, 1120
    img = Image.new('RGB', (w, h), (250, 250, 252))
    draw = ImageDraw.Draw(img)
    # Subtle inner border line
    round_rect(draw, (24, 24, w - 24, h - 24), radius=32, outline=(226, 232, 240), width=3)
    img.save(out_path, 'JPEG', quality=94)
    print(f"Saved: {out_path}")

# =============================================================================
# PART 2: BLACKJACK AVATARS (512x512)
# =============================================================================

def generate_blackjack_avatar(name_tc, title_tc, theme_c, out_path, is_dealer=True):
    size = (512, 512)
    img = Image.new('RGB', size, (10, 15, 25))
    cx, cy = 256, 256
    draw_radial_gradient(img, (cx, cy), 280, (theme_c[0] // 3, theme_c[1] // 3, theme_c[2] // 3), (8, 11, 20))
    draw = ImageDraw.Draw(img)

    # Ornate VIP Circular Frame
    r = 236
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=theme_c, width=7)
    draw.ellipse([cx - r + 10, cy - r + 10, cx + r - 10, cy + r - 10], outline=(255, 255, 255, 100), width=2)

    # Suit symbols decor around frame
    draw.text((cx - 16, 25), "♠", font=get_font(28), fill=theme_c)
    draw.text((cx - 16, 460), "♥", font=get_font(28), fill=(239, 68, 68))
    draw.text((25, cy - 16), "♣", font=get_font(28), fill=theme_c)
    draw.text((465, cy - 16), "♦", font=get_font(28), fill=(239, 68, 68))

    # Shoulders / Tuxedo
    body_y = 310
    round_rect(draw, (cx - 110, body_y, cx + 110, body_y + 150), radius=28, fill=(15, 23, 42), outline=theme_c, width=3)
    # White collar
    draw.polygon([(cx - 35, body_y), (cx + 35, body_y), (cx, body_y + 60)], fill=(255, 255, 255))
    # Bowtie
    draw.polygon([(cx - 28, body_y + 12), (cx + 28, body_y + 28), (cx + 28, body_y + 12), (cx - 28, body_y + 28)], fill=theme_c)
    draw.ellipse([cx - 8, body_y + 14, cx + 8, body_y + 26], fill=(255, 255, 255))

    # Head
    head_y = 195
    round_rect(draw, (cx - 65, head_y - 70, cx + 65, head_y + 70), radius=25, fill=(254, 215, 170), outline=(20, 25, 40), width=4)
    # Hair
    draw.ellipse([cx - 75, head_y - 85, cx + 75, head_y - 15], fill=(30, 20, 15))
    # Eyes
    draw.ellipse([cx - 36, head_y - 10, cx - 18, head_y + 10], fill=(15, 23, 42))
    draw.ellipse([cx + 18, head_y - 10, cx + 36, head_y + 10], fill=(15, 23, 42))
    draw.ellipse([cx - 28, head_y - 6, cx - 22, head_y], fill=(255, 255, 255))
    draw.ellipse([cx + 26, head_y - 6, cx + 32, head_y], fill=(255, 255, 255))
    # Smile
    draw.arc([cx - 25, head_y + 15, cx + 25, head_y + 40], 0, 180, fill=(180, 83, 9), width=3)

    # Name Banner Plate
    round_rect(draw, (cx - 140, 415, cx + 140, 475), radius=15, fill=(15, 23, 42), outline=theme_c, width=3)
    fn = get_font(26)
    nb = fn.getbbox(name_tc)
    nw = nb[2] - nb[0]
    draw.text((cx - nw / 2, 426), name_tc, font=fn, fill=(255, 255, 255))

    img.save(out_path, 'JPEG', quality=94)
    print(f"Saved: {out_path}")

# =============================================================================
# PART 3: MEMORY-MATCH RELIC FACES (512x512) & CARDS
# =============================================================================

def generate_memory_relics(faces_dir):
    os.makedirs(faces_dir, exist_ok=True)
    size = (512, 512)
    cx, cy = 256, 256

    relics = [
        ('star', '星辰寶石', (245, 158, 11), (254, 240, 138)),
        ('moon', '月影琉璃', (56, 189, 248), (224, 242, 254)),
        ('fish', '深海金魚', (249, 115, 22), (254, 215, 170)),
        ('cherry', '赤紅櫻桃', (225, 29, 72), (254, 205, 211)),
        ('leaf', '翡翠晨葉', (16, 185, 129), (209, 250, 229)),
        ('gem', '秘境原石', (168, 85, 247), (243, 232, 255)),
    ]

    for rid, rname, c_main, c_glow in relics:
        img = Image.new('RGB', size, (15, 20, 32))
        draw_radial_gradient(img, (cx, cy), 260, (c_main[0] // 3, c_main[1] // 3, c_main[2] // 3), (8, 12, 20))
        draw = ImageDraw.Draw(img)

        # Ornate Runic Outer Medallion
        r = 224
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=c_main, width=7)
        draw.ellipse([cx - r + 12, cy - r + 12, cx + r - 12, cy + r - 12], outline=(255, 255, 255, 90), width=2)

        # Specific Relic Art
        if rid == 'star':
            # 8-Point Cosmic Star
            pts = []
            for i in range(16):
                ang = (i * math.pi) / 8 - math.pi / 2
                rad = 135 if i % 2 == 0 else 55
                pts.append((cx + int(math.cos(ang) * rad), cy + int(math.sin(ang) * rad)))
            draw.polygon(pts, fill=c_main, outline=(255, 255, 255), width=3)
            # Inner gem
            draw.ellipse([cx - 35, cy - 35, cx + 35, cy + 35], fill=c_glow)
            draw.ellipse([cx - 15, cy - 15, cx + 15, cy + 15], fill=(255, 255, 255))

        elif rid == 'moon':
            # Crescent Moon
            draw.ellipse([cx - 110, cy - 120, cx + 110, cy + 120], fill=c_main)
            draw.ellipse([cx - 65, cy - 145, cx + 125, cy + 95], fill=(15, 20, 32))
            # Moon sparkle
            draw.ellipse([cx - 25, cy - 30, cx - 10, cy - 15], fill=(255, 255, 255))

        elif rid == 'fish':
            # Koi / Goldfish
            # Body
            draw.ellipse([cx - 95, cy - 55, cx + 65, cy + 55], fill=c_main, outline=(255, 255, 255), width=3)
            # Tail fins
            draw.polygon([(cx + 45, cy), (cx + 125, cy - 70), (cx + 95, cy), (cx + 125, cy + 70)], fill=c_glow)
            # Eye
            draw.ellipse([cx - 65, cy - 22, cx - 45, cy - 2], fill=(255, 255, 255))
            draw.ellipse([cx - 60, cy - 18, cx - 50, cy - 8], fill=(15, 20, 32))

        elif rid == 'cherry':
            # Twin Cherries with stems
            draw.ellipse([cx - 85, cy + 5, cx - 5, cy + 85], fill=c_main, outline=(255, 255, 255), width=3)
            draw.ellipse([cx + 5, cy - 15, cx + 85, cy + 65], fill=c_main, outline=(255, 255, 255), width=3)
            # Highlights
            draw.ellipse([cx - 65, cy + 20, cx - 45, cy + 40], fill=c_glow)
            draw.ellipse([cx + 25, cy, cx + 45, cy + 20], fill=c_glow)
            # Stems & Leaf
            draw.line([(cx - 45, cy + 15), (cx, cy - 75)], fill=(16, 185, 129), width=6)
            draw.line([(cx + 45, cy - 5), (cx, cy - 75)], fill=(16, 185, 129), width=6)
            draw.ellipse([cx - 15, cy - 105, cx + 45, cy - 65], fill=(16, 185, 129))

        elif rid == 'leaf':
            # Clover / Emerald Leaf
            draw.ellipse([cx - 75, cy - 110, cx + 75, cy + 110], fill=c_main, outline=(255, 255, 255), width=3)
            draw.line([(cx, cy - 90), (cx, cy + 125)], fill=c_glow, width=5)
            for y_off in range(-50, 70, 35):
                draw.line([(cx, cy + y_off), (cx - 45, cy + y_off - 25)], fill=c_glow, width=3)
                draw.line([(cx, cy + y_off), (cx + 45, cy + y_off - 25)], fill=c_glow, width=3)

        elif rid == 'gem':
            # Multifaceted Amethyst
            draw.polygon([(cx - 95, cy - 45), (cx - 45, cy - 110), (cx + 45, cy - 110), (cx + 95, cy - 45), (cx, cy + 115)], fill=c_main, outline=(255, 255, 255), width=3)
            draw.polygon([(cx - 45, cy - 110), (cx + 45, cy - 110), (cx + 45, cy - 45), (cx - 45, cy - 45)], fill=c_glow)
            draw.polygon([(cx - 45, cy - 45), (cx + 45, cy - 45), (cx, cy + 115)], fill=(147, 51, 234))

        # Bottom Subtitle
        round_rect(draw, (cx - 100, 420, cx + 100, 470), radius=12, fill=(15, 23, 42), outline=c_main, width=2)
        fn = get_font(22)
        bb = fn.getbbox(rname)
        draw.text((cx - (bb[2] - bb[0]) / 2, 432), rname, font=fn, fill=(255, 255, 255))

        out_f = os.path.join(faces_dir, f"{rid}.jpg")
        img.save(out_f, 'JPEG', quality=94)
        print(f"Saved: {out_f}")

def generate_memory_match_deck(mm_dir):
    generate_memory_relics(os.path.join(mm_dir, 'public', 'faces'))
    # Card back: Cosmic Astrolabe
    generate_card_back(os.path.join(mm_dir, 'public', 'card-back.jpg'), primary_color=(88, 28, 135), gold_border=True)
    # Table bg: Dark Walnut
    generate_felt_table(os.path.join(mm_dir, 'public', 'table-bg.jpg'), color=(24, 24, 27), border_line=True)

# =============================================================================
# PART 4: CHECKERS PIECES (512x512) & SQUARES
# =============================================================================

def generate_checker_piece(out_path, color_type='black', is_king=False):
    size = (512, 512)
    img = Image.new('RGB', size, (20, 25, 35))
    cx, cy = 256, 256
    draw = ImageDraw.Draw(img)

    is_black = color_type == 'black'
    main_c = (44, 40, 36) if is_black else (254, 243, 199)
    rim_c = (217, 119, 6) if is_black else (180, 83, 9)
    highlight_c = (87, 83, 78) if is_black else (255, 255, 255)

    # Turned lathe concentric rings
    r = 225
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=main_c, outline=rim_c, width=10)
    # Lathe groove 1
    draw.ellipse([cx - r + 30, cy - r + 30, cx + r - 30, cy + r - 30], outline=highlight_c, width=4)
    # Lathe groove 2 (steep drop)
    draw.ellipse([cx - r + 60, cy - r + 60, cx + r - 60, cy + r - 60], outline=(15, 23, 42) if is_black else (217, 119, 6), width=6)
    # Center concave dish
    draw.ellipse([cx - r + 90, cy - r + 90, cx + r - 90, cy + r - 90], fill=(28, 25, 23) if is_black else (253, 230, 138), outline=rim_c, width=4)

    if is_king:
        # Imperial Golden Crown
        gold = (245, 158, 11)
        draw.polygon([(cx - 75, cy + 45), (cx + 75, cy + 45), (cx + 85, cy - 35), (cx + 35, cy), (cx, cy - 65), (cx - 35, cy), (cx - 85, cy - 35)], fill=gold, outline=(255, 255, 255), width=3)
        # Crown jewels
        for jx in [cx - 75, cx, cx + 75]:
            draw.ellipse([jx - 8, cy - 45 if jx != cx else cy - 75, jx + 8, cy - 29 if jx != cx else cy - 59], fill=(220, 38, 38))
    else:
        # Center pip
        draw.ellipse([cx - 35, cy - 35, cx + 35, cy + 35], fill=main_c, outline=rim_c, width=4)

    img.save(out_path, 'JPEG', quality=95)
    print(f"Saved: {out_path}")

def generate_checkers_squares(checkers_dir):
    pub = os.path.join(checkers_dir, 'public')
    # Dark square: Walnut
    dark_sq = Image.new('RGB', (512, 512), (63, 43, 30))
    d_draw = ImageDraw.Draw(dark_sq)
    d_draw.rectangle([10, 10, 502, 502], outline=(40, 25, 15), width=8)
    dark_sq.save(os.path.join(pub, 'square-dark.jpg'), 'JPEG', quality=94)

    # Light square: Maple
    light_sq = Image.new('RGB', (512, 512), (235, 215, 185))
    l_draw = ImageDraw.Draw(light_sq)
    l_draw.rectangle([10, 10, 502, 502], outline=(200, 175, 140), width=8)
    light_sq.save(os.path.join(pub, 'square-light.jpg'), 'JPEG', quality=94)

    # Table background
    generate_felt_table(os.path.join(pub, 'table-bg.jpg'), color=(40, 30, 25), border_line=True)

# =============================================================================
# MAIN EXECUTION
# =============================================================================

def main():
    print("=== Launching Wave 9 Multi-Battleground Art Upgrade ===")

    # ---------------------------------------------------------
    # 1. Blackjack (黑傑克)
    # ---------------------------------------------------------
    print("\n--- Battleground 1: Blackjack ---")
    bj_pub = os.path.join(BASE_DIR, 'Games', 'Blackjack-main', 'public')
    generate_felt_table(os.path.join(bj_pub, 'felt.jpg'), color=(6, 78, 59), border_line=True)
    generate_card_back(os.path.join(bj_pub, 'card-back.jpg'), primary_color=(30, 58, 138), gold_border=True)
    generate_face_plate(os.path.join(bj_pub, 'face-plate.jpg'))
    generate_poker_suits(os.path.join(bj_pub, 'suits'))

    # Dealer / VIP avatars
    bj_avatars = os.path.join(bj_pub, 'avatars')
    os.makedirs(bj_avatars, exist_ok=True)
    generate_blackjack_avatar('見習荷官', '小林', (59, 130, 246), os.path.join(bj_avatars, 'dealer-novice.jpg'), is_dealer=True)
    generate_blackjack_avatar('資深荷官', '艾蓮娜', (236, 72, 153), os.path.join(bj_avatars, 'dealer-pro.jpg'), is_dealer=True)
    generate_blackjack_avatar('金牌荷官', '凡斯', (245, 158, 11), os.path.join(bj_avatars, 'dealer-vip.jpg'), is_dealer=True)
    generate_blackjack_avatar('豪賭名士', '玩家主角', (16, 185, 129), os.path.join(bj_avatars, 'player-vip.jpg'), is_dealer=False)

    # ---------------------------------------------------------
    # 2. Memory-Match (記憶翻牌)
    # ---------------------------------------------------------
    print("\n--- Battleground 2: Memory-Match ---")
    generate_memory_match_deck(os.path.join(BASE_DIR, 'Games', 'Memory-Match'))

    # ---------------------------------------------------------
    # 3. Checkers (西洋跳棋)
    # ---------------------------------------------------------
    print("\n--- Battleground 3: Checkers ---")
    chk_pub = os.path.join(BASE_DIR, 'Games', 'Checkers', 'public')
    generate_checker_piece(os.path.join(chk_pub, 'piece-black.jpg'), color_type='black', is_king=False)
    generate_checker_piece(os.path.join(chk_pub, 'piece-white.jpg'), color_type='white', is_king=False)
    generate_checker_piece(os.path.join(chk_pub, 'piece-black-king.jpg'), color_type='black', is_king=True)
    generate_checker_piece(os.path.join(chk_pub, 'piece-white-king.jpg'), color_type='white', is_king=True)
    generate_checkers_squares(os.path.join(BASE_DIR, 'Games', 'Checkers'))

    # ---------------------------------------------------------
    # 4. Klondike & FreeCell (經典接龍雙雄)
    # ---------------------------------------------------------
    print("\n--- Battleground 4: Klondike & FreeCell ---")
    # Klondike
    kl_pub = os.path.join(BASE_DIR, 'Games', 'Klondike', 'public')
    generate_felt_table(os.path.join(kl_pub, 'felt.jpg'), color=(20, 83, 45), border_line=True)
    generate_card_back(os.path.join(kl_pub, 'card-back.jpg'), primary_color=(29, 78, 216), gold_border=True)
    generate_face_plate(os.path.join(kl_pub, 'face-plate.jpg'))
    generate_poker_suits(os.path.join(kl_pub, 'suits'))

    # FreeCell
    fc_pub = os.path.join(BASE_DIR, 'Games', 'FreeCell', 'public')
    generate_felt_table(os.path.join(fc_pub, 'table-bg.jpg'), color=(15, 23, 42), border_line=True)
    generate_card_back(os.path.join(fc_pub, 'card-back.jpg'), primary_color=(185, 28, 28), gold_border=True)
    generate_face_plate(os.path.join(fc_pub, 'face-plate.jpg'))
    generate_poker_suits(os.path.join(fc_pub, 'suits'))

    print("\n=== All Wave 9 Assets Generated and Deployed Successfully! ===")

if __name__ == '__main__':
    main()
