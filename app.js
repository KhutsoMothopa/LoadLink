const locations = {
  sandton: { label: "Sandton", lat: -26.1076, lng: 28.0567 },
  rosebank: { label: "Rosebank", lat: -26.1466, lng: 28.0416 },
  midrand: { label: "Midrand", lat: -25.9992, lng: 28.1263 },
  soweto: { label: "Soweto", lat: -26.2485, lng: 27.8540 },
  centurion: { label: "Centurion", lat: -25.8603, lng: 28.1894 },
  pretoria: { label: "Pretoria CBD", lat: -25.7479, lng: 28.2293 }
};

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

const statusMap = {
  draft: {
    customer: "Draft quote",
    driver: "No active request",
    ops: "Draft",
    className: "neutral",
    timelineIndex: 0
  },
  confirmed: {
    customer: "Awaiting driver",
    driver: "Trip available",
    ops: "Dispatching",
    className: "warning",
    timelineIndex: 2
  },
  accepted: {
    customer: "Driver assigned",
    driver: "Accepted",
    ops: "Driver assigned",
    className: "active",
    timelineIndex: 2
  },
  pickup: {
    customer: "Driver en route",
    driver: "Pickup started",
    ops: "Collection in progress",
    className: "active",
    timelineIndex: 3
  },
  delivered: {
    customer: "Delivered",
    driver: "Completed",
    ops: "Complete",
    className: "complete",
    timelineIndex: 4
  }
};

const storageKey = "loadlink.activeTrip";
const form = document.querySelector("#bookingForm");
const confirmBtn = document.querySelector("#confirmBtn");
const resetBtn = document.querySelector("#resetBtn");
const acceptBtn = document.querySelector("#acceptBtn");
const pickupBtn = document.querySelector("#pickupBtn");
const deliverBtn = document.querySelector("#deliverBtn");

let activeTrip = loadTrip();

