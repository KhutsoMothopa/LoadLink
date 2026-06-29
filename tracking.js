const statusMap = {
  awaiting_payment: { label: "Awaiting payment", className: "warning", timelineIndex: 0 },
  dispatcher_notified: { label: "Dispatcher notified", className: "warning", timelineIndex: 1 },
  driver_assigned: { label: "Driver reviewing job", className: "warning", timelineIndex: 2 },
  driver_en_route: { label: "Driver on the way", className: "active", timelineIndex: 3 },
  goods_collected: { label: "Goods collected", className: "active", timelineIndex: 4 },
  delivered: { label: "Delivered", className: "complete", timelineIndex: 5 }
};

const activeBookingKey = "loadlinkActiveBooking";

async function apiRequest(path) {
  const response = await fetch(path);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(payload.error || "LoadLink API request failed");
  }

  return payload;
}

function storedBooking() {
  try {
    return JSON.parse(window.sessionStorage.getItem(activeBookingKey) || "null");
  } catch (error) {
    return null;
  }
}

function saveActiveBooking(booking) {
  if (!booking) return;
  window.sessionStorage.setItem(activeBookingKey, JSON.stringify(booking));
  window.LoadLinkOps?.saveBooking(booking);
}

function setPill(element, label, className) {
  element.textContent = label;
  element.className = `status-pill ${className}`;
}

function renderEmpty() {
  setPill(document.querySelector("#tripStatus"), "No active request", "neutral");
  setPill(document.querySelector("#paymentStatus"), "Not paid", "neutral");
  document.querySelector("#trackingIntro").textContent = "No active delivery was found. Create a request first, then return to this page.";
}

function renderTimeline(status) {
  const statusData = statusMap[status] || statusMap.awaiting_payment;

  document.querySelectorAll("#timeline li").forEach((item, index) => {
    item.classList.toggle("done", index < statusData.timelineIndex);
    item.classList.toggle("current", index === statusData.timelineIndex);
  });

  setPill(document.querySelector("#tripStatus"), statusData.label, statusData.className);
}

function renderBooking(booking) {
  saveActiveBooking(booking);
  const driver = booking.assignedDriver;
  const paid = booking.payment?.status === "paid";
  const proofSubmitted = booking.payment?.status === "proof_submitted";

  renderTimeline(booking.status);
  setPill(
    document.querySelector("#paymentStatus"),
    paid ? "Paid" : proofSubmitted ? "Proof under review" : "Payment due",
    paid ? "complete" : "warning"
  );
  document.querySelector("#trackingIntro").textContent = `Tracking booking ${booking.id}. This page refreshes automatically.`;
  document.querySelector("#bookingId").textContent = booking.id;
  document.querySelector("#dispatchNotice").textContent = booking.dispatcher?.notified
    ? `${booking.dispatcher.name} notified`
    : "Waiting for request";
  document.querySelector("#assignedDriver").textContent = driver
    ? `${driver.name}, ${driver.vehicle}, ${driver.distanceToPickup} km away`
    : "Not assigned yet";
  document.querySelector("#pickupAddress").textContent = booking.pickupAddress || booking.pickup?.address || "Not available";
  document.querySelector("#dropoffAddress").textContent = booking.dropoffAddress || booking.dropoff?.address || "Not available";
  document.querySelector("#scheduledPickup").textContent = `${booking.pickupDate}, ${booking.pickupTime}`;
  document.querySelector("#paymentReference").textContent = booking.payment?.reference || (proofSubmitted ? "Proof submitted" : "Pending");
}

async function refreshTracking() {
  const fallbackBooking = storedBooking();
  const operationalBooking = window.LoadLinkOps
    ?.mergeBookings()
    .find((booking) => booking.id === fallbackBooking?.id);

  if (operationalBooking || fallbackBooking) {
    renderBooking(operationalBooking || fallbackBooking);
  }

  try {
    const payload = await apiRequest(fallbackBooking?.id ? `/api/bookings/${fallbackBooking.id}` : "/api/bookings/current");

    if (!payload.booking) {
      if (!fallbackBooking) renderEmpty();
      return;
    }

    renderBooking(payload.booking);
  } catch (error) {
    if (!fallbackBooking) {
      setPill(document.querySelector("#tripStatus"), "Tracking unavailable", "warning");
    }
  }
}

refreshTracking();
window.setInterval(refreshTracking, 3000);
