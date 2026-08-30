const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const ApiError = require('./lib/ApiError');
const errorHandler = require('./middleware/errorHandler');
const routes = require('./routes');         

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.use('/api/v1', routes);                

app.use((req, res, next) => next(new ApiError(404, 'Route not found', 'NOT_FOUND')));
app.use(errorHandler);

module.exports = app;