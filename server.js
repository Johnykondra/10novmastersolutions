const fs = require("node:fs");
const path = require("node:path");
const { randomBytes } = require("node:crypto");

const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const express = require("express");
const session = require("express-session");

const app = express();
const port = process.env.PORT || 3000;
const sessionSecret = process.env.SESSION_SECRET || (
  process.env.VERCEL ? randomBytes(32).toString("hex") : null
);

if (!sessionSecret) {
  throw new Error("SESSION_SECRET must be set in the environment or .env file.");
}

if (process.env.VERCEL) {
  app.set("trust proxy", 1);
  if (!process.env.SESSION_SECRET) {
    console.warn("SESSION_SECRET is not configured; sessions will reset when the Vercel function restarts.");
  }
  if (!process.env.DB_PATH) {
    console.warn("Using a temporary SQLite database on Vercel; data will not persist across function restarts.");
  }
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    }
  })
);
require("./services/repairPriceService");
app.use((req, res, next) => {
  const cart = req.session.cart || {};
  res.locals.cartCount = Object.values(cart).reduce((total, quantity) => {
    return total + (Number.isSafeInteger(quantity) && quantity > 0 ? quantity : 0);
  }, 0);
  res.locals.notice = req.session.notice || null;
  delete req.session.notice;
  res.locals.currentUser = req.session.user || null;
  res.locals.formatPrice = (priceFils) => {
    const price = priceFils / 100;
    return `AED ${price.toLocaleString("en-AE", {
      maximumFractionDigits: 2,
      minimumFractionDigits: Number.isInteger(price) ? 0 : 2
    })}`;
  };
  next();
});

app.get("/", (req, res) => {
  res.render("index");
});

app.use("/shop", require("./routes/shop"));
app.use("/cart", require("./routes/cart"));
app.use("/api/assistant", require("./routes/assistant"));
app.use("/", require("./routes/auth"));
app.use("/", require("./routes/account"));
app.use("/", require("./routes/admin"));
app.use("/", require("./routes/checkout"));
app.use("/", require("./routes/tracking"));
app.use("/repairs", require("./routes/repairs"));

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).send("Something went wrong while processing your request.");
});

app.listen(port, () => {
  console.log(`Master Solutions is running at http://localhost:${port}`);
});
