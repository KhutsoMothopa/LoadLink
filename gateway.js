const completePaymentBtn = document.querySelector("#completePaymentBtn");
const params = new URLSearchParams(window.location.search);
const sessionId = params.get("sessionId");

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

function setStatus(label, className) {
  const pill = document.querySelector("#gatewayStatus");
  pill.textContent = label;
  pill.className = `status-pill ${className}`;
}

function renderSession(session) {
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

  try {
    const payload = await apiRequest(`/api/payments/sessions/${sessionId}`);
    renderSession(payload.session);
  } catch (error) {
    setStatus("Session unavailable", "warning");
    completePaymentBtn.disabled = true;
  }
}

async function completePayment() {
  completePaymentBtn.disabled = true;
  completePaymentBtn.textContent = "Confirming...";

  try {
    await apiRequest(`/api/payments/sessions/${sessionId}/confirm`, { method: "POST" });
    window.location.href = "tracking.html";
  } catch (error) {
    setStatus("Payment failed", "warning");
    completePaymentBtn.disabled = false;
    completePaymentBtn.textContent = "Complete payment";
  }
}

completePaymentBtn.addEventListener("click", completePayment);
loadGatewaySession();
