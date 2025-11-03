import express from 'express';
import cors from 'cors';
import pool from './db.js';

const app = express();
app.use(cors());
app.use(express.json());

// Get all categories
app.get('/categories', async (req, res) => {
  const result = await pool.query('SELECT * FROM categories ORDER BY id');
  res.json(result.rows);
});

// Get food types for a specific category
app.get('/categories/:id/food', async (req, res) => {
  const { id } = req.params;
  const result = await pool.query(
    'SELECT * FROM food_types WHERE category = $1 ORDER BY id',
    [id]
  );
  res.json(result.rows);
});

// Get a user's products for a given food type
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
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.listen(3000, () => console.log('Server running on port 3000'));

// USER LOGIN
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
    res.json({ message: 'Login successful', user_id: user.id, username: user.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});




