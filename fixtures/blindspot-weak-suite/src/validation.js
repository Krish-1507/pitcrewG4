function validateOrder(order) {
  if (!order || !Number.isInteger(order.quantity) || order.quantity <= 0)
    return { ok: false };
  return { ok: true, order };
}

module.exports = { validateOrder };
