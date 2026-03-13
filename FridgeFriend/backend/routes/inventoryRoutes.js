import express from "express";
import inventoryService from "../services/inventory/inventoryService.js";
import expiryService from "../services/inventory/expiryService.js";
import inventoryBucketService from "../services/inventory/inventoryBucketService.js";

const router = express.Router();

/**
 * POST: Add product to user inventory
 */
router.post("/user/addProduct", async (req, res) => {
  try {
    const result = await inventoryService.addProductToInventory(req.body);
    return res.json(result);
  } catch (err) {
    console.error("Add product error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error adding product",
    });
  }
});

router.post("/user_products/setExpiryPeriod", async (req, res) => {
  try {
    const result = await expiryService.setExpiryPeriod(req.body);
    return res.json(result);
  } catch (err) {
    console.error("setExpiryPeriod error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error updating expiry period",
    });
  }
});

router.get("/user/:userId/products/:productId", async (req, res) => {
  try {
    const result = await inventoryService.getUserOwnedProduct(
      req.params.userId,
      req.params.productId,
    );
    return res.json(result);
  } catch (err) {
    console.error("get product error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error loading product",
    });
  }
});

router.put("/user/:userId/products/:productId", async (req, res) => {
  try {
    const result = await inventoryService.updateUserOwnedProduct(
      req.params.userId,
      req.params.productId,
      req.body,
    );
    return res.json(result);
  } catch (err) {
    console.error("update product error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error updating product",
    });
  }
});

router.delete("/user/:userId/products/:productId", async (req, res) => {
  try {
    const result = await inventoryService.deleteUserOwnedProduct(
      req.params.userId,
      req.params.productId,
    );
    return res.json(result);
  } catch (err) {
    console.error("delete product error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error deleting product",
    });
  }
});

/**
 * POST: Remove N items from user_products for a grouped product/store row
 */
router.post("/user_products/remove", async (req, res) => {
  try {
    const result = await inventoryService.removeUserProducts(req.body);
    return res.json(result);
  } catch (err) {
    console.error("Remove user_products error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error removing items",
    });
  }
});

/**
 * GET: Expiry buckets for a grouped product/store
 */
router.get("/user_products/buckets", async (req, res) => {
  try {
    const result = await inventoryBucketService.getBuckets(req.query);
    return res.json(result);
  } catch (err) {
    console.error("Buckets fetch error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error loading buckets",
    });
  }
});

/**
 * POST: Remove N items from a specific expiry bucket
 */
router.post("/user_products/removeByExpiry", async (req, res) => {
  try {
    const result = await inventoryBucketService.removeByExpiry(req.body);
    return res.json(result);
  } catch (err) {
    console.error("RemoveByExpiry error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error removing items",
    });
  }
});

/**
 * POST: Mark notified
 */
router.post("/user_products/:id/markNotified", async (req, res) => {
  try {
    const result = await expiryService.markNotified(req.params.id);
    return res.json(result);
  } catch (err) {
    console.error("Mark notified error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error marking notified",
    });
  }
});

/**
 * POST: Change (move) all items from one expiry bucket to another
 */
router.post("/user_products/changeBucketExpiry", async (req, res) => {
  try {
    const result = await inventoryBucketService.changeBucketExpiry(req.body);
    return res.json(result);
  } catch (err) {
    console.error("changeBucketExpiry error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error changing bucket expiry",
    });
  }
});

/**
 * POST: Update store for a grouped user product (moves all rows), and optionally set last price
 */
router.post("/user_products/updateStoreAndPrice", async (req, res) => {
  try {
    const result = await inventoryService.updateStoreAndPrice(req.body);
    return res.json(result);
  } catch (err) {
    console.error("updateStoreAndPrice error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error updating store/price",
    });
  }
});

export default router;