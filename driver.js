const driverJobList = document.querySelector("#driverJobList");
const refreshJobsBtn = document.querySelector("#refreshJobsBtn");
const availableToggle = document.querySelector("#availableToggle");
const locationSelect = document.querySelector("#locationSelect");
const saveAvailabilityBtn = document.querySelector("#saveAvailabilityBtn");
const availabilityStatus = document.querySelector("#availabilityStatus");
const locationMeta = document.querySelector("#locationMeta");
const earningsPeriod = document.querySelector("#earningsPeriod");
const completedJobs = document.querySelector("#completedJobs");
const totalEarned = document.querySelector("#totalEarned");
const earningsStatus = document.querySelector("#earningsStatus");

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

function setAvailabilityStatus(label, className) {
  availabilityStatus.textContent = label;
  availabilityStatus.className = `status-pill ${className}`;
}

function renderLocations(locations, selectedKey) {
  locationSelect.innerHTML = Object.entries(locations)
    .map(([key, location]) => `<option value="${key}" ${key === selectedKey ? "selected" : ""}>${location.label}</option>`)
    .join("");
}

function renderProfile(profile, locations) {
  availableToggle.checked = Boolean(profile.available);
  renderLocations(locations, profile.currentLocationKey);
  setAvailabilityStatus(profile.available ? "Available" : "Unavailable", profile.available ? "active" : "warning");
  locationMeta.textContent = `Current area: ${profile.currentLocationLabel}. Updated ${new Date(profile.updatedAt).toLocaleString("en-ZA")}.`;
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
        <div>
          <dt>Your current area</dt>
          <dd>${driver.currentLocationLabel || "Not shared"}</dd>
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
  const cachedJobs = window.LoadLinkOps?.driverJobs() || [];

  if (cachedJobs.length) {
    renderJobs(cachedJobs);
  } else {
    setQueueStatus("Loading", "neutral");
  }

  try {
    const payload = await apiRequest("/api/driver/jobs");
    const jobs = window.LoadLinkOps
      ? window.LoadLinkOps.driverJobs(payload.jobs)
      : payload.jobs;

    renderJobs(jobs);
  } catch (error) {
    if (cachedJobs.length) {
      setQueueStatus("Saved jobs", "warning");
    } else {
      setQueueStatus("Driver API offline", "warning");
    }
  }
}

async function loadProfile() {
  setAvailabilityStatus("Loading", "neutral");

  try {
    const payload = await apiRequest("/api/driver/profile");
    const profile = window.LoadLinkOps?.saveDriverProfile(payload.profile) || payload.profile;
    renderProfile(profile, payload.locations);
  } catch (error) {
    const profile = window.LoadLinkOps?.getDrivers().find((driver) => driver.id === window.LoadLinkOps.activeDriverId);

    if (profile) {
      renderProfile(profile, window.LoadLinkOps.locations);
      setAvailabilityStatus("Saved profile", "warning");
    } else {
      setAvailabilityStatus("Offline", "warning");
      locationMeta.textContent = "Driver profile could not be loaded.";
    }
  }
}

async function saveProfile() {
  setAvailabilityStatus("Saving", "warning");
  saveAvailabilityBtn.disabled = true;
  const selectedLocationLabel = locationSelect.options[locationSelect.selectedIndex]?.textContent || "Selected area";

  try {
    if (window.LoadLinkAuth) {
      const [session, supabase] = await Promise.all([
        window.LoadLinkAuth.currentSession(),
        window.LoadLinkAuth.client()
      ]);

      if (session?.user?.id) {
        const { error: driverProfileError } = await supabase
          .from("driver_profiles")
          .update({
            availability: availableToggle.checked,
            status: availableToggle.checked ? "available" : "offline",
            current_location_key: locationSelect.value,
            current_location_label: selectedLocationLabel,
            updated_at: new Date().toISOString()
          })
          .eq("user_id", session.user.id);

        if (driverProfileError) throw driverProfileError;
      }
    }

    const payload = await apiRequest("/api/driver/profile", {
      method: "PATCH",
      body: JSON.stringify({
        available: availableToggle.checked,
        currentLocationKey: locationSelect.value
      })
    });

    const profile = window.LoadLinkOps?.saveDriverProfile(payload.profile) || payload.profile;
    renderProfile(profile, Object.fromEntries([...locationSelect.options].map((option) => [
      option.value,
      { label: option.textContent }
    ])));
    await loadJobs();
  } catch (error) {
    const profile = window.LoadLinkOps?.saveDriverProfile({
      id: window.LoadLinkOps.activeDriverId,
      available: availableToggle.checked,
      currentLocationKey: locationSelect.value,
      currentLocationLabel: selectedLocationLabel,
      updatedAt: new Date().toISOString()
    });

    if (profile) {
      renderProfile(profile, window.LoadLinkOps.locations);
      setAvailabilityStatus("Saved locally", "warning");
      await loadJobs();
    } else {
      setAvailabilityStatus("Save failed", "warning");
      locationMeta.textContent = error.message;
    }
  } finally {
    saveAvailabilityBtn.disabled = false;
  }
}

async function loadEarnings() {
  earningsStatus.textContent = "Loading earnings...";

  try {
    const payload = await apiRequest(`/api/driver/earnings?period=${earningsPeriod.value}`);
    const localEarnings = window.LoadLinkOps?.earnings(earningsPeriod.value);
    const earnings = localEarnings && localEarnings.completedJobs > payload.earnings.completedJobs
      ? localEarnings
      : payload.earnings;

    completedJobs.textContent = earnings.completedJobs.toLocaleString("en-ZA");
    totalEarned.textContent = formatRand(earnings.totalEarned);
    earningsStatus.textContent = `Showing delivered jobs from ${new Date(earnings.periodStart).toLocaleDateString("en-ZA")}.`;
  } catch (error) {
    const earnings = window.LoadLinkOps?.earnings(earningsPeriod.value);

    if (earnings) {
      completedJobs.textContent = earnings.completedJobs.toLocaleString("en-ZA");
      totalEarned.textContent = formatRand(earnings.totalEarned);
      earningsStatus.textContent = `Showing saved delivered jobs from ${new Date(earnings.periodStart).toLocaleDateString("en-ZA")}.`;
    } else {
      earningsStatus.textContent = "Earnings could not be loaded.";
    }
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
    await loadEarnings();
  } catch (error) {
    try {
      window.LoadLinkOps?.respondToJob(jobId, action);
      renderJobs(window.LoadLinkOps?.driverJobs() || []);
      await loadEarnings();
      setQueueStatus("Saved update", "warning");
    } catch (localError) {
      setQueueStatus("Update failed", "warning");
    }
  }
}

async function refreshDashboard() {
  await Promise.all([loadProfile(), loadJobs(), loadEarnings()]);
}

driverJobList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  respondToJob(button.dataset.job, button.dataset.action);
});

refreshJobsBtn.addEventListener("click", refreshDashboard);
saveAvailabilityBtn.addEventListener("click", saveProfile);
earningsPeriod.addEventListener("change", loadEarnings);

refreshDashboard();
window.setInterval(loadJobs, 30000);
