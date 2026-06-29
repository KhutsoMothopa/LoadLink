const dispatcherRequestList = document.querySelector("#dispatcherRequestList");
const dispatcherDriverList = document.querySelector("#dispatcherDriverList");
const refreshDispatchBtn = document.querySelector("#refreshDispatchBtn");
const hasRequestsPanel = Boolean(dispatcherRequestList);
const hasDriversPanel = Boolean(dispatcherDriverList);
let isLoadingDispatcher = false;
let isAssigningRequest = false;
const dispatcherRequests = new Map();

const statusLabels = {
  awaiting_payment: "Payment proof pending review",
  dispatcher_notified: "Ready for assignment",
  driver_assigned: "Assigned to driver",
  driver_en_route: "Driver accepted",
  goods_collected: "Goods collected",
  delivered: "Delivered"
};

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

function setStatus(selector, label, className) {
  const pill = document.querySelector(selector);
  if (!pill) return;
  pill.textContent = label;
  pill.className = `status-pill ${className}`;
}

function candidateOptions(request) {
  if (!request.driverCandidates.length) {
    return `<option value="">No available matching drivers</option>`;
  }

  return request.driverCandidates
    .map((driver, index) => `
      <option value="${driver.id}">
        ${index === 0 ? "Nearest: " : ""}${driver.name} - ${driver.distanceToPickup} km - ${driver.currentLocationLabel}
      </option>
    `)
    .join("");
}

function requestCard(request) {
  const assignedDriver = request.assignedDriver;
  const paymentConfirmed = request.payment?.status === "paid";
  const proofSubmitted = request.payment?.status === "proof_submitted";
  const readyForAssignment = paymentConfirmed && (request.status === "dispatcher_notified" || request.status === "driver_assigned");
  const nearest = request.driverCandidates[0];
  const proof = request.payment?.proof;
  const proofLink = proof?.dataUrl
    ? `<a class="header-text-action" href="${proof.dataUrl}" target="_blank" rel="noopener">View proof</a>`
    : `<span>${proof?.fileName || "Not uploaded"}</span>`;

  return `
    <article class="driver-job-card dispatcher-request-card">
      <div class="driver-job-topline">
        <div>
          <p class="section-kicker">${request.id}</p>
          <h3>${statusLabels[request.status] || request.status}</h3>
        </div>
        <span class="status-pill ${paymentConfirmed ? "active" : "warning"}">${paymentConfirmed ? "Payment confirmed" : "Proof submitted"}</span>
      </div>

      <dl class="ops-summary">
        <div>
          <dt>Customer</dt>
          <dd>${request.customerName}</dd>
        </div>
        <div>
          <dt>Pickup</dt>
          <dd>${request.pickupAddress || request.pickup.address}</dd>
        </div>
        <div>
          <dt>Drop-off</dt>
          <dd>${request.dropoffAddress || request.dropoff.address}</dd>
        </div>
        <div>
          <dt>Amount due</dt>
          <dd>${formatRand(request.price)}</dd>
        </div>
        <div>
          <dt>Proof of payment</dt>
          <dd>${proofLink}</dd>
        </div>
        <div>
          <dt>Payment note</dt>
          <dd>${proof?.note || request.payment?.reference || "No note provided"}</dd>
        </div>
        <div>
          <dt>Suggested driver</dt>
          <dd>${nearest ? `${nearest.name}, ${nearest.distanceToPickup} km` : "No match"}</dd>
        </div>
        <div>
          <dt>Assigned driver</dt>
          <dd>${assignedDriver ? `${assignedDriver.name}, ${assignedDriver.distanceToPickup} km` : "Not assigned"}</dd>
        </div>
      </dl>

      ${proofSubmitted ? `
        <div class="dispatcher-assignment-row">
          <p class="fine-print">Confirm the payment proof before assigning this request to a driver.</p>
          <button class="primary-button" type="button" data-action="confirm-payment" data-request="${request.id}">
            Confirm payment
          </button>
        </div>
      ` : ""}

      <div class="dispatcher-assignment-row">
        <label>
          <span>Assign driver</span>
          <select data-driver-select="${request.id}" ${!readyForAssignment || !request.driverCandidates.length ? "disabled" : ""}>
            ${candidateOptions(request)}
          </select>
        </label>
        <button class="primary-button" type="button" data-action="assign" data-request="${request.id}" ${!readyForAssignment || !request.driverCandidates.length ? "disabled" : ""}>
          Assign selected driver
        </button>
      </div>
    </article>
  `;
}

