#!/usr/bin/env python3
"""
generate-instant-flash-art.py

Generates and enhances high-resolution 2D game art assets for "Instant-Flash" (武士反應訓練),
strictly adhering to Sakurai visual design principles:
- skill-gfx-013: Silhouette-First Readability
- skill-gfx-002: Readability Before Decoration
- skill-gfx-001: Dramatic Lighting & Atmospheric Depth
- skill-gfx-007: Unified Stylized Japanese Anime / Ink-Wash Aesthetic
"""

import os
import math
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FLASH_DIR = os.path.join(BASE_DIR, 'Games', 'Instant-Flash')
PUBLIC_DIR = os.path.join(FLASH_DIR, 'public')
OPPONENTS_DIR = os.path.join(PUBLIC_DIR, 'opponents')
PROJECTILES_DIR = os.path.join(PUBLIC_DIR, 'projectiles')
os.makedirs(OPPONENTS_DIR, exist_ok=True)
os.makedirs(PROJECTILES_DIR, exist_ok=True)

# Font loading
FONT_PATH = '/System/Library/Fonts/Hiragino Sans GB.ttc'
if not os.path.exists(FONT_PATH):
    FONT_PATH = '/System/Library/Fonts/STHeiti Medium.ttc'

def get_font(size):
    try:
        return ImageFont.truetype(FONT_PATH, size)
    except Exception:
        return ImageFont.load_default()

# -----------------------------------------------------------------------------
# 1. Player Protagonist Asset Enhancement
# -----------------------------------------------------------------------------
RAW_PLAYER_PATH = '/Users/cfh00896102/.gemini/antigravity-cli/brain/ac5a5fbe-b048-4237-b07c-37e051d0275f/samurai_player_1795168168083.jpg'

