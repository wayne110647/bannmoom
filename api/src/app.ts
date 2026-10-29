import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { Db, DbHandle } from './db';
import { ApiError } from './errors';
import {
  archiveIngredient, createIngredient, getIngredient, listIngredients, listTransactions, recordAdjustment, recordUsage, stockIn,
  restoreIngredient, updateIngredient,
} from './services/ingredients';
import {
  archiveProduct, createRecipe, dashboardSummary, getRecipe, listProducts, listRecipes, restoreProduct,
  saveCostCalculation, updateRecipe,
} from './services/recipes';
import {
  adjustmentSchema, costCalculationSchema, ingredientSchema, menuRecipeSchema, newIngredientSchema, stockInSchema,
  usageSchema,
} from './validation';

export interface Bindings {
  HYPERDRIVE: Hyperdrive;
  ASSETS: Fetcher;
}

type AppEnv = { Bindings: Bindings; Variables: { db: Db } };

/** Parse and validate the JSON body; anything malformed becomes a 400 with a Thai message. */
async function body<S extends z.ZodType>(c: Context<AppEnv>, schema: S): Promise<z.output<S>> {
  const json = await c.req.json().catch(() => {
    throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
  });
  return schema.parse(json);
}

/** `openDb` is injected so tests can run the same routes against an in-process Postgres. */
export function createApp(openDb: (env: Bindings) => Promise<DbHandle>) {
  const app = new Hono<AppEnv>().basePath('/api');

  app.use(async (c, next) => {
    const handle = await openDb(c.env);
    c.set('db', handle.db);
    try {
      await next();
    } finally {
      await handle.close();
    }
  });

  app.onError((err, c) => {
    if (err instanceof ApiError) return c.json({ message: err.message }, err.status);
    if (err instanceof z.ZodError) {
      return c.json({ message: 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง', issues: err.issues }, 400);
    }
    console.error(err);
    return c.json({ message: 'ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง' }, 500);
  });

  app.notFound((c) => c.json({ message: 'ไม่พบข้อมูลที่ต้องการ' }, 404));

  /* ---------- Ingredients & stock ---------- */
  app.get('/ingredients', async (c) => c.json(await listIngredients(c.var.db)));
  app.post('/ingredients', async (c) => c.json(await createIngredient(c.var.db, await body(c, newIngredientSchema)), 201));
  app.get('/ingredients/:id', async (c) => c.json(await getIngredient(c.var.db, c.req.param('id'))));
  app.put('/ingredients/:id', async (c) =>
    c.json(await updateIngredient(c.var.db, c.req.param('id'), await body(c, ingredientSchema))),
  );
  app.delete('/ingredients/:id', async (c) => {
    await archiveIngredient(c.var.db, c.req.param('id'));
    return c.body(null, 204);
  });
  app.post('/ingredients/:id/restore', async (c) => c.json(await restoreIngredient(c.var.db, c.req.param('id'))));
  app.get('/ingredients/:id/transactions', async (c) => c.json(await listTransactions(c.var.db, c.req.param('id'))));
  app.post('/ingredients/:id/stock-in', async (c) =>
    c.json(await stockIn(c.var.db, c.req.param('id'), await body(c, stockInSchema))),
  );
  app.post('/ingredients/:id/usages', async (c) =>
    c.json(await recordUsage(c.var.db, c.req.param('id'), await body(c, usageSchema))),
  );
  app.post('/ingredients/:id/adjustments', async (c) =>
    c.json(await recordAdjustment(c.var.db, c.req.param('id'), await body(c, adjustmentSchema))),
  );

  /* ---------- Menu & recipes ---------- */
  app.get('/products', async (c) => c.json(await listProducts(c.var.db)));
  /** Deletes the menu item and its recipe (archived, so undo works). */
  app.delete('/products/:id', async (c) => {
    await archiveProduct(c.var.db, c.req.param('id'));
    return c.body(null, 204);
  });
  app.post('/products/:id/restore', async (c) => {
    await restoreProduct(c.var.db, c.req.param('id'));
    return c.body(null, 204);
  });
  app.get('/recipes', async (c) => c.json(await listRecipes(c.var.db)));
  app.post('/recipes', async (c) => c.json(await createRecipe(c.var.db, await body(c, menuRecipeSchema)), 201));
  app.get('/recipes/:id', async (c) => c.json(await getRecipe(c.var.db, c.req.param('id'))));
  app.put('/recipes/:id', async (c) =>
    c.json(await updateRecipe(c.var.db, c.req.param('id'), await body(c, menuRecipeSchema))),
  );
  app.post('/cost-calculations', async (c) =>
    c.json(await saveCostCalculation(c.var.db, await body(c, costCalculationSchema)), 201),
  );

  /* ---------- Reports ---------- */
  app.get('/reports/summary', async (c) => c.json(await dashboardSummary(c.var.db)));

  return app;
}
