const completePaymentBtn = document.querySelector("#completePaymentBtn");
const params = new URLSearchParams(window.location.search);
const sessionId = params.get("sessionId");
const activeBookingKey = "loadlinkActiveBooking";
const checkoutSessionKey = "loadlinkCheckoutSession";

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
    return JSON.parse(window.sessionStorage.getItem(activeBookingKey) || "null");
  } catch (error) {
    return null;
  }
}

function storedSession() {
  try {
    const session = JSON.parse(window.sessionStorage.getItem(checkoutSessionKey) || "null");
    return session?.id === sessionId ? session : null;
  } catch (error) {
    return null;
  }
}

function saveSession(session) {
  if (!session) return;
  window.sessionStorage.setItem(checkoutSessionKey, JSON.stringify(session));
}

function saveBooking(booking) {
  if (!booking) return;
  window.sessionStorage.setItem(activeBookingKey, JSON.stringify(booking));
}

function setStatus(label, className) {
  const pill = document.querySelector("#gatewayStatus");
  pill.textContent = label;
  pill.className = `status-pill ${className}`;
}

function renderSession(session) {
  saveSession(session);
  saveBooking(session.booking);
  document.querySelector("#gatewayProvider").textContent = session.provider;
  document.querySelector("#bookingId").textContent = session.bookingId;
  document.querySelector("#paymentAmount").textContent = formatRand(session.amount);
  document.querySelector("#paymentMethod").textContent = session.method.toUpperCase();
  document.querySelector("#sessionId").textContent = session.id;
  setStatus(session.status === "paid" ? "Paid" : "Pending", session.status === "paid" ? "complete" : "warning");
  completePaymentBtn.disabled = session.status === "paid";
  completePaymentBtn.textContent = session.status === "paid" ? "Payment complete" : "Complete payment";
}

async function loadGatewaySession() {
  if (!sessionId) {
    setStatus("Invalid session", "warning");
    completePaymentBtn.disabled = true;
    return;
  }

  const fallbackSession = storedSession();

  if (fallbackSession) {
    renderSession(fallbackSession);
  }

  try {
    const payload = await apiRequest(`/api/payments/sessions/${sessionId}`);
    renderSession(payload.session);
  } catch (error) {
    if (!fallbackSession) {
      setStatus("Session unavailable", "warning");
      completePaymentBtn.disabled = true;
    }
  }
}

async function completePayment() {
  completePaymentBtn.disabled = true;
  completePaymentBtn.textContent = "Confirming...";

  try {
    const payload = await apiRequest(`/api/payments/sessions/${sessionId}/confirm`, {
      method: "POST",
      body: JSON.stringify({
        sessionSnapshot: storedSession(),
        bookingSnapshot: storedBooking()
      })
    });
    saveBooking(payload.session?.booking);
    window.location.href = "tracking.html";
  } catch (error) {
    setStatus("Payment failed", "warning");
    completePaymentBtn.disabled = false;
    completePaymentBtn.textContent = "Complete payment";
  }
}

completePaymentBtn.addEventListener("click", completePayment);
loadGatewaySession();
