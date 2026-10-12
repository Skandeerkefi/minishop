const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { app, Order } = require("../src/index");

describe("Order Service", () => {
  let mongoServer;
  let productId;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri("minishop_orders");
    process.env.PRODUCT_SERVICE_URL = "http://product-service:4001";
    await mongoose.connect(process.env.MONGODB_URI);
    productId = new mongoose.Types.ObjectId().toString();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Order.deleteMany();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  it("reports the available order endpoints at the root", async () => {
    const response = await request(app).get("/");

    expect(response.status).toBe(200);
    expect(response.body.service).toBe("order-service");
    expect(response.body.endpoints).toContain("/orders");
  });

  it("creates an order from valid product data", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        _id: productId,
        name: "Laptop",
        price: 1200
      })
    });

    const response = await request(app)
      .post("/orders")
      .send({
        items: [{ productId, quantity: 2 }]
      });

    expect(response.status).toBe(201);
    expect(response.body.total).toBe(2400);
    expect(response.body.status).toBe("PENDING");
  });

  it("rejects orders referencing nonexistent products", async () => {
    const missingProductId = new mongoose.Types.ObjectId().toString();

    global.fetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "Product not found" })
    });

    const response = await request(app)
      .post("/orders")
      .send({
        items: [{ productId: missingProductId, quantity: 1 }]
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Product not found");
  });

  it("calculates the order total correctly", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        _id: productId,
        name: "Tablet",
        price: 350
      })
    });

    const response = await request(app)
      .post("/orders")
      .send({
        items: [{ productId, quantity: 3 }]
      });

    expect(response.status).toBe(201);
    expect(response.body.total).toBe(1050);
  });
});
