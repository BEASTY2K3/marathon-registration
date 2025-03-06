const express = require("express");
const { body, validationResult } = require("express-validator");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const User = require("../models/User");
const Payment = require("../models/Payment");
const nodemailer = require("nodemailer");

const router = express.Router();

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Helper: Generate Chest Number (Auto-Increment)
const getNextChestNumber = async () => {
  const lastUser = await User.findOne().sort({ chestNumber: -1 });
  return lastUser ? lastUser.chestNumber + 1 : 1000; // Start from 1000
};

// Helper: Send Confirmation Email
const sendConfirmationEmail = async (user) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "Polo Marathon Registration Confirmation",
      text: `Hello ${user.name},\n\nYour registration for the Polo Marathon is confirmed!\nYour Chest Number: ${user.chestNumber}\n\nThank you!`,
    };

    await transporter.sendMail(mailOptions);
    console.log(`📧 Confirmation email sent to: ${user.email}`);
  } catch (error) {
    console.error("❌ Error sending confirmation email:", error);
  }
};

// ✅ Razorpay Payment Verification Route
router.post("/payment/verify", async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
    const secret = process.env.RAZORPAY_KEY_SECRET;

    // Validate Razorpay signature
    const expectedSignature = crypto.createHmac("sha256", secret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      console.error("❌ Payment verification failed: Invalid signature");
      return res.status(400).json({ success: false, message: "Payment verification failed" });
    }

    // ✅ Save Payment Status in Database
    const payment = new Payment({ orderId: razorpay_order_id, paymentId: razorpay_payment_id, status: "success" });
    await payment.save();
    console.log("✅ Payment verified and saved:", payment);

    res.status(200).json({ success: true, message: "Payment verified" });
  } catch (error) {
    console.error("❌ Payment Verification Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ✅ Register User After Successful Payment
router.post("/register", async (req, res) => {
  try {
    const { name, email, phone, age, gender, category, paymentId, orderId } = req.body;
    
    // ✅ Check if Payment Exists and is Verified
    const payment = await Payment.findOne({ orderId, paymentId });
    if (!payment || payment.status !== "success") {
      console.error("❌ Payment verification failed or not found in DB");
      return res.status(400).json({ msg: "Payment not verified. Registration failed." });
    }
    
    // ✅ Generate Chest Number
    const chestNumber = await getNextChestNumber();
    
    // ✅ Save User Data in Database
    const newUser = new User({ name, email, phone, age, gender, category, paymentId, chestNumber });
    await newUser.save();
    console.log("✅ User Registered Successfully:", newUser);
    
    // ✅ Send Confirmation Email
    await sendConfirmationEmail(newUser);
    
    res.status(201).json({ msg: "User registered successfully after payment.", chestNumber: newUser.chestNumber });
  } catch (error) {
    console.error("❌ Error registering user:", error);
    res.status(500).json({ msg: "Server error", error: error.message });
  }
});

module.exports = router;
