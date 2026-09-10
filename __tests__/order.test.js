const { PrismaClient } = require('@prisma/client');
const request = require('supertest');

jest.mock('../src/utils/prisma', () => {
  const { PrismaClient } = require('@prisma/client');
  const mockPrisma = new PrismaClient();
  return mockPrisma;
});

const prisma = require('../src/utils/prisma');
const app = require('../src/app');

const SESSION = 'test-session-order';

describe('Order API', () => {
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

  const validCustomerInfo = {
    sessionId: SESSION,
    customerName: 'John Doe',
    email: 'john@example.com',
    phone: '9876543210',
    address: '123 Main Street, Bengaluru',
  };

  describe('POST /api/orders', () => {
    it('should create an order successfully', async () => {
      await request(app)
        .post(`/api/cart/${SESSION}/items`)
        .send({ productId: product1.id, quantity: 2 });

      const res = await request(app)
        .post('/api/orders')
        .send(validCustomerInfo);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderNumber).toMatch(/^ORD-/);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.totalAmount).toBe(1998);
      expect(res.body.data.status).toBe('PLACED');
    });

    it('should reduce product stock after order', async () => {
      await request(app)
        .post(`/api/cart/${SESSION}/items`)
        .send({ productId: product1.id, quantity: 3 });

      await request(app)
        .post('/api/orders')
        .send(validCustomerInfo);

      const product = await prisma.product.findUnique({ where: { id: product1.id } });
      expect(product.stock).toBe(7);
    });

    it('should clear cart after order', async () => {
      await request(app)
        .post(`/api/cart/${SESSION}/items`)
        .send({ productId: product1.id, quantity: 1 });

      await request(app)
        .post('/api/orders')
        .send(validCustomerInfo);

      const res = await request(app).get(`/api/cart/${SESSION}`);
      expect(res.body.data.items).toHaveLength(0);
    });

    it('should reject empty cart', async () => {
      const res = await request(app)
        .post('/api/orders')
        .send({ ...validCustomerInfo, sessionId: 'empty-cart-session' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Cart is empty');
    });

    it('should reject invalid customer info', async () => {
      await request(app)
        .post(`/api/cart/${SESSION}/items`)
        .send({ productId: product1.id, quantity: 1 });

      const res = await request(app)
        .post('/api/orders')
        .send({
          ...validCustomerInfo,
          email: 'invalid-email',
        });

      expect(res.status).toBe(400);
    });

    it('should reject when stock is insufficient', async () => {
      await request(app)
        .post(`/api/cart/${SESSION}/items`)
        .send({ productId: product2.id, quantity: 5 });

      await prisma.product.update({
        where: { id: product2.id },
        data: { stock: 2 },
      });

      const res = await request(app)
        .post('/api/orders')
        .send(validCustomerInfo);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/orders/:orderNumber', () => {
    it('should return order details', async () => {
      await request(app)
        .post(`/api/cart/${SESSION}/items`)
        .send({ productId: product1.id, quantity: 2 });

      const createRes = await request(app)
        .post('/api/orders')
        .send(validCustomerInfo);

      const orderNumber = createRes.body.data.orderNumber;

      const res = await request(app).get(`/api/orders/${orderNumber}`);
      expect(res.status).toBe(200);
      expect(res.body.data.orderNumber).toBe(orderNumber);
      expect(res.body.data.customerName).toBe('John Doe');
    });

    it('should return 404 for nonexistent order', async () => {
      const res = await request(app).get('/api/orders/ORD-00000000-000');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/orders', () => {
    it('should return all orders for the given email', async () => {
      for (const quantity of [1, 2]) {
        await request(app)
          .post(`/api/cart/${SESSION}/items`)
          .send({ productId: product1.id, quantity });
        const createRes = await request(app).post('/api/orders').send(validCustomerInfo);
        expect(createRes.status).toBe(201);
      }

      const res = await request(app).get('/api/orders').query({ email: 'john@example.com' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data.map((order) => order.itemCount).sort()).toEqual([1, 2]);
      expect(res.body.data.map((order) => order.orderNumber).every((n) => /^ORD-/.test(n))).toBe(true);
      expect(res.body.data.every((order) => order.items[0] && order.items[0].imageUrl === 'https://example.com/img1.jpg')).toBe(true);
      expect(res.body.data.every((order) => typeof order.totalAmount === 'number')).toBe(true);
    });

    it('should match email case-insensitively', async () => {
      await request(app)
        .post(`/api/cart/${SESSION}/items`)
        .send({ productId: product1.id, quantity: 1 });
      await request(app).post('/api/orders').send(validCustomerInfo);

      const res = await request(app).get('/api/orders').query({ email: 'JOHN@Example.COM' });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].email).toBeUndefined();
      expect(res.body.data[0].orderNumber).toMatch(/^ORD-/);
    });

    it('should return an empty array when no orders match', async () => {
      const res = await request(app).get('/api/orders').query({ email: 'nobody@example.com' });
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('should reject a missing email', async () => {
      const res = await request(app).get('/api/orders');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
