const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const healthRoutes = require('./routes/healthRoutes');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(morgan('dev'));

const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(cors({
  origin: clientUrl,
  credentials: true,
}));

app.use(express.json());

app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/health', healthRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
