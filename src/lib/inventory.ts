import type { InStatement } from "@libsql/client";
import { DEFAULT_PRODUCTS } from "@/lib/catalog";
import { databaseMode, db, ensureDbReady } from "@/lib/db";

export type ProductSummary = {
  id: number;
  slug: string;
  name: string;
  sku: string;
  description: string;
  highlight: string;
  displayOrder: number;
  totalUnits: number;
  availableUnits: number;
  assignedUnits: number;
  lastMovementAt: string | null;
  imagePath: string;
};

export type ProductUnit = {
  serialNumber: string;
  status: "available" | "assigned";
  provider: string | null;
  recipient: string | null;
  receivedDate: string | null;
  shippedDate: string | null;
};

export type MovementRecord = {
  id: number;
  type: "in" | "out";
  productSlug: string;
  productName: string;
  productSku: string;
  serialNumber: string;
  partnerName: string;
  movementDate: string;
  createdAt: string;
  unitStatus: "available" | "assigned";
};

export type ProductDetail = ProductSummary & {
  availableSerials: ProductUnit[];
  assignedSerials: ProductUnit[];
  recentMovements: MovementRecord[];
};

type ProductIdentity = {
  id: number;
  name: string;
};

type IncomingMovementInput = {
  slug: string;
  quantity: number;
  provider: string;
  movementDate: string;
  serialNumbers: string[];
};

type OutgoingMovementInput = {
  slug: string;
  quantity: number;
  recipient: string;
  movementDate: string;
  serialNumbers: string[];
};

type CreateProductInput = {
  name: string;
  sku: string;
  description: string;
  highlight: string;
  imagePath?: string;
};

function getRowValue(row: unknown, key: string) {
  return (row as Record<string, unknown>)[key];
}

function asString(row: unknown, key: string) {
  const value = getRowValue(row, key);
  return value == null ? "" : String(value);
}

function asNullableString(row: unknown, key: string) {
  const value = getRowValue(row, key);
  return value == null ? null : String(value);
}

function asNumber(row: unknown, key: string) {
  const value = getRowValue(row, key);
  if (typeof value === "number") {
    return value;
  }
  return Number(value ?? 0);
}

const productCatalog = new Map(DEFAULT_PRODUCTS.map((product) => [product.slug, product]));

function resolveImagePath(slug: string) {
  return productCatalog.get(slug)?.imagePath ?? "/logo.png";
}

function mapProductSummary(row: unknown): ProductSummary {
  const slug = asString(row, "slug");

  return {
    id: asNumber(row, "id"),
    slug,
    name: asString(row, "name"),
    sku: asString(row, "sku"),
    description: asString(row, "description"),
    highlight: asString(row, "highlight"),
    displayOrder: asNumber(row, "displayOrder"),
    totalUnits: asNumber(row, "totalUnits"),
    availableUnits: asNumber(row, "availableUnits"),
    assignedUnits: asNumber(row, "assignedUnits"),
    lastMovementAt: asNullableString(row, "lastMovementAt"),
    imagePath: resolveImagePath(slug),
  };
}

function mapUnit(row: unknown): ProductUnit {
  return {
    serialNumber: asString(row, "serialNumber"),
    status: asString(row, "status") === "assigned" ? "assigned" : "available",
    provider: asNullableString(row, "provider"),
    recipient: asNullableString(row, "recipient"),
    receivedDate: asNullableString(row, "receivedDate"),
    shippedDate: asNullableString(row, "shippedDate"),
  };
}

function mapMovement(row: unknown): MovementRecord {
  return {
    id: asNumber(row, "id"),
    type: asString(row, "type") === "out" ? "out" : "in",
    productSlug: asString(row, "productSlug"),
    productName: asString(row, "productName"),
    productSku: asString(row, "productSku"),
    serialNumber: asString(row, "serialNumber"),
    partnerName: asString(row, "partnerName"),
    movementDate: asString(row, "movementDate"),
    createdAt: asString(row, "createdAt"),
    unitStatus: asString(row, "unitStatus") === "assigned" ? "assigned" : "available",
  };
}

