import { createClient, type Client, type InStatement } from "@libsql/client";
import { DEFAULT_PRODUCTS } from "@/lib/catalog";

declare global {
  var inventoryDbClient: Client | undefined;
  var inventoryDbReady: Promise<void> | undefined;
}

function readEnvValue(...candidates: Array<string | undefined>) {
  for (const candidate of candidates) {
    const normalized = candidate?.trim();
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
}

const databaseUrl = readEnvValue(process.env.TURSO_DATABASE_URL, process.env.DATABASE_URL) ?? "file:local.db";
const authToken = readEnvValue(process.env.TURSO_AUTH_TOKEN);

const inventoryDbClient =
  globalThis.inventoryDbClient ??
  createClient({
    url: databaseUrl,
    ...(authToken ? { authToken } : {}),
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.inventoryDbClient = inventoryDbClient;
}

export const db = inventoryDbClient;
export const databaseMode = databaseUrl.startsWith("file:") ? "local" : "remote";

export async function ensureDbReady() {
  if (!globalThis.inventoryDbReady) {
    globalThis.inventoryDbReady = initializeDatabase();
  }

  await globalThis.inventoryDbReady;
}

async function initializeDatabase() {
  const setupStatements: InStatement[] = [
    "PRAGMA foreign_keys = ON",
    `CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      sku TEXT NOT NULL,
      description TEXT NOT NULL,
      highlight TEXT NOT NULL,
      display_order INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      serial_number TEXT NOT NULL UNIQUE,
      provider TEXT,
      recipient TEXT,
      received_date TEXT,
      shipped_date TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      movement_type TEXT NOT NULL,
      serial_number TEXT NOT NULL,
      partner_name TEXT NOT NULL,
      movement_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
    )`,
    "CREATE INDEX IF NOT EXISTS idx_products_display_order ON products(display_order)",
    "CREATE INDEX IF NOT EXISTS idx_units_product_status ON units(product_id, status)",
    "CREATE INDEX IF NOT EXISTS idx_units_serial_number ON units(serial_number)",
    "CREATE INDEX IF NOT EXISTS idx_movements_product_date ON movements(product_id, movement_date DESC)",
  ];

  await db.batch(setupStatements, "write");

  const countResult = await db.execute("SELECT COUNT(*) AS total FROM products");
  const totalProducts = Number(countResult.rows[0]?.total ?? 0);

  if (totalProducts > 0) {
    return;
  }

  await db.batch(
    DEFAULT_PRODUCTS.map((product) => ({
      sql: `INSERT INTO products (slug, name, sku, description, highlight, display_order)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        product.slug,
        product.name,
        product.sku,
        product.description,
        product.highlight,
        product.displayOrder,
      ],
    })),
    "write"
  );
}
