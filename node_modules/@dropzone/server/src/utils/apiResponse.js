/**
 * Formats a successful API response.
 */
export const sendSuccess = (res, statusCode = 200, data, message = 'Success') => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

/**
 * Formats an error API response.
 */
export const sendError = (res, statusCode = 500, error) => {
  const errorMessage = error instanceof Error ? error.message : error;
  
  res.status(statusCode).json({
    success: false,
    error: errorMessage,
  });
};

/**
 * Formats a paginated API response.
 */
export const sendPaginated = (res, data, totalCount, page, limit) => {
  res.status(200).json({
    success: true,
    data,
    meta: {
      totalCount,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
      totalPages: Math.ceil(totalCount / (limit || 10)),
    },
  });
};
