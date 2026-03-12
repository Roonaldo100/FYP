import pool from "../../db.js";

export async function addCategoryToUser(userIdRaw, nameRaw) {
  const userId = Number(userIdRaw);
  const name = String(nameRaw || "").trim();

  if (!Number.isInteger(userId) || userId <= 0) {
    return { status: 400, body: { message: "Invalid userId" } };
  }

  if (!name) {
    return { status: 400, body: { message: "Missing category name" } };
  }

  if (name.length > 20) {
    return {
      status: 400,
      body: { message: "Category name must be <= 20 characters" },
    };
  }

  try {
    const u = await pool.query(`SELECT 1 FROM users WHERE id = $1 LIMIT 1`, [
      userId,
    ]);

    if (!u.rows.length) {
      return { status: 404, body: { message: "User not found" } };
    }

    const inserted = await pool.query(
      `
      INSERT INTO categories (name, is_system, owner_user_id)
      VALUES ($1, false, $2)
      RETURNING id, name, is_system, owner_user_id
      `,
      [name, userId],
    );

    return {
      status: 201,
      body: {
        category: {
          id: Number(inserted.rows[0].id),
          name: String(inserted.rows[0].name),
          is_system: Boolean(inserted.rows[0].is_system),
          owner_user_id: inserted.rows[0].owner_user_id ?? null,
        },
      },
    };
  } catch (e) {
    if (e?.code === "23505") {
      return {
        status: 409,
        body: { message: "You already have a category with that name" },
      };
    }

    console.error("Create category error:", e);
    return {
      status: 500,
      body: { message: "Server error creating category" },
    };
  }
}

export async function removeCategoryFromUser(userIdRaw, categoryIdRaw) {
  const userId = Number(userIdRaw);
  const categoryId = Number(categoryIdRaw);

  if (
    !Number.isInteger(userId) ||
    userId <= 0 ||
    !Number.isInteger(categoryId) ||
    categoryId <= 0
  ) {
    return {
      status: 400,
      body: { message: "Invalid userId or categoryId" },
    };
  }

  try {
    const cat = await pool.query(
      `
      SELECT id
      FROM categories
      WHERE id = $1 AND is_system = false AND owner_user_id = $2
      LIMIT 1
      `,
      [categoryId, userId],
    );

    if (!cat.rows.length) {
      return {
        status: 404,
        body: { message: "Category not found (or not owned by user)" },
      };
    }

    const usage = await pool.query(
      `
      SELECT COUNT(*)::int AS n
      FROM products p
      JOIN food_types ft ON ft.id = p.food_type
      WHERE ft.category = $1
      `,
      [categoryId],
    );

    const n = Number(usage.rows[0]?.n ?? 0);

    if (n > 0) {
      return {
        status: 409,
        body: {
          message:
            "Category is in use by products. Move/delete those products (or change their food type) before deleting this category.",
          products_using_category: n,
        },
      };
    }

    await pool.query(
      `DELETE FROM categories WHERE id = $1 AND is_system = false AND owner_user_id = $2`,
      [categoryId, userId],
    );

    return { status: 200, body: { deleted: true } };
  } catch (e) {
    console.error("Delete category error:", e);
    return {
      status: 500,
      body: { message: "Server error deleting category" },
    };
  }
}

