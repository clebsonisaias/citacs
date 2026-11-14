#!/bin/sh
# Confere se o roteador traz o login PPPoE (WANPPPConnection.*.Username) e, se
# faltar, inclui o campo no provision de inventário do GenieACS.
# Rodar no terminal do container do GenieACS que tem o NBI (porta 7557).
#   sh pppoe-inventario.sh            -> confere e aplica se faltar
#   APLICAR=0 sh pppoe-inventario.sh  -> só confere, não altera nada
cat > /tmp/pppoe-inventario.js <<'EOF'
const http = require("http");
const NBI = process.env.NBI_URL || "http://127.0.0.1:7557";
const ID = process.env.DEVICE_ID || "00E0FC-Huawei-VMXQU21911003789";
const APLICAR = process.env.APLICAR !== "0";
const MARCA = "// citacs: login PPPoE para a integração";

function req(method, path, body) {
  return new Promise((ok, falha) => {
    const u = new URL(path, NBI);
    const r = http.request(u, { method, headers: body ? { "Content-Type": path.startsWith("/provisions") ? "application/javascript" : "application/json" } : {} }, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => ok({ status: res.statusCode, body: d }));
    });
    r.on("error", falha);
    r.setTimeout(30000, () => r.destroy(new Error("timeout")));
    if (body) r.write(body);
    r.end();
  });
}
const q = (o) => encodeURIComponent(JSON.stringify(o));

function acharUsernames(no, caminho, saida) {
  if (!no || typeof no !== "object") return saida;
  for (const [k, v] of Object.entries(no)) {
    if (k.startsWith("_")) continue;
    const p = caminho ? caminho + "." + k : k;
    if (k === "Username" && /PPP/.test(p)) saida.push([p, v && v._value]);
    else acharUsernames(v, p, saida);
  }
  return saida;
}

(async () => {
  const proj = "_lastInform,InternetGatewayDevice.WANDevice,Device.PPP";
  const r = await req("GET", `/devices/?query=${q({ _id: ID })}&projection=${proj}`);
  const devs = JSON.parse(r.body || "[]");
  if (!devs.length) { console.log(`ERRO: roteador ${ID} não está no ACS.`); process.exit(1); }
  const achados = acharUsernames(devs[0], "", []);
  console.log(`Roteador: ${ID}\nÚltimo inform: ${devs[0]._lastInform}`);
  if (achados.length) achados.forEach(([p, v]) => console.log(`  ${p} = ${JSON.stringify(v)}`));
  else console.log("  Nenhum WANPPPConnection.*.Username no banco do ACS.");
  const temValor = achados.some(([, v]) => typeof v === "string" && v.trim());

  const pr = JSON.parse((await req("GET", "/provisions/")).body || "[]");
  console.log(`\nProvisions: ${pr.map((p) => p._id).join(", ") || "(nenhum)"}`);
  const inv = pr.filter((p) => /invent/i.test(p._id));
  if (inv.length !== 1) { console.log(`ERRO: esperava 1 provision de inventário, achei ${inv.length}. Nada alterado.`); process.exit(1); }
  const prov = inv[0];
  const jaTem = prov.script.includes(MARCA);
  console.log(`Provision de inventário: "${prov._id}" (${jaTem ? "já inclui" : "não inclui"} o login PPPoE)`);

  if (!jaTem) {
    if (!APLICAR) { console.log("APLICAR=0: nada alterado."); return; }
    require("fs").writeFileSync(`/tmp/provision-${prov._id}.bak.js`, prov.script);
    const extra = `

${MARCA}
{
  const t = Date.now() - 6 * 3600 * 1000; // relê no máximo a cada 6 h
  // Só lê o modelo de dados que o aparelho já tem (sem {path}, não procura caminho novo).
  if (declare("InternetGatewayDevice.DeviceInfo.SerialNumber", {value: 1}).size)
    declare("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.Username", {path: t, value: t});
  else if (declare("Device.DeviceInfo.SerialNumber", {value: 1}).size)
    declare("Device.PPP.Interface.*.Username", {path: t, value: t});
}
`;
    const w = await req("PUT", `/provisions/${encodeURIComponent(prov._id)}`, prov.script + extra);
    console.log(`PUT provision: HTTP ${w.status} ${w.body}`.trim());
    if (w.status >= 300) process.exit(1);
    console.log(`Backup do script anterior: /tmp/provision-${prov._id}.bak.js`);
  }

  if (!temValor) {
    // Leitura só (refreshObject): pede ao roteador para reler a WAN agora.
    const obj = devs[0].Device ? "Device.PPP" : "InternetGatewayDevice.WANDevice.1.WANConnectionDevice";
    const t = await req("POST", `/devices/${encodeURIComponent(ID)}/tasks?connection_request&timeout=20000`,
      JSON.stringify({ name: "refreshObject", objectName: obj }));
    console.log(`\nRefresh de ${obj}: HTTP ${t.status} (200 = feito agora; 202 = fica para o próximo inform)`);
    const r2 = JSON.parse((await req("GET", `/devices/?query=${q({ _id: ID })}&projection=${proj}`)).body || "[]");
    const depois = acharUsernames(r2[0], "", []);
    depois.forEach(([p, v]) => console.log(`  ${p} = ${JSON.stringify(v)}`));
    if (!depois.length) console.log("  Ainda sem Username: confira de novo depois do próximo inform.");
  }
})().catch((e) => { console.log("ERRO:", e.message); process.exit(1); });
EOF
node /tmp/pppoe-inventario.js
