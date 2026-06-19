const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const dataDir = path.join(root, "data");
const bookingsFile = path.join(dataDir, "bookings.json");

const locations = {
  sandton: { label: "Sandton", address: "Sandton City, 83 Rivonia Road, Sandton", lat: -26.1076, lng: 28.0567 },
  rosebank: { label: "Rosebank", address: "Rosebank Mall, 15A Cradock Avenue, Rosebank", lat: -26.1466, lng: 28.0416 },
  midrand: { label: "Midrand", address: "Mall of Africa, Magwa Crescent, Midrand", lat: -25.9992, lng: 28.1263 },
  soweto: { label: "Soweto", address: "Maponya Mall, Chris Hani Road, Soweto", lat: -26.2485, lng: 27.8540 },
  centurion: { label: "Centurion", address: "Centurion Mall, Heuwel Road, Centurion", lat: -25.8603, lng: 28.1894 },
  pretoria: { label: "Pretoria CBD", address: "Church Square, Pretoria Central", lat: -25.7479, lng: 28.2293 }
};

const addressBook = [
  { key: "sandton", aliases: ["sandton city", "rivonia road", "sandton"] },
  { key: "rosebank", aliases: ["rosebank mall", "cradock avenue", "rosebank"] },
  { key: "midrand", aliases: ["mall of africa", "magwa crescent", "midrand"] },
  { key: "soweto", aliases: ["maponya mall", "chris hani", "soweto"] },
  { key: "centurion", aliases: ["centurion mall", "heuwel road", "centurion"] },
  { key: "pretoria", aliases: ["church square", "pretoria central", "pretoria cbd", "pretoria"] }
];

const vehicleRates = {
  bakkie: { label: "Bakkie", base: 280, perKm: 15, eta: 7 },
  canopy: { label: "Bakkie with canopy", base: 330, perKm: 17, eta: 9 },
  smallTruck: { label: "Small truck", base: 460, perKm: 23, eta: 12 },
  largeTruck: { label: "Large truck", base: 680, perKm: 31, eta: 16 }
};

const loadFees = {
  bed: { label: "Bed or mattress", fee: 30 },
  furniture: { label: "Household furniture", fee: 85 },
  appliance: { label: "Appliance", fee: 60 },
  business: { label: "Business stock", fee: 95 },
  construction: { label: "Construction material", fee: 140 }
};

const allowedStatuses = ["dispatcher_notified", "driver_assigned", "driver_en_route", "goods_collected", "delivered"];

const driverPool = [
  { id: "DRV-101", name: "Thabo M.", vehicleTypes: ["bakkie", "canopy"], lat: -26.116, lng: 28.058, rating: 4.9 },
  { id: "DRV-102", name: "Lerato K.", vehicleTypes: ["bakkie", "smallTruck"], lat: -26.151, lng: 28.041, rating: 4.8 },
  { id: "DRV-103", name: "Mandla S.", vehicleTypes: ["smallTruck", "largeTruck"], lat: -25.999, lng: 28.126, rating: 4.7 },
  { id: "DRV-104", name: "Nomsa P.", vehicleTypes: ["canopy", "largeTruck"], lat: -25.861, lng: 28.188, rating: 4.9 }
];

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function ensureStore() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(bookingsFile)) {
    fs.writeFileSync(bookingsFile, "[]\n");
  }
}

function readBookings() {
  ensureStore();
  try {
    return JSON.parse(fs.readFileSync(bookingsFile, "utf8"));
  } catch (error) {
    return [];
  }
}

function writeBookings(bookings) {
  ensureStore();
  fs.writeFileSync(bookingsFile, `${JSON.stringify(bookings, null, 2)}\n`);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        request.destroy();
      }
    });

    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });

    request.on("error", reject);
  });
}

function toRadians(degree) {
  return degree * (Math.PI / 180);
}

