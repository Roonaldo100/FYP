import express from "express";
import recipeService from "../services/recipes/recipeService.js";
import savedRecipeService from "../services/recipes/savedRecipeService.js";
import recipeNutritionService from "../services/recipes/recipeNutritionService.js";
import recipeMissingItemsService from "../services/recipes/recipeMissingItemsService.js";

const router = express.Router();

/**
 * Save recipe (from chatbot)
 */
router.post("/user/:userId/recipes/save", async (req, res) => {
  try {
    const result = await savedRecipeService.saveRecipeFromPayload(
      req.params.userId,
      req.body?.recipe,
    );
    return res.json(result);
  } catch (err) {
    console.error("Save recipe error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error saving recipe",
    });
  }
});

/**
 * Create custom recipe + save it
 */
router.post("/user/:userId/recipes", async (req, res) => {
  try {
    const result = await recipeService.createRecipe(
      req.params.userId,
      req.body,
    );
    return res.json(result);
  } catch (err) {
    console.error("Create recipe error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error creating recipe",
    });
  }
});

/**
 * List user saved recipes
 */
router.get("/user/:userId/recipes", async (req, res) => {
  try {
    const result = await recipeService.listRecipes(req.params.userId);
    return res.json(result);
  } catch (err) {
    console.error("List recipes error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error loading recipes",
    });
  }
});

/**
 * Get nutrition for a saved recipe
 */
router.get("/user/:userId/recipes/:recipeId/nutrition", async (req, res) => {
  try {
    const result = await recipeNutritionService.getRecipeNutrition(
      req.params.userId,
      req.params.recipeId,
    );
    return res.json(result);
  } catch (err) {
    console.error("Nutrition error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error loading nutrition",
    });
  }
});

/**
 * Get recipe details
 */
router.get("/user/:userId/recipes/:recipeId", async (req, res) => {
  try {
    const result = await recipeService.getRecipeDetails(
      req.params.userId,
      req.params.recipeId,
    );
    return res.json(result);
  } catch (err) {
    console.error("Recipe details error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error loading recipe",
    });
  }
});

/**
 * Update custom recipe (only owner)
 */
router.put("/user/:userId/recipes/:recipeId", async (req, res) => {
  try {
    const result = await recipeService.updateRecipe(
      req.params.userId,
      req.params.recipeId,
      req.body,
    );
    return res.json(result);
  } catch (err) {
    console.error("Update recipe error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error updating recipe",
    });
  }
});

/**
 * Remove from saved list; delete custom recipe row only if owner AND nobody else saved it
 */
router.delete("/user/:userId/recipes/:recipeId", async (req, res) => {
  try {
    const result = await recipeService.deleteRecipe(
      req.params.userId,
      req.params.recipeId,
    );
    return res.json(result);
  } catch (err) {
    console.error("Delete recipe error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error deleting recipe",
    });
  }
});

/**
 * Missing items for a saved recipe
 */
router.get("/user/:userId/recipes/:recipeId/missing", async (req, res) => {
  try {
    const result = await recipeMissingItemsService.getMissingItems(
      req.params.userId,
      req.params.recipeId,
    );
    return res.json(result);
  } catch (err) {
    console.error("Recipe missing error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error computing missing",
    });
  }
});

export default router;