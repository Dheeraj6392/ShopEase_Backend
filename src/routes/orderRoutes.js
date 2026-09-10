const express = require('express');
const router = express.Router();
const { createOrder, getOrder, getOrders } = require('../controllers/orderController');

router.get('/', getOrders);
router.post('/', createOrder);
router.get('/:orderNumber', getOrder);

module.exports = router;