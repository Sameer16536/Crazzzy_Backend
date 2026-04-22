'use strict';

const Razorpay = require('razorpay');

/**
 * Razorpay SDK instance.
 * key_id and key_secret are loaded from .env — never committed to source control.
 */
const razorpayInstance = new Razorpay({
  key_id    : process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

module.exports = razorpayInstance;
