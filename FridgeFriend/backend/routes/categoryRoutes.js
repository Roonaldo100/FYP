import express from "express";
import categoryService from "../services/categories/categoryService.js";
import userCategoryService from "../services/categories/userCategoryService.js";
import userService from "../services/users/userService.js";

const router = express.Router();

router.get("/categories", async (req, res) => {
  try {
    const result = await categoryService.getCategories(req.query.userId);
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error("Categories error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error loading categories",
    });
  }
});

router.get("/categories/:id/food", async (req, res) => {
  try {
    const result = await categoryService.getFoodByCategoryId(
      req.params.id,
      req.query.userId,
    );
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error("Food types error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error loading food types",
    });
  }
});

router.post("/user/:userId/categories", async (req, res) => {
  try {
    const result = await userCategoryService.addCategoryToUser(
      req.params.userId,
      req.body?.name,
    );
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error("Create category error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error creating category",
    });
  }
});

router.delete("/user/:userId/categories/:categoryId", async (req, res) => {
  try {
    const result = await userCategoryService.removeCategoryFromUser(
      req.params.userId,
      req.params.categoryId,
    );
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error("Delete category error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error deleting category",
    });
  }
});

router.post("/user/:userId/categories/:categoryId/food", async (req, res) => {
  try {
    const result = await userCategoryService.addFoodTypeToUserCategory(
      req.params.userId,
      req.params.categoryId,
      req.body?.name,
    );
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error("Create food type error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error creating food type",
    });
  }
});

router.delete("/user/:userId/foodtypes/:foodTypeId", async (req, res) => {
  try {
    const result = await userCategoryService.removeFoodTypeFromUser(
      req.params.userId,
      req.params.foodTypeId,
    );
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error("Delete food type error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error deleting food type",
    });
  }
});

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