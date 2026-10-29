# Baan Moom — คำนวณต้นทุน & สต็อกร้านขนม

แอปใช้ภายในร้าน: สต็อกวัตถุดิบ (ต้นทุนเฉลี่ยถ่วงน้ำหนัก + ประวัติทุกครั้ง), สูตรขนม/เมนู, คำนวณต้นทุนต่อชิ้นและกำไร

| ส่วน | เทคโนโลยี | โฟลเดอร์ |
|---|---|---|
| หน้าเว็บ | Angular 21 + Tailwind | `frontend/` |
| API | Cloudflare Worker + Hono | `api/` |
| Database | Postgres (Neon) ผ่าน Hyperdrive | `api/db/schema.sql` |
| สูตรคำนวณ | ใช้ร่วมกันทั้งหน้าเว็บและ API | `frontend/src/app/core/domain/` |

Worker ตัวเดียวเสิร์ฟทั้งหน้าเว็บและ `/api/*` (โดเมนเดียวกัน ไม่ต้องตั้ง CORS)

## รันในเครื่อง

**แบบข้อมูลตัวอย่าง (ไม่ต้องมี backend)** — ข้อมูลหายเมื่อรีเฟรช

```bash
cd frontend
npm install
npm run dev            # http://localhost:4200
```

**แบบต่อ API + database จริงในเครื่อง** (ไม่ต้องมี Docker/Neon: ใช้ PGlite = Postgres ในเครื่อง เก็บข้อมูลที่ `api/.pglite`)

```bash
cd api && npm install
npm run dev:db         # หน้าต่างที่ 1: database ที่ 127.0.0.1:54329
npm run dev            # หน้าต่างที่ 2: Worker ที่ http://127.0.0.1:8787
cd ../frontend
npm run dev:api        # หน้าต่างที่ 3: http://localhost:4200 (ส่ง /api ต่อไปที่ Worker)
```

ทดสอบ API: `cd api && npm test` (รันกับ Postgres จริงแบบ in-process ทุกครั้ง)

## Deploy ขึ้น Cloudflare (ครั้งแรก)

1. สร้าง database ที่ [Neon](https://neon.tech) แล้ว copy connection string
2. สร้างตาราง:
   ```bash
   cd api
   cp .env.example .env      # ใส่ DATABASE_URL ของ Neon
   npm run db:migrate
   ```
3. ผูก Cloudflare กับ Neon:
   ```bash
   npx wrangler login
   npx wrangler hyperdrive create banmoom-db --connection-string="<Neon pooled connection string>"
   ```
   เอา `id` ที่ได้ไปแทน `REPLACE_WITH_HYPERDRIVE_ID` ใน `api/wrangler.jsonc`
4. Deploy (build หน้าเว็บ + อัป Worker):
   ```bash
   npm run deploy
   ```
5. **ล็อกให้เฉพาะคนในบ้าน:** Cloudflare dashboard → Zero Trust → Access → Applications → เพิ่ม Self-hosted app ครอบโดเมนของ Worker (`banmoom.<บัญชี>.workers.dev`) → Policy: Allow, Emails = อีเมลคนในบ้าน (ฟรีถึง 50 คน, เข้าด้วยรหัส OTP ทางอีเมล)

ครั้งต่อไปแค่ `cd api && npm run deploy` (ถ้าแก้ `db/schema.sql` ให้รัน `npm run db:migrate` ก่อน)

## ยังไม่ได้ทำ

- ออเดอร์/ยอดขาย (หน้าแรกจึงแสดงยอดขายเป็น 0 เมื่อต่อ API จริง), สแกนสินค้า, รายงาน, ตั้งค่า
- รูปเมนู
