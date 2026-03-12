import express from "express";
import recipeChatService from "../services/chat/recipeChatService.js";

const router = express.Router();

/**
 * CHATBOT ROUTE (Spoonacular)
 */
router.post("/chat/recipe", async (req, res) => {
  try {
    const result = await recipeChatService.generateRecipe(req.body);

    return res.status(result.statusCode || 200).json({
      reply: result.reply,
      recipes: result.recipes,
    });
  } catch (err) {
    console.error("Chat recipe error:", err);
    return res.status(err.statusCode || 500).json({
      reply:
        "Sorry — I couldn’t fetch recipe suggestions right now. Check your Spoonacular key/quota and server logs.",
      recipes: [],
    });
  }
});

export default router;