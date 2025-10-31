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

// USER LOGIN (basic, no hashing yet)
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

