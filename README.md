# Inventory and Data Management System

A RESTful backend for Assignment 3 (Web Dev III, Unit 3), built only with Node.js, Express.js, MongoDB, Mongoose and dotenv.

## 1. Requirements covered

- Mongoose Product schema with field-level validation and unique SKU.
- MongoDB connection through Mongoose and environment variables through dotenv.
- Create, read, update and delete product APIs.
- Filtering, sorting and pagination using query parameters.
- Safe stock adjustment (restock and sale); stock cannot become negative.
- Low-stock report (`quantity <= reorderLevel`).
- Category-wise inventory summary using a MongoDB aggregation pipeline.
- Centralized 404/error handling and async route error forwarding.

## 2. Setup

Install Node.js (LTS) and have MongoDB running locally, or create a MongoDB Atlas database.

```bash
npm install
```

Copy `.env.example` to `.env` and set your MongoDB connection string:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/inventory_db
NODE_ENV=development
```

For MongoDB Atlas, replace the local URI with your Atlas connection string. Keep `.env` private; do not upload it to GitHub.

Start the server:

```bash
npm run dev
```

or:

```bash
npm start
```

Base URL: `http://localhost:5000/api/products`

## 3. API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/products` | Create product |
| GET | `/api/products` | List, filter, sort and paginate |
| GET | `/api/products/:id` | Get one product |
| PUT | `/api/products/:id` | Update product details |
| PATCH | `/api/products/:id/stock` | Increase/decrease stock |
| DELETE | `/api/products/:id` | Delete product |
| GET | `/api/products/low-stock` | Low-stock alert report |
| GET | `/api/products/summary` | Category-wise aggregation |

## 4. Test in Postman

### Create product
`POST http://localhost:5000/api/products`

Body → raw → JSON:

```json
{
  "name": "Gel Pen Pack of 15",
  "sku": "STNY-PN-713",
  "category": "Stationery",
  "price": 120,
  "quantity": 48,
  "reorderLevel": 20,
  "supplier": "Cello Pens"
}
```

Expected status: `201 Created`.

### Get all products
`GET http://localhost:5000/api/products`

Examples:

- `GET /api/products?page=1&limit=10`
- `GET /api/products?category=Stationery`
- `GET /api/products?search=pen`
- `GET /api/products?minPrice=100&maxPrice=500`
- `GET /api/products?minQuantity=5&maxQuantity=50`
- `GET /api/products?sort=price&order=asc`
- Combine them: `/api/products?category=Stationery&sort=price&order=desc&page=1&limit=5`

Allowed sort fields: `name`, `price`, `quantity`, `category`, `createdAt`, `updatedAt`.

### Get one product
`GET http://localhost:5000/api/products/PRODUCT_ID`

Replace `PRODUCT_ID` with the `_id` returned by the create request.

### Update product
`PUT http://localhost:5000/api/products/PRODUCT_ID`

```json
{
  "price": 140,
  "quantity": 60
}
```

Only supplied valid fields are updated. Mongoose validators run on updates.

### Restock or sell stock
`PATCH http://localhost:5000/api/products/PRODUCT_ID/stock`

Restock by 10:

```json
{ "change": 10 }
```

Sell 5:

```json
{ "change": -5 }
```

The operation is atomic and a sale is rejected if available stock is insufficient.

### Low-stock report
`GET http://localhost:5000/api/products/low-stock`

Returns products whose quantity is less than or equal to their reorder level.

### Category summary
`GET http://localhost:5000/api/products/summary`

Returns, for each category, number of product records, total quantity, total stock value (`price × quantity`) and average price.

### Delete product
`DELETE http://localhost:5000/api/products/PRODUCT_ID`

## 5. Validation and error behavior

- Missing required fields, negative price/quantity and invalid integer quantities are rejected.
- Duplicate SKU returns `409 Conflict`.
- Invalid MongoDB ID returns `400 Bad Request`.
- Unknown product returns `404 Not Found`.
- Invalid pagination/filter values return `400 Bad Request`.
- A sale that would make stock negative returns `400 Bad Request`.

## 6. Suggested practical demonstration order

1. Start MongoDB and run the server.
2. Create two or three products in different categories.
3. Fetch all products; demonstrate category/search filtering, sorting and pagination.
4. Fetch one product by its returned ID.
5. Update its price or quantity.
6. Restock with a positive `change`, then make a sale with a negative `change`.
7. Try an over-sale to demonstrate the insufficient-stock protection.
8. Open `/low-stock` and `/summary`.
9. Delete one product.

This sequence demonstrates every major rubric component. The assignment sheet specifies a 2.5-mark rubric: schema/validation (0.5), CRUD (0.75), querying (0.5), aggregation reports (0.5), and API design/clean code (0.25). Actual marks remain at the instructor's discretion.
