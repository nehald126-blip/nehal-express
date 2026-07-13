# Nehal Express — Clothing & Accessories Store

A full-stack e-commerce website: responsive storefront (mobile/tablet/laptop), a working
Node.js/Express backend with a JSON-file database, and a complete admin dashboard. All
prices are in Indian Rupees (₹).

## What's included

**Storefront** (`/`)
- Home page with hero, category strip, and full product catalog
- Search, category filters, and sorting (newest, price, rating)
- Product quick-view with size/colour selection and quantity
- Cart drawer (persisted in the browser via localStorage)
- Checkout flow (Cash on Delivery or UPI) that creates a real order and reduces stock
- Guest order tracking by Order ID + phone number
- Fully responsive: mobile, tablet, and laptop layouts

**Admin dashboard** (`/admin`)
- Secure login (username/password → session token)
- Overview: revenue, order count, product count, low-stock alerts, recent orders
- Products: add / edit / delete, with stock, pricing, sizes, colours, images
- Orders: view all orders and customer details, update order status
  (Placed → Packed → Shipped → Delivered / Cancelled)

**Backend**
- Express REST API (`server/server.js`)
- Simple JSON-file database (`server/data.json`, created automatically on first run)
- Passwords hashed with bcrypt; admin routes protected by session tokens

## Running it locally

Requires [Node.js](https://nodejs.org) 18 or newer.

```bash
cd nehal-express
npm install
npm start
```

Then open:
- Storefront: http://localhost:4000
- Admin dashboard: http://localhost:4000/admin

**Default admin login:** `admin` / `admin123` — change this in `server/seed-data.js`
(or add a "change password" flow) before using this in production.

## Email and invoice environment

Order confirmation email and PDF invoice generation support these optional environment
variables. Missing SMTP settings will skip email sending, but checkout still succeeds.

```env
# Email delivery for order confirmations. Keep these server-side only.
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=orders@example.com
SMTP_PASS=replace-with-smtp-password
SMTP_FROM="Nehal Express <orders@example.com>"

# Optional fallback recipient when checkout/customer email is missing.
ORDER_EMAIL_FALLBACK=owner@example.com

# Optional GST display rate. Totals stay unchanged; GST is shown as included.
GST_RATE=18
```

Never expose SMTP credentials in frontend files or client-side logs.

## Production deployment

Use Node.js 18 or newer and install only locked production dependencies:

```bash
npm ci --omit=dev
NODE_ENV=production npm start
```

Configure `PORT`, `MONGO_URI`, `JWT_SECRET`, Razorpay, Cloudinary, and any SMTP
variables in the deployment platform's server-side environment. Terminate HTTPS at the
hosting platform or reverse proxy. The app keeps HTML and the service worker revalidated
while allowing CSS, JavaScript, fonts, and images to use a one-day browser cache. Express
ETags remain enabled for conditional requests.

Response-compression middleware is not currently installed. Use platform-level
compression, or add an approved middleware dependency in a separate deployment change.

## Project structure

```
nehal-express/
├── package.json
├── server/
│   ├── server.js        # Express app & all API routes
│   ├── db.js            # tiny JSON-file data layer
│   ├── auth.js          # admin session tokens
│   ├── seed-data.js      # initial products, categories, admin user
│   └── data.json         # created on first run — your live data lives here
└── public/
    ├── index.html         # storefront
    ├── admin.html         # admin dashboard
    ├── css/style.css
    ├── css/admin.css
    └── js/app.js, admin.js
```

## Notes for going further

- **Data storage**: this uses a JSON file so the whole project runs anywhere with zero
  setup. For real production traffic, swap `server/db.js` for a proper database
  (PostgreSQL, MongoDB, etc.) — the rest of the app doesn't need to change much since all
  data access goes through that one file.
- **Payments**: checkout currently supports Cash on Delivery and a placeholder "UPI" option.
  To accept real online payments, integrate a gateway such as Razorpay or Cashfree (both
  are built for the Indian market and settle in ₹).
- **Images**: products currently reference hosted image URLs. For your own product photos,
  add file upload handling (e.g. `multer`) and store images under `public/images/`.
- **Deployment**: this Express app can be deployed as-is to Render, Railway, a VPS, etc.
  Just make sure `server/data.json` is on persistent storage (not wiped on redeploy).
