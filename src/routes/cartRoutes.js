const express = require('express');
const router = express.Router();
const { getCart, addItem, updateItem, removeItem } = require('../controllers/cartController');

router.get('/:sessionId', getCart);
router.post('/:sessionId/items', addItem);
router.patch('/:sessionId/items/:itemId', updateItem);
router.delete('/:sessionId/items/:itemId', removeItem);

module.exports = router;
