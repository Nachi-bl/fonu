# Stockroom

Stockroom is a small shop and inventory manager. Customers can browse products, place orders, and pay with Paystack. Administrators can manage products, upload photos, update stock, and view incoming orders.

The website uses React and TypeScript. The API uses NestJS, and the database uses PostgreSQL with Prisma. Styling is written in SCSS. Product photos are stored in Cloudinary.

This guide explains how to run the project on your computer, use each account, and prepare it for Vercel.

The website is what you see in the browser. The API is the server that handles requests such as signing in or placing an order. The database stores the accounts, products, and orders so they remain available after the application stops.

## Before you start

Install **Node.js 22**, which includes npm. You also need a PostgreSQL database. You can use a hosted database, an existing local PostgreSQL installation, or the Docker setup included in this project. Docker is only needed if you choose that last option.

Open a terminal inside the main project folder. You should see `package.json`, `apps`, and `README.md` there.

Check that Node and npm are available:

```sh
node --version
npm --version
```

If PowerShell says it cannot run `npm.ps1`, use `npm.cmd` instead of `npm` in the commands below. For example, run `npm.cmd ci` instead of `npm ci`.

## 1. Install the project

Run this after downloading or cloning the repository:

```sh
npm ci
```

This installs the frontend, API, and development tools using the versions recorded in `package-lock.json`. Let it finish before continuing.

## 2. Set up your environment file

The `.env` file holds settings and private credentials. It belongs in the main project folder, next to `package.json`.

**If `.env` already exists, keep it.** You do not need to copy the example over it. Overwriting it could replace your database address and the passwords used to create your demo accounts.

For a fresh setup, copy `.env.example` and name the copy `.env`. You can do this in your file manager. In PowerShell, the command is:

```powershell
Copy-Item .env.example .env
```

Open `.env` in your editor and fill in the values described below. Replace the example password and secret text with your own values. Keep this file private.

### Database address

`DATABASE_URL` tells the API where your PostgreSQL database is located.

For a hosted database, copy its PostgreSQL connection URL from the provider and put it after `DATABASE_URL=`. Keep any connection options supplied by the provider.

For the included Docker database, use:

```dotenv
DATABASE_URL=postgresql://inventory:inventory_local@localhost:5432/inventory
```

Those credentials are only for the local Docker database.

### Login secret

`JWT_SECRET` is used by the API to sign login tokens. It must contain at least 32 characters. Generate a random value with:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copy the result into `.env` as the value of `JWT_SECRET`. Do not share it or put it in frontend code.

### Demo account passwords

Choose your own values for `SEED_ADMIN_PASSWORD` and `SEED_CUSTOMER_PASSWORD`. Each password must contain at least 10 characters. You will use these to sign in after creating the demo accounts.

`SEED_ADMIN_EMAIL` can stay as `admin@stockroom.local`. The administrator's display name is **Blessing William**.

### Local addresses

For the usual local setup, leave these values as:

```dotenv
PORT=4000
CORS_ORIGIN=http://localhost:5173
```

`PORT` is the API port. `CORS_ORIGIN` identifies an allowed website address. Local development also supports the website running on port 5174.

You can configure Cloudinary and Paystack later. Browsing products and signing in do not require those credentials. Uploading new images needs Cloudinary, and making a payment needs Paystack.

## 3. Prepare the database

If you chose the included Docker database, start Docker Desktop and run:

```sh
docker compose -f infra/docker-compose.yml up -d db
```

Skip that command if PostgreSQL is already running elsewhere.

Next, run these commands one at a time:

```sh
npm run db:generate
npm run db:migrate
npm run db:seed
```

`db:generate` creates the Prisma client used by the API to communicate with PostgreSQL.

`db:migrate` creates or updates the database tables using the committed migrations. It does not reset the database.

`db:seed` adds eight sample products and the demo accounts. Running it again preserves existing stock and account passwords. It also keeps the seeded administrator's name as Blessing William. Changing a seed password in `.env` does not reset an account that already exists.

Use seeding for a local or demo setup. Do not run it automatically against a production database.

## 4. Start the website

Run:

```sh
npm run dev
```

Keep that terminal open. This starts the website and API together. Press **Ctrl+C** when you want to stop them.

