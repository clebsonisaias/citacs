"use client";
import { useState } from "react";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/login", { method: "POST", body: new FormData(e.currentTarget) });
    if (res.ok) {
      window.location.href = "/";
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error || "Não foi possível entrar. Tente de novo.");
    setBusy(false);
  }

  return (
    <main>
      <form className="card login" onSubmit={onSubmit}>
        <h1>Entrar no CIT<span style={{ color: "var(--accent)" }}>acs</span></h1>
        <div className="field">
          <label htmlFor="user">Usuário</label>
          <input id="user" name="user" autoComplete="username" required autoFocus />
        </div>
        <div className="field">
          <label htmlFor="password">Senha</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <button className="btn primary" type="submit" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
        {error && <p className="msg err" role="alert">{error}</p>}
      </form>
    </main>
  );
}
