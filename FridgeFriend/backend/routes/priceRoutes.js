import express from "express";
import priceHistoryService from "../services/pricing/priceHistoryService.js";

const router = express.Router();

/**
 * Allow the user to store prices for products per store
 */
router.get("/user/:userId/product/:productId/lastPrice", async (req, res) => {
  try {
    const result = await priceHistoryService.getLastPrice(
      req.params.userId,
      req.params.productId,
      req.query.storeId,
    );
    return res.json(result);
  } catch (err) {
    console.error("Get last price error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error fetching last price",
    });
  }
});

router.get(
  "/user/:userId/product/:productId/lastPriceAny",
  async (req, res) => {
    try {
      const result = await priceHistoryService.getLastPriceAny(
        req.params.userId,
        req.params.productId,
      );
      return res.json(result);
    } catch (err) {
      console.error("Get last price any error:", err);
      return res.status(err.statusCode || 500).json({
        message: err.message || "Server error fetching last price",
      });
    }
  },
);

router.post(
  "/user/:userId/product/:productId/clearPersonalHistory",
  async (req, res) => {
    try {
      const result = await priceHistoryService.clearPersonalHistory(
        req.params.userId,
        req.params.productId,
        req.body?.confirmDeleteInventory === true,
      );
      return res.json(result);
    } catch (err) {
      console.error("clearPersonalHistory error:", err);

      if (err.statusCode === 409 && err.payload) {
        return res.status(409).json({
          message: err.message,
          ...err.payload,
        });
      }

      return res.status(err.statusCode || 500).json({
        message: err.message || "Server error clearing history",
      });
    }
  },
);

export default router;