const { PrismaClient } = require('@prisma/client');
const request = require('supertest');
const express = require('express');

jest.mock('../src/utils/prisma', () => {
  const { PrismaClient } = require('@prisma/client');
  const mockPrisma = new PrismaClient();
  return mockPrisma;
});

const prisma = require('../src/utils/prisma');

const app = require('../src/app');

describe('Product API', () => {
  beforeEach(async () => {
    await prisma.cartItem.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.cart.deleteMany();
    await prisma.product.deleteMany();

    await prisma.product.createMany({
      data: [
        {
          name: 'Test Product 1',
          description: 'Description 1',
          price: 999.0,
          imageUrl: 'https://example.com/img1.jpg',
          category: 'Electronics',
          stock: 10,
        },
        {
          name: 'Test Product 2',
          description: 'Description 2',
          price: 1499.0,
          imageUrl: 'https://example.com/img2.jpg',
          category: 'Accessories',
          stock: 5,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('GET /api/products', () => {
    it('should return all products', async () => {
      const res = await request(app).get('/api/products');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.products).toHaveLength(2);
    });

    it('should filter by category', async () => {
      const res = await request(app).get('/api/products?category=Electronics');
      expect(res.status).toBe(200);
      expect(res.body.data.products).toHaveLength(1);
      expect(res.body.data.products[0].name).toBe('Test Product 1');
    });

    it('should support pagination', async () => {
      const res = await request(app).get('/api/products?page=1&limit=1');
      expect(res.status).toBe(200);
      expect(res.body.data.products).toHaveLength(1);
      expect(res.body.data.pagination.total).toBe(2);
    });
  });

  describe('GET /api/products/:id', () => {
    it('should return a product by id', async () => {
      const products = await prisma.product.findMany();
      const res = await request(app).get(`/api/products/${products[0].id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Test Product 1');
    });

    it('should return 404 for nonexistent product', async () => {
      const res = await request(app).get('/api/products/9999');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for invalid product id', async () => {
      const res = await request(app).get('/api/products/abc');
      expect(res.status).toBe(400);
    });
  });
});
