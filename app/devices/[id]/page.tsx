import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import DeviceActions from "@/components/DeviceActions";
import ParamTable from "@/components/ParamTable";
import { flatten, getDevice, summarize, wifiInfo } from "@/lib/genieacs";
import { ago } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DevicePage({ params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id);
  const raw = await getDevice(id);
  if (!raw) notFound();
  const d = summarize(raw);
  const wifi = wifiInfo(raw);
  const rows = flatten(raw);

  return (
    <>
      <Header />
      <main>
        <p><Link href="/">← Voltar para CPEs</Link></p>
        <h1>{d.manufacturer} {d.model} <span className="muted mono" style={{ fontSize: 14 }}>{d.serial}</span></h1>
        <div className="grid">
          <section className="card">
            <h2>Equipamento</h2>
            <dl>
              <dt>Status</dt><dd><span className={`dot ${d.online ? "on" : ""}`} />{d.online ? "Online" : "Offline"}</dd>
              <dt>Último contato</dt><dd title={d.lastInform || ""}>{ago(d.lastInform)}</dd>
              <dt>Firmware</dt><dd className="mono">{d.firmware || "—"}</dd>
              <dt>IP WAN</dt><dd className="mono">{d.ip || "—"}</dd>
              <dt>Modelo de dados</dt><dd>{d.dataModel === "IGD" ? "TR-098 (InternetGatewayDevice)" : "TR-181 (Device)"}</dd>
              <dt>ID GenieACS</dt><dd className="mono">{d.id}</dd>
            </dl>
          </section>
          <DeviceActions id={d.id} currentSsid={wifi?.ssid || ""} />
        </div>
        <ParamTable rows={rows} />
      </main>
    </>
  );
}
