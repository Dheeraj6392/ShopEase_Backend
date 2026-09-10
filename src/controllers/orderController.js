const orderService = require('../services/orderService');

const createOrder = async (req, res, next) => {
  try {
    const { sessionId, customerName, email, phone, address } = req.body;

    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'Session ID is required' });
    }

    const order = await orderService.createOrder(sessionId, {
      customerName,
      email,
      phone,
      address,
    });

    res.status(201).json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
};

const getOrder = async (req, res, next) => {
  try {
    const { orderNumber } = req.params;
    const order = await orderService.getOrder(orderNumber);
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
};

const getOrders = async (req, res, next) => {
  try {
    const { email } = req.query;
    const orders = await orderService.getOrdersByEmail(email);
    res.json({ success: true, data: orders });
  } catch (err) {
    next(err);
  }
};

module.exports = { createOrder, getOrder, getOrders };
