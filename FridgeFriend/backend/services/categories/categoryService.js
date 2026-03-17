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

  if (!Number.isFinite(categoryId) || !Number.isInteger(categoryId) || categoryId <= 0) {
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
        WHERE id = $1
          AND (is_system = true OR owner_user_id = $2)
        LIMIT 1
        `,
        [categoryId, userId],
      );

      if (!cat.rows.length) {
        return { status: 200, body: [] };
      }

      const result = await pool.query(
        `
        SELECT
          ft.id,
          ft.category,
          ft.name,
          ft.is_system,
          ft.owner_user_id,
          COUNT(up.product_id)::int AS product_count
        FROM food_types ft
        LEFT JOIN products p
          ON p.food_type = ft.id
        LEFT JOIN user_products up
          ON up.product_id = p.id
         AND up.user_id = $2
        WHERE ft.category = $1
          AND (ft.is_system = true OR ft.owner_user_id = $2)
        GROUP BY
          ft.id,
          ft.category,
          ft.name,
          ft.is_system,
          ft.owner_user_id
        ORDER BY ft.is_system DESC, ft.id ASC
        `,
        [categoryId, userId],
      );

      return {
        status: 200,
        body: result.rows,
      };
    }

    const cat = await pool.query(
      `
      SELECT id
      FROM categories
      WHERE id = $1
        AND is_system = true
      LIMIT 1
      `,
      [categoryId],
    );

    if (!cat.rows.length) {
      return { status: 200, body: [] };
    }

    const result = await pool.query(
      `
      SELECT
        ft.id,
        ft.category,
        ft.name,
        ft.is_system,
        ft.owner_user_id,
        0::int AS product_count
      FROM food_types ft
      WHERE ft.category = $1
        AND ft.is_system = true
      ORDER BY ft.is_system DESC, ft.id ASC
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