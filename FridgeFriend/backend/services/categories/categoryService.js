import pool from "../../db.js";

function parseOptionalUserId(raw) {
  if (raw === undefined || raw === null) return null;
  if (Array.isArray(raw)) raw = raw[0];

  const s = String(raw).trim();
  if (!s) return null;

  const n = Number(s);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;

  return n;
}

export async function getCategories(userIdRaw) {
  const userId = parseOptionalUserId(userIdRaw);

  try {
    if (userId) {
      const result = await pool.query(
        `
        SELECT id, name, is_system, owner_user_id
        FROM categories
        WHERE is_system = true OR owner_user_id = $1
        ORDER BY is_system DESC, id ASC
        `,
        [userId],
      );

      return {
        status: 200,
        body: result.rows,
      };
    }

    const result = await pool.query(
      `
      SELECT id, name, is_system, owner_user_id
      FROM categories
      WHERE is_system = true
      ORDER BY id ASC
      `,
    );

    return {
      status: 200,
      body: result.rows,
    };
  } catch (err) {
    console.error("Categories error:", err);
    return {
      status: 500,
      body: { message: "Server error loading categories" },
    };
  }
}

export async function getFoodByCategoryId(categoryIdRaw, userIdRaw) {
  const categoryId = Number(categoryIdRaw);
  const userId = parseOptionalUserId(userIdRaw);

  if (!Number.isFinite(categoryId) || categoryId <= 0) {
    return {
      status: 400,
      body: { message: "Invalid category id" },
    };
  }

  try {
    if (userId) {
      const cat = await pool.query(
        `
        SELECT id
        FROM categories
        WHERE id = $1 AND (is_system = true OR owner_user_id = $2)
        LIMIT 1
        `,
        [categoryId, userId],
      );

      if (!cat.rows.length) {
        return { status: 200, body: [] };
      }
    } else {
      const cat = await pool.query(
        `
        SELECT id
        FROM categories
        WHERE id = $1 AND is_system = true
        LIMIT 1
        `,
        [categoryId],
      );

      if (!cat.rows.length) {
        return { status: 200, body: [] };
      }
    }

    if (userId) {
      const result = await pool.query(
        `
        SELECT id, category, name, is_system, owner_user_id
        FROM food_types
        WHERE category = $1
          AND (is_system = true OR owner_user_id = $2)
        ORDER BY is_system DESC, id ASC
        `,
        [categoryId, userId],
      );

      return {
        status: 200,
        body: result.rows,
      };
    }

    const result = await pool.query(
      `
      SELECT id, category, name, is_system, owner_user_id
      FROM food_types
      WHERE category = $1 AND is_system = true
      ORDER BY id ASC
      `,
      [categoryId],
    );

    return {
      status: 200,
      body: result.rows,
    };
  } catch (err) {
    console.error("Food types error:", err);
    return {
      status: 500,
      body: { message: "Server error loading food types" },
    };
  }
}

export default {
  getCategories,
  getFoodByCategoryId,
};