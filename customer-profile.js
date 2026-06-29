(async function () {
  const fields = {
    status: document.querySelector("#profileStatus"),
    name: document.querySelector("#profileName"),
    email: document.querySelector("#profileEmail"),
    phone: document.querySelector("#profilePhone"),
    role: document.querySelector("#profileRole"),
    emailStatus: document.querySelector("#profileEmailStatus"),
    phoneStatus: document.querySelector("#profilePhoneStatus")
  };

  function setStatus(label, className = "neutral") {
    fields.status.textContent = label;
    fields.status.className = `status-pill ${className}`;
  }

  try {
    window.LoadLinkAuth?.setActiveRole?.("customer");
    const profile = await window.LoadLinkAuth.currentProfile();

    if (!profile) {
      setStatus("Unavailable", "warning");
      return;
    }

    fields.name.textContent = profile.full_name || "Not provided";
    fields.email.textContent = profile.email || "Not provided";
    fields.phone.textContent = profile.phone || "Not provided";
    fields.role.textContent = "Customer";
    fields.emailStatus.textContent = profile.email_verified ? "Verified" : "Verification pending";
    fields.phoneStatus.textContent = profile.phone_verified ? "Verified" : "Not verified";
    setStatus("Active", "active");
  } catch (error) {
    setStatus("Could not load", "warning");
  }
})();