function normalizeSerialNumbers(serialNumbers: string[]) {
  const cleaned = serialNumbers
    .map((serialNumber) => serialNumber.trim())
    .filter(Boolean);

  const uniqueSerials = [...new Set(cleaned.map((serialNumber) => serialNumber.toUpperCase()))];

  if (uniqueSerials.length !== cleaned.length) {
    throw new Error("Hay numeros de serie duplicados en la operaci?n.");
  }

  return uniqueSerials;
}

function validateMovementDate(movementDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(movementDate)) {
    throw new Error("La fecha debe tener formato YYYY-MM-DD.");
  }
}

async function getProductIdentity(slug: string): Promise<ProductIdentity> {
  const result = await db.execute({
    sql: "SELECT id, name FROM products WHERE slug = ? LIMIT 1",
    args: [slug],
  });

  const row = result.rows[0];

  if (!row) {
    throw new Error("No se ha encontrado el producto seleccionado.");
  }

  return {
    id: asNumber(row, "id"),
    name: asString(row, "name"),
  };
}

async function getProductSummaryBySlug(slug: string) {
  const result = await db.execute({
    sql: `SELECT
      p.id,
      p.slug,
      p.name,
      p.sku,
      p.description,
      p.highlight,
      p.display_order AS displayOrder,
      (SELECT COUNT(*) FROM units u WHERE u.product_id = p.id) AS totalUnits,
      (SELECT COUNT(*) FROM units u WHERE u.product_id = p.id AND u.status = 'available') AS availableUnits,
      (SELECT COUNT(*) FROM units u WHERE u.product_id = p.id AND u.status = 'assigned') AS assignedUnits,
      (SELECT MAX(m.movement_date) FROM movements m WHERE m.product_id = p.id) AS lastMovementAt
    FROM products p
    WHERE p.slug = ?
    LIMIT 1`,
    args: [slug],
  });

  const row = result.rows[0];

  if (!row) {
    throw new Error("No se ha encontrado el producto seleccionado.");
  }

  return mapProductSummary(row);
}

export async function getProducts() {
  await ensureDbReady();

  const result = await db.execute(`SELECT
      p.id,
      p.slug,
      p.name,
      p.sku,
      p.description,
      p.highlight,
      p.display_order AS displayOrder,
      (SELECT COUNT(*) FROM units u WHERE u.product_id = p.id) AS totalUnits,
      (SELECT COUNT(*) FROM units u WHERE u.product_id = p.id AND u.status = 'available') AS availableUnits,
      (SELECT COUNT(*) FROM units u WHERE u.product_id = p.id AND u.status = 'assigned') AS assignedUnits,
      (SELECT MAX(m.movement_date) FROM movements m WHERE m.product_id = p.id) AS lastMovementAt
    FROM products p
    ORDER BY p.display_order ASC, p.name ASC`);

  return {
    products: result.rows.map(mapProductSummary),
    databaseMode,
  };
}

export async function getProductDetail(slug: string): Promise<ProductDetail> {
  await ensureDbReady();

  const product = await getProductSummaryBySlug(slug);
  const unitsResult = await db.execute({
    sql: `SELECT
      serial_number AS serialNumber,
      status,
      provider,
      recipient,
      received_date AS receivedDate,
      shipped_date AS shippedDate
    FROM units
    WHERE product_id = ?
    ORDER BY CASE status WHEN 'available' THEN 0 ELSE 1 END, serial_number ASC`,
    args: [product.id],
  });
  const movementsResult = await db.execute({
    sql: `SELECT
      m.id,
      m.movement_type AS type,
      p.slug AS productSlug,
      p.name AS productName,
      p.sku AS productSku,
      m.serial_number AS serialNumber,
      m.partner_name AS partnerName,
      m.movement_date AS movementDate,
      m.created_at AS createdAt,
      COALESCE(u.status, 'available') AS unitStatus
    FROM movements m
    INNER JOIN products p ON p.id = m.product_id
    LEFT JOIN units u ON u.product_id = m.product_id AND u.serial_number = m.serial_number
    WHERE m.product_id = ?
    ORDER BY m.movement_date DESC, m.id DESC
    LIMIT 20`,
    args: [product.id],
  });

  const units = unitsResult.rows.map(mapUnit);

  return {
    ...product,
    availableSerials: units.filter((unit) => unit.status === "available"),
    assignedSerials: units.filter((unit) => unit.status === "assigned"),
    recentMovements: movementsResult.rows.map(mapMovement),
  };
}

