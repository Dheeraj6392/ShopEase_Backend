const { PrismaClient } = require('@prisma/client');
const request = require('supertest');

jest.mock('../src/utils/prisma', () => {
  const { PrismaClient } = require('@prisma/client');
  const mockPrisma = new PrismaClient();
  return mockPrisma;
});

const prisma = require('../src/utils/prisma');
const app = require('../src/app');

const SESSION = 'test-session-cart';

describe('Cart API', () => {
  let product1;
  let product2;

  beforeEach(async () => {
    await prisma.cartItem.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.cart.deleteMany();
    await prisma.product.deleteMany();

    product1 = await prisma.product.create({
      data: {
        name: 'Test Product 1',
        description: 'Description 1',
        price: 999.0,
        imageUrl: 'https://example.com/img1.jpg',
        category: 'Electronics',
        stock: 10,
      },
    });

    product2 = await prisma.product.create({
      data: {
        name: 'Test Product 2',
        description: 'Description 2',
        price: 1499.0,
        imageUrl: 'https://example.com/img2.jpg',
        category: 'Accessories',
        stock: 5,
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /api/cart/:sessionId/items', () => {
    it('should add an item to the cart', async () => {
      const res = await request(app)
        .post(`/api/cart/${SESSION}/items`)
        .send({ productId: product1.id, quantity: 2 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].quantity).toBe(2);
      expect(res.body.data.items[0].subtotal).toBe(1998);
    });

    it('should increase quantity if product already exists', async () => {
      await request(app)
        .post(`/api/cart/${SESSION}/items`)
        .send({ productId: product1.id, quantity: 1 });

      const res = await request(app)
        .post(`/api/cart/${SESSION}/items`)
        .send({ productId: product1.id, quantity: 2 });

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].quantity).toBe(3);
    });

    it('should reject quantity exceeding stock', async () => {
      const res = await request(app)
        .post(`/api/cart/${SESSION}/items`)
        .send({ productId: product2.id, quantity: 10 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 404 for nonexistent product', async () => {
      const res = await request(app)
        .post(`/api/cart/${SESSION}/items`)
        .send({ productId: 9999, quantity: 1 });

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/cart/:sessionId/items/:itemId', () => {
    it('should update item quantity', async () => {
      const addRes = await request(app)
        .post(`/api/cart/${SESSION}/items`)
        .send({ productId: product1.id, quantity: 1 });

      const itemId = addRes.body.data.items[0].id;

      const res = await request(app)
        .patch(`/api/cart/${SESSION}/items/${itemId}`)
        .send({ quantity: 5 });

      expect(res.status).toBe(200);
      expect(res.body.data.items[0].quantity).toBe(5);
    });

    it('should reject quantity exceeding stock', async () => {
      const addRes = await request(app)
        .post(`/api/cart/${SESSION}/items`)
        .send({ productId: product2.id, quantity: 1 });

      const itemId = addRes.body.data.items[0].id;

      const res = await request(app)
        .patch(`/api/cart/${SESSION}/items/${itemId}`)
        .send({ quantity: 20 });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/cart/:sessionId/items/:itemId', () => {
    it('should remove an item from cart', async () => {
      const addRes = await request(app)
        .post(`/api/cart/${SESSION}/items`)
        .send({ productId: product1.id, quantity: 1 });

      const itemId = addRes.body.data.items[0].id;

      const res = await request(app).delete(`/api/cart/${SESSION}/items/${itemId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(0);
    });
  });

  describe('GET /api/cart/:sessionId', () => {
    it('should return empty cart for new session', async () => {
      const res = await request(app).get('/api/cart/new-session');
      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(0);
      expect(res.body.data.totalAmount).toBe(0);
    });

    it('should return cart with items', async () => {
      await request(app)
        .post(`/api/cart/${SESSION}/items`)
        .send({ productId: product1.id, quantity: 2 });

      const res = await request(app).get(`/api/cart/${SESSION}`);
      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.totalItems).toBe(2);
      expect(res.body.data.totalAmount).toBe(1998);
    });
  });
});
