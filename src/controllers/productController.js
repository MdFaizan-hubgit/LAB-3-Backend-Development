const mongoose = require("mongoose");
const Product = require("../models/Product");
const asyncHandler = require("../middleware/asyncHandler");

// POST /api/products — create a product.
const createProduct = asyncHandler(async (req, res) => {
  const product = await Product.create(req.body);
  res.status(201).json(product);
});

// GET /api/products — filtering, sorting and pagination.
const getProducts = asyncHandler(async (req, res) => {
  const {
    category,
    search,
    minPrice,
    maxPrice,
    minQuantity,
    maxQuantity,
    sort = "createdAt",
    order = "desc",
    page = 1,
    limit = 10
  } = req.query;

  const filter = {};

  if (category) filter.category = new RegExp(`^${escapeRegex(category)}$`, "i");

  if (search) {
    const safeSearch = escapeRegex(search);
    filter.$or = [
      { name: { $regex: safeSearch, $options: "i" } },
      { sku: { $regex: safeSearch, $options: "i" } },
      { supplier: { $regex: safeSearch, $options: "i" } }
    ];
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) filter.price.$gte = parseNonNegative(minPrice, "minPrice");
    if (maxPrice !== undefined) filter.price.$lte = parseNonNegative(maxPrice, "maxPrice");
  }

  if (minQuantity !== undefined || maxQuantity !== undefined) {
    filter.quantity = {};
    if (minQuantity !== undefined) filter.quantity.$gte = parseNonNegative(minQuantity, "minQuantity");
    if (maxQuantity !== undefined) filter.quantity.$lte = parseNonNegative(maxQuantity, "maxQuantity");
  }

  const pageNumber = parsePositiveInteger(page, "page");
  const pageSize = parsePositiveInteger(limit, "limit");
  if (pageSize > 100) {
    const error = new Error("limit cannot be greater than 100");
    error.statusCode = 400;
    throw error;
  }

  const allowedSortFields = ["name", "price", "quantity", "category", "createdAt", "updatedAt"];
  if (!allowedSortFields.includes(sort)) {
    const error = new Error(`sort must be one of: ${allowedSortFields.join(", ")}`);
    error.statusCode = 400;
    throw error;
  }

  const sortOrder = String(order).toLowerCase() === "asc" ? 1 : -1;
  const sortOption = { [sort]: sortOrder };

  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort(sortOption)
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize),
    Product.countDocuments(filter)
  ]);

  res.status(200).json({
    total,
    page: pageNumber,
    limit: pageSize,
    totalPages: Math.ceil(total / pageSize),
    count: products.length,
    products
  });
});

// GET /api/products/:id — retrieve one product.
const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    const error = new Error("Product not found");
    error.statusCode = 404;
    throw error;
  }
  res.status(200).json(product);
});

// PUT /api/products/:id — update product details.
const updateProduct = asyncHandler(async (req, res) => {
  const allowedFields = ["name", "sku", "category", "price", "quantity", "reorderLevel", "supplier"];
  const updates = {};

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      updates[field] = req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    const error = new Error("Provide at least one valid product field to update");
    error.statusCode = 400;
    throw error;
  }

  const product = await Product.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
    context: "query"
  });

  if (!product) {
    const error = new Error("Product not found");
    error.statusCode = 404;
    throw error;
  }

  res.status(200).json(product);
});

// PATCH /api/products/:id/stock — safely adjust stock by a signed change.
const adjustStock = asyncHandler(async (req, res) => {
  const change = Number(req.body.change);

  if (!Number.isInteger(change) || change === 0) {
    const error = new Error("change must be a non-zero integer (positive to restock, negative for a sale)");
    error.statusCode = 400;
    throw error;
  }

  const query = { _id: req.params.id };
  if (change < 0) query.quantity = { $gte: Math.abs(change) };

  const product = await Product.findOneAndUpdate(
    query,
    { $inc: { quantity: change } },
    { new: true, runValidators: true }
  );

  if (!product) {
    const exists = await Product.exists({ _id: req.params.id });
    if (!exists) {
      const error = new Error("Product not found");
      error.statusCode = 404;
      throw error;
    }
    const error = new Error("Insufficient stock for this sale");
    error.statusCode = 400;
    throw error;
  }

  res.status(200).json({ message: "Stock updated", product });
});

// DELETE /api/products/:id — remove a product.
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) {
    const error = new Error("Product not found");
    error.statusCode = 404;
    throw error;
  }
  res.status(200).json({ message: "Product deleted", id: product._id });
});

// GET /api/products/low-stock — products at or below reorder level.
const getLowStockProducts = asyncHandler(async (req, res) => {
  const lowStockItems = await Product.find({
    $expr: { $lte: ["$quantity", "$reorderLevel"] }
  }).sort({ quantity: 1 });

  res.status(200).json({
    count: lowStockItems.length,
    lowStockItems
  });
});

// GET /api/products/summary — category-wise aggregation report.
const getCategorySummary = asyncHandler(async (req, res) => {
  const summary = await Product.aggregate([
    {
      $group: {
        _id: "$category",
        totalItems: { $sum: 1 },
        totalQuantity: { $sum: "$quantity" },
        totalStockValue: { $sum: { $multiply: ["$price", "$quantity"] } },
        avgPrice: { $avg: "$price" }
      }
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        category: "$_id",
        totalItems: 1,
        totalQuantity: 1,
        totalStockValue: { $round: ["$totalStockValue", 2] },
        avgPrice: { $round: ["$avgPrice", 2] }
      }
    }
  ]);

  res.status(200).json({
    categories: summary.length,
    summary
  });
});

function parsePositiveInteger(value, fieldName) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    const error = new Error(`${fieldName} must be a positive integer`);
    error.statusCode = 400;
    throw error;
  }
  return number;
}

function parseNonNegative(value, fieldName) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    const error = new Error(`${fieldName} must be a non-negative number`);
    error.statusCode = 400;
    throw error;
  }
  return number;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  adjustStock,
  deleteProduct,
  getLowStockProducts,
  getCategorySummary
};