export async function getMovementTimeline() {
  await ensureDbReady();

  const result = await db.execute(`SELECT
      m.id,
      m.movement_type AS type,
      p.slug AS productSlug,
      p.name AS productName,
      p.sku AS productSku,
      m.serial_number AS serialNumber,
      m.partner_name AS partnerName,
      m.movement_date AS movementDate,
      m.created_at AS createdAt,
      COALESCE(u.status, 'available') AS unitStatus
    FROM movements m
    INNER JOIN products p ON p.id = m.product_id
    LEFT JOIN units u ON u.product_id = m.product_id AND u.serial_number = m.serial_number
    ORDER BY m.movement_date DESC, m.id DESC
    LIMIT 200`);

  return {
    movements: result.rows.map(mapMovement),
  };
}

export async function addUnits(input: IncomingMovementInput) {
  await ensureDbReady();

  const slug = input.slug.trim();
  const provider = input.provider.trim();
  const quantity = Number(input.quantity);
  const serialNumbers = normalizeSerialNumbers(input.serialNumbers);

  validateMovementDate(input.movementDate);

  if (!slug) {
    throw new Error("Selecciona un producto antes de registrar entradas.");
  }

  if (!provider) {
    throw new Error("Indica el proveedor de la entrada.");
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("La cantidad debe ser un entero mayor que cero.");
  }

  if (serialNumbers.length !== quantity) {
    throw new Error("La cantidad debe coincidir con el numero de series indicadas.");
  }

  const product = await getProductIdentity(slug);
  const placeholders = serialNumbers.map(() => "?").join(", ");
  const existingSerials = await db.execute({
    sql: `SELECT serial_number AS serialNumber FROM units WHERE serial_number IN (${placeholders})`,
    args: serialNumbers,
  });

  if (existingSerials.rows.length > 0) {
    const duplicates = existingSerials.rows.map((row) => asString(row, "serialNumber")).join(", ");
    throw new Error(`Estos numeros de serie ya existen: ${duplicates}.`);
  }

  const timestamp = new Date().toISOString();
  const statements: InStatement[] = serialNumbers.flatMap((serialNumber) => [
    {
      sql: `INSERT INTO units (
        product_id,
        serial_number,
        provider,
        recipient,
        received_date,
        shipped_date,
        status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, NULL, ?, NULL, 'available', ?, ?)`,
      args: [product.id, serialNumber, provider, input.movementDate, timestamp, timestamp],
    },
    {
      sql: `INSERT INTO movements (
        product_id,
        movement_type,
        serial_number,
        partner_name,
        movement_date,
        created_at
      ) VALUES (?, 'in', ?, ?, ?, ?)`,
      args: [product.id, serialNumber, provider, input.movementDate, timestamp],
    },
  ]);

  await db.batch(statements, "write");

  return {
    message: `${quantity} unidad${quantity === 1 ? "" : "es"} anadida${quantity === 1 ? "" : "s"} a ${product.name}.`,
  };
}

