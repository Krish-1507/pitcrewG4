const { test } = require('node:test');
const assert = require('node:assert');
const { authorize } = require('../src/auth');
const { validateOrder } = require('../src/validation');

test('an anonymous caller is rejected', () => {
  assert.throws(() => authorize(undefined, 'read'), /unauthorized/);
});

test('a non-admin may not delete', () => {
  assert.throws(() => authorize({ role: 'member' }, 'delete'), /forbidden/);
});

test('a non-positive quantity is rejected', () => {
  assert.equal(validateOrder({ quantity: 0 }).ok, false);
  assert.equal(validateOrder(null).ok, false);
});
