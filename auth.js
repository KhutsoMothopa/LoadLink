const params = new URLSearchParams(window.location.search);
const selectedRole = ["customer", "driver", "dispatcher"].includes(params.get("role"))
  ? params.get("role")
  : "customer";
const nextPath = params.get("next") || (selectedRole === "driver" ? "driver.html" : selectedRole === "dispatcher" ? "dispatcher.html" : "index.html");

const roleLabels = {
  customer: "Customer",
  driver: "Driver",
  dispatcher: "Dispatcher"
};

const roleCopy = {
  customer: "Login or create a customer account to request vehicles and track deliveries.",
  driver: "Login or register a driver profile for approval, availability, assigned jobs, and earnings.",
  dispatcher: "Dispatcher access is private. Login with the approved operations account."
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

let mode = "login";

function setStatus(label, className = "neutral") {
  authStatus.textContent = label;
  authStatus.className = `status-pill ${className}`;
}

function setMode(nextMode) {
  mode = selectedRole === "dispatcher" ? "login" : nextMode;
  const registering = mode === "register";
  const isDriver = selectedRole === "driver";

  formTitle.textContent = `${roleLabels[selectedRole]} ${registering ? "registration" : "login"}`;
  submitAuthBtn.textContent = registering ? "Create account" : "Login";
  profileFields.hidden = !registering;
  driverFields.hidden = !(registering && isDriver);
  registerModeBtn.disabled = selectedRole === "dispatcher";
  loginModeBtn.className = registering ? "secondary-dark-button" : "primary-button";
  registerModeBtn.className = registering ? "primary-button" : "secondary-dark-button";

  authHelp.textContent = selectedRole === "dispatcher"
    ? "Dispatcher accounts are created privately by the platform owner and cannot self-register here."
    : registering
      ? "Create your profile once. After login, your platform will only show records linked to your account."
      : "Use the email and password linked to your LoadLink account.";
}

function formValue(id) {
  return document.querySelector(`#${id}`).value.trim();
}

async function checkSetup() {
  document.querySelector("#authEyebrow").textContent = `${roleLabels[selectedRole]} access`;
  document.querySelector("#auth-title").textContent = `${roleLabels[selectedRole]} secure access`;
  document.querySelector("#authIntro").textContent = roleCopy[selectedRole];
  setMode("login");

  try {
    const settings = await window.LoadLinkAuth.config();
    setStatus(settings.configured ? "Ready" : "Supabase setup needed", settings.configured ? "active" : "warning");
    if (!settings.configured && settings.setupIssue) {
      authHelp.textContent = settings.setupIssue;
    }
    submitAuthBtn.disabled = !settings.configured;
  } catch (error) {
    setStatus("Auth unavailable", "warning");
    submitAuthBtn.disabled = true;
  }

  if (params.get("reason") === "role") {
    setStatus("Wrong account role", "warning");
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
      setStatus("Wrong account role", "warning");
      authHelp.textContent = `This account is registered as ${profile.role}, not ${selectedRole}.`;
      return;
    }

    setStatus("Access granted", "active");
    window.location.href = nextPath;
  } catch (error) {
    setStatus("Access failed", "warning");
    authHelp.textContent = error.message;
  } finally {
    submitAuthBtn.disabled = false;
  }
}

loginModeBtn.addEventListener("click", () => setMode("login"));
registerModeBtn.addEventListener("click", () => setMode("register"));
authForm.addEventListener("submit", handleSubmit);
checkSetup();
