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

export async function scanBarcode({ barcode, userId }) {
  const uid = parseOptionalUserId(userId);

  const cleanBarcode = String(barcode ?? "").trim();
  if (!cleanBarcode) {
    const err = new Error("Missing barcode");
    err.statusCode = 400;
    err.payload = { found: false, message: "Missing barcode" };
    throw err;
  }

  try {
    const localProduct = uid
      ? await pool.query(
          `
          SELECT id, name
          FROM products
          WHERE barcode = $1
            AND (is_system = true OR owner_user_id = $2)
          LIMIT 1
          `,
          [cleanBarcode, uid],
        )
      : await pool.query(
          `
          SELECT id, name
          FROM products
          WHERE barcode = $1
            AND is_system = true
          LIMIT 1
          `,
          [cleanBarcode],
        );

    if (localProduct.rows.length > 0) {
      const product = localProduct.rows[0];

      const storeJoin = uid
        ? await pool.query(
            `
            SELECT s.id AS store_id, s.name AS store_name
            FROM product_store ps
            JOIN stores s ON s.id = ps.store_id
            WHERE ps.product_id = $1
              AND (s.is_system = true OR s.owner_user_id = $2)
            ORDER BY s.is_system DESC, s.name ASC
            LIMIT 1
            `,
            [product.id, uid],
          )
        : await pool.query(
            `
            SELECT s.id AS store_id, s.name AS store_name
            FROM product_store ps
            JOIN stores s ON s.id = ps.store_id
            WHERE ps.product_id = $1
              AND s.is_system = true
            ORDER BY s.name ASC
            LIMIT 1
            `,
            [product.id],
          );

      const storeRow = storeJoin.rows[0] || null;

      return {
        found: true,
        product_id: Number(product.id),
        product_name: String(product.name),
        store_id: storeRow ? Number(storeRow.store_id) : null,
        store_name: storeRow ? String(storeRow.store_name) : null,
        needs_classification: false,
        barcode: cleanBarcode,
      };
    }

    const offRes = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(
        cleanBarcode,
      )}.json`,
    );

    if (!offRes.ok) {
      const txt = await offRes.text().catch(() => "");
      console.warn("OpenFoodFacts non-OK:", offRes.status, txt);

      return {
        found: false,
        message: "Barcode lookup failed",
        barcode: cleanBarcode,
      };
    }

    const offData = await offRes.json();

    if (!offData || offData.status === 0) {
      return { found: false, barcode: cleanBarcode };
    }

    const name = String(
      offData.product?.product_name ||
        offData.product?.generic_name ||
        "Unnamed Product",
    ).trim();

    return {
      found: true,
      product_id: null,
      product_name: name || "Unnamed Product",
      store_id: null,
      store_name: null,
      needs_classification: true,
      barcode: cleanBarcode,
    };
  } catch (err) {
    console.error("Scan error:", err);
    const error = new Error("Server error while scanning");
    error.statusCode = 500;
    error.payload = {
      found: false,
      message: "Server error while scanning",
    };
    throw error;
  }
}

export default {
  scanBarcode,
};