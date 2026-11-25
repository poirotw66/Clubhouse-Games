// Unit check for cockpit telemetry decluttering in Easy Mode vs Pro Mode.
import assert from 'node:assert/strict';
import { createCockpit } from './cockpit.js';

class MockElement extends EventTarget {
  constructor(id = '', className = '') {
    super();
    this.id = id;
    this.className = className;
    this.hidden = false;
    this.textContent = '';
    this.attributes = new Map();
    this.classes = new Set(className ? className.split(' ').filter(Boolean) : []);
    this.classList = {
      add: (name) => this.classes.add(name),
      remove: (name) => this.classes.delete(name),
      toggle: (name, val) => (val ? this.classes.add(name) : this.classes.delete(name)),
      contains: (name) => this.classes.has(name),
    };
  }
  getAttribute(name) {
    return this.attributes.get(name);
  }
  setAttribute(name, val) {
    this.attributes.set(name, String(val));
  }
  getContext() {
    return {
      clearRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      arc: () => {},
      fill: () => {},
    };
  }
}

globalThis.window = new EventTarget();
globalThis.document = {
  body: new MockElement('body'),
  addEventListener: () => {},
};

const vmgCard = new MockElement('vmg-card', 'vmg-card');
const playbookCard = new MockElement('playbook-card', 'tactical-playbook-card');
const btnTelemetry = new MockElement('btn-telemetry', 'btn-telemetry-toggle');
const trimMode = new MockElement('cockpit-trim-mode');
const vmgCanvas = new MockElement('vmg-canvas');
vmgCanvas.width = 200;
vmgCanvas.height = 40;

const elements = new Map([
  ['.vmg-card', vmgCard],
  ['.tactical-playbook-card', playbookCard],
  ['#btn-telemetry', btnTelemetry],
  ['#cockpit-trim-mode', trimMode],
  ['#vmg-canvas', vmgCanvas],
]);

const root = {
  querySelector: (sel) => elements.get(sel) || null,
  querySelectorAll: () => [],
};

const cockpit = createCockpit(root);

// 1. Easy Mode: telemetry cards should automatically collapse / hide.
cockpit.syncMode(true);
assert.equal(cockpit.isTelemetryCollapsed, true, 'telemetry should be collapsed in easy mode');
assert.equal(vmgCard.hidden, true, 'vmg card should be hidden in easy mode');
assert.equal(playbookCard.hidden, true, 'tactical playbook should be hidden in easy mode');
assert.equal(btnTelemetry.hidden, false, 'telemetry toggle button should be visible in easy mode');

// 2. Toggle telemetry in Easy Mode: reveals panels when requested by user.
cockpit.toggleTelemetry();
assert.equal(cockpit.isTelemetryCollapsed, false, 'telemetry should expand after toggle');
assert.equal(vmgCard.hidden, false, 'vmg card should show when toggled');
assert.equal(playbookCard.hidden, false, 'playbook card should show when toggled');

// 3. Pro Mode: telemetry panels should be fully shown.
cockpit.syncMode(false);
assert.equal(vmgCard.hidden, false, 'vmg card should be visible in pro mode');
assert.equal(playbookCard.hidden, false, 'tactical playbook card should be visible in pro mode');
assert.equal(btnTelemetry.hidden, true, 'telemetry toggle button should be hidden in pro mode');

console.log('check-cockpit: ok');
