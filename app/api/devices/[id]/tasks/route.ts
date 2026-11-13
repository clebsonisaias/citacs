import { NextResponse } from "next/server";
import { getDevice, pushTask, wifiInfo } from "@/lib/genieacs";

type Body =
  | { action: "reboot" }
  | { action: "refresh" }
  | { action: "wifi"; ssid?: string; password?: string };

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id);
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
  try {
    const device = await getDevice(id);
    if (!device) return NextResponse.json({ error: "CPE não encontrada no GenieACS." }, { status: 404 });
    const root = device.InternetGatewayDevice ? "InternetGatewayDevice" : "Device";

    let task: Record<string, unknown>;
    if (body.action === "reboot") task = { name: "reboot" };
    else if (body.action === "refresh") task = { name: "refreshObject", objectName: root };
    else if (body.action === "wifi") {
      const w = wifiInfo(device);
      if (!w) return NextResponse.json({ error: "Esta CPE não expõe Wi-Fi via TR-069." }, { status: 400 });
      const values: Array<[string, string, string]> = [];
      const ssid = body.ssid?.trim();
      if (ssid) {
        if (ssid.length > 32) return NextResponse.json({ error: "O SSID aceita no máximo 32 caracteres." }, { status: 400 });
        values.push([w.ssidPath, ssid, "xsd:string"]);
      }
      if (body.password) {
        if (body.password.length < 8 || body.password.length > 63)
          return NextResponse.json({ error: "A senha do Wi-Fi precisa ter de 8 a 63 caracteres." }, { status: 400 });
        values.push([w.passPath, body.password, "xsd:string"]);
      }
      if (!values.length) return NextResponse.json({ error: "Informe o novo SSID, a nova senha ou ambos." }, { status: 400 });
      task = { name: "setParameterValues", parameterValues: values };
    } else {
      return NextResponse.json({ error: "Ação desconhecida." }, { status: 400 });
    }

    const result = await pushTask(id, task);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: `Não foi possível falar com o GenieACS. ${(e as Error).message}` },
      { status: 502 },
    );
  }
}
