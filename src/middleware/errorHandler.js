const ApiError = require('../lib/ApiError');

function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      ok: false,
      code: err.code,
      message: err.message,
      details: err.details,
    });
  }

  console.error(err);
  return res.status(500).json({
    ok: false,
    code: 'INTERNAL',
    message: 'Something went wrong',
  });
}

module.exports = errorHandler;