const statusMap = {
  draft: { customer: "Quote ready", className: "neutral" },
  awaiting_payment: { customer: "Awaiting payment", className: "warning" },
  dispatcher_notified: { customer: "Request sent", className: "warning" },
  driver_assigned: { customer: "Driver accepted", className: "active" },
  driver_en_route: { customer: "Driver on the way", className: "active" },
  goods_collected: { customer: "Goods collected", className: "active" },
  delivered: { customer: "Delivered", className: "complete" }
};

const form = document.querySelector("#bookingForm");
const confirmBtn = document.querySelector("#confirmBtn");
const resetBtn = document.querySelector("#resetBtn");

let activeTrip = null;
let draftQuote = null;
let quoteRequestId = 0;

const formatRand = (value) => `R ${Math.round(value).toLocaleString("en-ZA")}`;

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "LoadLink API request failed");
  }

  return payload;
}

function formPayload() {
  return {
    customerName: form.customerName.value.trim(),
    customerPhone: form.customerPhone.value.trim(),
    pickupAddress: form.pickupAddress.value.trim(),
    dropoffAddress: form.dropoffAddress.value.trim(),
    pickupKey: form.pickup.value,
    dropoffKey: form.dropoff.value,
    loadTypeKey: form.loadType.value,
    vehicleKey: form.vehicle.value,
    pickupDate: form.pickupDate.value || todayIsoDate(),
    pickupTime: form.pickupTime.value || "10:00",
    helpers: document.querySelector("#helpers").checked,
    stairs: document.querySelector("#stairs").checked,
    notes: document.querySelector("#loadNotes").value.trim()
  };
}

function setPill(element, label, className) {
  element.textContent = label;
  element.className = `status-pill ${className}`;
}

function updateQuoteUi(quote) {
  document.querySelector("#quotePrice").textContent = formatRand(quote.price);
  document.querySelector("#pickupLabel").textContent = quote.pickup.address || quote.pickup.label;
  document.querySelector("#dropoffLabel").textContent = quote.dropoff.address || quote.dropoff.label;
  document.querySelector("#distanceText").textContent = `${quote.distance.toFixed(1)} km`;
  document.querySelector("#vehicleText").textContent = quote.vehicle.label;
  document.querySelector("#loadText").textContent = quote.load.label;
  document.querySelector("#etaText").textContent = `${quote.eta} min`;
  document.querySelector("#routeSource").textContent = quote.routeSource || "Address matched";
  document.querySelector("#heroFare").textContent = formatRand(quote.price);
  document.querySelector("#heroDistance").textContent = `${quote.distance.toFixed(1)} km`;
}

function updateStatusUi(status) {
  const statusData = statusMap[status] || statusMap.draft;
  setPill(document.querySelector("#bookingStatus"), statusData.customer, statusData.className);
  document.querySelector("#heroStatus").textContent = statusData.customer;
}

function syncFormFromTrip(trip) {
  if (!trip) return;

  form.customerName.value = trip.customerName || "";
  form.customerPhone.value = trip.customerPhone || "";
  form.pickupAddress.value = trip.pickupAddress || trip.pickup?.address || "";
  form.dropoffAddress.value = trip.dropoffAddress || trip.dropoff?.address || "";
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
  const quote = activeTrip || draftQuote;
  if (!quote) return;

  updateQuoteUi(quote);
  updateStatusUi(activeTrip ? activeTrip.status : "draft");
}

async function refreshDraft() {
  const requestId = ++quoteRequestId;
  activeTrip = null;

  try {
    const payload = await apiRequest("/api/quote", {
      method: "POST",
      body: JSON.stringify(formPayload())
    });

    if (requestId !== quoteRequestId) return;

    draftQuote = payload.quote;
    render();
  } catch (error) {
    setPill(document.querySelector("#bookingStatus"), "API offline", "warning");
  }
}

async function loadCurrentBooking() {
  try {
    const payload = await apiRequest("/api/bookings/current");

    if (payload.booking) {
      activeTrip = payload.booking;
      draftQuote = payload.booking;
      syncFormFromTrip(payload.booking);
      render();
      return;
    }
  } catch (error) {
    setPill(document.querySelector("#bookingStatus"), "API offline", "warning");
  }

  await refreshDraft();
}

async function confirmBooking() {
  confirmBtn.disabled = true;
  confirmBtn.textContent = "Sending request...";

  try {
    const payload = await apiRequest("/api/bookings", {
      method: "POST",
      body: JSON.stringify(formPayload())
    });

    activeTrip = payload.booking;
    draftQuote = payload.booking;
    render();
    window.location.href = "payment.html";
  } catch (error) {
    setPill(document.querySelector("#bookingStatus"), "Request failed", "warning");
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.textContent = "Submit request";
  }
}

async function clearRequest() {
  activeTrip = null;
  draftQuote = null;

  try {
    await apiRequest("/api/bookings/current", { method: "DELETE" });
  } catch (error) {
    setPill(document.querySelector("#bookingStatus"), "Reset failed", "warning");
  }

  form.reset();
  form.customerName.value = "Khutso Mothopa";
  form.customerPhone.value = "+27 72 000 0000";
  form.pickupAddress.value = "Sandton City, 83 Rivonia Road, Sandton";
  form.dropoffAddress.value = "Rosebank Mall, 15A Cradock Avenue, Rosebank";
  form.pickupDate.value = todayIsoDate();
  form.pickupTime.value = "10:00";
  document.querySelector("#loadNotes").value = "Moving one queen bed and base. Customer will meet driver at reception.";
  await refreshDraft();
}

form.addEventListener("change", refreshDraft);
form.addEventListener("input", refreshDraft);
confirmBtn.addEventListener("click", confirmBooking);
resetBtn.addEventListener("click", clearRequest);

confirmBtn.textContent = "Continue to payment";
form.pickupDate.value = form.pickupDate.value || todayIsoDate();
loadCurrentBooking();
