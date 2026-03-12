import express from "express";
import productService from "../services/products/productService.js";
import barcodeService from "../services/products/barcodeService.js";

const router = express.Router();

/**
 * Optional product search (UI autocomplete)
 * GET /products/search?q=milk
 */
router.get("/products/search", async (req, res) => {
  try {
    const result = await productService.searchProducts(req.query);
    return res.json(result);
  } catch (err) {
    console.error("Product search error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error searching products",
    });
  }
});

/**
 * POST: Scan barcode
 */
router.post("/scan", async (req, res) => {
  try {
    const result = await barcodeService.scanBarcode(req.body);
    return res.json(result);
  } catch (err) {
    console.error("Barcode scan error:", err);
    return res
      .status(err.statusCode || 500)
      .json(
        err.payload || {
          found: false,
          message: err.message || "Server error scanning barcode",
        },
      );
  }
});

/**
 * POST: Create product
 */
router.post("/products/create", async (req, res) => {
  try {
    const result = await productService.createProduct(req.body);
    return res.json(result);
  } catch (err) {
    console.error("Create product error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error creating product",
    });
  }
});

export default router;