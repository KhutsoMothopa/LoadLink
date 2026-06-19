const payBtn = document.querySelector("#payBtn");

const formatRand = (value) => `R ${Math.round(value).toLocaleString("en-ZA")}`;

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

function selectedMethod() {
  return document.querySelector("input[name='paymentMethod']:checked")?.value || "card";
}

function setPaymentStatus(label, className) {
  const pill = document.querySelector("#paymentStatus");
  pill.textContent = label;
  pill.className = `status-pill ${className}`;
}

function renderEmpty() {
  setPaymentStatus("No request", "neutral");
  document.querySelector("#paymentIntro").textContent = "No active request was found. Create a request first, then return to payment.";
  payBtn.disabled = true;
}

function renderBooking(booking) {
  document.querySelector("#bookingId").textContent = booking.id;
  document.querySelector("#paymentAmount").textContent = formatRand(booking.price);
  document.querySelector("#pickupAddress").textContent = booking.pickupAddress || booking.pickup?.address || "Not available";
  document.querySelector("#dropoffAddress").textContent = booking.dropoffAddress || booking.dropoff?.address || "Not available";
  document.querySelector("#vehicleText").textContent = booking.vehicle?.label || "Not available";

  const paid = booking.payment?.status === "paid";
  setPaymentStatus(paid ? "Paid" : "Awaiting payment", paid ? "complete" : "warning");
  payBtn.disabled = paid;
  payBtn.textContent = paid ? "Payment received" : "Pay and send to dispatcher";
}

async function loadPayment() {
  try {
    const payload = await apiRequest("/api/bookings/current");

    if (!payload.booking) {
      renderEmpty();
      return;
    }

    renderBooking(payload.booking);
  } catch (error) {
    setPaymentStatus("Payment offline", "warning");
    payBtn.disabled = true;
  }
}

async function makePayment() {
  payBtn.disabled = true;
  payBtn.textContent = "Processing...";

  try {
    const current = await apiRequest("/api/bookings/current");

    if (!current.booking) {
      renderEmpty();
      return;
    }

    await apiRequest(`/api/bookings/${current.booking.id}/payment`, {
      method: "POST",
      body: JSON.stringify({ method: selectedMethod() })
    });

    window.location.href = "tracking.html";
  } catch (error) {
    setPaymentStatus("Payment failed", "warning");
    payBtn.disabled = false;
    payBtn.textContent = "Pay and send to dispatcher";
  }
}

payBtn.addEventListener("click", makePayment);
loadPayment();