const formatRand = (value) => `R ${Math.round(value).toLocaleString("en-ZA")}`;

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function distanceKm(start, end) {
  const earthRadius = 6371;
  const toRadians = (degree) => degree * (Math.PI / 180);
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

function calculateQuote() {
  const pickup = locations[form.pickup.value];
  const dropoff = locations[form.dropoff.value];
  const vehicle = vehicleRates[form.vehicle.value];
  const load = loadFees[form.loadType.value];
  const helpersFee = document.querySelector("#helpers").checked ? 170 : 0;
  const stairsFee = document.querySelector("#stairs").checked ? 95 : 0;
  const distance = distanceKm(pickup, dropoff);
  const platformBaseFee = 45;
  const subtotal = vehicle.base + distance * vehicle.perKm + load.fee + helpersFee + stairsFee;
  const price = subtotal + platformBaseFee;
  const driverPayout = price * 0.75;
  const platformMargin = price - driverPayout;

  return {
    pickup,
    dropoff,
    vehicle,
    load,
    distance,
    price,
    driverPayout,
    platformMargin,
    eta: vehicle.eta + Math.round(distance / 8)
  };
}

function buildTrip(status = "confirmed") {
  const quote = calculateQuote();
  const existingId = activeTrip && activeTrip.id ? activeTrip.id : `LL-${Date.now().toString().slice(-6)}`;

  return {
    id: existingId,
    status,
    customerName: form.customerName.value.trim() || "Customer",
    customerPhone: form.customerPhone.value.trim() || "Not provided",
    pickupKey: form.pickup.value,
    dropoffKey: form.dropoff.value,
    loadTypeKey: form.loadType.value,
    vehicleKey: form.vehicle.value,
    pickupDate: form.pickupDate.value || todayIsoDate(),
    pickupTime: form.pickupTime.value || "10:00",
    helpers: document.querySelector("#helpers").checked,
    stairs: document.querySelector("#stairs").checked,
    notes: document.querySelector("#loadNotes").value.trim(),
    createdAt: new Date().toISOString(),
    ...quote
  };
}

function saveTrip() {
  if (activeTrip) {
    localStorage.setItem(storageKey, JSON.stringify(activeTrip));
  } else {
    localStorage.removeItem(storageKey);
  }
}

function loadTrip() {
  try {
    return JSON.parse(localStorage.getItem(storageKey));
  } catch (error) {
    return null;
  }
}

function setPill(element, label, className) {
  element.textContent = label;
  element.className = `status-pill ${className}`;
}

function updateQuoteUi(quote) {
  document.querySelector("#quotePrice").textContent = formatRand(quote.price);
  document.querySelector("#driverFare").textContent = formatRand(quote.price);
  document.querySelector("#driverEarns").textContent = formatRand(quote.driverPayout);
  document.querySelector("#driverPayout").textContent = formatRand(quote.driverPayout);
  document.querySelector("#platformMargin").textContent = formatRand(quote.platformMargin);
  document.querySelector("#pickupLabel").textContent = quote.pickup.label;
  document.querySelector("#dropoffLabel").textContent = quote.dropoff.label;
  document.querySelector("#distanceText").textContent = `${quote.distance.toFixed(1)} km`;
  document.querySelector("#vehicleText").textContent = quote.vehicle.label;
  document.querySelector("#loadText").textContent = quote.load.label;
  document.querySelector("#etaText").textContent = `${quote.eta} min`;
  document.querySelector("#driverRoute").textContent = `${quote.pickup.label} to ${quote.dropoff.label}`;
  document.querySelector("#driverMeta").textContent = `${quote.vehicle.label} driver · 4.9 rating · ${Math.max(1.2, quote.distance / 4).toFixed(1)} km away`;
  document.querySelector("#heroFare").textContent = formatRand(quote.price);
  document.querySelector("#heroDistance").textContent = `${quote.distance.toFixed(1)} km`;
}

function updateStatusUi(status) {
  const statusData = statusMap[status] || statusMap.draft;
  setPill(document.querySelector("#bookingStatus"), statusData.customer, statusData.className);
  setPill(document.querySelector("#driverStatus"), statusData.driver, statusData.className);
  setPill(document.querySelector("#opsStatus"), statusData.ops, statusData.className);
  document.querySelector("#heroStatus").textContent = statusData.customer;

  acceptBtn.disabled = status !== "confirmed";
  pickupBtn.disabled = status !== "accepted";
  deliverBtn.disabled = status !== "pickup";

  document.querySelectorAll("#timeline li").forEach((item, index) => {
    item.classList.toggle("done", index < statusData.timelineIndex);
    item.classList.toggle("current", index === statusData.timelineIndex);
  });
}

function updateOpsUi(trip, quote) {
  const active = trip || {};
  document.querySelector("#bookingId").textContent = active.id || "Not confirmed";
  document.querySelector("#opsCustomer").textContent = active.customerName || form.customerName.value || "Customer";
  document.querySelector("#scheduledPickup").textContent = `${active.pickupDate || form.pickupDate.value || todayIsoDate()}, ${active.pickupTime || form.pickupTime.value || "10:00"}`;
  document.querySelector("#platformMargin").textContent = formatRand((trip || quote).platformMargin);
}

function syncFormFromTrip(trip) {
  if (!trip) return;

  form.customerName.value = trip.customerName || "";
  form.customerPhone.value = trip.customerPhone || "";
  form.pickup.value = trip.pickupKey || "sandton";
  form.dropoff.value = trip.dropoffKey || "rosebank";
  form.loadType.value = trip.loadTypeKey || "bed";
  form.vehicle.value = trip.vehicleKey || "bakkie";
  form.pickupDate.value = trip.pickupDate || todayIsoDate();
  form.pickupTime.value = trip.pickupTime || "10:00";
  document.querySelector("#helpers").checked = Boolean(trip.helpers);
  document.querySelector("#stairs").checked = Boolean(trip.stairs);
  document.querySelector("#loadNotes").value = trip.notes || "";
}

function render() {
  const quote = activeTrip || calculateQuote();
  updateQuoteUi(quote);
  updateOpsUi(activeTrip, quote);
  updateStatusUi(activeTrip ? activeTrip.status : "draft");
}

function refreshDraft() {
  if (activeTrip && activeTrip.status !== "draft") {
    activeTrip = null;
    saveTrip();
  }
  render();
}

form.addEventListener("change", refreshDraft);
form.addEventListener("input", refreshDraft);

confirmBtn.addEventListener("click", () => {
  activeTrip = buildTrip("confirmed");
  saveTrip();
  render();
  document.querySelector("#driver").scrollIntoView({ behavior: "smooth", block: "start" });
});

acceptBtn.addEventListener("click", () => {
  activeTrip = { ...activeTrip, status: "accepted" };
  saveTrip();
  render();
});

pickupBtn.addEventListener("click", () => {
  activeTrip = { ...activeTrip, status: "pickup" };
  saveTrip();
  render();
});

deliverBtn.addEventListener("click", () => {
  activeTrip = { ...activeTrip, status: "delivered" };
  saveTrip();
  render();
});

resetBtn.addEventListener("click", () => {
  activeTrip = null;
  localStorage.removeItem(storageKey);
  form.reset();
  form.customerName.value = "Khutso Mothopa";
  form.customerPhone.value = "+27 72 000 0000";
  form.pickupDate.value = todayIsoDate();
  form.pickupTime.value = "10:00";
  document.querySelector("#loadNotes").value = "Moving one queen bed and base. Customer will meet driver at reception.";
  render();
});

form.pickupDate.value = form.pickupDate.value || todayIsoDate();
syncFormFromTrip(activeTrip);
render();