function renderRequests(requests) {
  if (!dispatcherRequestList) return;

  const openRequests = requests.filter((request) => ["proof_submitted", "paid"].includes(request.payment?.status));
  dispatcherRequests.clear();
  requests.forEach((request) => dispatcherRequests.set(request.id, request));

  if (!requests.length) {
    setStatus("#dispatcherQueueStatus", "No payment proofs", "neutral");
    dispatcherRequestList.innerHTML = `<p class="fine-print">No payment proofs are waiting right now.</p>`;
    return;
  }

  setStatus("#dispatcherQueueStatus", `${openRequests.length} waiting`, openRequests.length ? "warning" : "active");
  dispatcherRequestList.innerHTML = requests.map(requestCard).join("");
}

function driverCard(driver) {
  return `
    <article class="driver-job-card dispatcher-driver-card">
      <div class="driver-job-topline">
        <div>
          <p class="section-kicker">${driver.id}</p>
          <h3>${driver.name}</h3>
        </div>
        <span class="status-pill ${driver.available ? "active" : "neutral"}">${driver.available ? "Available" : "Unavailable"}</span>
      </div>
      <dl class="ops-summary">
        <div>
          <dt>Current area</dt>
          <dd>${driver.currentLocationLabel}</dd>
        </div>
        <div>
          <dt>Vehicle types</dt>
          <dd>${driver.vehicleTypes.join(", ")}</dd>
        </div>
        <div>
          <dt>Number plate</dt>
          <dd>${driver.numberPlate || "Not registered"}</dd>
        </div>
        <div>
          <dt>Contact</dt>
          <dd>${driver.phone || driver.email || "Not available"}</dd>
        </div>
        <div>
          <dt>Driver status</dt>
          <dd>${driver.jobStatus || (driver.available ? "available" : "offline")}</dd>
        </div>
        <div>
          <dt>Rating</dt>
          <dd>${driver.rating}</dd>
        </div>
      </dl>
    </article>
  `;
}

function renderDrivers(drivers) {
  if (!dispatcherDriverList) return;

  const availableCount = drivers.filter((driver) => driver.available).length;
  setStatus("#dispatcherDriverStatus", `${availableCount} available`, availableCount ? "active" : "warning");
  dispatcherDriverList.innerHTML = drivers.length
    ? drivers.map(driverCard).join("")
    : `<p class="fine-print">No drivers are loaded yet.</p>`;
}

async function registeredDriversFromSupabase() {
  if (!window.LoadLinkAuth) return [];

  try {
    const supabase = await window.LoadLinkAuth.client();
    const { data, error } = await supabase
      .from("driver_profiles")
      .select("user_id, vehicle_type, number_plate, current_location_key, current_location_label, availability, status, rating, approved, profiles(full_name, email, phone)");

    if (error) throw error;

    return (data || []).map((driver) => ({
      id: driver.user_id,
      name: driver.profiles?.full_name || "Registered driver",
      available: Boolean(driver.availability) && driver.status !== "on_job",
      vehicleTypes: [driver.vehicle_type],
      currentLocationKey: driver.current_location_key,
      currentLocationLabel: driver.current_location_label || "Location not shared",
      rating: driver.rating || 5,
      numberPlate: driver.number_plate,
      phone: driver.profiles?.phone,
      email: driver.profiles?.email,
      jobStatus: driver.status,
      approved: driver.approved
    }));
  } catch (error) {
    return [];
  }
}