Open the website address printed in the terminal. It will normally be <http://localhost:5173>. If that port is already in use, Vite may print <http://localhost:5174> instead.

The API is at <http://localhost:4000/api/v1>. Its interactive documentation is at <http://localhost:4000/api/docs>.

The website forwards local `/api` requests to the API automatically. You do not need to configure a separate frontend API address for this setup.

## Sign in to an account

Open `/login` on your website. For example, use <http://localhost:5173/login>, or change the port to the one printed by Vite.

### Administrator

Sign in with `admin@stockroom.local`, unless you chose a different `SEED_ADMIN_EMAIL`. Use the password stored in `SEED_ADMIN_PASSWORD` when the account was first seeded. The account should display **Blessing William**.

The inventory page is `/admin/products`. Incoming orders are at `/admin/orders`.

### Customer

The sample customer email is `customer@stockroom.local`. Use the password stored in `SEED_CUSTOMER_PASSWORD` when that account was created.

You can also open `/register` and create another customer account. Public registration always creates a customer, never an administrator.

Login tokens are kept in browser memory and expire after one hour. Refreshing the page requires signing in again. Your cart is stored separately and remains available after a refresh.

## Use the shop as a customer

1. Open the product catalog at `/`.
2. Search for a product or choose a category.
3. Click a product to read its details and view its photos.
4. Choose a quantity and add it to your cart.
5. Open **My cart**, review the quantities, and sign in if needed.
6. Click **Place order**.
7. On the order page, find **Complete your payment** and click the Paystack button.

Open **My orders** at `/orders` to see your orders and read their details. Customers can only see their own orders.

The cart shows an estimate. When you place an order, the API checks current prices and stock and calculates the final amount. Keeping something in your cart does not reserve it. Stock is reduced when the order is created.

## Manage products as an administrator

Sign in as the administrator and open **Inventory**. On a smaller screen, open the hamburger menu first.

To create a product, click **Add product**, enter its name, description, SKU, category, price, and stock quantity, then click **Save product**. The SKU is a unique code for the product, such as `DESK-001`.

To change a product, click **Edit** beside it. You can update the same fields and manage its images. Prices entered in the form are in naira.

**Archive** removes a product from the public catalog without deleting its order history. **Restore** makes an archived product available again. A product with zero stock cannot be added to the cart.

## Set up product image uploads

Get your cloud name, API key, and API secret from your Cloudinary dashboard. Put them in the root `.env` file:

```dotenv
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
CLOUDINARY_FOLDER=stockroom/products
```

Restart the API after saving the file. If you are using `npm run dev`, stop it with Ctrl+C and start it again.

Open **Add product** or **Edit**, then click **Click to upload product images**. You can select several files at once. A product can have at most **seven images in total**, including any images it already has. The picker limits each image to **10 MB**.

The picker accepts image formats without limiting you to JPEG or PNG. Cloudinary checks the actual file and must support its format. A file your browser cannot preview locally may still upload successfully and display through Cloudinary afterward.

Remove an image before saving or click **Make cover** to move it to the first position. The first image is used on the catalog card. Images upload when you click **Save product**. Selecting files alone does not upload them.

Cards with multiple images rotate every five seconds. Customers can use the arrows and dots or pause the slideshow. Rotation pauses on hover or keyboard focus and respects the visitor's reduced-motion setting. The product detail page has selectable thumbnails.

The API provides an upload signature, and the browser sends the image directly to Cloudinary. The API secret stays on the server. If one file fails, successful uploads remain in the form, so retrying uploads only the remaining files.

Removing an image from a product does not delete it from Cloudinary. Closing the form after an upload can also leave an unused cloud asset. Automatic cleanup is not included.

## Set up Paystack payments

Put your Paystack secret key in the root `.env` file:

```dotenv
PAYSTACK_SECRET_KEY=your-paystack-secret-key
```

Use a test secret while testing the application. Restart the API after changing the key. This hosted checkout flow does not need a Paystack public key in the frontend.

The payment method appears in the cart. After placing an order, the customer clicks the Paystack button below the order total. Paystack opens its hosted checkout, where the customer enters payment details.

When the customer returns, the API verifies the payment before marking it **Paid** and confirming the order. It checks the saved reference, amount, currency, customer email, and order information. Repeating verification does not charge the customer or reduce stock again.

