const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();

app.use(express.json());

const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || "http://localhost:4001";

const orderSchema = new mongoose.Schema(
  {
    items: [
      {
        productId: {
          type: String,
          required: true
        },
        name: {
          type: String,
          required: true,
          trim: true
        },
        price: {
          type: Number,
          required: true,
          min: 0
        },
        quantity: {
          type: Number,
          required: true,
          min: 1
        }
      }
    ],
    total: {
      type: Number,
      required: true,
      min: 0
    },
    status: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "CANCELLED"],
      default: "PENDING"
    }
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);

app.get("/", (req, res) => {
  res.json({
    service: "order-service",
    status: "ok",
    endpoints: ["/health", "/orders", "/orders/:id"]
  });
});

app.get("/health", (req, res) => {
  res.json({
    service: "order-service",
    status: "ok"
  });
});

app.get("/orders", async (req, res, next) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 }).lean();
    res.json(orders);
  } catch (error) {
    next(error);
  }
});

app.get("/orders/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        error: "Invalid order ID"
      });
    }

    const order = await Order.findById(req.params.id).lean();

    if (!order) {
      return res.status(404).json({
        error: "Order not found"
      });
    }

    res.json(order);
  } catch (error) {
    next(error);
  }
});

app.post("/orders", async (req, res, next) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: "Order must include at least one item"
      });
    }

    const validatedItems = [];

    for (const item of items) {
      if (!item || typeof item.productId !== "string" || !item.productId.trim()) {
        return res.status(400).json({
          error: "Invalid order item data"
        });
      }

      if (!mongoose.isValidObjectId(item.productId)) {
        return res.status(400).json({
          error: "Invalid product ID"
        });
      }

      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        return res.status(400).json({
          error: "Invalid order item data"
        });
      }

      let productResponse;

      try {
        productResponse = await fetch(`${PRODUCT_SERVICE_URL}/products/${item.productId}`);
      } catch (error) {
        return res.status(503).json({
          error: "Product service unavailable"
        });
      }

      if (!productResponse.ok) {
        const errorPayload = await productResponse.json().catch(() => ({}));
        return res.status(400).json({
          error: errorPayload.error || "Product not found"
        });
      }

      const product = await productResponse.json();

      validatedItems.push({
        productId: item.productId,
        name: product.name,
        price: product.price,
        quantity: item.quantity
      });
    }

    const total = validatedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const order = await Order.create({
      items: validatedItems,
      total,
      status: "PENDING"
    });

    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  console.error(error);

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    error: "Internal server error"
  });
});

async function connectToDatabase() {
  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/minishop_orders";
  await mongoose.connect(mongoUri);
}

async function start() {
  await connectToDatabase();

  const port = Number(process.env.PORT) || 4002;

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`Order Service listening on ${port}`);
      resolve(server);
    });
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error("Order Service startup failed:", error);
    process.exit(1);
  });
}

module.exports = { app, Order, connectToDatabase, start };
