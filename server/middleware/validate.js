import { validationResult } from 'express-validator';
import ApiError from '../utils/ApiError.js';

/**
 * Terminates every express-validator chain: collects violations and turns
 * them into a single 400 in the standard envelope.
 * Usage: router.post('/', [body('email').isEmail(), ...], validate, handler)
 */
const validate = (req, _res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const message = [...new Set(errors.array().map((e) => e.msg))].join('. ');
    throw new ApiError(400, message);
  }
  next();
};

export default validate;