Returning from Paystack may require signing in again because the login token stays in memory. The return address is preserved, and verification continues after sign-in. The order also has a button to check payment status manually after checkout has started.

Automatic payment webhooks and refunds are not included yet. If a customer pays but does not return to the website, they should open the order and check its payment status.

## Understand order and payment statuses

A new order starts as **Pending**. Before payment checkout begins, the customer can cancel it. Cancellation restores its stock once, even if the request is repeated.

Once Paystack checkout has been initialized, cancellation is blocked because payment could still complete. Paid and confirmed orders cannot be cancelled through this flow. Unpaid orders do not automatically expire or release stock.

Administrators can open **Incoming orders** to inspect an order and confirm a pending one. An administrator's manual confirmation is separate from payment verification. Check the payment section on the order detail page to see whether money was received.

Historical orders keep the product names and prices recorded when they were placed. Editing or archiving a product does not rewrite those old details.

## Run the checks

Run these from the main project folder:

```sh
npm run format:check
npm run lint
npm run typecheck
npm run build
npm test
```

The first command checks formatting. The next two check code quality and TypeScript. The build command compiles both applications. The test command runs unit and API tests, including tests against PostgreSQL.

Tests create a uniquely named temporary database schema, apply the migrations there, and remove that schema afterward. They do not reset the application's tables. The database user needs permission to create and drop schemas.

To use another database for tests, add its address as `TEST_DATABASE_URL` in your root `.env`. Otherwise, the test runner uses a temporary schema on `DATABASE_URL`.

Tests cover stock safety, simultaneous purchases, rollback, permissions, order ownership, cancellation, image validation, payment verification, and deployment origins. External provider calls are mocked. Passing these tests does not mean a real Cloudinary upload or Paystack payment has been made.

With the development servers running, you can also run:

```sh
node scripts/browser-check.cjs
```

This needs Chrome at the Windows path used by the script, or an installed Playwright Chromium browser. It creates a demo order, cancels it to restore stock, and captures screenshots. The cancelled order remains in the demo customer's history.

## Deploy to Vercel

Import the repository into your Vercel account as **one project**. Keep the Root Directory at the repository root. Do not choose `apps/web` or `apps/api`.

Use **Other** as the framework preset and **22.x** as the Node.js version. The checked-in `vercel.json` supplies these settings:

```text
Install Command: npm ci
Build Command: npm run vercel:build
Output Directory: apps/web/dist
```

In Vercel's project settings, add `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, the four Cloudinary variables, and `PAYSTACK_SECRET_KEY`. Use the values for the environment you are deploying. Set `CORS_ORIGIN` to your website's full address, including `https://`. Use separate databases and payment credentials for Preview and Production.

Do not upload `.env` or put private keys in variables beginning with `VITE_`. Leave `VITE_API_BASE_URL` unset for this deployment. The website uses `/api/v1` on its own domain. Vercel's deployment and branch URLs are accepted automatically; custom domains should also be listed in `CORS_ORIGIN`.

The Vercel build does not migrate or seed the database. Before deploying changes that include new migrations, apply them to the intended database from a trusted terminal:

```sh
npm run db:deploy
```

That command uses the root `.env` if it exists, or the terminal's environment variables. Check the database address before running it. Use a hosted PostgreSQL pooled connection for the deployed API.

After deployment, open the home page, sign in, refresh an admin route, and check that products load. Then test an image upload and a Paystack test payment. The repository configuration alone does not publish the site or copy local environment values into Vercel.

The full deployment guide is in [docs/VERCEL.md](docs/VERCEL.md).

## Useful routes

Use the website address printed by Vite locally, or your deployed domain, before these paths:

```text
/                     Product catalog
/login                Sign in
/register             Create a customer account
/products/:id         Product details
/cart                 Shopping cart
/orders               Customer order history
/orders/:id           Order details and payment
/admin/products       Product management
/admin/orders         Incoming orders
```

Replace `:id` with a real product or order ID. The application builds these links for you when you click a product or order.

## API reference

Locally, API requests start with `http://localhost:4000/api/v1`. On Vercel, they start with the website's domain followed by `/api/v1`.

Protected requests need an access token returned by login or registration:

```http
Authorization: Bearer your-access-token
```

