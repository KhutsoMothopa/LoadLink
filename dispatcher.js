const dispatcherRequestList = document.querySelector("#dispatcherRequestList");
const dispatcherDriverList = document.querySelector("#dispatcherDriverList");
const refreshDispatchBtn = document.querySelector("#refreshDispatchBtn");
let isLoadingDispatcher = false;
let isAssigningRequest = false;
const dispatcherRequests = new Map();

const statusLabels = {
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
  const readyForAssignment = request.status === "dispatcher_notified" || request.status === "driver_assigned";
  const nearest = request.driverCandidates[0];

  return `
    <article class="driver-job-card dispatcher-request-card">
      <div class="driver-job-topline">
        <div>
          <p class="section-kicker">${request.id}</p>
          <h3>${statusLabels[request.status] || request.status}</h3>
        </div>
        <span class="status-pill ${request.status === "dispatcher_notified" ? "warning" : "active"}">${request.vehicle.label}</span>
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
          <dt>Paid amount</dt>
          <dd>${formatRand(request.price)}</dd>
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
  const openRequests = requests.filter((request) => request.status === "dispatcher_notified");
  dispatcherRequests.clear();
  requests.forEach((request) => dispatcherRequests.set(request.id, request));

  if (!requests.length) {
    setStatus("#dispatcherQueueStatus", "No paid requests", "neutral");
    dispatcherRequestList.innerHTML = `<p class="fine-print">No paid requests are waiting right now.</p>`;
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
          <dt>Rating</dt>
          <dd>${driver.rating}</dd>
        </div>
      </dl>
    </article>
  `;
}

function renderDrivers(drivers) {
  const availableCount = drivers.filter((driver) => driver.available).length;
  setStatus("#dispatcherDriverStatus", `${availableCount} available`, availableCount ? "active" : "warning");
  dispatcherDriverList.innerHTML = drivers.length
    ? drivers.map(driverCard).join("")
    : `<p class="fine-print">No drivers are loaded yet.</p>`;
}

async function loadDispatcher() {
  if (isLoadingDispatcher || isAssigningRequest) return;

  isLoadingDispatcher = true;
  refreshDispatchBtn.disabled = true;

  const cachedRequests = window.LoadLinkOps?.paidRequests() || [];
  const cachedDrivers = window.LoadLinkOps?.getDrivers() || [];

  if (cachedRequests.length) {
    renderRequests(cachedRequests);
  } else {
    setStatus("#dispatcherQueueStatus", "Loading", "neutral");
  }

  if (cachedDrivers.length) {
    renderDrivers(cachedDrivers);
  } else {
    setStatus("#dispatcherDriverStatus", "Loading", "neutral");
  }

  try {
    const [requestsPayload, driversPayload] = await Promise.all([
      apiRequest("/api/dispatcher/requests"),
      apiRequest("/api/dispatcher/drivers")
    ]);

    const requests = window.LoadLinkOps
      ? window.LoadLinkOps.paidRequests(requestsPayload.requests)
      : requestsPayload.requests;
    const drivers = window.LoadLinkOps
      ? window.LoadLinkOps.getDrivers(driversPayload.drivers)
      : driversPayload.drivers;

    renderRequests(requests);
    renderDrivers(drivers);
  } catch (error) {
    const requests = window.LoadLinkOps?.paidRequests() || [];
    const drivers = window.LoadLinkOps?.getDrivers() || [];

    if (requests.length) {
      renderRequests(requests);
      setStatus("#dispatcherQueueStatus", "Saved queue", "warning");
    } else {
      setStatus("#dispatcherQueueStatus", "Dispatch API unavailable", "warning");
    }

    if (drivers.length) {
      renderDrivers(drivers);
    } else {
      setStatus("#dispatcherDriverStatus", "Driver list unavailable", "warning");
    }
  } finally {
    isLoadingDispatcher = false;
    refreshDispatchBtn.disabled = false;
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

dispatcherRequestList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action='assign']");
  if (!button) return;

  assignRequest(button.dataset.request);
});

refreshDispatchBtn.addEventListener("click", loadDispatcher);
loadDispatcher();
