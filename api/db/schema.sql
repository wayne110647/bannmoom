-- Baan Moom schema. Idempotent: `npm run db:migrate` can run it any number of times.
-- Quantities are stored in each ingredient's BASE unit (g, ml, egg, piece).
-- numeric (not float) so money and grams never drift.

CREATE TABLE IF NOT EXISTS ingredients (
  id                     text PRIMARY KEY,
  name                   text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  category               text NOT NULL,
  base_unit              text NOT NULL CHECK (base_unit IN ('g', 'ml', 'egg', 'piece')),
  display_unit           text NOT NULL,
  quantity_on_hand       numeric(18, 6) NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  min_quantity           numeric(18, 6) NOT NULL DEFAULT 0 CHECK (min_quantity >= 0),
  avg_cost_per_base_unit numeric(18, 6) CHECK (avg_cost_per_base_unit >= 0),
  nearest_expiry         date,
  updated_at             timestamptz NOT NULL DEFAULT now(),
  -- Deleting only archives: stock history keeps pointing at the row, and undo can bring it back.
  archived_at            timestamptz
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
  created_at  timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

-- A recipe belongs to at most one product; products.recipeId is derived from this link.
CREATE TABLE IF NOT EXISTS recipes (
  id             text PRIMARY KEY,
  name           text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  product_id     text UNIQUE REFERENCES products (id),
  yield_qty      numeric(12, 3) NOT NULL CHECK (yield_qty > 0),
  packaging_cost numeric(12, 2) NOT NULL DEFAULT 0 CHECK (packaging_cost >= 0),
  labor_cost     numeric(12, 2) NOT NULL DEFAULT 0 CHECK (labor_cost >= 0),
  other_cost     numeric(12, 2) NOT NULL DEFAULT 0 CHECK (other_cost >= 0),
  created_at     timestamptz NOT NULL DEFAULT now(),
  archived_at    timestamptz
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

-- ---------- Archive (soft delete) ----------
-- Brings databases created before archiving existed up to date; no-ops on fresh ones.
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE products ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE ingredients DROP CONSTRAINT IF EXISTS ingredients_name_key;
ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_name_key;

-- Names only need to be unique among items that are still in use, so a deleted name can be reused.
CREATE UNIQUE INDEX IF NOT EXISTS ingredients_name_active_key ON ingredients (name) WHERE archived_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS recipes_name_active_key ON recipes (name) WHERE archived_at IS NULL;

-- ---------- Sales & money ----------
-- A sale is one "บันทึกยอดขาย" entry (often a whole day's count). sold_on is the shop's date (Thai time).
CREATE TABLE IF NOT EXISTS sales (
  id         text PRIMARY KEY,
  sold_on    date NOT NULL,
  total      numeric(12, 2) NOT NULL CHECK (total >= 0),
  note       text CHECK (char_length(note) <= 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Cancelled entries keep their rows; their stock was given back by sale_reversal transactions.
  voided_at  timestamptz
);

CREATE INDEX IF NOT EXISTS sales_sold_on_idx ON sales (sold_on);

-- name/price/cost are copied at sale time, so later menu edits don't rewrite past income.
CREATE TABLE IF NOT EXISTS sale_items (
  sale_id    text NOT NULL REFERENCES sales (id) ON DELETE CASCADE,
  position   smallint NOT NULL,
  product_id text NOT NULL REFERENCES products (id),
  name       text NOT NULL,
  sale_unit  text NOT NULL,
  quantity   numeric(12, 3) NOT NULL CHECK (quantity > 0),
  unit_price numeric(12, 2) NOT NULL CHECK (unit_price >= 0),
  -- Cost per unit from the recipe at sale time; null when the menu has no recipe or prices are missing.
  unit_cost  numeric(14, 4),
  PRIMARY KEY (sale_id, position)
);

CREATE TABLE IF NOT EXISTS expenses (
  id          text PRIMARY KEY,
  spent_on    date NOT NULL,
  category    text NOT NULL,
  amount      numeric(12, 2) NOT NULL CHECK (amount > 0),
  note        text CHECK (char_length(note) <= 200),
  created_at  timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE INDEX IF NOT EXISTS expenses_spent_on_idx ON expenses (spent_on);

-- Which sale a 'sale' / 'sale_reversal' stock movement belongs to, so cancelling gives back exactly that.
ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS sale_id text REFERENCES sales (id);
CREATE INDEX IF NOT EXISTS stock_transactions_sale_idx ON stock_transactions (sale_id) WHERE sale_id IS NOT NULL;
