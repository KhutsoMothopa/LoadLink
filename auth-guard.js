(async function () {
  const requiredRole = document.body.dataset.requiredRole;
  const authStatus = document.querySelector("[data-auth-status]");
  const signOutButtons = document.querySelectorAll("[data-sign-out]");
  const accountMenuTrigger = document.querySelector("[data-account-menu-trigger]");
  const accountMenuPanel = document.querySelector("[data-account-menu-panel]");

  if (!requiredRole || !window.LoadLinkAuth) return;
  window.LoadLinkAuth.setActiveRole?.(requiredRole);

  function revealPage() {
    document.body.classList.add("auth-ready");
  }

  function setAuthStatus(label, className = "neutral") {
    if (!authStatus) return;
    authStatus.textContent = label;
    const accountTrigger = authStatus.closest("[data-account-menu-trigger]");
    if (accountTrigger) {
      accountTrigger.className = `status-pill ${className} account-menu-trigger`;
    } else {
      authStatus.className = `status-pill ${className}`;
    }
  }

  function closeAccountMenu() {
    if (!accountMenuPanel || !accountMenuTrigger) return;
    accountMenuPanel.hidden = true;
    accountMenuTrigger.setAttribute("aria-expanded", "false");
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

  accountMenuTrigger?.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = accountMenuPanel?.hidden;
    if (!accountMenuPanel) return;
    accountMenuPanel.hidden = !willOpen;
    accountMenuTrigger.setAttribute("aria-expanded", String(Boolean(willOpen)));
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest("[data-account-menu-panel]") && !event.target.closest("[data-account-menu-trigger]")) {
      closeAccountMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAccountMenu();
  });

  signOutButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      await window.LoadLinkAuth.signOut();
      window.location.href = `auth.html?role=${encodeURIComponent(requiredRole)}`;
    });
  });
})();
