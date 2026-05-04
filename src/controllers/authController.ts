import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { body, validationResult } from 'express-validator';

import { prisma } from '../config/db';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendLoginAlertEmail,
} from '../config/mail';
import { generateOTP, otpExpiresAt } from '../utils/otpGenerator';
import {
  signAccessToken,
  generateRefreshToken,
  hashToken,
  refreshTokenExpiresAt,
} from '../utils/tokenUtils';
import { createError } from '../middlewares/errorMiddleware';
import { OtpType, Role } from '@prisma/client';

const SALT_ROUNDS = 10;

// ══════════════════════════════════════════════════════════════════════════════
// Validation Rule Sets
// ══════════════════════════════════════════════════════════════════════════════

export const signupValidation = [
  body('name')
    .trim().notEmpty().withMessage('Name is required')
    .isLength({ max: 100 }).withMessage('Name too long'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number'),
];

export const otpValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('otp')
    .trim().isLength({ min: 6, max: 6 }).isNumeric()
    .withMessage('OTP must be exactly 6 digits'),
];

export const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password is required'),
];

export const forgotPasswordValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
];

export const resetPasswordValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('otp')
    .trim().isLength({ min: 6, max: 6 }).isNumeric()
    .withMessage('OTP must be exactly 6 digits'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number'),
];

export const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number'),
];

export const updateProfileValidation = [
  body('name')
    .optional()
    .trim().notEmpty().withMessage('Name cannot be empty')
    .isLength({ max: 100 }).withMessage('Name too long'),
  body('email')
    .optional()
    .trim().isEmail().normalizeEmail().withMessage('Valid email required'),
  body('phone')
    .optional()
    .trim()
    .matches(/^[6-9]\d{9}$/).withMessage('Enter a valid 10-digit Indian mobile number'),
];

// ══════════════════════════════════════════════════════════════════════════════
// Private Helpers
// ══════════════════════════════════════════════════════════════════════════════

function validate(req: Request) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError(422, errors.array()[0].msg);
  }
}

async function createOtp(email: string, type: OtpType): Promise<string> {
  const otp = generateOTP();
  const expiresAt = otpExpiresAt(10);

  await prisma.otpCode.updateMany({
    where: { email, type, isUsed: false },
    data: { isUsed: true },
  });

  await prisma.otpCode.create({
    data: { email, otp, type, expiresAt, isUsed: false },
  });

  return otp;
}

async function consumeOtp(email: string, otp: string, type: OtpType) {
  const record = await prisma.otpCode.findFirst({
    where: { email, type, isUsed: false },
    orderBy: { id: 'desc' },
  });

  if (!record) throw createError(400, 'No valid OTP found for this email');
  if (record.isUsed) throw createError(400, 'OTP already used');
  if (new Date() > record.expiresAt) throw createError(400, 'OTP has expired');
  if (record.otp !== otp.trim()) throw createError(400, 'Invalid OTP');

  await prisma.otpCode.update({
    where: { id: record.id },
    data: { isUsed: true },
  });
}

async function storeRefreshToken(userId: number) {
  const rawToken = generateRefreshToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = refreshTokenExpiresAt();

  await prisma.refreshToken.create({
    data: { userId, tokenHash, expiresAt },
  });

  return { rawToken, expiresAt };
}

function buildAuthPayload(user: any, rawRefresh: string) {
  return {
    success: true,
    accessToken: signAccessToken(user),
    refreshToken: rawRefresh,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone || null,
      is_verified: user.isVerified,
    },
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Controllers
// ══════════════════════════════════════════════════════════════════════════════

export async function signup(req: Request, res: Response, next: NextFunction) {
  try {
    validate(req);
    const { name, email, password } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      if (existingUser.isVerified) throw createError(409, 'Email already registered');
      // Update password hash if unverified
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { name, passwordHash },
      });
    } else {
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      await prisma.user.create({
        data: { name, email, passwordHash, role: Role.USER, isVerified: false },
      });
    }

    const otp = await createOtp(email, OtpType.VERIFICATION);
    sendVerificationEmail(email, otp).catch((err) =>
      console.error('[Mail] Verification email failed:', err.message)
    );

    res.status(201).json({
      success: true,
      message: 'OTP sent to your email. Please verify your account.',
    });
  } catch (err) {
    next(err);
  }
}

