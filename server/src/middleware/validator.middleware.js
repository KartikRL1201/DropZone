import { sendError } from '../utils/apiResponse.js';

/**
 * Middleware to validate request bodies/params using Zod schemas.
 * 
 * @param {import('zod').ZodSchema} schema - The Zod schema to validate against.
 * @param {'body' | 'query' | 'params'} source - Where to look for data (defaults to body).
 */
export const validateRequest = (schema, source = 'body') => {
  return (req, res, next) => {
    const parseResult = schema.safeParse(req[source]);

    if (!parseResult.success) {
      const formattedErrors = parseResult.error.format();
      // DEBUG: Log what the client actually sent vs what failed
      console.log('--- VALIDATION FAILED ---');
      console.log('Raw body:', JSON.stringify(req[source], null, 2));
      console.log('Zod issues:', JSON.stringify(parseResult.error.issues, null, 2));
      console.log('--- END VALIDATION ---');
      // We return 400 Bad Request for validation failures
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        issues: parseResult.error.issues,
        details: formattedErrors,
      });
    }

    // Replace the raw request data with the validated/sanitized data from Zod
    req[source] = parseResult.data;
    next();
  };
};
