import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middlewares/authMiddleware';
import {
  signup, verifyOtp, verifyEmailOtp, resendOtp, login, refreshTokens, logout, logoutAll,
  forgotPassword, resetPassword, changePassword, getProfile, updateProfile,
  signupValidation, otpValidation, loginValidation, forgotPasswordValidation,
  resetPasswordValidation, changePasswordValidation, updateProfileValidation,
} from '../controllers/authController';

const router = express.Router();

const signupLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });
const otpLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 3 });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
const forgotPasswordLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 3 });
const refreshLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

router.post('/signup', signupLimiter, signupValidation, signup);
router.post('/verify-otp', otpLimiter, otpValidation, verifyOtp);
router.post('/verify-email-otp', otpLimiter, otpValidation, verifyEmailOtp);
router.post('/resend-otp', otpLimiter, resendOtp);
router.post('/login', loginLimiter, loginValidation, login);
router.post('/refresh', refreshLimiter, refreshTokens);
router.post('/logout', logout);
router.post('/forgot-password', forgotPasswordLimiter, forgotPasswordValidation, forgotPassword);
router.post('/reset-password', otpLimiter, resetPasswordValidation, resetPassword);

router.use(authenticate);
router.post('/logout-all', logoutAll);
router.patch('/change-password', changePasswordValidation, changePassword);
router.get('/me', getProfile);
router.patch('/me', updateProfileValidation, updateProfile);

export default router;
