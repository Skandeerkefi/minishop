const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();

app.use(express.json());

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: ""
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    stock: {
      type: Number,
      required: true,
      min: 0
    }
  },
  { timestamps: true }
);

const Product = mongoose.model("Product", productSchema);

app.get("/", (req, res) => {
  res.json({
    service: "product-service",
    status: "ok",
    endpoints: ["/health", "/products", "/products/:id"]
  });
});

app.get("/health", (req, res) => {
  res.json({
    service: "product-service",
    status: "ok"
  });
});

app.get("/products", async (req, res, next) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 }).lean();
    res.json(products);
  } catch (error) {
    next(error);
  }
});

app.get("/products/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        error: "Invalid product ID"
      });
    }

    const product = await Product.findById(req.params.id).lean();

    if (!product) {
      return res.status(404).json({
        error: "Product not found"
      });
    }

    res.json(product);
  } catch (error) {
    next(error);
  }
});

app.post("/products", async (req, res, next) => {
  try {
    const { name, description = "", price, stock = 0 } = req.body;

    const hasValidName = typeof name === "string" && name.trim().length > 0;
    const hasValidPrice = typeof price === "number" && Number.isFinite(price) && price >= 0;
    const hasValidStock = Number.isInteger(stock) && stock >= 0;

    if (!hasValidName || !hasValidPrice || !hasValidStock) {
      return res.status(400).json({
        error: "Invalid product data"
      });
    }

    const product = await Product.create({
      name: name.trim(),
      description: typeof description === "string" ? description : "",
      price,
      stock
    });

    res.status(201).json(product);
  } catch (error) {
    if (error && error.name === "ValidationError") {
      return res.status(400).json({
        error: "Invalid product data"
      });
    }

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
  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/minishop_products";
  await mongoose.connect(mongoUri);
}

async function start() {
  await connectToDatabase();

  const port = Number(process.env.PORT) || 4001;

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`Product Service listening on ${port}`);
      resolve(server);
    });
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error("Product Service startup failed:", error);
    process.exit(1);
  });
}

module.exports = { app, Product, connectToDatabase, start };
