(function () {
  const bookingsKey = "loadlinkOperationalBookings";
  const driversKey = "loadlinkOperationalDrivers";
  const activeDriverId = "DRV-101";

  const locations = {
    sandton: { label: "Sandton", lat: -26.1076, lng: 28.0567 },
    rosebank: { label: "Rosebank", lat: -26.1466, lng: 28.0416 },
    midrand: { label: "Midrand", lat: -25.9992, lng: 28.1263 },
    soweto: { label: "Soweto", lat: -26.2485, lng: 27.8540 },
    centurion: { label: "Centurion", lat: -25.8603, lng: 28.1894 },
    pretoria: { label: "Pretoria CBD", lat: -25.7479, lng: 28.2293 }
  };

  const defaultDrivers = [
    { id: "DRV-101", name: "Thabo M.", vehicleTypes: ["bakkie", "canopy"], currentLocationKey: "sandton", rating: 4.9 },
    { id: "DRV-102", name: "Lerato K.", vehicleTypes: ["bakkie", "smallTruck"], currentLocationKey: "rosebank", rating: 4.8 },
    { id: "DRV-103", name: "Mandla S.", vehicleTypes: ["smallTruck", "largeTruck"], currentLocationKey: "midrand", rating: 4.7 },
    { id: "DRV-104", name: "Nomsa P.", vehicleTypes: ["canopy", "largeTruck"], currentLocationKey: "centurion", rating: 4.9 }
  ];

  function readJson(key, fallback) {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(key) || "null");
      return Array.isArray(parsed) ? parsed : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  function normalizeDriver(driver) {
    const locationKey = driver.currentLocationKey || driver.defaultLocationKey || "sandton";
    const location = locations[locationKey] || locations.sandton;

    return {
      ...driver,
      available: driver.available !== false,
      currentLocationKey: locationKey,
      currentLocationLabel: driver.currentLocationLabel || location.label,
      lat: driver.lat ?? location.lat,
      lng: driver.lng ?? location.lng,
      updatedAt: driver.updatedAt || new Date().toISOString()
    };
  }

  function getDrivers(apiDrivers = []) {
    const stored = readJson(driversKey, []);
    const map = new Map(defaultDrivers.map((driver) => [driver.id, normalizeDriver(driver)]));

    stored.forEach((driver) => map.set(driver.id, normalizeDriver({ ...map.get(driver.id), ...driver })));
    apiDrivers.forEach((driver) => map.set(driver.id, normalizeDriver({ ...map.get(driver.id), ...driver })));

    const drivers = [...map.values()];
    writeJson(driversKey, drivers);
    return drivers;
  }

  function saveDriverProfile(profile) {
    const drivers = getDrivers().map((driver) => driver.id === profile.id ? normalizeDriver({ ...driver, ...profile }) : driver);
    writeJson(driversKey, drivers);
    return drivers.find((driver) => driver.id === profile.id);
  }

  function getBookings() {
    return readJson(bookingsKey, []);
  }

  function saveBookings(bookings) {
    writeJson(bookingsKey, bookings);
  }

  function saveBooking(booking) {
    if (!booking?.id) return null;

    const bookings = getBookings();
    const index = bookings.findIndex((item) => item.id === booking.id);

    if (index >= 0) {
      bookings[index] = { ...bookings[index], ...booking };
    } else {
      bookings.push(booking);
    }

    saveBookings(bookings);
    return bookings.find((item) => item.id === booking.id);
  }

  function mergeBookings(apiBookings = []) {
    apiBookings.forEach(saveBooking);
    return getBookings().sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
  }

  function toRad(value) {
    return value * Math.PI / 180;
  }

  function distanceKm(a, b) {
    if (!a || !b) return 0;

    const earthRadius = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

    return earthRadius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  function driverCandidates(booking) {
    return getDrivers()
      .filter((driver) =>
        driver.available &&
        driver.vehicleTypes.includes(booking.vehicleKey) &&
        !booking.declinedDriverIds?.includes(driver.id)
      )
      .map((driver) => ({
        id: driver.id,
        name: driver.name,
        rating: driver.rating,
        vehicleTypes: driver.vehicleTypes,
        currentLocationLabel: driver.currentLocationLabel,
        distanceToPickup: Number(distanceKm({ lat: driver.lat, lng: driver.lng }, booking.pickup).toFixed(1))
      }))
      .sort((a, b) => a.distanceToPickup - b.distanceToPickup);
  }

  function paidRequests(apiRequests = []) {
    return mergeBookings(apiRequests)
      .filter((booking) => booking.payment?.status === "paid" && booking.status !== "delivered")
      .map((booking) => ({
        ...booking,
        driverCandidates: booking.driverCandidates?.length ? booking.driverCandidates : driverCandidates(booking)
      }));
  }

  function pushStatus(booking, status, actor) {
    booking.status = status;
    booking.updatedAt = new Date().toISOString();
    booking.statusHistory = booking.statusHistory || [];
    booking.statusHistory.push({ status, at: booking.updatedAt, actor });
  }

  function assignBooking(id, driverId) {
    const bookings = getBookings();
    const booking = bookings.find((item) => item.id === id);

    if (!booking) throw new Error("Request not found in the dispatcher workspace");

    const candidates = driverCandidates(booking);
    const selected = driverId ? candidates.find((driver) => driver.id === driverId) : candidates[0];

    if (!selected) throw new Error("No available driver matches this request");

    booking.assignedDriver = {
      id: selected.id,
      name: selected.name,
      vehicle: booking.vehicle?.label || "Vehicle",
      rating: selected.rating,
      currentLocationLabel: selected.currentLocationLabel,
      distanceToPickup: selected.distanceToPickup
    };
    booking.driverResponse = { status: "pending", at: new Date().toISOString(), driverId: selected.id };
    booking.dispatcher = {
      ...(booking.dispatcher || {}),
      assignedAt: new Date().toISOString(),
      assignedBy: "LoadLink Dispatch Desk"
    };
    pushStatus(booking, "driver_assigned", "dispatcher");
    saveBookings(bookings);

    return booking;
  }

  function driverJobs(apiJobs = [], driverId = activeDriverId) {
    mergeBookings(apiJobs);
    return getBookings().filter((booking) =>
      ["driver_assigned", "driver_en_route", "goods_collected"].includes(booking.status) &&
      booking.assignedDriver?.id === driverId
    );
  }

  function respondToJob(id, action, driverId = activeDriverId) {
    const bookings = getBookings();
    const booking = bookings.find((item) => item.id === id && item.assignedDriver?.id === driverId);

    if (!booking) throw new Error("Job not found in the driver workspace");

    if (action === "accept") {
      booking.driverResponse = { status: "accepted", at: new Date().toISOString(), driverId };
      pushStatus(booking, "driver_en_route", "driver");
    } else if (action === "decline") {
      booking.declinedDriverIds = [...new Set([...(booking.declinedDriverIds || []), driverId])];
      booking.assignedDriver = null;
      booking.driverResponse = { status: "declined", at: new Date().toISOString(), driverId };
      pushStatus(booking, "dispatcher_notified", "driver");
    } else if (action === "collected") {
      pushStatus(booking, "goods_collected", "driver");
    } else if (action === "delivered") {
      pushStatus(booking, "delivered", "driver");
    }

    saveBookings(bookings);
    return booking;
  }

  function earnings(period = "week", driverId = activeDriverId) {
    const now = new Date();
    const start = new Date(now);

    if (period === "year") start.setMonth(0, 1);
    else if (period === "month") start.setDate(1);
    else start.setDate(now.getDate() - 7);

    start.setHours(0, 0, 0, 0);

    const completed = getBookings().filter((booking) =>
      booking.status === "delivered" &&
      booking.assignedDriver?.id === driverId &&
      new Date(booking.updatedAt || booking.createdAt || 0) >= start
    );

    return {
      period,
      periodStart: start.toISOString(),
      completedJobs: completed.length,
      totalEarned: completed.reduce((total, booking) => total + (Number(booking.driverPayout) || 0), 0)
    };
  }

  window.LoadLinkOps = {
    activeDriverId,
    locations,
    getDrivers,
    saveDriverProfile,
    saveBooking,
    mergeBookings,
    paidRequests,
    assignBooking,
    driverJobs,
    respondToJob,
    earnings
  };
})();