The main endpoints are:

```text
POST    /auth/register                  Create a customer account
POST    /auth/login                     Sign in
GET     /auth/me                        Read the signed-in account
GET     /products                       Browse active products
GET     /products/:id                   Read an active product
GET     /products/inventory             Admin product list, including archived products
POST    /products                       Admin creates a product
PATCH   /products/:id                   Admin edits a product
DELETE  /products/:id                   Admin archives a product
POST    /products/images/signature      Admin requests a Cloudinary upload signature
POST    /orders                         Customer creates an order
GET     /orders                         Own orders for customers, all orders for admins
GET     /orders/:id                     Order owner or administrator reads an order
PATCH   /orders/:id/status              Admin confirms or cancels a pending order
DELETE  /orders/:id                     Cancel an eligible pending order
POST    /orders/:id/payment             Customer starts or resumes Paystack checkout
POST    /orders/:id/payment/verify      Customer checks payment status
```

Product lists support `page`, `limit`, `search`, and `category`. Order lists support `page` and `limit`. List responses contain `data`, `total`, `page`, and `limit`.

To place an order, send an `items` array containing product IDs and positive integer quantities. Do not send prices or totals. The API reads those from the database. Prices in the API are integer kobo: 1,000 naira is `100000` kobo.

The API rejects unknown fields. Errors return `statusCode`, `code`, `message`, and `requestId`. Another customer's order returns 404. Stock shortages and invalid order transitions return 409. Open `/api/docs` on the API host for the interactive reference.

## Where the code lives

```text
api/index.js                 Vercel function entry point
apps/web/src                 React screens, shared components, state, and SCSS
apps/web/public/images       Supplied product photos
apps/api/src                 Authentication, products, orders, uploads, and payments
apps/api/prisma              Database schema, migrations, and demo seed
apps/api/test                API and service tests
infra                        Optional local PostgreSQL containers
scripts                      Local configuration, tests, and browser checks
docs                         Deployment guide, verification notes, and screenshots
.github/workflows/ci.yml      Automated repository checks
vercel.json                  Vercel build and routing settings
```

The browser talks to NestJS through REST requests. NestJS checks authentication and permissions, then uses Prisma to read or update PostgreSQL. Image bytes go directly to Cloudinary with an API-generated signature. Paystack handles payment details, and the API verifies the result.

## If something goes wrong

### The website will not open

Make sure `npm run dev` is still running. Open the address it actually prints rather than assuming port 5173. If the API failed to start, look at its error in the terminal.

### The API cannot connect to the database

Check `DATABASE_URL`, including the database name and connection options. If you chose Docker, make sure Docker Desktop and the `db` container are running. Then retry the migration command.

### Login stops working after a refresh

Sign in again. This is the current in-memory session behavior. If you changed a seed password after creating an account, the account still has its original password.

### The administrator still shows the old name

Sign out and back in. Existing sessions keep the account details received at login. The seeded administrator should then display Blessing William.

### Uploads or payments say they are not configured

Check the Cloudinary variables or `PAYSTACK_SECRET_KEY`, save `.env`, and restart the API. On Vercel, change the project environment variables and redeploy instead.

### Prisma reports that a Windows engine file is locked

Stop the running development servers with Ctrl+C before running `npm ci` or `npm run db:generate` again. Restart the application after generation finishes.

### Tests cannot create a schema

Use a database account with schema creation permissions, or set `TEST_DATABASE_URL` to a separate PostgreSQL database where those permissions are available.

### An order is unpaid after leaving Paystack

Open its detail page and use the payment status check button. Sign in again if needed. Do not assume payment succeeded just because a checkout page was opened.

### A Vercel frontend route returns 404

Confirm the project's Root Directory is the repository root and its build uses the checked-in `vercel.json`. The configured routing handles frontend page refreshes and keeps API requests separate.

## Current limits

The application does not yet include automatic refunds, payment webhooks, shipping integration, refresh tokens, automatic stock release for unpaid orders, or the optional Go reporting service. Rate limiting is per API process or warm Vercel function instance.

Order creation does not have an idempotency key yet. If placing an order times out, check your order history before trying again. An order may already have been created even when the browser did not receive the response.

See [verification notes and screenshots](docs/VERIFICATION.md) for recorded checks and example screens.
