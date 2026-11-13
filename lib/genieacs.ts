import "server-only";

// Cliente da NBI do GenieACS. Só roda no servidor: o navegador nunca fala com a NBI.
const NBI = (process.env.GENIEACS_NBI_URL || "http://nbi:7557").replace(/\/$/, "");

type Node = { _value?: unknown; _timestamp?: string; _writable?: boolean; [k: string]: unknown };
export type RawDevice = {
  _id: string;
  _lastInform?: string;
  _registered?: string;
  _deviceId?: { _Manufacturer?: string; _OUI?: string; _ProductClass?: string; _SerialNumber?: string };
  [k: string]: unknown;
};

export type DeviceSummary = {
  id: string;
  manufacturer: string;
  model: string;
  serial: string;
  firmware: string;
  ip: string;
  lastInform: string | null;
  online: boolean;
  dataModel: "IGD" | "Device";
};

export function get(device: RawDevice, path: string): unknown {
  let cur: unknown = device;
  for (const part of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  if (cur && typeof cur === "object" && "_value" in (cur as Node)) return (cur as Node)._value;
  return undefined;
}

function str(v: unknown): string {
  return v == null ? "" : String(v);
}

export function isOnline(lastInform: string | null | undefined): boolean {
  if (!lastInform) return false;
  const min = Number(process.env.ONLINE_THRESHOLD_MIN || 15);
  return Date.now() - new Date(lastInform).getTime() < min * 60_000;
}

export function summarize(d: RawDevice): DeviceSummary {
  const dataModel = d.InternetGatewayDevice ? "IGD" : "Device";
  const root = dataModel === "IGD" ? "InternetGatewayDevice" : "Device";
  const ip =
    dataModel === "IGD"
      ? str(get(d, "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ExternalIPAddress")) ||
        str(get(d, "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress"))
      : str(get(d, "Device.IP.Interface.1.IPv4Address.1.IPAddress"));
  return {
    id: d._id,
    manufacturer: str(get(d, `${root}.DeviceInfo.Manufacturer`)) || str(d._deviceId?._Manufacturer),
    model: str(get(d, `${root}.DeviceInfo.ModelName`)) || str(d._deviceId?._ProductClass),
    serial: str(get(d, `${root}.DeviceInfo.SerialNumber`)) || str(d._deviceId?._SerialNumber),
    firmware: str(get(d, `${root}.DeviceInfo.SoftwareVersion`)),
    ip,
    lastInform: d._lastInform ?? null,
    online: isOnline(d._lastInform),
    dataModel,
  };
}

const LIST_PROJECTION = [
  "_id",
  "_lastInform",
  "_deviceId",
  "InternetGatewayDevice.DeviceInfo",
  "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ExternalIPAddress",
  "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress",
  "Device.DeviceInfo",
  "Device.IP.Interface.1.IPv4Address.1.IPAddress",
].join(",");

async function nbi(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${NBI}${path}`, { ...init, cache: "no-store", signal: AbortSignal.timeout(20_000) });
  return res;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function listDevices(search?: string): Promise<DeviceSummary[]> {
  const params = new URLSearchParams({ projection: LIST_PROJECTION, limit: "500", sort: JSON.stringify({ _lastInform: -1 }) });
  const q = search?.trim();
  if (q) {
    const rx = { $regex: escapeRegex(q), $options: "i" };
    params.set("query", JSON.stringify({ $or: [{ _id: rx }, { "_deviceId._SerialNumber": rx }] }));
  }
  const res = await nbi(`/devices/?${params}`);
  if (!res.ok) throw new Error(`NBI respondeu ${res.status}`);
  return ((await res.json()) as RawDevice[]).map(summarize);
}

export async function getDevice(id: string): Promise<RawDevice | null> {
  const params = new URLSearchParams({ query: JSON.stringify({ _id: id }) });
  const res = await nbi(`/devices/?${params}`);
  if (!res.ok) throw new Error(`NBI respondeu ${res.status}`);
  const list = (await res.json()) as RawDevice[];
  return list[0] ?? null;
}

export type WifiInfo = { ssid: string; ssidPath: string; passPath: string } | null;

export function wifiInfo(d: RawDevice): WifiInfo {
  if (d.InternetGatewayDevice) {
    const base = "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1";
    // Huawei/ZTE costumam usar PreSharedKey.1.KeyPassphrase; outros PreSharedKey.1.PreSharedKey
    const passPath =
      get(d, `${base}.PreSharedKey.1.KeyPassphrase`) !== undefined
        ? `${base}.PreSharedKey.1.KeyPassphrase`
        : get(d, `${base}.KeyPassphrase`) !== undefined
          ? `${base}.KeyPassphrase`
          : `${base}.PreSharedKey.1.PreSharedKey`;
    return { ssid: str(get(d, `${base}.SSID`)), ssidPath: `${base}.SSID`, passPath };
  }
  return {
    ssid: str(get(d, "Device.WiFi.SSID.1.SSID")),
    ssidPath: "Device.WiFi.SSID.1.SSID",
    passPath: "Device.WiFi.AccessPoint.1.Security.KeyPassphrase",
  };
}

export type TaskResult = { status: "executed" | "queued"; httpStatus: number };

export async function pushTask(id: string, task: Record<string, unknown>): Promise<TaskResult> {
  const res = await nbi(`/devices/${encodeURIComponent(id)}/tasks?timeout=3000&connection_request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(task),
  });
  if (res.status === 200) return { status: "executed", httpStatus: 200 };
  if (res.status === 202) return { status: "queued", httpStatus: 202 };
  throw new Error(`NBI respondeu ${res.status}: ${await res.text()}`);
}

// Achata a árvore de parâmetros para exibição: [caminho, valor, gravável]
export function flatten(d: RawDevice, prefix = ""): Array<[string, string, boolean]> {
  const out: Array<[string, string, boolean]> = [];
  const walk = (node: Record<string, unknown>, path: string) => {
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith("_") || v == null || typeof v !== "object") continue;
      const p = path ? `${path}.${k}` : k;
      const n = v as Node;
      if ("_value" in n) out.push([p, str(n._value), Boolean(n._writable)]);
      walk(n as Record<string, unknown>, p);
    }
  };
  walk(d as Record<string, unknown>, prefix);
  return out;
}
