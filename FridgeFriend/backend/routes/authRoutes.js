import express from "express";
import authService from "../services/auth/authService.js";

const router = express.Router();

router.post("/signup", async (req, res) => {
  try {
    const result = await authService.signup(req.body);
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error creating account",
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const result = await authService.login(req.body);
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error("Login error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error",
    });
  }
});

export default router;