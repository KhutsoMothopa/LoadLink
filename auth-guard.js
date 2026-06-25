(async function () {
  const requiredRole = document.body.dataset.requiredRole;
  const authStatus = document.querySelector("[data-auth-status]");
  const signOutButton = document.querySelector("[data-sign-out]");

  if (!requiredRole || !window.LoadLinkAuth) return;

  function revealPage() {
    document.body.classList.add("auth-ready");
  }

  function setAuthStatus(label, className = "neutral") {
    if (!authStatus) return;
    authStatus.textContent = label;
    authStatus.className = `status-pill ${className}`;
  }

  try {
    const settings = await window.LoadLinkAuth.config();

    if (!settings.configured) {
      setAuthStatus("Auth setup needed", "warning");
      revealPage();
      return;
    }

    const profile = await window.LoadLinkAuth.currentProfile();

    if (!profile) {
      window.location.href = `auth.html?role=${encodeURIComponent(requiredRole)}&next=${encodeURIComponent(window.location.pathname)}`;
      return;
    }

    if (profile.role !== requiredRole) {
      await window.LoadLinkAuth.signOut();
      window.location.href = `auth.html?role=${encodeURIComponent(requiredRole)}&next=${encodeURIComponent(window.location.pathname)}&reason=access`;
      return;
    }

    setAuthStatus(`${profile.full_name || profile.email}`, "active");
    revealPage();
  } catch (error) {
    setAuthStatus("Auth unavailable", "warning");
    revealPage();
  }

  signOutButton?.addEventListener("click", async () => {
    await window.LoadLinkAuth.signOut();
    window.location.href = `auth.html?role=${encodeURIComponent(requiredRole)}`;
  });
})();
