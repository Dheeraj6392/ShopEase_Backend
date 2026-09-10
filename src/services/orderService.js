const prisma = require('../utils/prisma');
const { AppError } = require('../middleware/errorHandler');

const generateOrderNumber = () => {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD-${date}-${random}`;
};

const validateCustomerInfo = ({ customerName, email, phone, address }) => {
  if (!customerName || customerName.trim().length < 2 || customerName.trim().length > 100) {
    throw new AppError('Customer name must be between 2 and 100 characters', 400);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email.trim())) {
    throw new AppError('Valid email is required', 400);
  }

  const phoneRegex = /^[0-9]{7,15}$/;
  if (!phone || !phoneRegex.test(phone.replace(/[\s\-+()]/g, ''))) {
    throw new AppError('Valid phone number is required', 400);
  }

  if (!address || address.trim().length < 5 || address.trim().length > 500) {
    throw new AppError('Address must be between 5 and 500 characters', 400);
  }
};

const createOrder = async (sessionId, customerInfo) => {
  validateCustomerInfo(customerInfo);

  const cart = await prisma.cart.findUnique({
    where: { sessionId },
    include: {
      items: { include: { product: true } },
    },
  });

  if (!cart || cart.items.length === 0) {
    throw new AppError('Cart is empty', 400);
  }

  const order = await prisma.$transaction(async (tx) => {
    const orderItems = [];
    let totalAmount = 0;

    for (const cartItem of cart.items) {
      const product = await tx.product.findUnique({
        where: { id: cartItem.productId },
      });

      if (!product) {
        throw new AppError(
          `Product "${cartItem.product.name}" is no longer available`,
          400
        );
      }

      if (product.stock < cartItem.quantity) {
        throw new AppError(
          `Insufficient stock for "${product.name}". Available: ${product.stock}`,
          400
        );
      }

      const price = Number(product.price);
      const subtotal = price * cartItem.quantity;
      totalAmount += subtotal;

      orderItems.push({
        productId: product.id,
        productName: product.name,
        price,
        quantity: cartItem.quantity,
        subtotal,
      });

      await tx.product.update({
        where: { id: product.id },
        data: { stock: product.stock - cartItem.quantity },
      });
    }

    const orderNumber = generateOrderNumber();
    const createdOrder = await tx.order.create({
      data: {
        orderNumber,
        customerName: customerInfo.customerName.trim(),
        email: customerInfo.email.trim().toLowerCase(),
        phone: customerInfo.phone.trim(),
        address: customerInfo.address.trim(),
        totalAmount,
        items: {
          create: orderItems,
        },
      },
      include: { items: true },
    });

    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

    return createdOrder;
  });

  return formatOrder(order);
};

const formatOrder = (order) => ({
  id: order.id,
  orderNumber: order.orderNumber,
  customerName: order.customerName,
  email: order.email,
  phone: order.phone,
  address: order.address,
  totalAmount: Number(order.totalAmount),
  status: order.status,
  items: order.items.map((item) => ({
    id: item.id,
    productName: item.productName,
    price: Number(item.price),
    quantity: item.quantity,
    subtotal: Number(item.subtotal),
  })),
  createdAt: order.createdAt,
});

const getOrder = async (orderNumber) => {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: true },
  });

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  return formatOrder(order);
};

const getOrdersByEmail = async (email) => {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized) {
    throw new AppError('Email is required', 400);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalized)) {
    throw new AppError('Valid email is required', 400);
  }

  const orders = await prisma.order.findMany({
    where: { email: normalized },
    orderBy: { createdAt: 'desc' },
    include: {
      items: {
        include: { product: { select: { imageUrl: true } } },
      },
    },
  });

  return orders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    totalAmount: Number(order.totalAmount),
    status: order.status,
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    items: order.items.slice(0, 4).map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      imageUrl: item.product ? item.product.imageUrl : null,
    })),
    createdAt: order.createdAt,
  }));
};

module.exports = { createOrder, getOrder, getOrdersByEmail };