export async function addFoodTypeToUserCategory(
  userIdRaw,
  categoryIdRaw,
  nameRaw,
) {
  const userId = Number(userIdRaw);
  const categoryId = Number(categoryIdRaw);
  const name = String(nameRaw || "").trim();

  if (
    !Number.isInteger(userId) ||
    userId <= 0 ||
    !Number.isInteger(categoryId) ||
    categoryId <= 0
  ) {
    return {
      status: 400,
      body: { message: "Invalid userId or categoryId" },
    };
  }

  if (!name) {
    return { status: 400, body: { message: "Missing food type name" } };
  }

  if (name.length > 20) {
    return {
      status: 400,
      body: { message: "Food type name must be <= 20 characters" },
    };
  }

  try {
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
      return {
        status: 404,
        body: { message: "Category not found for this user" },
      };
    }

    const inserted = await pool.query(
      `
      INSERT INTO food_types (category, name, is_system, owner_user_id)
      VALUES ($1, $2, false, $3)
      RETURNING id, category, name, is_system, owner_user_id
      `,
      [categoryId, name, userId],
    );

    return {
      status: 201,
      body: {
        food_type: {
          id: Number(inserted.rows[0].id),
          category: Number(inserted.rows[0].category),
          name: String(inserted.rows[0].name),
          is_system: Boolean(inserted.rows[0].is_system),
          owner_user_id: inserted.rows[0].owner_user_id ?? null,
        },
      },
    };
  } catch (e) {
    if (e?.code === "23505") {
      return {
        status: 409,
        body: {
          message: "You already have that food type name in this category",
        },
      };
    }

    console.error("Create food type error:", e);
    return {
      status: 500,
      body: { message: "Server error creating food type" },
    };
  }
}

export async function removeFoodTypeFromUser(userIdRaw, foodTypeIdRaw) {
  const userId = Number(userIdRaw);
  const foodTypeId = Number(foodTypeIdRaw);

  if (
    !Number.isInteger(userId) ||
    userId <= 0 ||
    !Number.isInteger(foodTypeId) ||
    foodTypeId <= 0
  ) {
    return {
      status: 400,
      body: { message: "Invalid userId or foodTypeId" },
    };
  }

  try {
    const ft = await pool.query(
      `
      SELECT id
      FROM food_types
      WHERE id = $1 AND is_system = false AND owner_user_id = $2
      LIMIT 1
      `,
      [foodTypeId, userId],
    );

    if (!ft.rows.length) {
      return {
        status: 404,
        body: { message: "Food type not found (or not owned by user)" },
      };
    }

    const usage = await pool.query(
      `SELECT COUNT(*)::int AS n FROM products WHERE food_type = $1`,
      [foodTypeId],
    );

    const n = Number(usage.rows[0]?.n ?? 0);

    if (n > 0) {
      return {
        status: 409,
        body: {
          message:
            "Food type is in use by products. Change those products to a different food type before deleting this one.",
          products_using_food_type: n,
        },
      };
    }

    await pool.query(
      `DELETE FROM food_types WHERE id = $1 AND is_system = false AND owner_user_id = $2`,
      [foodTypeId, userId],
    );

    return { status: 200, body: { deleted: true } };
  } catch (e) {
    console.error("Delete food type error:", e);
    return {
      status: 500,
      body: { message: "Server error deleting food type" },
    };
  }
}

export async function getUserFoodType(userIdRaw, foodTypeIdRaw) {
  const userId = Number(userIdRaw);
  const foodTypeId = Number(foodTypeIdRaw);

  try {
    const q = `
      SELECT
        p.id AS product_id,
        p.name AS product_name,
        s.id AS store_id,
        s.name AS store_name,
        COUNT(up.id) AS quantity,
        MIN(up.expiry_date) AS nearest_expiry,
        upp.last_price AS last_price
      FROM user_products up
      JOIN products p ON p.id = up.product_id
      LEFT JOIN stores s ON s.id = up.store_id
      LEFT JOIN user_product_prices upp
        ON upp.user_id = up.user_id
      AND upp.product_id = up.product_id
      AND upp.store_id IS NOT DISTINCT FROM up.store_id
      WHERE up.user_id = $1 AND p.food_type = $2
      GROUP BY
        p.id,
        p.name,
        s.id,
        s.name,
        upp.last_price
      ORDER BY p.name;
    `;

    const result = await pool.query(q, [userId, foodTypeId]);

    return {
      status: 200,
      body: result.rows,
    };
  } catch (err) {
    console.error("User product fetch error:", err);
    return {
      status: 500,
      body: { message: "Server error" },
    };
  }
}

export default {
  addCategoryToUser,
  removeCategoryFromUser,
  addFoodTypeToUserCategory,
  removeFoodTypeFromUser,
  getUserFoodType,
};