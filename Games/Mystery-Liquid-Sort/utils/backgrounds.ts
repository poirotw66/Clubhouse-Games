/**
 * Background system for the game
 * Supports multiple background types: gradients and images
 */

export interface BackgroundConfig {
    id: number;
    name: string;
    type: 'gradient' | 'image';
    // For gradient backgrounds
    gradient?: {
        from: string;
        to: string;
        radial?: {
            color: string;
            opacity: number;
        };
    };
    // For image backgrounds
    imageUrl?: string;
    overlay?: string; // Overlay color with opacity for readability
}

/**
 * Background configurations
 * Currently 12 existing backgrounds + 3 new Taiwan street backgrounds = 15 total
 */
export const BACKGROUNDS: BackgroundConfig[] = [
    // Existing 12 backgrounds (gradient-based)
    {
        id: 1,
        name: 'Default Purple',
        type: 'gradient',
        gradient: {
            from: '#2a1b3d',
            to: '#0f0f1a',
            radial: { color: 'rgba(100,50,255,0.15)', opacity: 0.15 }
        }
    },
    {
        id: 2,
        name: 'Deep Blue',
        type: 'gradient',
        gradient: {
            from: '#1a1a2e',
            to: '#16213e',
            radial: { color: 'rgba(59,130,246,0.2)', opacity: 0.2 }
        }
    },
    {
        id: 3,
        name: 'Ocean Blue',
        type: 'gradient',
        gradient: {
            from: '#0a192f',
            to: '#112240',
            radial: { color: 'rgba(6,182,212,0.15)', opacity: 0.15 }
        }
    },
    {
        id: 4,
        name: 'Purple Dream',
        type: 'gradient',
        gradient: {
            from: '#2d1b69',
            to: '#1a0d3d',
            radial: { color: 'rgba(168,85,247,0.2)', opacity: 0.2 }
        }
    },
    {
        id: 5,
        name: 'Dark Green',
        type: 'gradient',
        gradient: {
            from: '#1a2e1a',
            to: '#0f1a0f',
            radial: { color: 'rgba(34,197,94,0.15)', opacity: 0.15 }
        }
    },
    {
        id: 6,
        name: 'Crimson Night',
        type: 'gradient',
        gradient: {
            from: '#2e1a1a',
            to: '#1a0f0f',
            radial: { color: 'rgba(239,68,68,0.15)', opacity: 0.15 }
        }
    },
    {
        id: 7,
        name: 'Orange Sunset',
        type: 'gradient',
        gradient: {
            from: '#3d2817',
            to: '#1a0f0a',
            radial: { color: 'rgba(249,115,22,0.2)', opacity: 0.2 }
        }
    },
    {
        id: 8,
        name: 'Teal Twilight',
        type: 'gradient',
        gradient: {
            from: '#1a2e2e',
            to: '#0f1a1a',
            radial: { color: 'rgba(20,184,166,0.15)', opacity: 0.15 }
        }
    },
    {
        id: 9,
        name: 'Pink Mist',
        type: 'gradient',
        gradient: {
            from: '#2e1a2e',
            to: '#1a0f1a',
            radial: { color: 'rgba(236,72,153,0.15)', opacity: 0.15 }
        }
    },
    {
        id: 10,
        name: 'Amber Glow',
        type: 'gradient',
        gradient: {
            from: '#2e2817',
            to: '#1a170f',
            radial: { color: 'rgba(234,179,8,0.2)', opacity: 0.2 }
        }
    },
    {
        id: 11,
        name: 'Indigo Night',
        type: 'gradient',
        gradient: {
            from: '#1a1a3d',
            to: '#0f0f2e',
            radial: { color: 'rgba(99,102,241,0.15)', opacity: 0.15 }
        }
    },
    {
        id: 12,
        name: 'Emerald Deep',
        type: 'gradient',
        gradient: {
            from: '#1a3d2e',
            to: '#0f2e1a',
            radial: { color: 'rgba(16,185,129,0.15)', opacity: 0.15 }
        }
    },
    
    // New Taiwan street backgrounds (13-15)
    {
        id: 13,
        name: 'Taiwan Night Market',
        type: 'image',
        imageUrl: '/backgrounds/taiwan-night-market.jpg',
        overlay: 'rgba(0,0,0,0.6)' // Dark overlay for text readability
    },
    {
        id: 14,
        name: 'Taipei Street',
        type: 'image',
        imageUrl: '/backgrounds/taipei-street.jpg',
        overlay: 'rgba(0,0,0,0.6)'
    },
    {
        id: 15,
        name: 'Traditional Taiwan Alley',
        type: 'image',
        imageUrl: '/backgrounds/taiwan-alley.jpg',
        overlay: 'rgba(0,0,0,0.6)'
    }
];

/**
 * Get background by ID
 */
export function getBackgroundById(id: number): BackgroundConfig | undefined {
    return BACKGROUNDS.find(bg => bg.id === id);
}

/**
 * Get random background
 */
export function getRandomBackground(): BackgroundConfig {
    const randomIndex = Math.floor(Math.random() * BACKGROUNDS.length);
    return BACKGROUNDS[randomIndex];
}

/**
 * Get background by level (for adventure mode)
 * Cycles through backgrounds based on level
 */
export function getBackgroundByLevel(level: number): BackgroundConfig {
    const index = (level - 1) % BACKGROUNDS.length;
    return BACKGROUNDS[index];
}

/**
 * Get saved background preference from localStorage
 */
export function getSavedBackground(): BackgroundConfig {
    const savedId = localStorage.getItem('mls_background_id');
    if (savedId) {
        const bg = getBackgroundById(parseInt(savedId, 10));
        if (bg) return bg;
    }
    // Default to first background
    return BACKGROUNDS[0];
}

/**
 * Save background preference to localStorage
 */
export function saveBackground(id: number): void {
    localStorage.setItem('mls_background_id', id.toString());
}
