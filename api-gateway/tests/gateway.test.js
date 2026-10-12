const request = require("supertest");

const { app } = require("../src/index");

describe("API Gateway", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  it("reports the available gateway endpoints at the root", async () => {
    const response = await request(app).get("/");

    expect(response.status).toBe(200);
    expect(response.body.service).toBe("api-gateway");
    expect(response.body.endpoints).toContain("/api/products");
  });

  it("reports its health", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ service: "api-gateway", status: "ok" });
  });

  it("forwards product requests and rewrites the public path", async () => {
    global.fetch.mockResolvedValue({
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => JSON.stringify([{ name: "Laptop" }])
    });

    const response = await request(app).get("/api/products");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ name: "Laptop" }]);
    expect(global.fetch).toHaveBeenCalledWith("http://localhost:4001/products", expect.objectContaining({ method: "GET" }));
  });

  it("returns a controlled error when a backend is unavailable", async () => {
    global.fetch.mockRejectedValue(new Error("connection refused"));

    const response = await request(app).get("/api/orders");

    expect(response.status).toBe(503);
    expect(response.body.error).toBe("Backend service unavailable");
  });
});
