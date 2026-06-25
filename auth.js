const params = new URLSearchParams(window.location.search);
let selectedRole = ["customer", "driver", "dispatcher"].includes(params.get("role"))
  ? params.get("role")
  : "customer";

function nextPathForRole(role) {
  if (params.get("next")) return params.get("next");
  if (role === "driver") return "driver.html";
  if (role === "dispatcher") return "dispatcher.html";
  return "index.html";
}

const roleLabels = {
  customer: "Customer",
  driver: "Driver",
  dispatcher: "Dispatcher"
};

const roleHeroTitles = {
  customer: "Move your goods with trusted transport support.",
  driver: "Manage your work, availability, and earnings.",
  dispatcher: "Run paid requests from one secure operations desk."
};

const roleCopy = {
  customer: "Login or create a customer account to request vehicles, pay securely, and track deliveries from collection to drop-off.",
  driver: "Login or register a driver profile for approval, availability, assigned jobs, and earnings.",
  dispatcher: "Dispatcher access is private. Login with the approved operations account to assign requests and monitor job progress."
};

const authForm = document.querySelector("#authForm");
const authStatus = document.querySelector("#authStatus");
const authHelp = document.querySelector("#authHelp");
const formTitle = document.querySelector("#formTitle");
const submitAuthBtn = document.querySelector("#submitAuthBtn");
const loginModeBtn = document.querySelector("#loginModeBtn");
const registerModeBtn = document.querySelector("#registerModeBtn");
const profileFields = document.querySelector("#profileFields");
const driverFields = document.querySelector("#driverFields");
const roleCards = document.querySelectorAll("[data-role-card]");
const authModal = document.querySelector("#authModal");
const authMenuTriggers = document.querySelectorAll("[data-auth-menu-trigger]");
const authMenuPanels = document.querySelectorAll("[data-auth-menu-panel]");
const authRoleOpeners = document.querySelectorAll("[data-auth-role-open]");
const authCloseBtn = document.querySelector("#authCloseBtn");
const emailInput = document.querySelector("#email");
const emailField = emailInput?.closest("label");
const passwordInput = document.querySelector("#password");
const passwordToggle = document.querySelector("#passwordToggle");
const passwordFieldLabel = document.querySelector("#passwordFieldLabel");
const forgotPasswordBtn = document.querySelector("#forgotPasswordBtn");

let mode = "login";

function setStatus(label, className = "neutral") {
  authStatus.textContent = label;
  authStatus.className = `status-pill ${className}`;
}

function setAccessFailed(message = "The login details do not match this access area.") {
  setStatus("Access failed", "warning");
  authHelp.textContent = message;
}

function setMode(nextMode) {
  mode = nextMode === "reset" ? "reset" : selectedRole === "dispatcher" ? "login" : nextMode;
  const registering = mode === "register";
  const resetting = mode === "reset";
  const isDriver = selectedRole === "driver";

  authModal.dataset.mode = mode;
  formTitle.textContent = resetting
    ? "Reset password"
    : `${roleLabels[selectedRole]} ${registering ? "registration" : "login"}`;
  submitAuthBtn.textContent = resetting ? "Update password" : registering ? "Create account" : "Login";
  profileFields.hidden = !registering;
  driverFields.hidden = !(registering && isDriver);
  if (emailField) emailField.hidden = resetting;
  if (emailInput) emailInput.required = !resetting;
  if (passwordFieldLabel) passwordFieldLabel.textContent = resetting ? "New password" : "Password";
  if (passwordInput) passwordInput.autocomplete = resetting || registering ? "new-password" : "current-password";
  if (registerModeBtn) registerModeBtn.disabled = selectedRole === "dispatcher";
  if (loginModeBtn) loginModeBtn.className = registering ? "secondary-dark-button" : "primary-button";
  if (registerModeBtn) registerModeBtn.className = registering ? "primary-button" : "secondary-dark-button";
  if (forgotPasswordBtn) forgotPasswordBtn.hidden = registering || resetting;

  authHelp.textContent = resetting
    ? "Enter a new password for your LoadLink account."
    : selectedRole === "dispatcher"
    ? "Dispatcher accounts are created privately by the platform owner and cannot self-register here."
    : registering
      ? "Create your profile once. After login, your platform will only show records linked to your account."
      : "Use the email and password linked to your LoadLink account.";
}

function formValue(id) {
  return document.querySelector(`#${id}`).value.trim();
}

function updateRole(nextRole) {
  if (!roleLabels[nextRole]) return;
  selectedRole = nextRole;
  document.querySelector("#authEyebrow").textContent = `${roleLabels[selectedRole]} access`;
  document.querySelector("#auth-title").textContent = roleHeroTitles[selectedRole];
  document.querySelector("#authIntro").textContent = roleCopy[selectedRole];
  document.body.dataset.authRole = selectedRole;
  roleCards.forEach((card) => {
    card.classList.toggle("active", card.dataset.roleCard === selectedRole);
  });
  setMode(mode);
}

function closeAuthMenus() {
  authMenuPanels.forEach((panel) => {
    panel.hidden = true;
  });
  authMenuTriggers.forEach((trigger) => {
    trigger.setAttribute("aria-expanded", "false");
  });
}

function toggleAuthMenu(menuName) {
  const panel = document.querySelector(`[data-auth-menu-panel="${menuName}"]`);
  const trigger = document.querySelector(`[data-auth-menu-trigger="${menuName}"]`);
  const willOpen = panel?.hidden;

  closeAuthMenus();

  if (panel && trigger && willOpen) {
    panel.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
  }
}

