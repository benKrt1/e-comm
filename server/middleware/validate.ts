import { validationResult } from 'express-validator';
import type { Request, Response, NextFunction } from 'express';
import ApiError from '../utils/ApiError.ts';

/**
 * Terminates every express-validator chain: collects violations and turns
 * them into a single 400 in the standard envelope.
 * Usage: router.post('/', [body('email').isEmail(), ...], validate, handler)
 */
const validate = (req: Request, _res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const message = [...new Set(errors.array().map((e) => e.msg as string))].join('. ');
    throw new ApiError(400, message);
  }
  next();
};

export default validate;
