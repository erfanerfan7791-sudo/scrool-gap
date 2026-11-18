const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL. Add a PostgreSQL database and set DATABASE_URL.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("localhost")
    ? false
    : { rejectUnauthorized: false }
});

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "20kb" }));
app.use(express.static("public"));

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "تعداد درخواست‌ها زیاد است. کمی بعد دوباره امتحان کن." }
});

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS members (
      id BIGSERIAL PRIMARY KEY,
      display_name VARCHAR(30) NOT NULL,
      eitaa_id VARCHAR(40) NOT NULL UNIQUE,
      points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log("Database is ready.");
}

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.get("/api/stats", async (req, res) => {
  try {
    const result = await pool.query("SELECT COUNT(*)::int AS member_count FROM members");
    res.json({ memberCount: result.rows[0].member_count });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "خطا در دریافت آمار." });
  }
});

app.get("/api/leaderboard", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT display_name AS name, eitaa_id AS eitaaId, points
      FROM members
      ORDER BY points DESC, created_at ASC
      LIMIT 100
    `);
    res.json({ members: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "خطا در دریافت جدول رتبه‌بندی." });
  }
});

app.post("/api/members", registerLimiter, async (req, res) => {
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  let eitaaId = typeof req.body.eitaaId === "string" ? req.body.eitaaId.trim() : "";

  if (name.length < 2 || name.length > 30) {
    return res.status(400).json({ error: "نام باید بین ۲ تا ۳۰ کاراکتر باشد." });
  }
  if (!/^@?[A-Za-z0-9_]{3,39}$/.test(eitaaId)) {
    return res.status(400).json({ error: "آیدی معتبر نیست. فقط حروف انگلیسی، عدد و _ مجاز است." });
  }

  eitaaId = "@" + eitaaId.replace(/^@/, "").toLowerCase();

  try {
    const result = await pool.query(
      `INSERT INTO members (display_name, eitaa_id)
       VALUES ($1, $2)
       ON CONFLICT (eitaa_id) DO NOTHING
       RETURNING display_name AS name, eitaa_id AS "eitaaId", points`,
      [name, eitaaId]
    );

    if (result.rowCount === 0) {
      return res.status(409).json({ error: "این آیدی قبلاً ثبت شده است." });
    }

    res.status(201).json({ member: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "ثبت‌نام انجام نشد. دوباره تلاش کن." });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: "صفحه موردنظر پیدا نشد." });
});

initializeDatabase()
  .then(() => app.listen(PORT, () => console.log(`Scrool Gap running on ${PORT}`)))
  .catch(error => {
    console.error("Database initialization failed:", error);
    process.exit(1);
  });
