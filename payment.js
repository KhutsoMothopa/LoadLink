const proofForm = document.querySelector("#proofForm");
const payBtn = document.querySelector("#payBtn");
const proofFile = document.querySelector("#proofFile");
const proofNote = document.querySelector("#proofNote");
const params = new URLSearchParams(window.location.search);
const bookingId = params.get("bookingId");
const activeBookingKey = "loadlinkActiveBooking";

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

function proofStatusFor(booking) {
  if (booking.payment?.status === "paid") {
    return { label: "Payment confirmed", className: "complete", button: "Payment confirmed", disabled: true };
  }

  if (booking.payment?.status === "proof_submitted") {
    return { label: "Proof submitted", className: "warning", button: "Proof waiting for dispatcher", disabled: true };
  }

  return { label: "Awaiting proof", className: "warning", button: "Submit proof to dispatch", disabled: false };
}

function renderBooking(booking) {
  saveActiveBooking(booking);
  document.querySelector("#bookingId").textContent = booking.id;
  document.querySelector("#bankReference").textContent = booking.id;
  document.querySelector("#paymentAmount").textContent = formatRand(booking.price);
  document.querySelector("#pickupAddress").textContent = booking.pickupAddress || booking.pickup?.address || "Not available";
  document.querySelector("#dropoffAddress").textContent = booking.dropoffAddress || booking.dropoff?.address || "Not available";
  document.querySelector("#vehicleText").textContent = booking.vehicle?.label || "Not available";

  const status = proofStatusFor(booking);
  setPaymentStatus(status.label, status.className);
  payBtn.disabled = status.disabled;
  payBtn.textContent = status.button;
  proofFile.disabled = status.disabled;
  proofNote.disabled = status.disabled;
}

function readProofFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Proof file could not be read"));
    reader.readAsDataURL(file);
  });
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
      const status = proofStatusFor(fallbackBooking);
      setPaymentStatus(status.label, status.className);
      return;
    }

    setPaymentStatus("Payment unavailable", "warning");
    payBtn.disabled = true;
  }
}

async function submitProof(event) {
  event.preventDefault();
  const booking = activeBooking || storedBooking();
  const file = proofFile.files[0];

  if (!booking) {
    renderEmpty();
    return;
  }

  if (!file) {
    setPaymentStatus("Proof required", "warning");
    return;
  }

  if (file.size > 650_000) {
    setPaymentStatus("File too large", "warning");
    document.querySelector("#paymentIntro").textContent = "Please upload a smaller proof file for now. PDF or image under 650 KB works best.";
    return;
  }

  payBtn.disabled = true;
  payBtn.textContent = "Uploading proof...";

  try {
    const proofDataUrl = await readProofFile(file);
    const payload = await apiRequest(`/api/bookings/${booking.id}/payment-proof`, {
      method: "POST",
      body: JSON.stringify({
        bookingSnapshot: booking,
        note: proofNote.value.trim(),
        proof: {
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          fileSize: file.size,
          dataUrl: proofDataUrl
        }
      })
    });

    saveActiveBooking(payload.booking);
    window.location.href = "tracking.html";
  } catch (error) {
    const now = new Date().toISOString();
    const localBooking = {
      ...booking,
      status: "awaiting_payment",
      payment: {
        ...(booking.payment || {}),
        status: "proof_submitted",
        method: "manual_eft",
        reference: booking.id,
        proof: {
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          fileSize: file.size,
          note: proofNote.value.trim(),
          submittedAt: now,
          dataUrl: await readProofFile(file)
        }
      },
      updatedAt: now,
      statusHistory: [
        ...(booking.statusHistory || []),
        { status: "payment_proof_submitted", at: now, actor: "customer" }
      ]
    };

    saveActiveBooking(localBooking);
    window.location.href = "tracking.html";
  }
}

proofForm.addEventListener("submit", submitProof);
loadPayment();
