import pool from "../../db.js";

export async function deleteUsageRow(userId, productId) {
  const uid = Number(userId);
  const pid = Number(productId);

  if (!Number.isInteger(uid) || uid <= 0) {
    const err = new Error("Invalid userId");
    err.statusCode = 400;
    throw err;
  }

  if (!Number.isInteger(pid) || pid <= 0) {
    const err = new Error("Invalid productId");
    err.statusCode = 400;
    throw err;
  }

  try {
    const del = await pool.query(
      `
      DELETE FROM user_product_usage
      WHERE user_id = $1
        AND product_id = $2
      RETURNING user_id, product_id
      `,
      [uid, pid]
    );

    if (!del.rows.length) {
      const err = new Error("Frequently used row not found");
      err.statusCode = 404;
      throw err;
    }

    return { message: "Frequently used item deleted" };
  } catch (err) {
    if (err.statusCode) throw err;
    console.error("Delete user_product_usage error:", err);
    const e = new Error("Server error deleting frequently used item");
    e.statusCode = 500;
    throw e;
  }
}

export default {
  deleteUsageRow,
};