if os.path.exists(RAW_PLAYER_PATH):
    print("Enhancing player battle sprite from generated art...")
    with Image.open(RAW_PLAYER_PATH) as raw:
        # Resize to 600x900 with high quality Lanczos filter
        player_sprite = raw.resize((600, 900), Image.Resampling.LANCZOS)
        enhancer = ImageEnhance.Contrast(player_sprite)
        player_sprite = enhancer.enhance(1.15)
        sharp = ImageEnhance.Sharpness(player_sprite)
        player_sprite = sharp.enhance(1.25)
        
        target_path = os.path.join(PUBLIC_DIR, 'player.jpg')
        player_sprite.save(target_path, 'JPEG', quality=95)
        print(f"Saved: {target_path} (600x900)")

        # Create player 512x512 avatar
        avatar_crop = raw.crop((raw.width // 2 - 270, 80, raw.width // 2 + 270, 80 + 540))
        avatar_crop = avatar_crop.resize((512, 512), Image.Resampling.LANCZOS)
        
        # Add decorative circular frame and seal
        draw = ImageDraw.Draw(avatar_crop)
        accent_rgb = (34, 211, 238) # Cyan
        
        # Inner decorative ring
        draw.ellipse([8, 8, 504, 504], outline=accent_rgb, width=4)
        draw.ellipse([14, 14, 498, 498], outline=(15, 23, 42), width=2)
        
        # Hanko seal for Player: "閃"
        seal_x, seal_y, seal_s = 400, 40, 72
        draw.rectangle([seal_x, seal_y, seal_x + seal_s, seal_y + seal_s], fill=(220, 38, 38), outline=(254, 202, 202), width=2)
        font_seal = get_font(42)
        draw.text((seal_x + 15, seal_y + 12), "閃", font=font_seal, fill=(255, 255, 255))
        
        player_avatar_path = os.path.join(OPPONENTS_DIR, 'player.jpg')
        avatar_crop.save(player_avatar_path, 'JPEG', quality=95)
        print(f"Saved: {player_avatar_path} (512x512)")
else:
    print(f"Notice: {RAW_PLAYER_PATH} not found; skipping player replacement.")

# -----------------------------------------------------------------------------
# 2. Distinct Opponent Portraits & Sprites (8 Opponents)
# -----------------------------------------------------------------------------
OPPONENT_SPECS = [
    {
        'id': 'ronin',
        'name': '見習浪人',
        'tagline': '基礎打直來',
        'kanji': '浪',
        'accent': (134, 239, 172), # Emerald green
        'secondary': (22, 101, 52),
        'weapon': 'shinai',
        'headgear': 'kasa',
    },
    {
        'id': 'bait',
        'name': '誘餌影',
        'tagline': '假動作大師',
        'kanji': '影',
        'accent': (244, 114, 182), # Rose pink
        'secondary': (157, 23, 77),
        'weapon': 'kunai',
        'headgear': 'fox_mask',
    },
    {
        'id': 'twin',
        'name': '雙連閃',
        'tagline': '二連擊',
        'kanji': '雙',
        'accent': (56, 189, 248), # Sky blue
        'secondary': (3, 105, 161),
        'weapon': 'dual_blades',
        'headgear': 'headband',
    },
    {
        'id': 'delay',
        'name': '遲延鬼',
        'tagline': '故意拖拍',
        'kanji': '鬼',
        'accent': (167, 139, 250), # Lavender purple
        'secondary': (91, 33, 182),
        'weapon': 'nodachi',
        'headgear': 'oni_mask',
    },
    {
        'id': 'surge',
        'name': '加速鴉',
        'tagline': '中途加速',
        'kanji': '鴉',
        'accent': (251, 146, 60), # Amber orange
        'secondary': (154, 52, 18),
        'weapon': 'feather_blades',
        'headgear': 'tengu_mask',
    },
    {
        'id': 'mirror',
        'name': '左右幻',
        'tagline': '左右亂換',
        'kanji': '幻',
        'accent': (34, 211, 238), # Cyan
        'secondary': (14, 116, 144),
        'weapon': 'mirror_katanas',
        'headgear': 'veil',
    },
    {
        'id': 'chaos',
        'name': '混彈鬼',
        'tagline': '暗器亂舞',
        'kanji': '亂',
        'accent': (232, 121, 249), # Magenta
        'secondary': (134, 25, 143),
        'weapon': 'chain_scythe',
        'headgear': 'spiked_band',
    },
    {
        'id': 'master',
        'name': '宗師一閃',
        'tagline': '最終試煉',
        'kanji': '極',
        'accent': (251, 191, 36), # Golden amber
        'secondary': (180, 83, 9),
        'weapon': 'divine_katana',
        'headgear': 'blindfold',
    },
]

def render_opponent_portrait(spec):
    w, h = 512, 512
    img = Image.new('RGB', (w, h), (13, 17, 28))
    draw = ImageDraw.Draw(img)
    accent = spec['accent']
    sec = spec['secondary']

    # 1. Radial atmospheric background vignette
    for r in range(256, 10, -8):
        ratio = 1.0 - (r / 256.0)
        # Blend dark charcoal with accent tint
        br = int(13 + (accent[0] * 0.18 * ratio))
        bg = int(17 + (accent[1] * 0.18 * ratio))
        bb = int(28 + (accent[2] * 0.18 * ratio))
        draw.ellipse([w//2 - r, h//2 - r, w//2 + r, h//2 + r], fill=(br, bg, bb))

    # 2. Geometric Japanese wave / circle background texture
    for ring in range(60, 240, 35):
        draw.ellipse([w//2 - ring, h//2 - ring, w//2 + ring, h//2 + ring], outline=(accent[0]//6, accent[1]//6, accent[2]//6), width=1)

    # 3. Silhouette Warrior Figure
    cx, cy = w // 2, h // 2 + 30
    
    # Shoulders & Chest Torso
    torso_pts = [
        (cx - 140, h - 20),
        (cx - 100, cy + 50),
        (cx - 50, cy),
        (cx + 50, cy),
        (cx + 100, cy + 50),
        (cx + 140, h - 20),
    ]
    draw.polygon(torso_pts, fill=(18, 22, 34))
    
    # Collar / Kimono folds
    draw.line([(cx - 70, cy + 110), (cx + 15, cy + 25)], fill=accent, width=3)
    draw.line([(cx + 70, cy + 110), (cx - 15, cy + 25)], fill=(accent[0]//2, accent[1]//2, accent[2]//2), width=3)

    # Head & Neck
    draw.rectangle([cx - 22, cy - 25, cx + 22, cy + 15], fill=(22, 26, 40))
    # Face silhouette
    draw.ellipse([cx - 45, cy - 95, cx + 45, cy - 5], fill=(26, 32, 50))
    # Sharp eyes gleam in theme color
    draw.polygon([(cx - 28, cy - 50), (cx - 12, cy - 47), (cx - 20, cy - 45)], fill=accent)
    draw.polygon([(cx + 12, cy - 47), (cx + 28, cy - 50), (cx + 20, cy - 45)], fill=accent)

    # 4. Signature Headgear & Silhouette Modifiers
    hg = spec['headgear']
    if hg == 'kasa':
        # Wide conical straw hat
        draw.polygon([(cx - 130, cy - 70), (cx, cy - 140), (cx + 130, cy - 70)], fill=(38, 44, 60), outline=accent, width=2)
        draw.line([(cx - 130, cy - 68), (cx + 130, cy - 68)], fill=accent, width=3)
    elif hg == 'fox_mask':
        # Fox mask tilted on side of head
        mask_pts = [(cx + 25, cy - 110), (cx + 65, cy - 115), (cx + 85, cy - 85), (cx + 55, cy - 55), (cx + 20, cy - 75)]
        draw.polygon(mask_pts, fill=(245, 245, 250), outline=accent, width=2)
        # Fox ears
        draw.polygon([(cx + 35, cy - 130), (cx + 50, cy - 105), (cx + 30, cy - 105)], fill=(220, 38, 38))
        draw.polygon([(cx + 65, cy - 125), (cx + 80, cy - 100), (cx + 60, cy - 100)], fill=(220, 38, 38))
    elif hg == 'oni_mask':
        # Menacing horned demon half-mask
        draw.polygon([(cx - 45, cy - 35), (cx + 45, cy - 35), (cx + 35, cy + 5), (cx, cy + 18), (cx - 35, cy + 5)], fill=(88, 28, 135), outline=accent, width=2)
        # Horns
        draw.polygon([(cx - 40, cy - 105), (cx - 55, cy - 145), (cx - 25, cy - 115)], fill=(220, 38, 38), outline=accent, width=2)
        draw.polygon([(cx + 40, cy - 105), (cx + 55, cy - 145), (cx + 25, cy - 115)], fill=(220, 38, 38), outline=accent, width=2)
    elif hg == 'tengu_mask':
        # Tengu long-beaked raven mask
        draw.polygon([(cx - 10, cy - 50), (cx + 65, cy - 35), (cx - 10, cy - 25)], fill=(20, 20, 20), outline=accent, width=2)
        # Crow feathers plume
        for fx in range(-50, -10, 10):
            draw.line([(cx + fx, cy - 100), (cx + fx - 25, cy - 135)], fill=(30, 41, 59), width=4)
    elif hg == 'blindfold':
        # Master ornate runic blindfold
        draw.rectangle([cx - 48, cy - 58, cx + 48, cy - 36], fill=(15, 23, 42), outline=accent, width=2)
        font_rune = get_font(16)
        draw.text((cx - 38, cy - 55), "天 · 神 · 極", font=font_rune, fill=accent)
        # Divine golden crown halo
        for a in range(0, 360, 30):
            rad = math.radians(a)
            x1 = cx + math.cos(rad) * 110
            y1 = (cy - 60) + math.sin(rad) * 110
            x2 = cx + math.cos(rad) * 135
            y2 = (cy - 60) + math.sin(rad) * 135
            draw.line([(x1, y1), (x2, y2)], fill=accent, width=2)
    elif hg == 'dual_blades':
        # Electric lightning headband
        draw.rectangle([cx - 46, cy - 75, cx + 46, cy - 65], fill=accent)
    elif hg == 'veil':
        # Mirage split-pattern veil
        draw.line([(cx, cy - 90), (cx, cy + 20)], fill=accent, width=2)

    # 5. Weapon Silhouette & Dynamic Spark Trails
    wp = spec['weapon']
    if wp in ('nodachi', 'divine_katana'):
        # Massive blade over shoulder
        bx1, by1 = cx + 80, cy + 130
        bx2, by2 = cx - 140, cy - 170
        draw.line([(bx1, by1), (bx2, by2)], fill=(240, 240, 250), width=8)
        draw.line([(bx1, by1), (bx2, by2)], fill=accent, width=3)
        # Katana hilt & Tsuba
        draw.ellipse([bx1 - 10, by1 - 10, bx1 + 10, by1 + 10], fill=accent)
    elif wp == 'dual_blades':
        # Crossed twin blades
        draw.line([(cx - 110, cy + 90), (cx + 90, cy - 110)], fill=accent, width=4)
        draw.line([(cx + 110, cy + 90), (cx - 90, cy - 110)], fill=accent, width=4)
    elif wp == 'chain_scythe':
        # Kusarigama curved scythe & chain links
        draw.arc([cx + 40, cy - 120, cx + 140, cy - 20], 180, 360, fill=accent, width=6)
        for i in range(5):
            draw.ellipse([cx - 90 + i*35, cy + 70 + (i%2)*12, cx - 75 + i*35, cy + 85 + (i%2)*12], outline=accent, width=2)
    else:
        # Standard katana blade gleam
        draw.line([(cx - 90, cy + 70), (cx + 110, cy - 120)], fill=accent, width=3)

    # 6. Border Framing & Glow
    draw.rectangle([10, 10, w - 10, h - 10], outline=accent, width=3)
    draw.rectangle([14, 14, w - 14, h - 14], outline=(15, 23, 42), width=2)
    
    # 7. Red Hanko Seal in Top-Right Corner
    seal_x, seal_y, seal_s = w - 85, 25, 60
    draw.rectangle([seal_x, seal_y, seal_x + seal_s, seal_y + seal_s], fill=(185, 28, 28), outline=(254, 202, 202), width=2)
    font_seal = get_font(36)
    draw.text((seal_x + 12, seal_y + 10), spec['kanji'], font=font_seal, fill=(255, 255, 255))

    # 8. Bottom Name & Tagline Banner
    banner_h = 56
    draw.rectangle([16, h - 16 - banner_h, w - 16, h - 16], fill=(15, 23, 42, 220), outline=accent, width=1)
    font_name = get_font(22)
    font_sub = get_font(13)
    draw.text((28, h - 16 - banner_h + 8), spec['name'], font=font_name, fill=accent)
    draw.text((28, h - 16 - banner_h + 34), spec['tagline'], font=font_sub, fill=(148, 163, 184))

    # Save 512x512 portrait
    portrait_path = os.path.join(OPPONENTS_DIR, f"{spec['id']}.jpg")
    img.save(portrait_path, 'JPEG', quality=95)
    print(f"Saved portrait: {portrait_path} (512x512)")

    # Also generate 600x900 battle sprite version for GameCanvas
    sprite_w, sprite_h = 600, 900
    sprite_img = img.resize((sprite_w, sprite_h), Image.Resampling.LANCZOS)
    sprite_path = os.path.join(OPPONENTS_DIR, f"{spec['id']}-sprite.jpg")
    sprite_img.save(sprite_path, 'JPEG', quality=95)
    print(f"Saved battle sprite: {sprite_path} (600x900)")

print("\nGenerating 8 Opponent character portraits & sprites...")
for spec in OPPONENT_SPECS:
    render_opponent_portrait(spec)

# Update default enemy.jpg to master/boss sprite
boss_sprite_path = os.path.join(OPPONENTS_DIR, 'master-sprite.jpg')
if os.path.exists(boss_sprite_path):
    with Image.open(boss_sprite_path) as boss_img:
        boss_img.save(os.path.join(PUBLIC_DIR, 'enemy.jpg'), 'JPEG', quality=95)
        print("Updated default public/enemy.jpg with high-res sprite")

# -----------------------------------------------------------------------------
# 3. Projectile Textures Upscaling & Visual Polishing (512x512)
# -----------------------------------------------------------------------------
print("\nPolishing 4 projectile textures...")
PROJECTILE_ACCENTS = {
    'shuriken.jpg': (239, 68, 68),   # Red sparks
    'kunai.jpg': (56, 189, 248),     # Blue stream
    'bomb.jpg': (249, 115, 22),      # Orange fuse burn
    'sickle.jpg': (20, 184, 166),    # Teal wind shear
}

for filename, accent_col in PROJECTILE_ACCENTS.items():
    p_path = os.path.join(PROJECTILES_DIR, filename)
    if os.path.exists(p_path):
        with Image.open(p_path) as p_img:
            # Resample to 512x512
            p_up = p_img.resize((512, 512), Image.Resampling.LANCZOS)
            # Enhance contrast and sharpness
            p_up = ImageEnhance.Contrast(p_up).enhance(1.25)
            p_up = ImageEnhance.Sharpness(p_up).enhance(1.4)
            
            # Add subtle radial energy glow border
            p_draw = ImageDraw.Draw(p_up)
            p_draw.rectangle([4, 4, 508, 508], outline=accent_col, width=3)
            p_draw.rectangle([8, 8, 504, 504], outline=(15, 23, 42), width=2)
            
            p_up.save(p_path, 'JPEG', quality=95)
            print(f"Enhanced projectile: {p_path} (512x512, accent={accent_col})")

print("\nAll Instant-Flash art assets generated and polished successfully!")

