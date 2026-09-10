const prisma = require('../utils/prisma');
const { AppError } = require('../middleware/errorHandler');

const formatCart = (cart) => {
  if (!cart || !cart.items || cart.items.length === 0) {
    return { items: [], totalItems: 0, totalAmount: 0 };
  }

  const items = cart.items.map((item) => ({
    id: item.id,
    product: {
      id: item.product.id,
      name: item.product.name,
      price: Number(item.product.price),
      imageUrl: item.product.imageUrl,
    },
    quantity: item.quantity,
    subtotal: Number(item.product.price) * item.quantity,
  }));

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);

  return { items, totalItems, totalAmount };
};

const getCart = async (sessionId) => {
  let cart = await prisma.cart.findUnique({
    where: { sessionId },
    include: {
      items: {
        include: { product: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { sessionId },
      include: {
        items: {
          include: { product: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  return formatCart(cart);
};

const addItem = async (sessionId, productId, quantity) => {
  if (quantity < 1) {
    throw new AppError('Quantity must be at least 1', 400);
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    throw new AppError('Product not found', 404);
  }

  const cart = await prisma.cart.upsert({
    where: { sessionId },
    create: { sessionId },
    update: {},
  });

  const existingItem = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId } },
  });

  const newQuantity = existingItem ? existingItem.quantity + quantity : quantity;

  if (newQuantity > product.stock) {
    throw new AppError(
      `Insufficient stock. Available: ${product.stock}`,
      400
    );
  }

  await prisma.cartItem.upsert({
    where: { cartId_productId: { cartId: cart.id, productId } },
    create: { cartId: cart.id, productId, quantity },
    update: { quantity: newQuantity },
  });

  return getCart(sessionId);
};

const updateItem = async (sessionId, itemId, quantity) => {
  if (quantity < 1) {
    throw new AppError('Quantity must be at least 1', 400);
  }

  const cart = await prisma.cart.findUnique({
    where: { sessionId },
    include: { items: true },
  });

  if (!cart) {
    throw new AppError('Cart not found', 404);
  }

  const cartItem = await prisma.cartItem.findFirst({
    where: { id: itemId, cartId: cart.id },
    include: { product: true },
  });

  if (!cartItem) {
    throw new AppError('Cart item not found', 404);
  }

  if (quantity > cartItem.product.stock) {
    throw new AppError(
      `Insufficient stock. Available: ${cartItem.product.stock}`,
      400
    );
  }

  await prisma.cartItem.update({
    where: { id: itemId },
    data: { quantity },
  });

  return getCart(sessionId);
};

const removeItem = async (sessionId, itemId) => {
  const cart = await prisma.cart.findUnique({
    where: { sessionId },
    include: { items: true },
  });

  if (!cart) {
    throw new AppError('Cart not found', 404);
  }

  const cartItem = await prisma.cartItem.findFirst({
    where: { id: itemId, cartId: cart.id },
  });

  if (!cartItem) {
    throw new AppError('Cart item not found', 404);
  }

  await prisma.cartItem.delete({ where: { id: itemId } });

  return getCart(sessionId);
};

module.exports = { getCart, addItem, updateItem, removeItem };
