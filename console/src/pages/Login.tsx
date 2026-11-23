import { useState } from "react";
import { api, session } from "../api";

export default function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const r = await api("/api/auth/admin/login", { method: "POST", body: { email: email.trim(), password } });
      session.set(r.access_token, r.user);
      onDone();
    } catch (err: any) {
      setError(err.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="login">
      <form className="card" onSubmit={submit}>
        <img className="brand-mark" src="/logo.png" alt="DailyBasic logo" style={{ width: 56, height: 56, borderRadius: 14 }} />
        <h1>Food Market Console</h1>
        <p className="muted" style={{ marginTop: 0 }}>Sign in with your DailyBasic admin account.</p>
        {error && <div className="error-box">{error}</div>}
        <div style={{ display: "grid", gap: 12 }}>
          <label className="field"><span>Email</span>
            <input className="input" type="email" autoComplete="username" required value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="admin@dailybasics.in" />
          </label>
          <label className="field"><span>Password</span>
            <input className="input" type="password" autoComplete="current-password" required value={password}
              onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button className="btn primary" type="submit" disabled={busy} style={{ justifyContent: "center", padding: 11 }}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </div>
      </form>
    </div>
  );
}
