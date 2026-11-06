import assert from 'node:assert/strict';
import { createInput } from './input.js';

class Element extends EventTarget {
  constructor(hold) {
    super();
    this.hold = hold;
    this.classes = new Set();
    this.classList = {
      toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name),
      remove: (name) => this.classes.delete(name),
    };
  }
  getAttribute() { return this.hold; }
  setPointerCapture() {}
}
const previousWindow = globalThis.window;
const previousDocument = globalThis.document;
try {
  globalThis.window = new EventTarget();
  globalThis.document = new EventTarget();
  document.hidden = false;
  const canvas = new Element();
  const left = new Element('rudderLeft');
  const forward = new Element('holdCourse');
  const pads = [left, forward];
  const root = {
    querySelector: (selector) => selector === '#gl' ? canvas : null,
    querySelectorAll: (selector) => selector === '[data-hold]' ? pads : pads.filter((el) => el.classes.has('holding')),
  };
  const input = createInput(root);
  const press = (code) => {
    const event = new Event('keydown', { cancelable: true });
    event.code = code;
    window.dispatchEvent(event);
  };
  left.dispatchEvent(new Event('pointerdown'));
  forward.dispatchEvent(new Event('pointerdown'));
  press('ArrowRight');
  assert.equal(input.sample(0.016).rudder, 0, 'keyboard and touch steer combine');
  assert.equal(input.holdingCourse, true);
  window.dispatchEvent(new Event('blur'));
  assert.equal(input.sample(0.016).rudder, 0, 'blur releases every input source');
  assert.equal(input.holdingCourse, false);
  assert.equal(left.classes.has('holding'), false);
  left.dispatchEvent(new Event('pointerdown'));
  press('KeyW');
  document.hidden = true;
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(input.sample(0.016).rudder, 0, 'app switch releases touch steering');
  assert.equal(input.holdingCourse, false, 'app switch releases keyboard course assist');
  document.hidden = false;
  left.dispatchEvent(new Event('pointerdown'));
  assert.equal(input.sample(0.016).rudder, -1, 'controls work again after returning');
  left.dispatchEvent(new Event('pointercancel'));
  assert.equal(input.sample(0.016).rudder, 0, 'cancel releases steering');
  console.log('check-input: ok (blur, app switch, cancellation, recovery)');
} finally {
  globalThis.window = previousWindow;
  globalThis.document = previousDocument;
}
