function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: err.message
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  }

  if (err.code === 'RATE_LIMIT_EXCEEDED') {
    return res.status(429).json({
      success: false,
      error: 'Too many requests'
    });
  }

  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
}

export {
  errorHandler,
  notFoundHandler
};