async function loadDispatcher() {
  if (isLoadingDispatcher || isAssigningRequest || (!hasRequestsPanel && !hasDriversPanel)) return;

  isLoadingDispatcher = true;
  if (refreshDispatchBtn) refreshDispatchBtn.disabled = true;

  const cachedRequests = hasRequestsPanel ? window.LoadLinkOps?.paidRequests() || [] : [];
  const cachedDrivers = hasDriversPanel ? window.LoadLinkOps?.getDrivers() || [] : [];

  if (hasRequestsPanel) {
    if (cachedRequests.length) {
      renderRequests(cachedRequests);
    } else {
      setStatus("#dispatcherQueueStatus", "Loading", "neutral");
    }
  }

  if (hasDriversPanel) {
    if (cachedDrivers.length) {
      renderDrivers(cachedDrivers);
    } else {
      setStatus("#dispatcherDriverStatus", "Loading", "neutral");
    }
  }

  try {
    const [requestsPayload, driversPayload] = await Promise.all([
      hasRequestsPanel ? apiRequest("/api/dispatcher/requests") : Promise.resolve({ requests: [] }),
      hasDriversPanel ? apiRequest("/api/dispatcher/drivers") : Promise.resolve({ drivers: [] })
    ]);

    if (hasRequestsPanel) {
      const requests = window.LoadLinkOps
        ? window.LoadLinkOps.paidRequests(requestsPayload.requests)
        : requestsPayload.requests;
      renderRequests(requests);
    }

    if (hasDriversPanel) {
      const drivers = window.LoadLinkOps
        ? window.LoadLinkOps.getDrivers(driversPayload.drivers)
        : driversPayload.drivers;
      const registeredDrivers = await registeredDriversFromSupabase();
      renderDrivers(registeredDrivers.length ? registeredDrivers : drivers);
    }
  } catch (error) {
    const requests = window.LoadLinkOps?.paidRequests() || [];
    const drivers = window.LoadLinkOps?.getDrivers() || [];

    if (hasRequestsPanel) {
      if (requests.length) {
        renderRequests(requests);
        setStatus("#dispatcherQueueStatus", "Saved queue", "warning");
      } else {
        setStatus("#dispatcherQueueStatus", "Dispatch API unavailable", "warning");
      }
    }

    if (hasDriversPanel) {
      if (drivers.length) {
        renderDrivers(drivers);
      } else {
        setStatus("#dispatcherDriverStatus", "Driver list unavailable", "warning");
      }
    }
  } finally {
    isLoadingDispatcher = false;
    if (refreshDispatchBtn) refreshDispatchBtn.disabled = false;
  }
}

async function assignRequest(requestId) {
  const select = document.querySelector(`[data-driver-select="${requestId}"]`);
  const driverId = select?.value || null;
  const button = document.querySelector(`[data-action="assign"][data-request="${requestId}"]`);
  const bookingSnapshot = dispatcherRequests.get(requestId);

  isAssigningRequest = true;
  if (button) {
    button.disabled = true;
    button.textContent = "Assigning...";
  }
  setStatus("#dispatcherQueueStatus", "Assigning", "warning");

  try {
    const payload = await apiRequest(`/api/dispatcher/requests/${requestId}/assign`, {
      method: "POST",
      body: JSON.stringify({ driverId, bookingSnapshot })
    });

    window.LoadLinkOps?.saveBooking(payload.booking);
    renderRequests(window.LoadLinkOps?.paidRequests() || [payload.booking]);
    setStatus("#dispatcherQueueStatus", "Assigned", "active");
  } catch (error) {
    try {
      const booking = window.LoadLinkOps?.assignBooking(requestId, driverId);
      renderRequests(window.LoadLinkOps?.paidRequests() || [booking]);
      setStatus("#dispatcherQueueStatus", "Assigned from saved queue", "active");
    } catch (localError) {
      setStatus("#dispatcherQueueStatus", "Assignment failed", "warning");
      if (button) button.disabled = false;
    }
  } finally {
    isAssigningRequest = false;
    if (button) button.textContent = "Assign selected driver";
  }
}

async function confirmPayment(requestId) {
  const button = document.querySelector(`[data-action="confirm-payment"][data-request="${requestId}"]`);
  const bookingSnapshot = dispatcherRequests.get(requestId);

  if (button) {
    button.disabled = true;
    button.textContent = "Confirming...";
  }
  setStatus("#dispatcherQueueStatus", "Confirming payment", "warning");

  try {
    const payload = await apiRequest(`/api/dispatcher/requests/${requestId}/confirm-payment`, {
      method: "POST",
      body: JSON.stringify({
        reference: bookingSnapshot?.payment?.reference || requestId,
        bookingSnapshot
      })
    });

    window.LoadLinkOps?.saveBooking(payload.booking);
    renderRequests(window.LoadLinkOps?.paidRequests() || [payload.booking]);
    setStatus("#dispatcherQueueStatus", "Payment confirmed", "active");
  } catch (error) {
    try {
      const booking = window.LoadLinkOps?.confirmPayment(requestId);
      renderRequests(window.LoadLinkOps?.paidRequests() || [booking]);
      setStatus("#dispatcherQueueStatus", "Payment confirmed locally", "active");
    } catch (localError) {
      setStatus("#dispatcherQueueStatus", "Confirmation failed", "warning");
      if (button) button.disabled = false;
    }
  } finally {
    if (button) button.textContent = "Confirm payment";
  }
}

if (dispatcherRequestList) {
  dispatcherRequestList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action='assign']");
    const confirmButton = event.target.closest("button[data-action='confirm-payment']");

    if (confirmButton) {
      confirmPayment(confirmButton.dataset.request);
      return;
    }

    if (!button) return;

    assignRequest(button.dataset.request);
  });
}

if (refreshDispatchBtn) refreshDispatchBtn.addEventListener("click", loadDispatcher);
loadDispatcher();
