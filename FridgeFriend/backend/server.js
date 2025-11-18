import cors from 'cors';
import express from 'express';
import fetch from 'node-fetch';
import pool from './db.js';

const app = express(); // allows for app.get etc
app.use(cors()); // allows backend to accept requests from a different origin
app.use(express.json()); // parses incoming JSON data from request bodies


//  GET ALL CATEGORIES

app.get('/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ message: 'Server error fetching categories' });
  }
});


//  GET FOOD TYPES FOR A SPECIFIC CATEGORY

app.get('/categories/:id/food', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM food_types WHERE category = $1 ORDER BY id',
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching food types:', err);
    res.status(500).json({ message: 'Server error fetching food types' });
  }
});


//  GET A USER'S PRODUCTS FOR A GIVEN FOOD TYPE (grouped)

app.get('/user/:userId/foodtype/:foodTypeId', async (req, res) => {
  const { userId, foodTypeId } = req.params;

  try {
    const query = `
      SELECT
        p.id AS product_id,
        p.name AS product_name,
        s.name AS store_name,
        COUNT(up.id) AS quantity,
        MIN(up.expiry_date) AS nearest_expiry
      FROM user_products up
      JOIN products p ON p.id = up.product_id
      JOIN stores s ON s.id = up.store_id
      WHERE up.user_id = $1 AND p.food_type = $2
      GROUP BY p.id, p.name, s.name
      ORDER BY p.name;
    `;

    const result = await pool.query(query, [userId, foodTypeId]);
    res.json(result.rows);

  } catch (err) {
    console.error('Error fetching user products:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


//  USER LOGIN

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 AND password = $2',
      [username, password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    res.json({
      message: 'Login successful',
      user_id: user.id,
      username: user.username
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


//  BARCODE SCAN ENDPOINT
//  - Checks local DB by barcode
//  - If not found, attempts lookup on OpenFoodFacts
//  - Inserts new product (and product_store row) if needed

app.post('/scan', async (req, res) => {
  const { barcode } = req.body;

  if (!barcode) {
    return res.status(400).json({ message: 'Barcode is required' });
  }

  try {
    // 1. Try local product lookup by barcode
    const local = await pool.query(
      `SELECT id AS product_id, name AS product_name, food_type
       FROM products
       WHERE barcode = $1`,
      [barcode]
    );

    if (local.rows.length > 0) {
      // You could also look up store+price here from product_store
      return res.json({
        found: true,
        product_id: local.rows[0].product_id,
        product_name: local.rows[0].product_name,
        store_id: 1,        // TEMP: Tesco
        store_name: 'Tesco',
        expiry_date: null
      });
    }

    // 2. Lookup from OpenFoodFacts
    const offRes = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`
    );
    const offData = await offRes.json();

    if (offData.status === 0) {
      // Product not found in OFF either
      return res.json({ found: false });
    }

    const name =
      offData.product.product_name ||
      offData.product.generic_name ||
      'Unknown Product';

    // 3. Decide food_type
    // For now, TEMP: map everything to 'Other' or a known food_type id
    // You can improve this later with smarter category matching.
    const defaultFoodTypeId = 1; // e.g. Apples / Fruit etc. Adjust to a real id in your food_types table.

    // 4. Insert new product with barcode
    const insertProduct = await pool.query(
      `INSERT INTO products (name, barcode, food_type)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [name, barcode, defaultFoodTypeId]
    );

    const newProductId = insertProduct.rows[0].id;

    // 5. Ensure product_store row exists (FK requirement for user_products)
    // TEMP: assume Tesco (store_id = 1) and price 0.00
    await pool.query(
      `INSERT INTO product_store (product_id, store_id, price)
       VALUES ($1, $2, $3)
       ON CONFLICT (product_id, store_id) DO NOTHING`,
      [newProductId, 1, 0.00]
    );

    return res.json({
      found: true,
      product_id: newProductId,
      product_name: name,
      store_id: 1,
      store_name: 'Tesco',
      expiry_date: null
    });

  } catch (err) {
    console.error('Scan error:', err);
    res.status(500).json({ message: 'Server error while scanning' });
  }
});


//  USER ADDS PRODUCT TO THEIR INVENTORY
//  - Respects FK to product_store via (product_id, store_id)

app.post('/user/addProduct', async (req, res) => {
  const { userId, productId, storeId, expiryDate } = req.body;

  if (!userId || !productId || !storeId || !expiryDate) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    // This will fail if (productId, storeId) is not present in product_store,
    // which we ensured in /scan.
    await pool.query(
      `INSERT INTO user_products (user_id, product_id, store_id, expiry_date)
       VALUES ($1, $2, $3, $4)`,
      [userId, productId, storeId, expiryDate]
    );

    res.json({ message: 'Product added successfully' });

  } catch (err) {
    console.error('Add product error:', err);
    res.status(500).json({ message: 'Server error adding product' });
  }
});


//  START SERVER

app.listen(3000, () => console.log('Server running on port 3000'));