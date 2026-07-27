"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadBest = loadBest;
exports.saveBest = saveBest;
const config_1 = require("./config");
const EMPTY = { score: 0, floor: 0 };
function loadBest() {
    try {
        const raw = window.localStorage.getItem(config_1.STORAGE_KEY);
        if (!raw)
            return EMPTY;
        const parsed = JSON.parse(raw);
        return {
            score: Number(parsed.score) || 0,
            floor: Number(parsed.floor) || 0,
        };
    }
    catch {
        return EMPTY;
    }
}
function saveBest(record) {
    const previous = loadBest();
    const merged = {
        score: Math.max(previous.score, record.score),
        floor: Math.max(previous.floor, record.floor),
    };
    try {
        window.localStorage.setItem(config_1.STORAGE_KEY, JSON.stringify(merged));
    }
    catch {
        // Private mode or storage disabled: best-effort only.
    }
    return merged;
}
