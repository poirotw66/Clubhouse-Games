# Background Images Directory

This directory contains background images for the game.

## Taiwan Street Backgrounds

The following three Taiwan street background images should be placed here:

1. **taiwan-night-market.jpg** - Taiwan night market scene
2. **taipei-street.jpg** - Taipei street scene  
3. **taiwan-alley.jpg** - Traditional Taiwan alley scene

## Image Requirements

- **Format**: JPG or PNG
- **Recommended size**: 1920x1080 px (16:9 aspect ratio) or larger
- **File size**: Optimized for web (under 500KB recommended)
- **Quality**: High quality, suitable for background use

## Usage

These images are referenced in `utils/backgrounds.ts` and will be automatically loaded when the corresponding background is selected.

## Adding New Backgrounds

To add new background images:

1. Place the image file in this directory
2. Update `utils/backgrounds.ts` to add a new background configuration
3. Use the format: `/backgrounds/your-image-name.jpg`
