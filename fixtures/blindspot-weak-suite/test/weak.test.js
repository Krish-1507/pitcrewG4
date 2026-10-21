const { test } = require('node:test');
const assert = require('node:assert');
const { authorize } = require('../src/auth');
const { validateOrder } = require('../src/validation');

test('an admin may delete', () => {
  assert.equal(authorize({ role: 'admin' }, 'delete'), true);
});

test('a positive quantity is valid', () => {
  assert.equal(validateOrder({ quantity: 2 }).ok, true);
});
