const prisma = require('../utils/prisma');

const getProducts = async ({ page = 1, limit = 12, category, search } = {}) => {
  const skip = (page - 1) * limit;
  const where = {
    ...(category ? { category } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    products,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getProductById = async (id) => {
  return prisma.product.findUnique({ where: { id } });
};

module.exports = { getProducts, getProductById };
