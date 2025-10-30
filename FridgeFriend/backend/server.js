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

app.listen(3000, () => console.log('Server running on port 3000'));
