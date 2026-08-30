const ApiError = require('../lib/ApiError');


function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return next(new ApiError(
        400,
        'Invalid request',
        'VALIDATION_ERROR',
        result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message }))
      ));
    }

    req.body = result.data;  
    next();
  };
}

module.exports = validate;