function isPasswordRecoveryFlow() {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return params.get("type") === "recovery" || hashParams.get("type") === "recovery" || params.get("mode") === "reset";
}

function recoveryError() {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return params.get("error_code") || hashParams.get("error_code") || params.get("error") || hashParams.get("error");
}

async function handlePasswordResetRequest() {
  const email = formValue("email");

  if (!email) {
    setStatus("Email required", "warning");
    authHelp.textContent = "Enter the email address linked to your LoadLink account, then request a reset link.";
    document.querySelector("#email")?.focus();
    return;
  }

  forgotPasswordBtn.disabled = true;
  setStatus("Sending reset link", "warning");

  try {
    await window.LoadLinkAuth.requestPasswordReset(email);
    setStatus("Reset email sent", "active");
    authHelp.textContent = "If an account exists for that email address, a password reset link has been sent.";
  } catch (error) {
    setStatus("Reset unavailable", "warning");
    authHelp.textContent = error.message || "Password reset could not be started right now.";
  } finally {
    forgotPasswordBtn.disabled = false;
  }
}

function openAuth(nextMode = "login", nextRole = selectedRole) {
  updateRole(nextRole);

  if (nextMode === "register" && selectedRole === "dispatcher") {
    updateRole("customer");
  }

  closeAuthMenus();
  authModal.hidden = false;
  document.body.classList.add("auth-modal-open");
  setMode(nextMode);
  setTimeout(() => document.querySelector("#email")?.focus(), 80);
}

function closeAuth() {
  authModal.hidden = true;
  document.body.classList.remove("auth-modal-open");
}

async function checkSetup() {
  updateRole(selectedRole);
  setMode(isPasswordRecoveryFlow() ? "reset" : params.get("mode") === "register" ? "register" : "login");

  try {
    const settings = await window.LoadLinkAuth.config();
    setStatus(settings.configured ? "Ready" : "Supabase setup needed", settings.configured ? "active" : "warning");
    if (!settings.configured && settings.setupIssue) {
      authHelp.textContent = settings.setupIssue;
    }
    submitAuthBtn.disabled = !settings.configured;
  } catch (error) {
    setStatus("Auth unavailable", "warning");
    authHelp.textContent = `${error.message || "The auth service could not be reached."} Please use https://www.load-link.co.za/auth and try again.`;
    submitAuthBtn.disabled = true;
  }

  if (["access", "role"].includes(params.get("reason"))) {
    setAccessFailed();
  }

  if (recoveryError()) {
    openAuth("login");
    setStatus("Reset link expired", "warning");
    authHelp.textContent = "This password reset link is invalid or has expired. Request a new reset link and use the latest email from Supabase.";
    return;
  }

  if (isPasswordRecoveryFlow()) {
    openAuth("reset");
    setStatus("Reset password", "warning");
    return;
  }

  if (params.get("mode") === "register" || params.get("open") === "login") {
    openAuth(params.get("mode") === "register" ? "register" : "login");
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  submitAuthBtn.disabled = true;
  setStatus(mode === "register" ? "Creating account" : "Signing in", "warning");

  try {
    const email = formValue("email");
    const password = formValue("password");
    let profile;

    if (mode === "reset") {
      await window.LoadLinkAuth.updatePassword(password);
      setMode("login");
      passwordInput.value = "";
      setStatus("Password updated", "active");
      authHelp.textContent = "Your password has been updated. You can now log in with the new password.";
      return;
    }

    if (mode === "register") {
      profile = await window.LoadLinkAuth.signUp({
        role: selectedRole,
        fullName: formValue("fullName"),
        email,
        phone: formValue("phone"),
        password,
        driver: {
          vehicleType: formValue("vehicleType"),
          numberPlate: formValue("numberPlate"),
          licenceNumber: formValue("licenceNumber"),
          permitNumber: formValue("permitNumber")
        }
      });
    } else {
      profile = await window.LoadLinkAuth.signIn(email, password);
    }

    if (!profile) {
      setStatus("Check email confirmation", "warning");
      authHelp.textContent = "Supabase may require email confirmation before first login.";
      return;
    }

    if (profile.role !== selectedRole) {
      await window.LoadLinkAuth.signOut();
      setAccessFailed();
      return;
    }

    setStatus("Access granted", "active");
    window.location.href = nextPathForRole(selectedRole);
  } catch (error) {
    setAccessFailed(error.message);
  } finally {
    submitAuthBtn.disabled = false;
  }
}

authMenuTriggers.forEach((trigger) => {
  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleAuthMenu(trigger.dataset.authMenuTrigger);
  });
});

authRoleOpeners.forEach((opener) => {
  opener.addEventListener("click", () => {
    openAuth(opener.dataset.authMode, opener.dataset.authRole);
  });
});

authCloseBtn.addEventListener("click", closeAuth);
authModal.addEventListener("click", (event) => {
  if (event.target === authModal) closeAuth();
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".auth-menu")) closeAuthMenus();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !authModal.hidden) closeAuth();
  if (event.key === "Escape") closeAuthMenus();
});

passwordToggle?.addEventListener("click", () => {
  const showingPassword = passwordInput.type === "text";
  passwordInput.type = showingPassword ? "password" : "text";
  passwordToggle.setAttribute("aria-label", showingPassword ? "Show password" : "Hide password");
  passwordToggle.setAttribute("aria-pressed", String(!showingPassword));
});

loginModeBtn?.addEventListener("click", () => setMode("login"));
registerModeBtn?.addEventListener("click", () => setMode("register"));
forgotPasswordBtn?.addEventListener("click", handlePasswordResetRequest);
authForm.addEventListener("submit", handleSubmit);
checkSetup();
