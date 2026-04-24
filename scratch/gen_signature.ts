import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from the root
dotenv.config({ path: path.join(__dirname, '../.env') });

const RAZORPAY_SECRET = process.env.RAZORPAY_KEY_SECRET;

if (!RAZORPAY_SECRET) {
    console.error("❌ RAZORPAY_KEY_SECRET not found in .env");
    process.exit(1);
}

// EDIT THESE VALUES BASED ON YOUR PREVIOUS RESPONSE
const razorpay_order_id = "order_ShO0DuDPwYESd0"; 
const razorpay_payment_id = "pay_test_999999999"; // Fake ID for testing

const body = razorpay_order_id + "|" + razorpay_payment_id;

const signature = crypto
    .createHmac('sha256', RAZORPAY_SECRET)
    .update(body)
    .digest('hex');

console.log("\n✅ SIGNATURE GENERATED FOR TESTING");
console.log("----------------------------------");
console.log(`Order ID (Internal): 1`);
console.log(`Razorpay Order ID:   ${razorpay_order_id}`);
console.log(`Razorpay Payment ID: ${razorpay_payment_id}`);
console.log(`Razorpay Signature:  ${signature}`);
console.log("----------------------------------\n");
console.log("Use these values in your 'Verify Payment' request body.");
