const params = new URLSearchParams(window.location.search);
let selectedRole = ["customer", "driver", "dispatcher"].includes(params.get("role"))
  ? params.get("role")
  : "customer";

function nextPathForRole(role) {
  const next = params.get("next");

  if (next && roleForPath(next) === role) return next;
  if (role === "driver") return "driver.html";
  if (role === "dispatcher") return "dispatcher.html";
  return "index.html";
}

function roleForPath(path) {
  const cleanPath = path
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/[?#].*$/, "")
    .replace(/^\/+/, "")
    .toLowerCase();

  if (!cleanPath || cleanPath === "index.html") return "customer";
  if (["payment", "payment.html", "tracking", "tracking.html", "gateway", "gateway.html", "customer-profile", "customer-profile.html"].includes(cleanPath)) return "customer";
  if (["driver", "driver.html"].includes(cleanPath)) return "driver";
  if (["dispatcher", "dispatcher.html", "dispatcher-drivers", "dispatcher-drivers.html"].includes(cleanPath)) return "dispatcher";
  return "";
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
const verificationNote = document.querySelector("#verificationNote");
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
const resendVerificationBtn = document.querySelector("#resendVerificationBtn");

let mode = "login";
let pendingVerificationEmail = "";
let lastPreparedRole = "";

function setStatus(label, className = "neutral") {
  authStatus.textContent = label;
  authStatus.className = `status-pill ${className}`;
}

function setAccessFailed(message = "The login details do not match this access area.") {
  setStatus("Access failed", "warning");
  authHelp.textContent = message;
}

function setLoginFailed(email, error) {
  const message = error?.message || "";
  const needsEmailVerification =
    selectedRole !== "dispatcher" && /email.*confirm|confirm.*email|not confirmed|verification/i.test(message);

  pendingVerificationEmail = needsEmailVerification ? email || "" : "";
  setAccessFailed(
    needsEmailVerification
      ? "This account still needs email verification. Confirm the email address or resend the verification email."
      : "The login details do not match this access area."
  );
  if (resendVerificationBtn) resendVerificationBtn.hidden = !pendingVerificationEmail;
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
  if (verificationNote) verificationNote.hidden = !registering;
  driverFields.hidden = !(registering && isDriver);
  if (emailField) emailField.hidden = resetting;
  if (emailInput) emailInput.required = !resetting;
  if (passwordFieldLabel) passwordFieldLabel.textContent = resetting ? "New password" : "Password";
  if (passwordInput) passwordInput.autocomplete = resetting || registering ? "new-password" : "current-password";
  if (registerModeBtn) registerModeBtn.disabled = selectedRole === "dispatcher";
  if (loginModeBtn) loginModeBtn.className = registering ? "secondary-dark-button" : "primary-button";
  if (registerModeBtn) registerModeBtn.className = registering ? "primary-button" : "secondary-dark-button";
  if (forgotPasswordBtn) forgotPasswordBtn.hidden = registering || resetting;
  if (resendVerificationBtn) resendVerificationBtn.hidden = selectedRole === "dispatcher" || !pendingVerificationEmail || registering || resetting;

  authHelp.textContent = resetting
    ? "Enter a new password for your LoadLink account."
    : selectedRole === "dispatcher"
    ? "Dispatcher accounts are created privately by the platform owner and cannot self-register here."
    : registering
      ? "Create your profile once. After login, your platform will only show records linked to your account."
      : "Use the email and password linked to your LoadLink account.";

  configureCredentialFields(false);
}

function configureCredentialFields(clearCredentials = false) {
  const isDispatcher = selectedRole === "dispatcher";

  window.LoadLinkAuth?.setActiveRole?.(selectedRole);
  authForm.setAttribute("autocomplete", isDispatcher ? "off" : "on");
  emailInput?.setAttribute("name", `${selectedRole}_email`);
  passwordInput?.setAttribute("name", `${selectedRole}_password`);
  emailInput?.setAttribute("autocomplete", isDispatcher ? "off" : "username");
  passwordInput?.setAttribute("autocomplete", isDispatcher ? "new-password" : mode === "register" ? "new-password" : "current-password");
  emailInput?.setAttribute("data-1p-ignore", isDispatcher ? "true" : "false");
  passwordInput?.setAttribute("data-1p-ignore", isDispatcher ? "true" : "false");
  emailInput?.setAttribute("data-lpignore", isDispatcher ? "true" : "false");
  passwordInput?.setAttribute("data-lpignore", isDispatcher ? "true" : "false");

  if (clearCredentials) {
    emailInput.value = "";
    passwordInput.value = "";
  }
}

function clearDispatcherAutofill() {
  if (selectedRole !== "dispatcher") return;

  [80, 350, 900].forEach((delay) => {
    window.setTimeout(() => {
      if (selectedRole !== "dispatcher") return;
      if (document.activeElement === emailInput || document.activeElement === passwordInput) return;
      emailInput.value = "";
      passwordInput.value = "";
    }, delay);
  });
}

function formValue(id) {
  return document.querySelector(`#${id}`).value.trim();
}

function updateRole(nextRole) {
  if (!roleLabels[nextRole]) return;
  const roleChanged = nextRole !== selectedRole || nextRole !== lastPreparedRole;
  selectedRole = nextRole;
  if (selectedRole === "dispatcher") pendingVerificationEmail = "";
  configureCredentialFields(roleChanged && selectedRole === "dispatcher");
  if (selectedRole === "dispatcher") clearDispatcherAutofill();
  lastPreparedRole = selectedRole;
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

async function handleResendVerification() {
  const email = pendingVerificationEmail || formValue("email");

  if (!email) {
    setStatus("Email required", "warning");
    authHelp.textContent = "Enter the email address you registered with, then resend the verification email.";
    document.querySelector("#email")?.focus();
    return;
  }

  resendVerificationBtn.disabled = true;
  setStatus("Sending verification", "warning");

  try {
    await window.LoadLinkAuth.resendEmailVerification(email);
    pendingVerificationEmail = email;
    setStatus("Verification email sent", "active");
    authHelp.textContent = "If the email address is linked to a pending account, a new verification link has been sent. Check Inbox, Spam, Promotions, and All Mail.";
  } catch (error) {
    setStatus("Verification unavailable", "warning");
    authHelp.textContent = error.message || "Verification email could not be sent right now.";
  } finally {
    resendVerificationBtn.disabled = false;
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
  window.LoadLinkAuth?.setActiveRole?.(selectedRole);
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

  if (params.get("verified") === "email" && selectedRole !== "dispatcher") {
    pendingVerificationEmail = "";
    if (resendVerificationBtn) resendVerificationBtn.hidden = true;
    setStatus("Email verified", "active");
    authHelp.textContent = "Your email has been verified. You can now log in to your LoadLink account.";
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

    if (profile.pendingEmailVerification) {
      pendingVerificationEmail = profile.email || email;
      setMode("login");
      setStatus("Verify email", "warning");
      authHelp.textContent = "We sent a verification link to your email address. Confirm your email, then return here to log in.";
      if (resendVerificationBtn) resendVerificationBtn.hidden = selectedRole === "dispatcher";
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
    if (mode === "login") {
      setLoginFailed(formValue("email"), error);
    } else {
      setAccessFailed();
    }
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
resendVerificationBtn?.addEventListener("click", handleResendVerification);
authForm.addEventListener("submit", handleSubmit);
checkSetup();
