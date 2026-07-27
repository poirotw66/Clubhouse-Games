"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("node:assert/strict");
const engine_js_1 = require("../src/game/engine.js");
function clone(value) {
    return JSON.parse(JSON.stringify(value));
}
function setSnake(state, segments, dir) {
    state.snake = clone(segments);
    state.prevSnake = clone(segments);
    state.dir = dir;
    state.pendingDirs = [];
}
function createEmptyState() {
    const state = (0, engine_js_1.createRun)(42);
    state.fruits = [];
    state.enemies = [];
    state.projectiles = [];
    state.spikes = [];
    state.effects = [];
    state.events = [];
    state.exit = null;
    state.boss = null;
    state.quota = 99;
    state.eaten = 0;
    return state;
}
function createSpitter(pos, offset = 11) {
    return {
        id: 999,
        type: 'spitter',
        pos: clone(pos),
        prev: clone(pos),
        offset,
    };
}
function expectSpitterOnlyFiresWhenAligned() {
    const aligned = createEmptyState();
    setSnake(aligned, [
        { x: 8, y: 5 },
        { x: 7, y: 5 },
        { x: 6, y: 5 },
        { x: 5, y: 5 },
    ], 'right');
    aligned.enemies = [createSpitter({ x: 3, y: 5 })];
    (0, engine_js_1.tick)(aligned);
    assert.equal(aligned.projectiles.length, 1, 'Spitter should fire when aligned on the same row.');
    const diagonal = createEmptyState();
    setSnake(diagonal, [
        { x: 8, y: 7 },
        { x: 7, y: 7 },
        { x: 6, y: 7 },
        { x: 5, y: 7 },
    ], 'right');
    diagonal.enemies = [createSpitter({ x: 3, y: 5 })];
    (0, engine_js_1.tick)(diagonal);
    assert.equal(diagonal.projectiles.length, 0, 'Spitter should stay idle when the head is diagonal.');
}
function expectCursedFruitUsesFlatScore() {
    const state = createEmptyState();
    state.floor = 6;
    state.score = 0;
    state.energy = 0;
    setSnake(state, [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 },
        { x: 7, y: 10 },
    ], 'right');
    state.fruits = [{ pos: { x: 11, y: 10 }, type: 'cursed' }];
    (0, engine_js_1.tick)(state);
    assert.equal(state.score, 5, 'Cursed fruit should award a flat 5 score.');
}
function expectBloodDashOnlyCostsHp() {
    const state = createEmptyState();
    state.relics = ['blood'];
    state.hp = 3;
    state.dashCount = 3;
    setSnake(state, [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 },
        { x: 7, y: 10 },
        { x: 6, y: 10 },
        { x: 5, y: 10 },
    ], 'right');
    (0, engine_js_1.dash)(state);
    assert.equal(state.hp, 2, 'The fourth blood dash should cost 1 HP.');
    assert.equal(state.snake.length, 6, 'Blood dash should not shrink the snake.');
}
expectSpitterOnlyFiresWhenAligned();
expectCursedFruitUsesFlatScore();
expectBloodDashOnlyCostsHp();
console.log('Roguelike Snake logic self-check passed.');
