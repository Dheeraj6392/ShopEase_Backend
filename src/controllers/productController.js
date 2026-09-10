const productService = require('../services/productService');

const getProducts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 12;
    const { category, q } = req.query;

    const result = await productService.getProducts({ page, limit, category, search: q });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const getProduct = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    const product = await productService.getProductById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
};

module.exports = { getProducts, getProduct };
