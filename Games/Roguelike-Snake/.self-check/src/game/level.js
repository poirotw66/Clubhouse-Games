"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LAYOUT_NAME = exports.CENTER = exports.FLOOR = exports.WALL = void 0;
exports.index = index;
exports.inBounds = inBounds;
exports.isWall = isWall;
exports.generateTerrain = generateTerrain;
exports.collectFloorCells = collectFloorCells;
exports.chebyshev = chebyshev;
exports.samePos = samePos;
const config_1 = require("./config");
const rng_1 = require("./rng");
exports.WALL = 1;
exports.FLOOR = 0;
exports.CENTER = Math.floor(config_1.GRID / 2);
exports.LAYOUT_NAME = {
    open: '開闊廳堂',
    pillars: '列柱大殿',
    cross: '十字迴廊',
    rings: '環形祭壇',
    corridors: '狹長甬道',
    diamond: '菱形墓室',
    scatter: '亂石崩雲',
};
const LAYOUT_POOL = [
    'pillars',
    'cross',
    'rings',
    'corridors',
    'diamond',
    'scatter',
];
function index(x, y) {
    return y * config_1.GRID + x;
}
function inBounds(x, y) {
    return x >= 0 && y >= 0 && x < config_1.GRID && y < config_1.GRID;
}
function isWall(tiles, x, y) {
    if (!inBounds(x, y))
        return true;
    return tiles[index(x, y)] === exports.WALL;
}
function setWall(tiles, x, y) {
    if (inBounds(x, y))
        tiles[index(x, y)] = exports.WALL;
}
function clearRect(tiles, x0, y0, x1, y1) {
    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            if (inBounds(x, y))
                tiles[index(x, y)] = exports.FLOOR;
        }
    }
}
function applyLayout(tiles, layout, rng) {
    switch (layout) {
        case 'pillars': {
            for (let y = 3; y < config_1.GRID - 3; y += 4) {
                for (let x = 3; x < config_1.GRID - 3; x += 4) {
                    setWall(tiles, x, y);
                    setWall(tiles, x + 1, y);
                    setWall(tiles, x, y + 1);
                    setWall(tiles, x + 1, y + 1);
                }
            }
            break;
        }
        case 'cross': {
            for (let i = 2; i < config_1.GRID - 2; i++) {
                if (Math.abs(i - exports.CENTER) > 2) {
                    setWall(tiles, i, exports.CENTER);
                    setWall(tiles, exports.CENTER, i);
                }
            }
            break;
        }
        case 'rings': {
            for (const radius of [4, 8]) {
                for (let y = exports.CENTER - radius; y <= exports.CENTER + radius; y++) {
                    for (let x = exports.CENTER - radius; x <= exports.CENTER + radius; x++) {
                        const ring = Math.max(Math.abs(x - exports.CENTER), Math.abs(y - exports.CENTER)) === radius;
                        const gate = x === exports.CENTER || y === exports.CENTER;
                        if (ring && !gate)
                            setWall(tiles, x, y);
                    }
                }
            }
            break;
        }
        case 'corridors': {
            for (let x = 4; x < config_1.GRID - 2; x += 4) {
                const gap = (0, rng_1.randInt)(rng, 2, config_1.GRID - 5);
                for (let y = 1; y < config_1.GRID - 1; y++) {
                    if (y < gap || y > gap + 2)
                        setWall(tiles, x, y);
                }
            }
            break;
        }
        case 'diamond': {
            for (let y = 1; y < config_1.GRID - 1; y++) {
                for (let x = 1; x < config_1.GRID - 1; x++) {
                    const dist = Math.abs(x - exports.CENTER) + Math.abs(y - exports.CENTER);
                    if ((dist === 6 || dist === 10) && x !== exports.CENTER && y !== exports.CENTER) {
                        setWall(tiles, x, y);
                    }
                }
            }
            break;
        }
        case 'scatter': {
            const blobs = (0, rng_1.randInt)(rng, 10, 16);
            for (let i = 0; i < blobs; i++) {
                const x = (0, rng_1.randInt)(rng, 2, config_1.GRID - 3);
                const y = (0, rng_1.randInt)(rng, 2, config_1.GRID - 3);
                const horizontal = rng() < 0.5;
                const length = (0, rng_1.randInt)(rng, 1, 3);
                for (let n = 0; n < length; n++) {
                    setWall(tiles, horizontal ? x + n : x, horizontal ? y : y + n);
                }
            }
            break;
        }
        case 'open':
        default:
            break;
    }
}
/** Any floor pocket the snake could never reach becomes wall, so spawns stay legal. */
function sealUnreachable(tiles, start) {
    const seen = new Uint8Array(config_1.GRID * config_1.GRID);
    const queue = [index(start.x, start.y)];
    seen[queue[0]] = 1;
    while (queue.length > 0) {
        const current = queue.pop();
        const x = current % config_1.GRID;
        const y = Math.floor(current / config_1.GRID);
        const neighbours = [
            [x + 1, y],
            [x - 1, y],
            [x, y + 1],
            [x, y - 1],
        ];
        for (const [nx, ny] of neighbours) {
            if (!inBounds(nx, ny))
                continue;
            const id = index(nx, ny);
            if (seen[id] || tiles[id] === exports.WALL)
                continue;
            seen[id] = 1;
            queue.push(id);
        }
    }
    for (let i = 0; i < tiles.length; i++) {
        if (tiles[i] === exports.FLOOR && !seen[i])
            tiles[i] = exports.WALL;
    }
}
function generateTerrain(rng, floor, isBoss) {
    const tiles = new Uint8Array(config_1.GRID * config_1.GRID);
    for (let i = 0; i < config_1.GRID; i++) {
        setWall(tiles, i, 0);
        setWall(tiles, i, config_1.GRID - 1);
        setWall(tiles, 0, i);
        setWall(tiles, config_1.GRID - 1, i);
    }
    const layout = floor === 1 ? 'open' : isBoss ? 'pillars' : LAYOUT_POOL[Math.floor(rng() * LAYOUT_POOL.length)];
    applyLayout(tiles, layout, rng);
    // Spawn corridor for the snake, plus breathing room around the boss pedestal.
    clearRect(tiles, exports.CENTER - 5, exports.CENTER - 1, exports.CENTER + 5, exports.CENTER + 1);
    if (isBoss)
        clearRect(tiles, exports.CENTER - 3, exports.CENTER - 8, exports.CENTER + 3, exports.CENTER + 3);
    sealUnreachable(tiles, { x: exports.CENTER, y: exports.CENTER });
    return { tiles, layout };
}
function collectFloorCells(tiles) {
    const cells = [];
    for (let y = 1; y < config_1.GRID - 1; y++) {
        for (let x = 1; x < config_1.GRID - 1; x++) {
            if (tiles[index(x, y)] === exports.FLOOR)
                cells.push({ x, y });
        }
    }
    return cells;
}
function chebyshev(a, b) {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}
function samePos(a, b) {
    return a.x === b.x && a.y === b.y;
}
