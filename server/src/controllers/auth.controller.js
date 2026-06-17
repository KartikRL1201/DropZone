import bcrypt from 'bcryptjs';
import { User } from '../models/User.model.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { z } from 'zod';
import { UserRole } from '@dropzone/shared-domain';

// --- Auth Validations ---
export const RegisterSchema = z.object({
  email: z.string().min(3),
  password: z.string().min(8),
  name: z.string().min(2),
  phone: z.string().min(10),
  role: z.nativeEnum(UserRole).default(UserRole.VOLUNTEER),
});

export const LoginSchema = z.object({
  email: z.string().min(3),
  password: z.string(),
});

// Removed RefreshSchema because refreshToken is now in cookies

/**
 * Auth Controller
 */
export const AuthController = {
  
  /**
   * Admin-only user registration.
   * Public registration is not allowed in DropZone (except for zero-auth volunteers).
   */
  async register(req, res) {
    try {
      const { email, password, name, phone, role } = req.body;

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return sendError(res, 409, 'Email is already registered.');
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const user = await User.create({
        email,
        passwordHash,
        name,
        phone,
        role,
      });

      // Don't return password hash
      const userSafe = user.toObject();
      delete userSafe.passwordHash;

      return sendSuccess(res, 201, userSafe, 'User registered successfully.');
    } catch (error) {
      console.error(error);
      return sendError(res, 500, 'Registration failed.');
    }
  },

  /**
   * Login & generate JWT tokens
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Select passwordHash since it's hidden by default in the schema
      const user = await User.findOne({ 
        $or: [
          { email: email.toLowerCase() },
          { name: email }
        ]
      })
        .select('+passwordHash +refreshTokenHash')
        .populate('assignedWarehouse', 'name code');
      
      if (!user || !user.isActive) {
        return sendError(res, 401, 'Invalid credentials or inactive account.');
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return sendError(res, 401, 'Invalid credentials.');
      }

      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      // Hash refresh token before saving to DB
      const salt = await bcrypt.genSalt(10);
      user.refreshTokenHash = await bcrypt.hash(refreshToken, salt);
      user.lastLoginAt = new Date();
      await user.save();

      const userSafe = user.toObject();
      delete userSafe.passwordHash;
      delete userSafe.refreshTokenHash;

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      return sendSuccess(res, 200, { user: userSafe, accessToken }, 'Login successful.');
    } catch (error) {
      console.error(error);
      return sendError(res, 500, 'Login failed.');
    }
  },

  /**
   * Rotate access token using a valid refresh token
   */
  async refresh(req, res) {
    try {
      const refreshToken = req.cookies?.refreshToken;
      if (!refreshToken) {
        return sendError(res, 401, 'No refresh token provided.');
      }

      const decoded = verifyRefreshToken(refreshToken);
      if (!decoded) {
        return sendError(res, 401, 'Invalid or expired refresh token.');
      }

      const user = await User.findById(decoded.id)
        .select('+refreshTokenHash')
        .populate('assignedWarehouse', 'name code');
      if (!user || !user.isActive || !user.refreshTokenHash) {
        return sendError(res, 401, 'Invalid session.');
      }

      const isMatch = await bcrypt.compare(refreshToken, user.refreshTokenHash);
      if (!isMatch) {
        return sendError(res, 401, 'Invalid refresh token.');
      }

      const newAccessToken = generateAccessToken(user);
      const newRefreshToken = generateRefreshToken(user);

      // Rotate the refresh token in the DB
      const salt = await bcrypt.genSalt(10);
      user.refreshTokenHash = await bcrypt.hash(newRefreshToken, salt);
      await user.save();

      res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      return sendSuccess(res, 200, { accessToken: newAccessToken }, 'Token refreshed.');
    } catch (error) {
      console.error(error);
      return sendError(res, 500, 'Token refresh failed.');
    }
  },

  /**
   * Logout (invalidate refresh token)
   */
  async logout(req, res) {
    try {
      const user = await User.findById(req.user.id);
      if (user) {
        user.refreshTokenHash = null;
        await user.save();
      }
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      });
      return sendSuccess(res, 200, null, 'Logout successful.');
    } catch (error) {
      return sendError(res, 500, 'Logout failed.');
    }
  }
};
