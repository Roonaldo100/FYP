import express from "express";
import shoppingCandidateService from "../services/shopping/shoppingCandidateService.js";
import shoppingInventoryTransferService from "../services/shopping/shoppingInventoryTransferService.js";
import shoppingListService from "../services/shopping/shoppingListService.js";

const router = express.Router();

router.get("/user/:userId/shopping/candidates/inventory", async (req, res) => {
  try {
    const result = await shoppingCandidateService.getInventoryCandidates(
      req.params.userId,
    );
    return res.json(result);
  } catch (err) {
    console.error("shopping candidates inventory error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error loading inventory candidates",
    });
  }
});

router.get("/user/:userId/shopping/candidates/history", async (req, res) => {
  try {
    const result = await shoppingCandidateService.getHistoryCandidates(
      req.params.userId,
    );
    return res.json(result);
  } catch (err) {
    console.error("shopping candidates history error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error loading history candidates",
    });
  }
});

router.post("/user/:userId/shoppingLists", async (req, res) => {
  try {
    const result = await shoppingListService.createShoppingList(
      req.params.userId,
      req.body?.name,
    );
    return res.status(201).json(result);
  } catch (err) {
    console.error("create shopping list error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error creating shopping list",
    });
  }
});

router.get("/user/:userId/shoppingLists", async (req, res) => {
  try {
    const result = await shoppingListService.listShoppingLists(
      req.params.userId,
    );
    return res.json(result);
  } catch (err) {
    console.error("list shopping lists error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error listing shopping lists",
    });
  }
});

router.delete("/user/:userId/shoppingLists/:listId", async (req, res) => {
  try {
    const result = await shoppingListService.deleteShoppingList(
      req.params.userId,
      req.params.listId,
    );
    return res.json(result);
  } catch (err) {
    console.error("delete shopping list error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error deleting shopping list",
    });
  }
});

router.post("/user/:userId/shoppingLists/:listId/items", async (req, res) => {
  try {
    const result = await shoppingListService.addShoppingListItem(
      req.params.userId,
      req.params.listId,
      req.body,
    );
    return res.status(result.statusCode || 201).json({
      item_id: result.item_id,
      merged: result.merged,
    });
  } catch (err) {
    console.error("add shopping list item error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error adding item",
    });
  }
});

router.post("/user/:userId/shoppingLists/:listId/addToInventory", async (req, res) => {
  try {
    const result =
      await shoppingInventoryTransferService.addSelectedListItemsToInventory(
        req.params.userId,
        req.params.listId,
        req.body?.itemIds,
      );
    return res.json(result);
  } catch (err) {
    console.error("addToInventory error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error adding to inventory",
    });
  }
});

router.post(
  "/user/:userId/shoppingLists/:listId/items/:itemId/attachProduct",
  async (req, res) => {
    try {
      const result = await shoppingListService.attachProductToShoppingListItem(
        req.params.userId,
        req.params.listId,
        req.params.itemId,
        req.body,
      );
      return res.json(result);
    } catch (err) {
      console.error("attachProduct error:", err);
      return res.status(err.statusCode || 500).json({
        message: err.message || "Server error attaching product",
      });
    }
  },
);

router.put(
  "/user/:userId/shoppingLists/:listId/items/:itemId",
  async (req, res) => {
    try {
      const result = await shoppingListService.updateShoppingListItem(
        req.params.userId,
        req.params.listId,
        req.params.itemId,
        req.body,
      );
      return res.json(result);
    } catch (err) {
      console.error("update shopping list item error:", err);
      return res.status(err.statusCode || 500).json({
        message: err.message || "Server error updating item",
      });
    }
  },
);

router.delete(
  "/user/:userId/shoppingLists/:listId/items/:itemId",
  async (req, res) => {
    try {
      const result = await shoppingListService.deleteShoppingListItem(
        req.params.userId,
        req.params.listId,
        req.params.itemId,
      );
      return res.json(result);
    } catch (err) {
      console.error("delete shopping list item error:", err);
      return res.status(err.statusCode || 500).json({
        message: err.message || "Server error deleting item",
      });
    }
  },
);

router.get("/user/:userId/shoppingLists/:listId", async (req, res) => {
  try {
    const result = await shoppingListService.getShoppingList(
      req.params.userId,
      req.params.listId,
    );
    return res.json(result);
  } catch (err) {
    console.error("get shopping list error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.message || "Server error loading shopping list",
    });
  }
});

export default router;