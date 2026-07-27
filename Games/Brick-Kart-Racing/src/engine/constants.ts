/**
 * All distances are in "world units", which map 1:1 to pixels of the track
 * texture. One LEGO-style stud is STUD_PX wide in that texture.
 */
export const WORLD_SIZE = 2048;
export const STUD_PX = 16;

/** Half the road is drivable at full grip; outside that is grass. */
export const ROAD_WIDTH = 130;
export const CURB_WIDTH = 14;

/** One unit of the brick models equals this many world units. */
export const BRICK_UNIT = 6;

export const KART_LENGTH = 6 * BRICK_UNIT;
export const KART_WIDTH = 4 * BRICK_UNIT;
export const KART_RADIUS = 15;

/** Internal render resolution; the canvas is upscaled to fit the viewport. */
export const RENDER_WIDTH = 640;
export const RENDER_HEIGHT = 360;
export const HORIZON_FRAC = 0.4;
export const FOCAL = RENDER_WIDTH * 0.62;

export const CAM_HEIGHT = 38;
export const CAM_DISTANCE = 130;
/** How quickly the camera catches up with the kart, per second. */
export const CAM_LAG = 6;

export const FOG_START = 620;
export const FOG_END = 1500;

export const SURFACE_GRASS = 0;
export const SURFACE_ROAD = 1;
export const SURFACE_BOOST = 2;

export const LAP_TOTAL = 3;
export const RACER_COUNT = 4;

/** Sprite billboards are pre-rendered at this many yaw steps. */
export const SPRITE_ANGLES = 24;
export const SPRITE_SIZE = 128;
