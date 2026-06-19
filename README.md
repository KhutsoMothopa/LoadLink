# LoadLink Courier Website

MVP website for a bakkie and truck courier marketplace. LoadLink connects customers who need courier or moving services with available owner-drivers.

## What is included

- Customer trip request form
- Distance-based demo price calculation
- Vehicle and load type selection
- Customer confirmation flow
- Driver trip acceptance and status flow
- Operations trip monitor
- Server-side quote calculation
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

You can also open `index.html` directly in your browser.

## Product direction

The next milestone should connect the estimate form to a real mapping/geocoding service, then add customer accounts, driver accounts, payment handling, live driver notifications, and a driver mobile app.

## Current API routes

- `GET /api/health`
- `POST /api/quote`
- `POST /api/bookings`
- `GET /api/bookings/current`
- `PATCH /api/bookings/:id/status`
- `GET /api/driver/jobs`