function distanceKm(start, end) {
  const earthRadius = 6371;
  const latDistance = toRadians(end.lat - start.lat);
  const lngDistance = toRadians(end.lng - start.lng);
  const startLat = toRadians(start.lat);
  const endLat = toRadians(end.lat);
  const a =
    Math.sin(latDistance / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(lngDistance / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.max(3.5, earthRadius * c * 1.18);
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function parseCoordinates(value) {
  const match = String(value || "").match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!match) return null;

  const lat = Number(match[1]);
  const lng = Number(match[2]);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -35 || lat > -20 || lng < 16 || lng > 34) return null;

  return { lat, lng };
}

function geocodeAddress(address, fallbackKey) {
  const cleanAddress = String(address || "").trim();
  const normalized = normalizeText(cleanAddress);
  const fallback = locations[fallbackKey] || locations.sandton;
  const coordinateInput = parseCoordinates(cleanAddress);

  if (coordinateInput) {
    return {
      label: cleanAddress,
      address: cleanAddress,
      lat: coordinateInput.lat,
      lng: coordinateInput.lng,
      source: "coordinates",
      confidence: "exact"
    };
  }

  if (normalized) {
    const match = addressBook.find((entry) =>
      entry.aliases.some((alias) => normalized.includes(alias) || alias.includes(normalized))
    );

    if (match) {
      const location = locations[match.key];
      return {
        ...location,
        address: cleanAddress || location.address,
        source: "local-address-book",
        confidence: "matched"
      };
    }
  }

  return {
    ...fallback,
    address: cleanAddress || fallback.address,
    source: "service-area-fallback",
    confidence: cleanAddress ? "estimated" : "area-only"
  };
}

function validateSelection(input) {
  const pickupKey = input.pickupKey || input.pickup || "sandton";
  const dropoffKey = input.dropoffKey || input.dropoff || "rosebank";
  const loadTypeKey = input.loadTypeKey || input.loadType || "bed";
  const vehicleKey = input.vehicleKey || input.vehicle || "bakkie";

  if (!locations[pickupKey]) throw new Error("Invalid pickup location");
  if (!locations[dropoffKey]) throw new Error("Invalid drop-off location");
  if (!loadFees[loadTypeKey]) throw new Error("Invalid load type");
  if (!vehicleRates[vehicleKey]) throw new Error("Invalid vehicle type");

  return { pickupKey, dropoffKey, loadTypeKey, vehicleKey };
}

function calculateQuote(input) {
  const keys = validateSelection(input);
  const pickup = geocodeAddress(input.pickupAddress, keys.pickupKey);
  const dropoff = geocodeAddress(input.dropoffAddress, keys.dropoffKey);
  const vehicle = vehicleRates[keys.vehicleKey];
  const load = loadFees[keys.loadTypeKey];
  const helpersFee = input.helpers ? 170 : 0;
  const stairsFee = input.stairs ? 95 : 0;
  const platformBaseFee = 45;
  const distance = distanceKm(pickup, dropoff);
  const subtotal = vehicle.base + distance * vehicle.perKm + load.fee + helpersFee + stairsFee;
  const price = subtotal + platformBaseFee;
  const driverPayout = price * 0.75;
  const platformMargin = price - driverPayout;

  return {
    ...keys,
    pickup,
    dropoff,
    vehicle,
    load,
    distance,
    price,
    driverPayout,
    platformMargin,
    paymentRequired: price,
    routeSource: pickup.confidence === "estimated" || dropoff.confidence === "estimated" ? "Estimated from service area" : "Address matched",
    eta: vehicle.eta + Math.round(distance / 8)
  };
}

function nearestDriverFor(booking) {
  const availableDrivers = driverPool.filter((driver) => driver.vehicleTypes.includes(booking.vehicleKey));
  const ranked = availableDrivers.length ? availableDrivers : driverPool;
  const nearest = ranked
    .map((driver) => ({
      ...driver,
      distanceToPickup: distanceKm({ lat: driver.lat, lng: driver.lng }, booking.pickup)
    }))
    .sort((a, b) => a.distanceToPickup - b.distanceToPickup)[0];

  return {
    id: nearest.id,
    name: nearest.name,
    vehicle: booking.vehicle.label,
    rating: nearest.rating,
    distanceToPickup: Number(nearest.distanceToPickup.toFixed(1))
  };
}

function createBooking(input) {
  const now = new Date().toISOString();
  const quote = calculateQuote(input);

  return {
    id: `LL-${Date.now().toString().slice(-6)}`,
    status: "dispatcher_notified",
    customerName: String(input.customerName || "Customer").trim(),
    customerPhone: String(input.customerPhone || "Not provided").trim(),
    pickupDate: String(input.pickupDate || new Date().toISOString().slice(0, 10)),
    pickupTime: String(input.pickupTime || "10:00"),
    pickupAddress: String(input.pickupAddress || quote.pickup.address).trim(),
    dropoffAddress: String(input.dropoffAddress || quote.dropoff.address).trim(),
    helpers: Boolean(input.helpers),
    stairs: Boolean(input.stairs),
    notes: String(input.notes || "").trim(),
    payment: {
      status: "unpaid",
      method: null,
      reference: null,
      paidAt: null
    },
    dispatcher: {
      notified: true,
      name: "LoadLink Dispatch Desk",
      notifiedAt: now,
      searchStartedAt: now
    },
    assignedDriver: null,
    createdAt: now,
    updatedAt: now,
    statusHistory: [{ status: "dispatcher_notified", at: now, actor: "customer" }],
    ...quote
  };
}

function latestActiveBooking(bookings) {
  const active = bookings.filter((booking) => booking.status !== "delivered");
  return active[active.length - 1] || bookings[bookings.length - 1] || null;
}

function pushStatus(booking, status, actor = "system") {
  if (booking.status === status) return;

  booking.status = status;
  booking.updatedAt = new Date().toISOString();
  booking.statusHistory = booking.statusHistory || [];
  booking.statusHistory.push({ status, at: booking.updatedAt, actor });
}

function advanceBookingForCustomer(booking) {
  if (!booking || booking.status === "delivered") return booking;

  const ageSeconds = (Date.now() - new Date(booking.createdAt).getTime()) / 1000;

  if (ageSeconds >= 6 && booking.status === "dispatcher_notified") {
    booking.assignedDriver = booking.assignedDriver || nearestDriverFor(booking);
    pushStatus(booking, "driver_assigned");
  }

  if (ageSeconds >= 12 && booking.status === "driver_assigned") {
    pushStatus(booking, "driver_en_route");
  }

  if (ageSeconds >= 20 && booking.status === "driver_en_route") {
    pushStatus(booking, "goods_collected");
  }

  if (ageSeconds >= 30 && booking.status === "goods_collected") {
    pushStatus(booking, "delivered");
  }

  return booking;
}

function getCurrentBooking() {
  const bookings = readBookings();
  const booking = latestActiveBooking(bookings);

  if (!booking) return null;

  const previousStatus = booking.status;
  advanceBookingForCustomer(booking);

  if (booking.status !== previousStatus || (booking.assignedDriver && !bookings.find((item) => item.id === booking.id).assignedDriver)) {
    writeBookings(bookings);
  }

  return booking;
}

function updateBookingStatus(id, status) {
  if (!allowedStatuses.includes(status)) {
    throw new Error("Invalid booking status");
  }

  const bookings = readBookings();
  const booking = bookings.find((item) => item.id === id);

  if (!booking) {
    return null;
  }

  pushStatus(booking, status, "dispatcher");

  if (status === "driver_assigned") {
    booking.assignedDriver = booking.assignedDriver || nearestDriverFor(booking);
  }

  writeBookings(bookings);
  return booking;
}

function markBookingPaid(id, input) {
  const bookings = readBookings();
  const booking = bookings.find((item) => item.id === id);

  if (!booking) return null;

  const now = new Date().toISOString();
  booking.payment = {
    status: "paid",
    method: input.method || "card",
    reference: `PAY-${Date.now().toString().slice(-7)}`,
    paidAt: now
  };
  booking.updatedAt = now;
  booking.statusHistory = booking.statusHistory || [];
  booking.statusHistory.push({ status: "payment_received", at: now, actor: "customer" });
  writeBookings(bookings);

  return booking;
}

async function handleApi(request, response, pathname) {
  try {
    if (request.method === "GET" && pathname === "/api/health") {
      sendJson(response, 200, { ok: true, service: "LoadLink API" });
      return;
    }

    if (request.method === "GET" && pathname === "/api/locations") {
      sendJson(response, 200, { locations, addressBook, vehicleRates, loadFees });
      return;
    }

    if (request.method === "POST" && pathname === "/api/geocode") {
      const body = await readJsonBody(request);
      const keys = validateSelection(body);
      sendJson(response, 200, {
        pickup: geocodeAddress(body.pickupAddress, keys.pickupKey),
        dropoff: geocodeAddress(body.dropoffAddress, keys.dropoffKey)
      });
      return;
    }

    if (request.method === "POST" && pathname === "/api/quote") {
      const body = await readJsonBody(request);
      sendJson(response, 200, { quote: calculateQuote(body) });
      return;
    }

    if (request.method === "GET" && pathname === "/api/bookings/current") {
      sendJson(response, 200, { booking: getCurrentBooking() });
      return;
    }

    if (request.method === "DELETE" && pathname === "/api/bookings/current") {
      writeBookings([]);
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === "GET" && pathname === "/api/driver/jobs") {
      const jobs = readBookings().filter((booking) => booking.status === "driver_assigned");
      sendJson(response, 200, { jobs });
      return;
    }

    if (request.method === "POST" && pathname === "/api/bookings") {
      const body = await readJsonBody(request);
      const booking = createBooking(body);
      const bookings = readBookings();
      bookings.push(booking);
      writeBookings(bookings);
      sendJson(response, 201, { booking });
      return;
    }

    const statusMatch = pathname.match(/^\/api\/bookings\/([^/]+)\/status$/);
    if (request.method === "PATCH" && statusMatch) {
      const body = await readJsonBody(request);
      const booking = updateBookingStatus(statusMatch[1], body.status);

      if (!booking) {
        sendJson(response, 404, { error: "Booking not found" });
        return;
      }

      sendJson(response, 200, { booking });
      return;
    }

    const paymentMatch = pathname.match(/^\/api\/bookings\/([^/]+)\/payment$/);
    if (request.method === "POST" && paymentMatch) {
      const body = await readJsonBody(request);
      const booking = markBookingPaid(paymentMatch[1], body);

      if (!booking) {
        sendJson(response, 404, { error: "Booking not found" });
        return;
      }

      sendJson(response, 200, { booking });
      return;
    }

    sendJson(response, 404, { error: "API route not found" });
  } catch (error) {
    sendJson(response, 400, { error: error.message });
  }
}

function serveStatic(request, response, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  const filePath = path.join(root, requestedPath);

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream"
    });
    response.end(data);
  });
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.pathname.startsWith("/api/")) {
    handleApi(request, response, url.pathname);
    return;
  }

  serveStatic(request, response, url.pathname);
});

server.listen(port, "127.0.0.1", () => {
  ensureStore();
  console.log(`LoadLink Courier website and API running at http://127.0.0.1:${port}`);
});
