(function () {
  const validRoles = ["customer", "driver", "dispatcher"];
  let activeRole = roleFromPage();
  const clientPromises = new Map();

  function roleFromPage() {
    const params = new URLSearchParams(window.location.search);
    const pageRole = document.body?.dataset.requiredRole || params.get("role");
    return validRoles.includes(pageRole) ? pageRole : "customer";
  }

  function setActiveRole(role) {
    if (validRoles.includes(role)) activeRole = role;
  }

  function roleStorageKey(prefix, role = activeRole) {
    return `${prefix}:${role}`;
  }

  async function apiRequest(path, options = {}) {
    const response = await fetch(path, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};

    if (!response.ok) {
      throw new Error(payload.error || "LoadLink API request failed");
    }

    return payload;
  }

  function saveSession(session) {
    if (!session) return;
    window.localStorage.setItem(roleStorageKey("loadlinkAuthSession"), JSON.stringify(session));
  }

  function storedSession() {
    try {
      return JSON.parse(window.localStorage.getItem(roleStorageKey("loadlinkAuthSession")) || "null");
    } catch (error) {
      return null;
    }
  }

  function saveProfile(profile) {
    if (!profile) return;
    window.localStorage.setItem(roleStorageKey("loadlinkAuthProfile", profile.role || activeRole), JSON.stringify(profile));
  }

  function storedProfile() {
    try {
      return JSON.parse(window.localStorage.getItem(roleStorageKey("loadlinkAuthProfile")) || "null");
    } catch (error) {
      return null;
    }
  }

  function clearSession() {
    window.localStorage.removeItem(roleStorageKey("loadlinkAuthSession"));
    window.localStorage.removeItem(roleStorageKey("loadlinkAuthProfile"));
  }

  async function config() {
    return apiRequest("/api/auth/config");
  }

  async function client() {
    if (clientPromises.has(activeRole)) return clientPromises.get(activeRole);

    const clientPromise = config().then((settings) => {
      if (!settings.configured) {
        throw new Error("Supabase is not configured yet.");
      }

      if (!window.supabase?.createClient) {
        throw new Error("Supabase client library could not be loaded.");
      }

      return window.supabase.createClient(settings.supabaseUrl, settings.supabaseAnonKey, {
        auth: {
          storageKey: roleStorageKey("loadlinkSupabaseSession")
        }
      });
    });

    clientPromises.set(activeRole, clientPromise);
    return clientPromise;
  }

  async function currentSession() {
    try {
      const supabase = await client();
      const { data } = await supabase.auth.getSession();
      const session = data?.session || storedSession();

      if (session) saveSession(session);
      return session;
    } catch (error) {
      return storedSession();
    }
  }

  async function currentProfile() {
    const session = await currentSession();

    if (!session?.user) return null;

    try {
      const supabase = await client();
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (error) throw error;
      saveProfile(data);
      return data;
    } catch (error) {
      return storedProfile();
    }
  }

  async function signIn(email, password) {
    const supabase = await client();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) throw error;
    saveSession(data.session);

    return ensureProfile(data.user);
  }

  function emailConfirmationRedirectUrl() {
    const productionConfirmUrl = "https://www.load-link.co.za/auth?open=login&verified=email";
    const localConfirmUrl = `${window.location.origin}/auth.html?open=login&verified=email`;

    return window.location.hostname.endsWith("load-link.co.za")
      ? productionConfirmUrl
      : localConfirmUrl;
  }

  async function ensureProfile(user) {
    if (!user?.id) return null;

    const supabase = await client();
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (existingProfile) {
      saveProfile(existingProfile);
      return existingProfile;
    }

    const metadata = user.user_metadata || {};
    const role = metadata.role || "customer";
    const profile = {
      id: user.id,
      role,
      full_name: metadata.full_name || user.email,
      email: user.email,
      phone: metadata.phone || "Not provided"
    };

    const { error: profileError } = await supabase.from("profiles").insert(profile);
    if (profileError) throw profileError;

    if (role === "customer") {
      const { error: customerError } = await supabase.from("customer_profiles").insert({ user_id: user.id });
      if (customerError) throw customerError;
    }

    if (role === "driver") {
      const { error: driverError } = await supabase.from("driver_profiles").insert({
        user_id: user.id,
        vehicle_type: metadata.vehicle_type || "bakkie",
        number_plate: metadata.number_plate || "Not provided",
        licence_number: metadata.licence_number || "Not provided",
        permit_number: metadata.permit_number || null,
        availability: false,
        status: "offline",
        approved: false
      });

      if (driverError) throw driverError;
    }

    saveProfile(profile);
    return profile;
  }

  async function signUp({ role, fullName, email, phone, password, driver }) {
    const supabase = await client();
    const emailRedirectTo = emailConfirmationRedirectUrl();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: {
          role,
          full_name: fullName,
          phone,
          vehicle_type: driver.vehicleType,
          number_plate: driver.numberPlate,
          licence_number: driver.licenceNumber,
          permit_number: driver.permitNumber
        }
      }
    });

    if (error) throw error;

    const userId = data.user?.id;

    if (!userId) {
      throw new Error("Account created. Check email confirmation before signing in.");
    }

    if (!data.session) {
      return {
        role,
        email,
        pendingEmailVerification: true
      };
    }

    const profile = {
      id: userId,
      role,
      full_name: fullName,
      email,
      phone
    };

    const { error: profileError } = await supabase.from("profiles").insert(profile);
    if (profileError) throw profileError;

    if (role === "customer") {
      const { error: customerError } = await supabase.from("customer_profiles").insert({ user_id: userId });
      if (customerError) throw customerError;
    }

    if (role === "driver") {
      const { error: driverError } = await supabase.from("driver_profiles").insert({
        user_id: userId,
        vehicle_type: driver.vehicleType,
        number_plate: driver.numberPlate,
        licence_number: driver.licenceNumber,
        permit_number: driver.permitNumber || null,
        current_location_key: driver.currentLocationKey || null,
        current_location_label: driver.currentLocationLabel || null,
        availability: false,
        status: "offline",
        approved: false
      });

      if (driverError) throw driverError;
    }

    saveSession(data.session);
    saveProfile(profile);
    return profile;
  }

  async function resendEmailVerification(email) {
    const supabase = await client();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: emailConfirmationRedirectUrl()
      }
    });

    if (error) throw error;
  }

  async function requestPasswordReset(email) {
    const supabase = await client();
    const productionResetUrl = "https://www.load-link.co.za/auth?mode=reset";
    const localResetUrl = `${window.location.origin}/auth.html?mode=reset`;
    const redirectTo = window.location.hostname.endsWith("load-link.co.za")
      ? productionResetUrl
      : localResetUrl;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    if (error) throw error;
  }

  async function updatePassword(password) {
    const supabase = await client();
    const { data, error } = await supabase.auth.updateUser({ password });

    if (error) throw error;
    if (data?.session) saveSession(data.session);
    return data?.user || null;
  }

  async function signOut() {
    try {
      const supabase = await client();
      await supabase.auth.signOut();
    } catch (error) {
      // Local clear still protects this browser session if the network is unavailable.
    }

    clearSession();
  }

  window.LoadLinkAuth = {
    setActiveRole,
    config,
    client,
    currentSession,
    currentProfile,
    signIn,
    signUp,
    resendEmailVerification,
    requestPasswordReset,
    updatePassword,
    signOut,
    clearSession
  };
})();
