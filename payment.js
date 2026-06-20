const payBtn = document.querySelector("#payBtn");
const params = new URLSearchParams(window.location.search);
const bookingId = params.get("bookingId");
const activeBookingKey = "loadlinkActiveBooking";
const checkoutSessionKey = "loadlinkCheckoutSession";

let activeBooking = null;

const formatRand = (value) => `R ${Math.round(value).toLocaleString("en-ZA")}`;

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(payload.error || "LoadLink API request failed");
  }

  return payload;
}

function storedBooking() {
  try {
    const booking = JSON.parse(window.sessionStorage.getItem(activeBookingKey) || "null");
    if (!bookingId || booking?.id === bookingId) return booking;
  } catch (error) {
    return null;
  }

  return null;
}

function saveActiveBooking(booking) {
  if (!booking) return;
  activeBooking = booking;
  window.sessionStorage.setItem(activeBookingKey, JSON.stringify(booking));
  window.LoadLinkOps?.saveBooking(booking);
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
  saveActiveBooking(booking);
  document.querySelector("#bookingId").textContent = booking.id;
  document.querySelector("#paymentAmount").textContent = formatRand(booking.price);
  document.querySelector("#pickupAddress").textContent = booking.pickupAddress || booking.pickup?.address || "Not available";
  document.querySelector("#dropoffAddress").textContent = booking.dropoffAddress || booking.dropoff?.address || "Not available";
  document.querySelector("#vehicleText").textContent = booking.vehicle?.label || "Not available";

  const paid = booking.payment?.status === "paid";
  setPaymentStatus(paid ? "Paid" : "Awaiting payment", paid ? "complete" : "warning");
  payBtn.disabled = paid;
  payBtn.textContent = paid ? "Payment received" : "Continue to secure checkout";
}

async function loadPayment() {
  const fallbackBooking = storedBooking();

  if (fallbackBooking) {
    renderBooking(fallbackBooking);
  }

  try {
    const payload = await apiRequest(bookingId ? `/api/bookings/${bookingId}` : "/api/bookings/current");

    if (!payload.booking) {
      if (!fallbackBooking) renderEmpty();
      return;
    }

    renderBooking(payload.booking);
  } catch (error) {
    if (fallbackBooking) {
      setPaymentStatus("Awaiting payment", "warning");
      return;
    }

    setPaymentStatus("Payment unavailable", "warning");
    payBtn.disabled = true;
  }
}

async function startCheckout() {
  payBtn.disabled = true;
  payBtn.textContent = "Opening checkout...";

  try {
    const booking = activeBooking || storedBooking();

    if (!booking) {
      renderEmpty();
      return;
    }

    const payload = await apiRequest("/api/payments/checkout", {
      method: "POST",
      body: JSON.stringify({
        bookingId: booking.id,
        method: selectedMethod(),
        bookingSnapshot: booking
      })
    });

    window.sessionStorage.setItem(checkoutSessionKey, JSON.stringify(payload.session));
    saveActiveBooking(payload.session.booking || booking);
    window.location.href = payload.session.redirectUrl;
  } catch (error) {
    const booking = activeBooking || storedBooking();

    if (booking) {
      const session = {
        id: `CHK-${Date.now().toString().slice(-8)}`,
        bookingId: booking.id,
        provider: "LoadLink Secure Checkout",
        method: selectedMethod(),
        amount: booking.price,
        currency: "ZAR",
        status: "pending",
        createdAt: new Date().toISOString(),
        redirectUrl: `gateway.html?sessionId=CHK-${Date.now().toString().slice(-8)}`
      };

      session.redirectUrl = `gateway.html?sessionId=${session.id}`;
      window.sessionStorage.setItem(checkoutSessionKey, JSON.stringify(session));
      saveActiveBooking(booking);
      window.location.href = session.redirectUrl;
      return;
    }

    setPaymentStatus("Checkout failed", "warning");
    payBtn.disabled = false;
    payBtn.textContent = "Continue to secure checkout";
  }
}

payBtn.addEventListener("click", startCheckout);
loadPayment();
