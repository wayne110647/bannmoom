-- Baan Moom schema. Idempotent: `npm run db:migrate` can run it any number of times.
-- Quantities are stored in each ingredient's BASE unit (g, ml, egg, piece).
-- numeric (not float) so money and grams never drift.

CREATE TABLE IF NOT EXISTS ingredients (
  id                     text PRIMARY KEY,
  name                   text NOT NULL UNIQUE CHECK (char_length(name) BETWEEN 1 AND 80),
  category               text NOT NULL,
  base_unit              text NOT NULL CHECK (base_unit IN ('g', 'ml', 'egg', 'piece')),
  display_unit           text NOT NULL,
  quantity_on_hand       numeric(18, 6) NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  min_quantity           numeric(18, 6) NOT NULL DEFAULT 0 CHECK (min_quantity >= 0),
  avg_cost_per_base_unit numeric(18, 6) CHECK (avg_cost_per_base_unit >= 0),
  nearest_expiry         date,
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- Every stock change is a row here; quantity_on_hand is never edited without one.
CREATE TABLE IF NOT EXISTS stock_transactions (
  id            text PRIMARY KEY,
  ingredient_id text NOT NULL REFERENCES ingredients (id),
  type          text NOT NULL CHECK (type IN ('opening', 'stock_in', 'usage', 'adjustment', 'sale', 'sale_reversal')),
  quantity      numeric(18, 6) NOT NULL,
  unit_cost     numeric(18, 6),
  balance_after numeric(18, 6) NOT NULL CHECK (balance_after >= 0),
  reason        text,
  note          text CHECK (char_length(note) <= 200),
  expiry_date   date,
  created_at    timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS stock_transactions_ingredient_idx ON stock_transactions (ingredient_id, created_at DESC);

CREATE TABLE IF NOT EXISTS products (
  id          text PRIMARY KEY,
  name        text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  category    text NOT NULL,
  description text NOT NULL DEFAULT '',
  image_url   text,
  sale_unit   text NOT NULL CHECK (char_length(sale_unit) BETWEEN 1 AND 20),
  sell_price  numeric(12, 2) NOT NULL CHECK (sell_price >= 0),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- A recipe belongs to at most one product; products.recipeId is derived from this link.
CREATE TABLE IF NOT EXISTS recipes (
  id             text PRIMARY KEY,
  name           text NOT NULL UNIQUE CHECK (char_length(name) BETWEEN 1 AND 80),
  product_id     text UNIQUE REFERENCES products (id),
  yield_qty      numeric(12, 3) NOT NULL CHECK (yield_qty > 0),
  packaging_cost numeric(12, 2) NOT NULL DEFAULT 0 CHECK (packaging_cost >= 0),
  labor_cost     numeric(12, 2) NOT NULL DEFAULT 0 CHECK (labor_cost >= 0),
  other_cost     numeric(12, 2) NOT NULL DEFAULT 0 CHECK (other_cost >= 0),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recipe_items (
  recipe_id     text NOT NULL REFERENCES recipes (id) ON DELETE CASCADE,
  ingredient_id text NOT NULL REFERENCES ingredients (id),
  position      smallint NOT NULL,
  quantity      numeric(18, 6) NOT NULL CHECK (quantity > 0),
  unit          text NOT NULL,
  PRIMARY KEY (recipe_id, ingredient_id)
);

CREATE TABLE IF NOT EXISTS cost_calculations (
  id             text PRIMARY KEY,
  recipe_id      text NOT NULL REFERENCES recipes (id) ON DELETE CASCADE,
  packaging_cost numeric(12, 2) NOT NULL,
  labor_cost     numeric(12, 2) NOT NULL,
  other_cost     numeric(12, 2) NOT NULL,
  yield_qty      numeric(12, 3) NOT NULL,
  sell_price     numeric(12, 2),
  total_cost     numeric(12, 2) NOT NULL,
  cost_per_piece numeric(12, 2) NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
