const cartService = require('../services/cartService');

const getCart = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const cart = await cartService.getCart(sessionId);
    res.json({ success: true, data: cart });
  } catch (err) {
    next(err);
  }
};

const addItem = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { productId, quantity } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID is required' });
    }

    const cart = await cartService.addItem(sessionId, parseInt(productId, 10), parseInt(quantity, 10) || 1);
    res.json({ success: true, data: cart });
  } catch (err) {
    next(err);
  }
};

const updateItem = async (req, res, next) => {
  try {
    const { sessionId, itemId } = req.params;
    const { quantity } = req.body;

    if (quantity === undefined) {
      return res.status(400).json({ success: false, message: 'Quantity is required' });
    }

    const cart = await cartService.updateItem(sessionId, parseInt(itemId, 10), parseInt(quantity, 10));
    res.json({ success: true, data: cart });
  } catch (err) {
    next(err);
  }
};

const removeItem = async (req, res, next) => {
  try {
    const { sessionId, itemId } = req.params;
    const cart = await cartService.removeItem(sessionId, parseInt(itemId, 10));
    res.json({ success: true, data: cart });
  } catch (err) {
    next(err);
  }
};

module.exports = { getCart, addItem, updateItem, removeItem };