export async function verifyOtp(req: Request, res: Response, next: NextFunction) {
  try {
    validate(req);
    const { email, otp } = req.body;

    await consumeOtp(email, otp, OtpType.VERIFICATION);

    const user = await prisma.user.update({
      where: { email },
      data: { isVerified: true },
    });

    const { rawToken } = await storeRefreshToken(user.id);

    sendWelcomeEmail(email, user.name).catch((e) =>
      console.warn('[Mail] Welcome email failed:', e.message)
    );

    res.json({
      ...buildAuthPayload(user, rawToken),
      message: 'Email verified successfully. Welcome to Crazzzy!',
    });
  } catch (err) {
    next(err);
  }
}

export async function resendOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const { email } = req.body;
    if (!email) throw createError(422, 'Email is required');

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.isVerified) {
      throw createError(404, 'No unverified account found for this email');
    }

    const otp = await createOtp(email, OtpType.VERIFICATION);
    sendVerificationEmail(email, otp).catch((err) =>
      console.error('[Mail] Resend OTP email failed:', err.message)
    );

    res.json({ success: true, message: 'OTP resent successfully' });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    validate(req);
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw createError(401, 'Invalid email or password');

    if (!user.isVerified) throw createError(403, 'Please verify your email before logging in');
    if (user.isBanned) throw createError(403, 'Your account has been suspended. Contact support.');

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) throw createError(401, 'Invalid email or password');

    const { rawToken } = await storeRefreshToken(user.id);

    sendLoginAlertEmail(email, user.name).catch((e) =>
      console.warn('[Mail] Login alert failed:', e.message)
    );

    res.json({
      ...buildAuthPayload(user, rawToken),
      message: 'Login successful',
    });
  } catch (err) {
    next(err);
  }
}

export async function refreshTokens(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw createError(401, 'Refresh token is required');

    const tokenHash = hashToken(refreshToken);

    const record = await prisma.refreshToken.findFirst({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record) throw createError(401, 'Invalid refresh token');

    if (record.revokedAt) {
      await prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw createError(401, 'Refresh token revoked. Please log in again.');
    }

    if (new Date() > record.expiresAt) {
      throw createError(401, 'Refresh token expired. Please log in again.');
    }

    if (record.user.isBanned) {
      throw createError(403, 'Your account has been suspended.');
    }

    // Revoke old token
    await prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    const { rawToken } = await storeRefreshToken(record.user.id);

    res.json({
      ...buildAuthPayload(record.user, rawToken),
      message: 'Tokens refreshed',
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw createError(400, 'Refresh token is required');

    const tokenHash = hashToken(refreshToken);

    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

export async function logoutAll(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.refreshToken.updateMany({
      where: { userId: req.user!.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    res.json({ success: true, message: 'Logged out from all devices' });
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    validate(req);
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.isVerified) {
      return res.json({
        success: true,
        message: 'If that email is registered, a reset code has been sent.',
      });
    }

    const otp = await createOtp(email, OtpType.PASSWORD_RESET);
    sendPasswordResetEmail(email, otp).catch((err) =>
      console.error('[Mail] Password reset email failed:', err.message)
    );

    res.json({
      success: true,
      message: 'If that email is registered, a reset code has been sent.',
    });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    validate(req);
    const { email, otp, newPassword } = req.body;

    await consumeOtp(email, otp, OtpType.PASSWORD_RESET);

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    const user = await prisma.user.update({
      where: { email },
      data: { passwordHash },
    });

    await prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    res.json({
      success: true,
      message: 'Password reset successfully. Please log in with your new password.',
    });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    validate(req);
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw createError(404, 'User not found');

    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) throw createError(401, 'Current password is incorrect');

    if (currentPassword === newPassword) {
      throw createError(400, 'New password must be different from the current password');
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    await prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    res.json({
      success: true,
      message: 'Password changed successfully. Please log in again.',
    });
  } catch (err) {
    next(err);
  }
}

export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true, name: true, email: true, phone: true, role: true, 
        isVerified: true, isBanned: true, createdAt: true
      }
    });
    
    if (!user) throw createError(404, 'User not found');

    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    validate(req);
    const { name, phone, email } = req.body;

    if (!name && !phone && !email) {
      throw createError(400, 'Provide at least one field to update (name, email or phone)');
    }

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(name && { name: name.trim() }),
        ...(phone && { phone: phone.trim() }),
        ...(email && { email: email.trim() }),
      },
      select: {
        id: true, name: true, email: true, phone: true, role: true, 
        isVerified: true, createdAt: true
      }
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user,
    });
  } catch (err) {
    next(err);
  }
}

export async function verifyEmailOtp(req: Request, res: Response, next: NextFunction) {
  return verifyOtp(req, res, next);
}
