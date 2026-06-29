# LoadLink Courier Website

Customer website for a bakkie and truck courier marketplace. LoadLink lets customers request transport, pay for the trip, and track delivery progress while the dispatcher finds the nearest suitable driver behind the scenes.

## What is included

- Customer trip request form
- Distance-based price calculation
- Vehicle and load type selection
- Customer confirmation flow
- Manual payment proof upload before dispatch review
- Dispatcher payment confirmation before driver assignment
- Dispatcher email notification after confirmed payment
- Dedicated customer tracking page
- Separate driver website for assigned job responses
- Separate dispatcher website for assigning paid requests to available drivers
- Driver availability and current-area updates for dispatch assignment
- Driver earnings summary for week, month, and year
- Dispatcher notification and nearest-driver assignment simulation
- Server-side quote calculation
- Address geocoding foundation with service-area fallback
- Booking API with lightweight JSON persistence
- Supabase-ready account and role foundation for customers, drivers, and dispatchers
- Public Privacy Policy, Terms of Service, and Contact pages
- Formal, professional visual style

## Open in VS Code

Open this folder in Visual Studio Code:

```text
C:\Users\refil\Documents\Codex\2026-06-19\i\loadlink-courier-website
```

## Preview the website

If Node.js is installed, run:

```bash
npm start
```

Then open:

```text
http://127.0.0.1:4173
```

Tracking is available at:

```text
http://127.0.0.1:4173/tracking.html
```

Manual payment proof upload is available at:

```text
http://127.0.0.1:4173/payment.html
```

Driver jobs are available at:

```text
http://127.0.0.1:4173/driver.html
```

Dispatcher operations are available at:

```text
http://127.0.0.1:4173/dispatcher.html
```

Production routes on Vercel:

```text
https://www.load-link.co.za/
https://www.load-link.co.za/driver
https://www.load-link.co.za/dispatcher
https://www.load-link.co.za/tracking
https://www.load-link.co.za/payment
https://www.load-link.co.za/auth
https://www.load-link.co.za/privacy
https://www.load-link.co.za/terms
https://www.load-link.co.za/contact
```

Vercel serves the backend through the single serverless API gateway in `api/index.js`, so routes such as `/api/quote` and `/api/driver/jobs` are available in production without exceeding the Hobby plan function limit. For long-term reliability, booking, payment, driver, and dispatch records should be moved to a managed database.

## Dispatcher email

After payment is confirmed, LoadLink prepares a dispatcher notification email to:

```text
clementmothopa@gmail.com
```

For production email delivery, set SMTP environment variables before starting the server:

```bash
DISPATCHER_EMAIL=clementmothopa@gmail.com
DISPATCH_FROM_NAME="LoadLink Dispatch"
DISPATCH_FROM_EMAIL=dispatch@loadlink.co.za
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
```

When SMTP is not configured, the platform records the same dispatcher notification in `data/dispatcher-emails.json` for operational review.

## Product direction

The next milestone should connect the booking, driver, dispatcher, and payout workflows directly to Supabase tables. The schema and account pages are now included, but the operational APIs still keep the prototype JSON fallback until Supabase environment variables and database records are connected end to end.

## Supabase account setup

Create a Supabase project, then run:

```text
supabase/schema.sql
```

Add these Vercel environment variables:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-public-anon-key
```

Replace the examples with the real values from Supabase. Do not leave `https://your-project.supabase.co` in Vercel, because the login page will not be able to reach Supabase.

Account routes:

```text
/auth?role=customer
/auth?role=driver
/auth?role=dispatcher
```

Customers and drivers can register from the account page. Dispatcher accounts should be created privately in Supabase Auth, then added to `public.profiles` with role `dispatcher` using the SQL note at the bottom of `supabase/schema.sql`.

## Current API routes

- `GET /api/health`
- `GET /api/locations`
- `GET /api/auth/config`
- `POST /api/geocode`
- `POST /api/quote`
- `POST /api/bookings`
- `GET /api/bookings/current`
- `POST /api/bookings/:id/payment-proof`
- `POST /api/dispatcher/requests/:id/confirm-payment`
- `POST /api/bookings/:id/payment`
- `GET /api/driver/profile`
- `PATCH /api/driver/profile`
- `GET /api/driver/earnings?period=week|month|year`
- `GET /api/dispatcher/requests`
- `GET /api/dispatcher/drivers`
- `POST /api/dispatcher/requests/:id/assign`

## Live dispatch state

The live Vercel deployment keeps API-backed data when available and mirrors the current browser's operational state in local storage for continuity across customer payment, dispatcher assignment, driver response, and tracking. The next production step is to replace temporary JSON and browser continuity storage with a durable database so separate customers, dispatchers, and drivers share the same records in real time.

## Internal foundation routes

These are backend foundations for future dispatcher and driver products, not visible customer website tools.

- `PATCH /api/bookings/:id/status`
- `GET /api/driver/jobs`
- `POST /api/driver/jobs/:id/respond`
