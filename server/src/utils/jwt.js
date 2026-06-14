import jwt from 'jsonwebtoken';
import { env } from '../config/env.config.js';

/**
 * Generate an Access Token (short-lived)
 */
export const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRY }
  );
};

/**
 * Generate a Refresh Token (long-lived)
 */
export const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      // We embed a random string to ensure unique refresh tokens even if generated at the exact same second
      nonce: Math.random().toString(36).substring(7),
    },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRY }
  );
};

/**
 * Verify an Access Token
 */
export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET);
  } catch (err) {
    return null;
  }
};

/**
 * Verify a Refresh Token
 */
export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET);
  } catch (err) {
    return null;
  }
};
