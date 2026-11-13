"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Msg = { kind: "ok" | "err"; text: string } | null;

export default function DeviceActions({ id, currentSsid }: { id: string; currentSsid: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [confirmReboot, setConfirmReboot] = useState(false);

  async function run(action: string, extra: Record<string, string> = {}) {
    setBusy(action);
    setMsg(null);
    try {
      const res = await fetch(`/api/devices/${encodeURIComponent(id)}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ kind: "err", text: data.error || "A tarefa falhou. Tente de novo." });
      else if (data.status === "executed") {
        setMsg({ kind: "ok", text: "Tarefa executada na CPE." });
        router.refresh();
      } else
        setMsg({ kind: "ok", text: "CPE não respondeu agora. A tarefa ficou na fila e roda no próximo contato (Inform)." });
    } catch {
      setMsg({ kind: "err", text: "Sem resposta do servidor. Verifique a conexão e tente de novo." });
    } finally {
      setBusy(null);
      setConfirmReboot(false);
    }
  }

  function onWifi(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    run("wifi", { ssid: String(f.get("ssid") || ""), password: String(f.get("password") || "") });
  }

  return (
    <section className="card">
      <h2>Ações</h2>
      <div className="row-actions" style={{ marginBottom: 16 }}>
        <button className="btn" onClick={() => run("refresh")} disabled={!!busy}>
          {busy === "refresh" ? "Atualizando…" : "Atualizar parâmetros"}
        </button>
        {confirmReboot ? (
          <>
            <button className="btn danger" onClick={() => run("reboot")} disabled={!!busy}>
              {busy === "reboot" ? "Reiniciando…" : "Reiniciar esta CPE"}
            </button>
            <button className="btn" onClick={() => setConfirmReboot(false)} disabled={!!busy}>Manter ligada</button>
          </>
        ) : (
          <button className="btn danger" onClick={() => setConfirmReboot(true)} disabled={!!busy}>Reiniciar…</button>
        )}
      </div>
      <form onSubmit={onWifi}>
        <div className="field">
          <label htmlFor="ssid">Nome da rede Wi-Fi (SSID)</label>
          <input id="ssid" name="ssid" defaultValue={currentSsid} maxLength={32} />
        </div>
        <div className="field">
          <label htmlFor="password">Nova senha do Wi-Fi</label>
          <input id="password" name="password" type="password" minLength={8} maxLength={63} placeholder="deixe vazio para manter" autoComplete="new-password" />
        </div>
        <button className="btn primary" type="submit" disabled={!!busy}>{busy === "wifi" ? "Salvando…" : "Salvar Wi-Fi"}</button>
      </form>
      {msg && <p className={`msg ${msg.kind}`} role="status">{msg.text}</p>}
    </section>
  );
}
