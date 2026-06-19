const statusMap = {
  draft: {
    customer: "Draft quote",
    payment: "Not requested",
    trip: "Draft",
    className: "neutral",
    timelineIndex: 0
  },
  dispatcher_notified: {
    customer: "Request sent",
    payment: "Payment due",
    trip: "Dispatcher notified",
    className: "warning",
    timelineIndex: 1
  },
  driver_assigned: {
    customer: "Driver accepted",
    payment: "Payment due",
    trip: "Driver assigned",
    className: "active",
    timelineIndex: 2
  },
  driver_en_route: {
    customer: "Driver on the way",
    payment: "Payment due",
    trip: "Driver on the way",
    className: "active",
    timelineIndex: 3
  },
  goods_collected: {
    customer: "Goods collected",
    payment: "Payment due",
    trip: "Goods collected",
    className: "active",
    timelineIndex: 4
  },
  delivered: {
    customer: "Delivered",
    payment: "Payment due",
    trip: "Delivered",
    className: "complete",
    timelineIndex: 5
  }
};

const form = document.querySelector("#bookingForm");
const confirmBtn = document.querySelector("#confirmBtn");
const resetBtn = document.querySelector("#resetBtn");
const payBtn = document.querySelector("#payBtn");

let activeTrip = null;
let draftQuote = null;
let quoteRequestId = 0;
let pollingId = null;

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

function paymentLabel(trip) {
  if (!trip) return "Not requested";
  return trip.payment?.status === "paid" ? "Paid" : "Payment due";
}

function paymentClass(trip) {
  if (!trip) return "neutral";
  return trip.payment?.status === "paid" ? "complete" : "warning";
}

function updateQuoteUi(quote) {
  document.querySelector("#quotePrice").textContent = formatRand(quote.price);
  document.querySelector("#paymentAmount").textContent = formatRand(quote.price);
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
  setPill(document.querySelector("#tripStatus"), statusData.trip, statusData.className);
  setPill(document.querySelector("#paymentStatus"), paymentLabel(activeTrip), paymentClass(activeTrip));
  document.querySelector("#heroStatus").textContent = statusData.customer;

  payBtn.disabled = !activeTrip || activeTrip.payment?.status === "paid";
  payBtn.textContent = activeTrip?.payment?.status === "paid" ? "Payment received" : "Pay securely";

  document.querySelectorAll("#timeline li").forEach((item, index) => {
    item.classList.toggle("done", index < statusData.timelineIndex);
    item.classList.toggle("current", index === statusData.timelineIndex);
  });
}

function updateTrackingUi(trip, quote) {
  const active = trip || {};
  const dispatcher = active.dispatcher;
  const driver = active.assignedDriver;

  document.querySelector("#bookingId").textContent = active.id || "Not confirmed";
  document.querySelector("#dispatchNotice").textContent = dispatcher?.notified
    ? `${dispatcher.name} notified`
    : "Waiting for request";
  document.querySelector("#assignedDriver").textContent = driver
    ? `${driver.name}, ${driver.vehicle}, ${driver.distanceToPickup} km away`
    : "Not assigned yet";
  document.querySelector("#scheduledPickup").textContent = `${active.pickupDate || form.pickupDate.value || todayIsoDate()}, ${active.pickupTime || form.pickupTime.value || "10:00"}`;
  document.querySelector("#paymentReference").textContent = active.payment?.reference || "Pending";
  document.querySelector("#paymentAmount").textContent = formatRand((trip || quote).price);
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
  updateTrackingUi(activeTrip, quote);
  updateStatusUi(activeTrip ? activeTrip.status : "draft");
}

function startPolling() {
  if (pollingId) return;

  pollingId = window.setInterval(loadCurrentBooking, 3000);
}

function stopPollingIfComplete() {
  if (!activeTrip || activeTrip.status !== "delivered" || !pollingId) return;

  window.clearInterval(pollingId);
  pollingId = null;
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
    setPill(document.querySelector("#tripStatus"), "API offline", "warning");
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
      stopPollingIfComplete();
      return;
    }
  } catch (error) {
    setPill(document.querySelector("#tripStatus"), "API offline", "warning");
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
    startPolling();
    document.querySelector("#payment").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    setPill(document.querySelector("#tripStatus"), "Request failed", "warning");
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.textContent = "Submit request";
  }
}

async function makePayment() {
  if (!activeTrip) return;

  payBtn.disabled = true;
  payBtn.textContent = "Processing...";

  try {
    const payload = await apiRequest(`/api/bookings/${activeTrip.id}/payment`, {
      method: "POST",
      body: JSON.stringify({ method: "card" })
    });

    activeTrip = payload.booking;
    draftQuote = payload.booking;
    render();
    document.querySelector("#tracking").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    setPill(document.querySelector("#paymentStatus"), "Payment failed", "warning");
  }
}

async function resetDemo() {
  activeTrip = null;
  draftQuote = null;

  if (pollingId) {
    window.clearInterval(pollingId);
    pollingId = null;
  }

  try {
    await apiRequest("/api/bookings/current", { method: "DELETE" });
  } catch (error) {
    setPill(document.querySelector("#tripStatus"), "Reset failed", "warning");
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
payBtn.addEventListener("click", makePayment);
resetBtn.addEventListener("click", resetDemo);

confirmBtn.textContent = "Submit request";
form.pickupDate.value = form.pickupDate.value || todayIsoDate();
loadCurrentBooking();