export async function removeUnits(input: OutgoingMovementInput) {
  await ensureDbReady();

  const slug = input.slug.trim();
  const recipient = input.recipient.trim();
  const quantity = Number(input.quantity);
  const serialNumbers = normalizeSerialNumbers(input.serialNumbers);

  validateMovementDate(input.movementDate);

  if (!slug) {
    throw new Error("Selecciona un producto antes de registrar salidas.");
  }

  if (!recipient) {
    throw new Error("Indica el destinatario de la salida.");
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("La cantidad debe ser un entero mayor que cero.");
  }

  if (serialNumbers.length !== quantity) {
    throw new Error("La cantidad debe coincidir con el numero de series indicadas.");
  }

  const product = await getProductIdentity(slug);
  const placeholders = serialNumbers.map(() => "?").join(", ");
  const availableUnits = await db.execute({
    sql: `SELECT serial_number AS serialNumber
      FROM units
      WHERE product_id = ?
        AND status = 'available'
        AND serial_number IN (${placeholders})`,
    args: [product.id, ...serialNumbers],
  });

  const availableSerials = availableUnits.rows.map((row) => asString(row, "serialNumber"));
  const missingSerials = serialNumbers.filter((serialNumber) => !availableSerials.includes(serialNumber));

  if (missingSerials.length > 0) {
    throw new Error(`No estan disponibles para salida: ${missingSerials.join(", ")}.`);
  }

  const timestamp = new Date().toISOString();
  const statements: InStatement[] = serialNumbers.flatMap((serialNumber) => [
    {
      sql: `UPDATE units
        SET recipient = ?, shipped_date = ?, status = 'assigned', updated_at = ?
        WHERE product_id = ? AND serial_number = ?`,
      args: [recipient, input.movementDate, timestamp, product.id, serialNumber],
    },
    {
      sql: `INSERT INTO movements (
        product_id,
        movement_type,
        serial_number,
        partner_name,
        movement_date,
        created_at
      ) VALUES (?, 'out', ?, ?, ?, ?)`,
      args: [product.id, serialNumber, recipient, input.movementDate, timestamp],
    },
  ]);

  await db.batch(statements, "write");

  return {
    message: `${quantity} unidad${quantity === 1 ? "" : "es"} registrada${quantity === 1 ? "" : "s"} como enviada${quantity === 1 ? "" : "s"}.`,
  };
}

export async function clearAllUnits() {
  await ensureDbReady();

  await db.execute("DELETE FROM units");

  return {
    message: "Se han eliminado todas las unidades del inventario operativo.",
  };
}

export async function clearAllMovements() {
  await ensureDbReady();

  await db.execute("DELETE FROM movements");

  return {
    message: "Se han eliminado todos los movimientos del inventario operativo.",
  };
}

export async function createCustomProduct(input: CreateProductInput) {
  await ensureDbReady();

  const name = input.name.trim();
  const sku = input.sku.trim();
  const description = input.description.trim();
  const highlight = input.highlight.trim();
  const imagePath = input.imagePath?.trim() || "/logo.png";

  if (!name || !sku) {
    throw new Error("El nombre y el SKU son obligatorios.");
  }

  // Generar slug a partir del nombre
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  // Verificar si ya existe el slug o el sku
  const existing = await db.execute({
    sql: "SELECT id FROM products WHERE slug = ? OR sku = ? LIMIT 1",
    args: [slug, sku],
  });

  if (existing.rows.length > 0) {
    throw new Error("Ya existe un producto con ese nombre o SKU.");
  }

  // Obtener el orden máximo actual
  const maxOrderResult = await db.execute("SELECT MAX(display_order) as maxOrder FROM products");
  const nextOrder = asNumber(maxOrderResult.rows[0], "maxOrder") + 1;

  await db.execute({
    sql: `INSERT INTO products (slug, name, sku, description, highlight, display_order)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [slug, name, sku, description, highlight, nextOrder],
  });

  // Nota: Si se quisiera guardar la imagen de forma permanente en el catálogo estático,
  // habría que modificar el archivo catalog.ts, pero como estamos usando DB,
  // el producto persistirá en la base de datos local/remota.
  
  return {
    message: `Producto "${name}" creado correctamente.`,
    product: { slug, name, sku },
  };
}
