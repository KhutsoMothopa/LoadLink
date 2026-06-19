const locations = {
  sandton: { label: "Sandton", lat: -26.1076, lng: 28.0567 },
  rosebank: { label: "Rosebank", lat: -26.1466, lng: 28.0416 },
  midrand: { label: "Midrand", lat: -25.9992, lng: 28.1263 },
  soweto: { label: "Soweto", lat: -26.2485, lng: 27.8540 },
  centurion: { label: "Centurion", lat: -25.8603, lng: 28.1894 },
  pretoria: { label: "Pretoria CBD", lat: -25.7479, lng: 28.2293 }
};

const vehicleRates = {
  bakkie: { label: "Bakkie", base: 280, perKm: 15, eta: 7 },
  canopy: { label: "Bakkie with canopy", base: 330, perKm: 17, eta: 9 },
  smallTruck: { label: "Small truck", base: 460, perKm: 23, eta: 12 },
  largeTruck: { label: "Large truck", base: 680, perKm: 31, eta: 16 }
};

const loadFees = {
  bed: { label: "Bed or mattress", fee: 30 },
  furniture: { label: "Household furniture", fee: 85 },
  appliance: { label: "Appliance", fee: 60 },
  business: { label: "Business stock", fee: 95 },
  construction: { label: "Construction material", fee: 140 }
};

const form = document.querySelector("#quoteForm");
const calculateBtn = document.querySelector("#calculateBtn");
const confirmBtn = document.querySelector("#confirmBtn");
const acceptBtn = document.querySelector("#acceptBtn");

const formatRand = (value) => `R ${Math.round(value).toLocaleString("en-ZA")}`;

function distanceKm(start, end) {
  const earthRadius = 6371;
  const toRadians = (degree) => degree * (Math.PI / 180);
  const latDistance = toRadians(end.lat - start.lat);
  const lngDistance = toRadians(end.lng - start.lng);
  const startLat = toRadians(start.lat);
  const endLat = toRadians(end.lat);
  const a =
    Math.sin(latDistance / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(lngDistance / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.max(3.5, earthRadius * c * 1.18);
}

function calculateQuote() {
  const pickup = locations[form.pickup.value];
  const dropoff = locations[form.dropoff.value];
  const vehicle = vehicleRates[form.vehicle.value];
  const load = loadFees[form.loadType.value];
  const helpersFee = document.querySelector("#helpers").checked ? 170 : 0;
  const stairsFee = document.querySelector("#stairs").checked ? 95 : 0;
  const distance = distanceKm(pickup, dropoff);
  const platformFee = 45;
  const price = vehicle.base + distance * vehicle.perKm + load.fee + helpersFee + stairsFee + platformFee;

  return {
    pickup,
    dropoff,
    vehicle,
    load,
    distance,
    price,
    eta: vehicle.eta + Math.round(distance / 8)
  };
}

function setDispatchState(state) {
  const dispatchState = document.querySelector("#dispatchState");
  const driverStatus = document.querySelector("#driverStatus");

  if (state === "waiting") {
    dispatchState.textContent = "Waiting for customer confirmation";
    driverStatus.textContent = "Standby";
    driverStatus.classList.remove("active");
    acceptBtn.disabled = true;
    acceptBtn.textContent = "Driver accepts trip";
    confirmBtn.textContent = "Confirm request";
  }

  if (state === "notified") {
    dispatchState.textContent = "Trip sent to nearby driver";
    driverStatus.textContent = "Notified";
    driverStatus.classList.add("active");
    acceptBtn.disabled = false;
    acceptBtn.textContent = "Driver accepts trip";
  }

  if (state === "accepted") {
    dispatchState.textContent = "Driver accepted and is heading to pickup";
    driverStatus.textContent = "Accepted";
    driverStatus.classList.add("active");
    acceptBtn.disabled = true;
  }
}

function updateQuote() {
  const quote = calculateQuote();

  document.querySelector("#quotePrice").textContent = formatRand(quote.price);
  document.querySelector("#driverFare").textContent = formatRand(quote.price);
  document.querySelector("#pickupLabel").textContent = quote.pickup.label;
  document.querySelector("#dropoffLabel").textContent = quote.dropoff.label;
  document.querySelector("#distanceText").textContent = `${quote.distance.toFixed(1)} km`;
  document.querySelector("#vehicleText").textContent = quote.vehicle.label;
  document.querySelector("#loadText").textContent = quote.load.label;
  document.querySelector("#etaText").textContent = `${quote.eta} min`;
  document.querySelector("#driverMeta").textContent = `${quote.vehicle.label} driver · 4.9 rating · ${Math.max(1.2, quote.distance / 4).toFixed(1)} km away`;
  setDispatchState("waiting");
}

calculateBtn.addEventListener("click", updateQuote);

form.addEventListener("change", updateQuote);

confirmBtn.addEventListener("click", () => {
  updateQuote();
  setDispatchState("notified");
  confirmBtn.textContent = "Request confirmed";
});

acceptBtn.addEventListener("click", () => {
  setDispatchState("accepted");
  acceptBtn.textContent = "Trip accepted";
});

updateQuote();
