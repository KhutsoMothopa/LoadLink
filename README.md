# LoadLink Courier Website

Customer website for a bakkie and truck courier marketplace. LoadLink lets customers request transport, pay for the trip, and track delivery progress while the dispatcher finds the nearest suitable driver behind the scenes.

## What is included

- Customer trip request form
- Distance-based price calculation
- Vehicle and load type selection
- Customer confirmation flow
- Dedicated payment method page before dispatch notification
- Gateway-style checkout session before payment confirmation
- Dispatcher email notification after confirmed payment
- Dedicated customer tracking page
- Separate driver website for assigned job responses
- Driver availability and current-area updates for dispatch assignment
- Driver earnings summary for week, month, and year
- Dispatcher notification and nearest-driver assignment simulation
- Server-side quote calculation
- Address geocoding foundation with service-area fallback
- Booking API with lightweight JSON persistence
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

Payment is available at:

```text
http://127.0.0.1:4173/payment.html
```

Secure checkout is available after a payment session is created:

```text
http://127.0.0.1:4173/gateway.html?sessionId=...
```

Driver jobs are available at:

```text
http://127.0.0.1:4173/driver.html
```

Production routes on Vercel:

```text
https://www.load-link.co.za/
https://www.load-link.co.za/driver
https://www.load-link.co.za/tracking
https://www.load-link.co.za/payment
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

The next milestone should connect the geocoding foundation to a real mapping provider. Driver tools, dispatcher tools, and payment handling should be built as separate product areas from this customer booking website.

## Current API routes

- `GET /api/health`
- `GET /api/locations`
- `POST /api/geocode`
- `POST /api/quote`
- `POST /api/bookings`
- `GET /api/bookings/current`
- `POST /api/bookings/:id/payment`
- `POST /api/payments/checkout`
- `GET /api/payments/sessions/:id`
- `POST /api/payments/sessions/:id/confirm`
- `GET /api/driver/profile`
- `PATCH /api/driver/profile`
- `GET /api/driver/earnings?period=week|month|year`

## Internal foundation routes

These are backend foundations for future dispatcher and driver products, not visible customer website tools.

- `PATCH /api/bookings/:id/status`
- `GET /api/driver/jobs`
- `POST /api/driver/jobs/:id/respond`
