const driverJobList = document.querySelector("#driverJobList");
const refreshJobsBtn = document.querySelector("#refreshJobsBtn");

const statusLabels = {
  driver_assigned: "Awaiting your response",
  driver_en_route: "Accepted - on the way",
  goods_collected: "Goods collected"
};

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

function setQueueStatus(label, className) {
  const pill = document.querySelector("#driverQueueStatus");
  pill.textContent = label;
  pill.className = `status-pill ${className}`;
}

function actionButtons(job) {
  if (job.status === "driver_assigned") {
    return `
      <button class="primary-button" type="button" data-action="accept" data-job="${job.id}">Accept job</button>
      <button class="secondary-dark-button" type="button" data-action="decline" data-job="${job.id}">Decline</button>
    `;
  }

  if (job.status === "driver_en_route") {
    return `<button class="primary-button" type="button" data-action="collected" data-job="${job.id}">Mark goods collected</button>`;
  }

  if (job.status === "goods_collected") {
    return `<button class="primary-button" type="button" data-action="delivered" data-job="${job.id}">Mark delivered</button>`;
  }

  return "";
}

function jobCard(job) {
  const driver = job.assignedDriver || {};

  return `
    <article class="driver-job-card">
      <div class="driver-job-topline">
        <div>
          <p class="section-kicker">${job.id}</p>
          <h3>${statusLabels[job.status] || job.status}</h3>
        </div>
        <span class="status-pill ${job.status === "driver_assigned" ? "warning" : "active"}">${job.vehicle.label}</span>
      </div>

      <dl class="ops-summary">
        <div>
          <dt>Customer</dt>
          <dd>${job.customerName}</dd>
        </div>
        <div>
          <dt>Pickup</dt>
          <dd>${job.pickupAddress || job.pickup.address}</dd>
        </div>
        <div>
          <dt>Drop-off</dt>
          <dd>${job.dropoffAddress || job.dropoff.address}</dd>
        </div>
        <div>
          <dt>Fare</dt>
          <dd>${formatRand(job.price)}</dd>
        </div>
        <div>
          <dt>Your payout</dt>
          <dd>${formatRand(job.driverPayout)}</dd>
        </div>
        <div>
          <dt>Distance to pickup</dt>
          <dd>${driver.distanceToPickup || "-"} km</dd>
        </div>
      </dl>

      <div class="button-stack driver-actions">
        ${actionButtons(job)}
      </div>
    </article>
  `;
}

function renderJobs(jobs) {
  if (!jobs.length) {
    setQueueStatus("No assigned jobs", "neutral");
    driverJobList.innerHTML = `<p class="fine-print">No jobs are waiting right now. Keep this page open and refresh after dispatch assigns a request.</p>`;
    return;
  }

  setQueueStatus(`${jobs.length} active job${jobs.length === 1 ? "" : "s"}`, "active");
  driverJobList.innerHTML = jobs.map(jobCard).join("");
}

async function loadJobs() {
  setQueueStatus("Loading", "neutral");

  try {
    const payload = await apiRequest("/api/driver/jobs");
    renderJobs(payload.jobs);
  } catch (error) {
    setQueueStatus("Driver API offline", "warning");
  }
}

async function respondToJob(jobId, action) {
  setQueueStatus("Updating", "warning");

  try {
    await apiRequest(`/api/driver/jobs/${jobId}/respond`, {
      method: "POST",
      body: JSON.stringify({ action })
    });
    await loadJobs();
  } catch (error) {
    setQueueStatus("Update failed", "warning");
  }
}

driverJobList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  respondToJob(button.dataset.job, button.dataset.action);
});

refreshJobsBtn.addEventListener("click", loadJobs);
loadJobs();
window.setInterval(loadJobs, 5000);
