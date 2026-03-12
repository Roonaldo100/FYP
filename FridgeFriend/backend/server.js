import dotenv from "dotenv";
dotenv.config();

import cors from "cors";
import express from "express";

import authRoutes from "./routes/authRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import inventoryRoutes from "./routes/inventoryRoutes.js";
import priceRoutes from "./routes/priceRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import recipeRoutes from "./routes/recipeRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import shoppingListRoutes from "./routes/shoppingListRoutes.js";
import storeRoutes from "./routes/storeRoutes.js";
import userRoutes from "./routes/userRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());

/**
 * Route modules
 * Keep mounted at root so all original endpoint paths remain unchanged
 */
app.use(authRoutes);
app.use(categoryRoutes);
app.use(chatRoutes);
app.use(inventoryRoutes);
app.use(priceRoutes);
app.use(productRoutes);
app.use(recipeRoutes);
app.use(settingsRoutes);
app.use(shoppingListRoutes);
app.use(storeRoutes);
app.use(userRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});