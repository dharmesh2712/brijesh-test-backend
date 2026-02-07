const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors());

/* -------------------- MongoDB -------------------- */
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error(err));

const OrderSchema = new mongoose.Schema(
  {
    orderId: String,
    amount: Number,
    currency: String,
    receipt: String,
    status: String,
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", OrderSchema);

/* -------------------- Razorpay -------------------- */
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/* -------------------- Routes -------------------- */
app.get("/", (req, res) => {
  res.send("Razorpay + MongoDB backend running");
});

// Create Order
app.post("/create-order", async (req, res) => {
  try {
    const order = await razorpay.orders.create({
      amount: 500,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    });

    // Save order to MongoDB
    await Order.create({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      status: order.status,
    });

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verify Payment
app.post("/verify-payment", async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  } = req.body;

  const sign = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(sign)
    .digest("hex");

  if (expected === razorpay_signature) {
    await Order.findOneAndUpdate(
      { orderId: razorpay_order_id },
      { status: "paid" }
    );

    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

/* -------------------- Server -------------------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
