require("dotenv").config();

const express = require("express");
const connectDB = require("./src/config/db");
const productRoutes = require("./src/routes/productRoutes");
const { notFound, errorHandler } = require("./src/middleware/errorMiddleware");

const app = express();

// Built-in middleware to read JSON request bodies.
app.use(express.json());

// Simple health check.
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Inventory Management API is running",
    endpoints: "/api/products"
  });
});

app.use("/api/products", productRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Unable to start server:", error.message);
    process.exit(1);
  }
}

startServer();
