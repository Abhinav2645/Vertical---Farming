import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import "./App.css";

/* ---------- Supabase (reads keys from .env / Vercel env vars) ---------- */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

/* ---------- Small SVG line chart (no extra libraries needed) ---------- */
function LineChart({ data, color }) {
  const w = 400, h = 200, pad = 12;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / (data.length - 1);
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return `${x},${y}`;
  });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="chart" preserveAspectRatio="none">
      <polygon points={`${pad},${h - pad} ${pts.join(" ")} ${w - pad},${h - pad}`} fill={color} opacity="0.15" />
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------- Authentication screen ---------- */
function AuthScreen({ initialMode = "signin", onDemo, onDone }) {
  const [mode, setMode] = useState(initialMode); // signin | signup | forgot | reset
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState(null); // { type: "error" | "ok", text }
  const [busy, setBusy] = useState(false);

  useEffect(() => setMode(initialMode), [initialMode]);

  const titles = {
    signin: ["Welcome back", "Sign in to monitor your farm."],
    signup: ["Create your account", "Start tracking your vertical farm."],
    forgot: ["Reset your password", "We'll email you a reset link."],
    reset: ["Choose a new password", "Use at least 8 characters."],
  };

  const switchMode = (m) => { setMode(m); setMsg(null); setPassword(""); setConfirm(""); };

  async function submit(e) {
    e.preventDefault();
    setMsg(null);
    if (!supabase) return setMsg({ type: "error", text: "Supabase isn't set up yet. Add your keys to .env, or use the demo." });
    if ((mode === "signup" || mode === "reset") && password.length < 8)
      return setMsg({ type: "error", text: "Password must be at least 8 characters." });
    if ((mode === "signup" || mode === "reset") && password !== confirm)
      return setMsg({ type: "error", text: "Passwords don't match." });

    setBusy(true);
    let error = null;
    if (mode === "signin") ({ error } = await supabase.auth.signInWithPassword({ email, password }));
    if (mode === "signup") {
      const res = await supabase.auth.signUp({ email, password });
      error = res.error;
      if (!error && !res.data.session) setMsg({ type: "ok", text: "Account created. Check your email to confirm it, then sign in." });
    }
    if (mode === "forgot") {
      ({ error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin }));
      if (!error) setMsg({ type: "ok", text: "Reset link sent. Check your inbox." });
    }
    if (mode === "reset") {
      ({ error } = await supabase.auth.updateUser({ password }));
      if (!error) { setMsg({ type: "ok", text: "Password updated. Taking you to the dashboard…" }); setTimeout(() => onDone && onDone(), 1500); }
    }
    if (error) setMsg({ type: "error", text: error.message });
    setBusy(false);
  }

  const [title, sub] = titles[mode];
  return (
    <div className="auth-page">
      <form className="auth-card glass" onSubmit={submit}>
        <h1 className="auth-brand">🌱 VertiGrow</h1>
        <h2>{title}</h2>
        <p className="muted">{sub}</p>

        {mode !== "reset" && (
          <label>Email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          </label>
        )}
        {mode !== "forgot" && (
          <label>{mode === "reset" ? "New password" : "Password"}
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete={mode === "signin" ? "current-password" : "new-password"} />
          </label>
        )}
        {(mode === "signup" || mode === "reset") && (
          <label>Confirm password
            <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
          </label>
        )}

        {msg && <div className={`notice ${msg.type}`} role="status">{msg.text}</div>}

        <button className="primary" disabled={busy}>
          {busy ? "Please wait…" : { signin: "Sign in", signup: "Create account", forgot: "Send reset link", reset: "Update password" }[mode]}
        </button>

        <div className="auth-links">
          {mode === "signin" && (<>
            <button type="button" className="link" onClick={() => switchMode("forgot")}>Forgot password?</button>
            <button type="button" className="link" onClick={() => switchMode("signup")}>Create an account</button>
          </>)}
          {mode === "signup" && <button type="button" className="link" onClick={() => switchMode("signin")}>I already have an account</button>}
          {mode === "forgot" && <button type="button" className="link" onClick={() => switchMode("signin")}>Back to sign in</button>}
        </div>

        {onDemo && <button type="button" className="ghost" onClick={onDemo}>Explore the demo dashboard</button>}
      </form>
    </div>
  );
}

/* ---------- Account page (change password while signed in) ---------- */
function Account({ user }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function change(e) {
    e.preventDefault();
    if (password.length < 8) return setMsg({ type: "error", text: "Password must be at least 8 characters." });
    if (password !== confirm) return setMsg({ type: "error", text: "Passwords don't match." });
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setMsg(error ? { type: "error", text: error.message } : { type: "ok", text: "Password changed." });
    if (!error) { setPassword(""); setConfirm(""); }
    setBusy(false);
  }

  return (
    <section className="panel glass account">
      <h3>Account</h3>
      <p className="muted">Signed in as {user?.email ?? "demo user"}</p>
      {user ? (
        <form onSubmit={change}>
          <label>New password
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </label>
          <label>Confirm new password
            <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </label>
          {msg && <div className={`notice ${msg.type}`} role="status">{msg.text}</div>}
          <button className="primary" disabled={busy}>{busy ? "Saving…" : "Change password"}</button>
        </form>
      ) : (
        <p className="muted">Sign in with a real account to change your password.</p>
      )}
    </section>
  );
}

