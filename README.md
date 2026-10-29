# Baan Moom — คำนวณต้นทุน สต็อก และรายรับ-รายจ่ายร้านขนม

แอปใช้ภายในร้าน ออกแบบให้ใช้ง่ายบนมือถือ (ทุกหน้ามีปุ่ม **“วิธีใช้”** มุมขวาล่าง)

- **บันทึกยอดขาย** — ใส่จำนวนที่ขายได้ของแต่ละเมนู ระบบตัดวัตถุดิบออกจากสต็อกตามสูตรให้เอง
- **รายรับ-รายจ่าย** — ขายได้ / จ่ายไป / เหลือ รายวัน 7 วัน รายเดือน (ซื้อวัตถุดิบผ่าน “รับเข้า” นับเป็นรายจ่ายอัตโนมัติ)
- **สต็อกวัตถุดิบ** — รับเข้า เบิกใช้ ปรับยอด ต้นทุนเฉลี่ยถ่วงน้ำหนัก และประวัติทุกครั้ง
- **เมนู & สูตร** — ต้นทุนต่อชิ้นและกำไร คิดจากราคาวัตถุดิบจริง
- กดค้าง (หรือปุ่ม ⋯) เพื่อเปิดเมนู แก้ไข / ลบ — ลบผิดกด “เลิกทำ” ได้

| ส่วน | เทคโนโลยี | โฟลเดอร์ |
|---|---|---|
| หน้าเว็บ | Angular 21 + Tailwind | `frontend/` |
| API | Cloudflare Worker + Hono | `api/` |
| Database | Postgres (Neon) ผ่าน Hyperdrive | `api/db/schema.sql` |
| สูตรคำนวณ | ใช้ร่วมกันทั้งหน้าเว็บและ API | `frontend/src/app/core/domain/` |

Worker ตัวเดียวเสิร์ฟทั้งหน้าเว็บและ `/api/*` (โดเมนเดียวกัน ไม่ต้องตั้ง CORS)

## รันในเครื่อง

```bash
npm run setup     # ครั้งแรกครั้งเดียว: ติดตั้งทุกส่วน
npm run dev       # เปิด database + API + หน้าเว็บ พร้อมกัน → http://localhost:4200
```

- Database ในเครื่องใช้ PGlite (Postgres ในเครื่อง ไม่ต้องมี Docker/Neon) เก็บข้อมูลที่ `api/.pglite` — ลบโฟลเดอร์นี้ = เริ่มใหม่ว่าง ๆ
- อยากลองแบบไม่ต้องมี backend (ข้อมูลตัวอย่าง หายเมื่อรีเฟรช): `cd frontend && npm run dev:mock`
- ทดสอบ API: `npm test` (รันกับ Postgres จริงแบบ in-process)

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
4. Deploy (build หน้าเว็บ + อัป Worker): `npm run deploy` (ที่ root)
5. **ล็อกให้เฉพาะคนในบ้าน:** Cloudflare dashboard → Zero Trust → Access → Applications → เพิ่ม Self-hosted app ครอบโดเมนของ Worker (`banmoom.<บัญชี>.workers.dev`) → Policy: Allow, Emails = อีเมลคนในบ้าน (ฟรีถึง 50 คน, เข้าด้วยรหัส OTP ทางอีเมล)

ครั้งต่อไปแค่ `npm run deploy` — ถ้าแก้ `api/db/schema.sql` ให้รัน `npm run db:migrate` (ใน `api/`) ก่อน (รันซ้ำได้ปลอดภัย)

## กติกาที่ควรรู้

- **ขายแล้ววัตถุดิบในแอปไม่พอ:** ยอดขายยังบันทึกได้ (เงินเข้าจริง) สต็อกตัดเหลือ 0 และแจ้งว่าตัวไหนไม่พอ ให้ไป “รับเข้า” หรือ “ปรับยอด”
- **ยกเลิกรายการขาย:** คืนวัตถุดิบเท่าที่ตัดไปจริง
- **ลบ = ซ่อน:** วัตถุดิบ/เมนู/รายจ่ายที่ลบยังอยู่ในฐานข้อมูล (ประวัติไม่หาย) กู้คืนได้ด้วย “เลิกทำ”
- **วัตถุดิบที่ยังใช้อยู่ในสูตร** ลบไม่ได้ ต้องเอาออกจากสูตรก่อน
- วันที่ทั้งหมดเป็นเวลาไทย

## ยังไม่ได้ทำ

- สแกนสินค้า, ตั้งค่า, รูปเมนู
