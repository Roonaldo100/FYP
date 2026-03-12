import express from "express";
import storeService from "../services/stores/storeService.js";
import userStoreService from "../services/stores/userStoreService.js";

const router = express.Router();

/**
 * GET: Stores
 */
router.get("/stores", async (req, res) => {
  try {
    const result = await storeService.getStores(req.query.userId);
    return res.json(result);
  } catch (err) {
    console.error("Store fetch error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error loading stores",
    });
  }
});

/**
 * POST: Create a new store
 */
router.post("/stores", async (req, res) => {
  try {
    const result = await storeService.createStore(req.body);
    return res.json(result);
  } catch (err) {
    console.error("Create store error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error creating store",
    });
  }
});

/**
 * DELETE (safe): migrate references to "No store", then delete the store
 */
router.delete("/user/:userId/stores/:storeId/safe", async (req, res) => {
  try {
    const result = await userStoreService.safeDeleteUserStore(
      req.params.userId,
      req.params.storeId,
      req.body?.deletePriceHistory === true,
    );
    return res.json(result);
  } catch (err) {
    console.error("safe delete store error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error deleting store safely",
    });
  }
});

export default router;