/* ---------- Dashboard ---------- */
function Dashboard({ user, onSignOut }) {
  const [page, setPage] = useState("dashboard");
  const [temp, setTemp] = useState(24);
  const [humidity, setHumidity] = useState(62);
  const [ph, setPh] = useState(6.2);
  const [light, setLight] = useState(480);
  const [pump, setPump] = useState(true);
  const [lamp, setLamp] = useState(true);

  const tempHistory = [22, 23, 23.5, 24, 24.5, 24, temp];
  const humHistory = [58, 60, 61, 63, 62, 61, humidity];

  const metrics = [
    { icon: "🌡️", label: "Temperature", value: temp, unit: "°C", pct: (temp / 40) * 100, tag: temp > 28 ? "High" : "Good" },
    { icon: "💧", label: "Humidity", value: humidity, unit: "%", pct: humidity, tag: humidity < 40 ? "Low" : "Good" },
    { icon: "🧪", label: "Water pH", value: ph, unit: "", pct: (ph / 14) * 100, tag: ph < 5.5 || ph > 7 ? "Check" : "Good" },
    { icon: "☀️", label: "Light", value: light, unit: " lux", pct: (light / 1000) * 100, tag: "Live" },
  ];

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <h2 className="brand">🌱 VertiGrow</h2>
        <nav>
          <button className={`nav-link ${page === "dashboard" ? "selected" : ""}`} onClick={() => setPage("dashboard")}>Dashboard</button>
          <button className={`nav-link ${page === "account" ? "selected" : ""}`} onClick={() => setPage("account")}>Account</button>
        </nav>
        <div className="connection">
          <span className="online-dot" />Demo sensors
          <small>{user ? user.email : "Not signed in"}</small>
          <button className="ghost small" onClick={onSignOut}>{user ? "Sign out" : "Back to sign in"}</button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="muted">Farm overview</p>
            <h1>{page === "dashboard" ? "Dashboard" : "Account"}</h1>
          </div>
          <span className="demo-badge">Demo data</span>
        </header>

        {page === "account" ? <Account user={user} /> : (<>
          <section className="hero glass">
            <div>
              <p className="hero-tag">Today</p>
              <h2>Your crops are growing well</h2>
              <p>All readings are inside the healthy range for leafy greens. Adjust the sliders below to preview how the dashboard reacts.</p>
            </div>
            <div className="hero-plant">🥬</div>
          </section>

          <section className="metrics">
            {metrics.map((m) => (
              <div className="metric-card glass" key={m.label}>
                <div className="metric-top"><span>{m.icon}</span><span className="mini-tag">{m.tag}</span></div>
                <p>{m.label}</p>
                <h2>{m.value}<small>{m.unit}</small></h2>
                <div className="mini-progress"><div style={{ width: `${Math.min(100, Math.max(0, m.pct))}%` }} /></div>
              </div>
            ))}
          </section>

          <section className="charts-grid">
            <div className="panel glass">
              <div className="panel-heading"><div><h3>Temperature</h3><p>Last 7 readings</p></div></div>
              <LineChart data={tempHistory} color="#4ade80" />
            </div>
            <div className="panel glass">
              <div className="panel-heading"><div><h3>Humidity</h3><p>Last 7 readings</p></div></div>
              <LineChart data={humHistory} color="#60a5fa" />
            </div>
          </section>

          <section className="charts-grid">
            <div className="panel glass">
              <div className="panel-heading"><div><h3>Controls</h3><p>Switch devices on or off</p></div></div>
              {[["💦", "Water pump", pump, setPump, "pump-icon"], ["💡", "Grow lights", lamp, setLamp, "light-icon"]].map(([icon, name, on, set, cls]) => (
                <div className="device-row" key={name}>
                  <span className={`device-icon ${cls}`}>{icon}</span>
                  <div className="device-info"><strong>{name}</strong><small>{on ? "Running" : "Off"}</small></div>
                  <button className={`toggle ${on ? "on" : ""}`} onClick={() => set(!on)} aria-pressed={on}>{on ? "On" : "Off"}</button>
                </div>
              ))}
            </div>

            <div className="panel glass">
              <div className="panel-heading"><div><h3>Test readings</h3><p>Move the sliders to simulate sensors</p></div></div>
              {[
                ["Temperature", temp, setTemp, 10, 40, 0.5, "°C"],
                ["Humidity", humidity, setHumidity, 20, 100, 1, "%"],
                ["Water pH", ph, setPh, 4, 9, 0.1, ""],
                ["Light", light, setLight, 0, 1000, 10, " lux"],
              ].map(([label, val, set, min, max, step, unit]) => (
                <div className="test-row" key={label}>
                  <label>{label}<strong>{val}{unit}</strong>
                    <input type="range" min={min} max={max} step={step} value={val} onChange={(e) => set(Number(e.target.value))} />
                  </label>
                </div>
              ))}
            </div>
          </section>
        </>)}
        <footer>VertiGrow · demo sensor data</footer>
      </main>
    </div>
  );
}

/* ---------- Root ---------- */
export default function App() {
  const [user, setUser] = useState(null);
  const [demo, setDemo] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [ready, setReady] = useState(!supabase);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user ?? null); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setUser(null); setDemo(false);
  }

  if (!ready) return <div className="auth-page"><p className="muted">Loading…</p></div>;
  if (recovery) return <AuthScreen initialMode="reset" onDone={() => setRecovery(false)} />;
  if (!user && !demo) return <AuthScreen onDemo={() => setDemo(true)} />;
  return <Dashboard user={user} onSignOut={signOut} />;
}
