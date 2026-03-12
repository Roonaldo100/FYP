import express from "express";
import userSettingsService from "../services/settings/userSettingsService.js";
import notificationService from "../services/settings/notificationService.js";
import expiryService from "../services/inventory/expiryService.js";

const router = express.Router();

/**
 * GET: Settings
 */
router.get("/user/:userId/settings", async (req, res) => {
  try {
    const result = await userSettingsService.getUserSettings(
      req.params.userId,
    );
    return res.json(result);
  } catch (err) {
    console.error("Get settings error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error loading settings",
    });
  }
});

/**
 * POST: Update notification preference + sweep
 */
router.post("/user/:userId/settings/notificationPeriod", async (req, res) => {
  try {
    const result = await userSettingsService.updateNotificationPeriod(
      req.params.userId,
      req.body?.notification_period_preference,
      req.body?.overrideExisting,
    );
    return res.json(result);
  } catch (err) {
    console.error("Update settings error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error updating settings",
    });
  }
});

/**
 * GET: Pending notifications
 */
router.get("/user/:userId/pendingNotifications", async (req, res) => {
  try {
    const result = await notificationService.getPendingNotifications(
      req.params.userId,
    );
    return res.json(result);
  } catch (err) {
    console.error("Pending notifications error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error loading pending notifications",
    });
  }
});

/**
 * GET: Expiring soon
 */
router.get("/user/:userId/expiringSoon", async (req, res) => {
  try {
    const result = await expiryService.getExpiringSoon(req.params.userId);
    return res.json(result);
  } catch (err) {
    console.error("expiringSoon error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error loading expiring soon list",
    });
  }
});

export default router;