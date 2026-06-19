# LoadLink Courier Website

Customer website for a bakkie and truck courier marketplace. LoadLink lets customers request transport, pay for the trip, and track delivery progress while the dispatcher finds the nearest suitable driver behind the scenes.

## What is included

- Customer trip request form
- Distance-based demo price calculation
- Vehicle and load type selection
- Customer confirmation flow
- Dedicated payment method page before dispatch notification
- Gateway-style checkout session before payment confirmation
- Dedicated customer tracking page
- Separate driver website for assigned job responses
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

The local gateway sandbox is available after a checkout session is created:

```text
http://127.0.0.1:4173/gateway.html?sessionId=...
```

Driver jobs are available at:

```text
http://127.0.0.1:4173/driver.html
```

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

## Internal foundation routes

These are backend foundations for future dispatcher and driver products, not visible customer website tools.

- `PATCH /api/bookings/:id/status`
- `GET /api/driver/jobs`
- `POST /api/driver/jobs/:id/respond`
