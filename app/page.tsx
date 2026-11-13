import Link from "next/link";
import Header from "@/components/Header";
import { listDevices, type DeviceSummary } from "@/lib/genieacs";
import { ago } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q || "";
  let devices: DeviceSummary[] = [];
  let error = "";
  try {
    devices = await listDevices(q);
  } catch (e) {
    error = (e as Error).message;
  }
  const online = devices.filter((d) => d.online).length;

  return (
    <>
      <Header />
      <main>
        <h1>CPEs</h1>
        {error ? (
          <div className="card">
            <p className="msg err">Não foi possível consultar o GenieACS ({error}).</p>
            <p className="muted">Confira se GENIEACS_NBI_URL aponta para a NBI e se o CITacs está na mesma rede Docker do GenieACS.</p>
          </div>
        ) : (
          <>
            <div className="stats">
              <div className="card stat"><b>{devices.length}</b><small>{q ? "encontradas" : "cadastradas"}</small></div>
              <div className="card stat"><b style={{ color: "var(--ok)" }}>{online}</b><small>online</small></div>
              <div className="card stat"><b>{devices.length - online}</b><small>offline</small></div>
            </div>
            <form className="toolbar" role="search">
              <label htmlFor="q" className="muted" style={{ alignSelf: "center" }}>Buscar</label>
              <input id="q" name="q" defaultValue={q} placeholder="serial ou ID" style={{ flex: "1 1 220px" }} />
              <button className="btn primary" type="submit">Buscar</button>
              {q && <Link className="btn" href="/">Limpar busca</Link>}
            </form>
            <div className="card" style={{ padding: 0 }}>
              {devices.length === 0 ? (
                <div className="empty">
                  {q ? (
                    <>Nenhuma CPE com “{q}”. <Link href="/">Ver todas</Link></>
                  ) : (
                    <>Nenhuma CPE registrada ainda. Configure a ACS URL da CPE para o endereço CWMP do GenieACS e aguarde o primeiro Inform.</>
                  )}
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Status</th><th>Fabricante</th><th>Modelo</th><th>Serial</th><th>Firmware</th><th>IP WAN</th><th>Último contato</th></tr>
                    </thead>
                    <tbody>
                      {devices.map((d) => (
                        <tr key={d.id}>
                          <td><span className={`dot ${d.online ? "on" : ""}`} />{d.online ? "Online" : "Offline"}</td>
                          <td>{d.manufacturer || "—"}</td>
                          <td>{d.model || "—"}</td>
                          <td className="mono"><Link href={`/devices/${encodeURIComponent(d.id)}`}>{d.serial || d.id}</Link></td>
                          <td className="mono">{d.firmware || "—"}</td>
                          <td className="mono">{d.ip || "—"}</td>
                          <td title={d.lastInform || ""}>{ago(d.lastInform)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </>
  );
}
