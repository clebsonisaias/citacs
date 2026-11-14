"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { 
  Sparkles, 
  Send, 
  Bot, 
  User, 
  Cpu, 
  AlertTriangle, 
  Radio, 
  Zap, 
  ShieldCheck,
  CheckCircle2
} from "lucide-react";
import { AiChatMessage } from "@citacs/shared";

export default function AiCopilotPage() {
  const [activeTenant, setActiveTenant] = useState<'citmax' | 'netgo'>('citmax');
  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      id: "intro-1",
      role: "assistant",
      content: `👋 Olá! Sou o **Copilot de NOC do CITacs**.\n\nPosso achar um roteador pelo **nome do cliente**, login ou serial, e diagnosticar sinal, WAN e Wi-Fi com os dados do ACS e do SGP. Eu só leio: reiniciar e mudar Wi-Fi ficam nos botões da página do roteador.`,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const quickPrompts = [
    "Como está a conexão do Teobaldo Guedes?",
    "Quais roteadores estão offline?",
    "Liste os roteadores e de quem são",
    "Algum roteador com sinal de fibra ruim?",
  ];

  const handleSend = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: AiChatMessage = {
      id: `usr-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newHistory,
          tenantId: activeTenant,
        }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, data]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header />

      <main className="flex-1 flex flex-col p-6 max-w-5xl mx-auto w-full space-y-4">
        {/* Banner Top */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-card via-card to-primary/10 border border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 text-primary flex items-center justify-center border border-primary/30">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Central de IA &amp; Assistente de NOC
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  OpenAI Ativa
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Tire dúvidas técnicas, analise dados GPON e dispare diagnósticos de Wi-Fi baseados em evidência.
              </p>
            </div>
          </div>

          {/* Provedor Selector */}
          <div className="flex items-center gap-2 bg-secondary/80 p-1 rounded-xl border border-border">
            <span className="text-xs text-muted-foreground px-2 font-medium">Provedor:</span>
            <button
              onClick={() => setActiveTenant('citmax')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                activeTenant === 'citmax'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              CITmax
            </button>
            <button
              onClick={() => setActiveTenant('netgo')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                activeTenant === 'netgo'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Netgo
            </button>
          </div>
        </div>

        {/* Quick Prompts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {quickPrompts.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSend(prompt)}
              className="p-3 rounded-xl bg-card border border-border/80 hover:border-primary/50 text-left text-xs text-muted-foreground hover:text-foreground transition-all flex items-center gap-2.5 group"
            >
              <Zap className="w-3.5 h-3.5 text-primary shrink-0 group-hover:scale-110 transition-transform" />
              <span className="truncate">{prompt}</span>
            </button>
          ))}
        </div>

        {/* Chat Stream Window */}
        <div className="flex-1 rounded-2xl bg-card border border-border p-4 overflow-y-auto space-y-4 min-h-[420px]">
          {messages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-primary/20 text-primary flex items-center justify-center shrink-0 border border-primary/30 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-xs leading-relaxed space-y-2 ${
                    isUser
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary/60 border border-border text-foreground"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse p-2">
              <Sparkles className="w-4 h-4 text-primary animate-spin" />
              <span>O Copilot está analisando os dados...</span>
            </div>
          )}
        </div>

        {/* Chat Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="flex items-center gap-2 p-2 rounded-2xl bg-card border border-border"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite uma pergunta técnica, serial ou solicitação de diagnóstico..."
            className="flex-1 bg-transparent px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Enviar</span>
          </button>
        </form>
      </main>
    </>
  );
}
