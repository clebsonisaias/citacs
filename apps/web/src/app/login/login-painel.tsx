"use client";

import { useEffect, useState, type CSSProperties, type FormEvent, type InputHTMLAttributes } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import s from "./login.module.css";

/** Campo de senha com o botão de olho para mostrar o que foi digitado. */
function CampoSenha({ rotulo, ver, alternar, ...input }: { rotulo: string; ver: boolean; alternar: () => void } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={s.campo}>
      <span>{rotulo}</span>
      <div className={s.comOlho}>
        <input {...input} type={ver ? "text" : "password"} autoCapitalize="none" spellCheck={false} />
        <button type="button" className={s.olho} onClick={alternar} aria-label={ver ? "Esconder senha" : "Mostrar senha"} aria-pressed={ver}>
          {ver ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </label>
  );
}

type Estado = "ocioso" | "enviando" | "ok" | "erro" | "trocar";

const VISOR: Record<Estado, string> = {
  ocioso: "AGUARDANDO CREDENCIAIS",
  enviando: "AUTENTICANDO",
  ok: "ACESSO LIBERADO · CARREGANDO PAINEL",
  erro: "ACESSO NEGADO",
  trocar: "SENHA TEMPORÁRIA · DEFINA UMA NOVA",
};

const PORTAS = Array.from({ length: 16 }, (_, i) => i);
// Ritmo de cada LED sem Math.random: o HTML do servidor precisa bater com o do navegador.
const ritmo = (i: number) =>
  ({
    "--i": i,
    "--dur": `${0.7 + ((i * 7) % 11) / 9}s`,
    "--atraso": `${((i * 13) % 17) / 8}s`,
  }) as CSSProperties;

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const JSON_HEADERS = { "Content-Type": "application/json" };

/** Só caminhos internos: evita mandar alguém para fora depois do login (open redirect). */
function destinoSeguro(de: string | null) {
  return de && de.startsWith("/") && !de.startsWith("//") ? de : "/";
}

function mensagemDaApi(corpo: { message?: string | string[] }, padrao: string) {
  return (Array.isArray(corpo.message) ? corpo.message[0] : corpo.message) || padrao;
}

