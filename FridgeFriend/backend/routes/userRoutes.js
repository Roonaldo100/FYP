import express from "express";
import userService from "../services/users/userService.js";
import frequentItemsService from "../services/users/frequentItemsService.js";
import usageService from "../services/users/usageService.js";

const router = express.Router();

/**
 * GET: Frequently used items for a user
 */
router.get("/user/:userId/frequentItems", async (req, res) => {
  try {
    const result = await frequentItemsService.getFrequentItems(
      req.params.userId,
      req.query.limit,
    );
    return res.json(result);
  } catch (err) {
    console.error("frequentItems error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error loading frequent items",
    });
  }
});

/**
 * DELETE: Remove a frequently used item row
 */
router.delete("/user_product_usage", async (req, res) => {
  try {
    const result = await usageService.deleteUsageRow(
      req.query.userId,
      req.query.productId,
    );
    return res.json(result);
  } catch (err) {
    console.error("Delete user_product_usage error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error deleting frequently used item",
    });
  }
});

/**
 * GET: Products for a user's food type
 */
router.get("/user/:userId/foodtype/:foodTypeId", async (req, res) => {
  try {
    const result = await userService.getUserFoodTypeProducts(
      req.params.userId,
      req.params.foodTypeId,
    );
    return res.json(result);
  } catch (err) {
    console.error("User product fetch error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error",
    });
  }
});

export default router;