export function LoginPainel() {
  const params = useSearchParams();
  const [estado, setEstado] = useState<Estado>("ocioso");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [temporaria, setTemporaria] = useState(""); // a senha com que entrou, exigida para trocar
  const [pedirTemporaria, setPedirTemporaria] = useState(false); // voltou com sessão: não sabemos a temporária
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [nome, setNome] = useState("");
  const [ver, setVer] = useState(false);
  const alternarVer = () => setVer((v) => !v);

  // Já tem sessão: entra direto, ou cai na troca de senha se ainda for a temporária.
  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (r) => {
        if (!r.ok) return;
        const u = await r.json();
        if (u.trocarSenha) {
          setNome(u.nome);
          setPedirTemporaria(true);
          setEstado("trocar");
        } else window.location.replace(destinoSeguro(params.get("de")));
      })
      .catch(() => undefined);
  }, [params]);

  function liberar() {
    setEstado("ok");
    setTimeout(() => window.location.replace(destinoSeguro(params.get("de"))), 1100);
  }

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setOcupado(true);
    setEstado("enviando");
    const inicio = Date.now();
    try {
      const r = await fetch("/api/auth/login", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ login, senha }) });
      const corpo = await r.json().catch(() => ({}));
      await esperar(Math.max(0, 650 - (Date.now() - inicio))); // dá tempo da varredura dos LEDs aparecer
      if (!r.ok) {
        setEstado("erro");
        setErro(
          r.status === 401 ? "Usuário ou senha inválidos." : r.status === 429 ? mensagemDaApi(corpo, "Muitas tentativas.") : "Não foi possível entrar agora. Tente de novo.",
        );
        return;
      }
      if (corpo.trocarSenha) {
        setTemporaria(senha);
        setSenha("");
        setNome(corpo.nome);
        setEstado("trocar");
        return;
      }
      liberar();
    } catch {
      setEstado("erro");
      setErro("Sem conexão com o servidor.");
    } finally {
      setOcupado(false);
    }
  }

  async function trocar(e: FormEvent) {
    e.preventDefault();
    if (nova.length < 12) return setErro("A senha nova precisa de 12 caracteres ou mais.");
    if (nova !== confirma) return setErro("As duas senhas novas não são iguais.");
    setErro("");
    setOcupado(true);
    try {
      const r = await fetch("/api/auth/senha", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ atual: temporaria, nova }) });
      if (r.ok) return liberar();
      setErro(mensagemDaApi(await r.json().catch(() => ({})), "Não foi possível trocar a senha."));
    } catch {
      setErro("Sem conexão com o servidor.");
    } finally {
      setOcupado(false);
    }
  }

  const forca = Math.min(4, Math.floor(nova.length / 4)); // 0..4 barras; 12+ caracteres = 3

  return (
    <main className={s.palco}>
      <div className={s.grade} aria-hidden="true" />
      <svg className={s.fibras} viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <filter id="brilho-fibra" filterUnits="userSpaceOnUse" x="-100" y="-100" width="1400" height="1000">
            <feGaussianBlur stdDeviation="3.5" result="borrado" />
            <feMerge>
              <feMergeNode in="borrado" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {[
          "M-40 120 C 300 140, 520 300, 820 380",
          "M-40 260 C 260 250, 560 360, 820 400",
          "M-40 420 C 280 430, 540 420, 820 420",
          "M-40 600 C 300 560, 560 470, 820 440",
          "M-40 760 C 320 700, 600 520, 820 460",
          "M1240 80 C 1080 160, 980 300, 900 380",
          "M1240 720 C 1100 640, 980 520, 900 460",
        ].map((d, i) => (
          <g key={d}>
            <path d={d} className={s.fibra} pathLength={1000} />
            <path d={d} className={s.pulso} pathLength={1000} filter="url(#brilho-fibra)" style={{ animationDelay: `${i * 0.9}s`, animationDuration: `${4 + (i % 3)}s` }} />
          </g>
        ))}
      </svg>

      <section className={s.marca}>
        <p className={s.sobretitulo}>NOC · Gerência TR-069</p>
        <h1 className={s.titulo}>
          CIT<span>acs</span>
        </h1>
        <p className={s.lema}>Os roteadores dos clientes num só painel, com diagnóstico por IA baseado em evidência.</p>
        <ul className={s.modulos}>
          <li>
            <i className={`${s.ledModulo} ${s.verde}`} /> Gerência remota CWMP
          </li>
          <li>
            <i className={`${s.ledModulo} ${s.ciano}`} /> Diagnóstico por camadas com IA
          </li>
          <li>
            <i className={`${s.ledModulo} ${s.ambar}`} /> Toda alteração com autor e reversão
          </li>
        </ul>
      </section>

      <section className={s.chassi} data-estado={estado} aria-labelledby="titulo-acesso">
        {["se", "sd", "ie", "id"].map((p) => (
          <span key={p} className={`${s.parafuso} ${s[p]}`} aria-hidden="true" />
        ))}

        <header className={s.serigrafia}>
          <span id="titulo-acesso">CITacs · CONSOLE DE ACESSO</span>
          <span className={s.modelo}>MOD-AUTH 01</span>
        </header>

        <div className={s.portas} aria-hidden="true">
          {PORTAS.map((i) => (
            <div key={i} className={s.porta} style={ritmo(i)}>
              <i className={`${s.led} ${i % 5 === 3 ? s.ledAtividade : ""}`} />
              <span className={s.gaiola} />
              <small>{String(i + 1).padStart(2, "0")}</small>
            </div>
          ))}
        </div>

        <div className={s.visor} role="status" aria-live="polite">
          <span className={s.prompt}>&gt;</span> {VISOR[estado]}
          <span className={s.cursor} aria-hidden="true" />
        </div>

        {estado !== "trocar" ? (
          <form className={s.formulario} onSubmit={entrar} key="entrar">
            <label className={s.campo}>
              <span>Usuário</span>
              <input
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                maxLength={64}
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                disabled={ocupado || estado === "ok"}
                autoFocus
              />
            </label>
            <CampoSenha
              rotulo="Senha"
              ver={ver}
              alternar={alternarVer}
              name="password"
              autoComplete="current-password"
              required
              maxLength={200}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              disabled={ocupado || estado === "ok"}
            />
            {erro && (
              <p className={s.erro} role="alert">
                {erro}
              </p>
            )}
            <button className={s.botao} type="submit" disabled={ocupado || estado === "ok"}>
              <i className={s.ledBotao} aria-hidden="true" />
              {estado === "enviando" ? "Autenticando" : estado === "ok" ? "Liberado" : "Entrar"}
            </button>
          </form>
        ) : (
          <form className={s.formulario} onSubmit={trocar} key="trocar">
            <p className={s.aviso}>
              {nome ? `${nome}, este` : "Este"} é o seu primeiro acesso com uma senha temporária. Escolha uma senha só sua, com 12 caracteres ou mais.
            </p>
            {pedirTemporaria && (
              <CampoSenha rotulo="Senha temporária" ver={ver} alternar={alternarVer} autoComplete="current-password" required value={temporaria} onChange={(e) => setTemporaria(e.target.value)} />
            )}
            <CampoSenha rotulo={`Senha nova · ${nova.length} de 12+`} ver={ver} alternar={alternarVer} autoComplete="new-password" required minLength={12} maxLength={200} value={nova} onChange={(e) => setNova(e.target.value)} disabled={ocupado} autoFocus />
            <div className={s.forca} data-nivel={forca} aria-hidden="true">
              {[0, 1, 2, 3].map((b) => (
                <i key={b} className={b < forca ? s.barraAcesa : undefined} />
              ))}
            </div>
            <CampoSenha rotulo="Repita a senha nova" ver={ver} alternar={alternarVer} autoComplete="new-password" required maxLength={200} value={confirma} onChange={(e) => setConfirma(e.target.value)} disabled={ocupado} />
            {erro && (
              <p className={s.erro} role="alert">
                {erro}
              </p>
            )}
            <button className={s.botao} type="submit" disabled={ocupado || estado !== "trocar"}>
              <i className={s.ledBotao} aria-hidden="true" />
              Salvar e entrar
            </button>
          </form>
        )}

        <footer className={s.rodape}>
          <span>SESSÃO CIFRADA · TLS</span>
          <span>ACESSO REGISTRADO</span>
        </footer>
      </section>
    </main>
  );
}
