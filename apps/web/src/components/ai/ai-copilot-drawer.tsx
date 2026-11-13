"use client";

import { useState } from "react";
import { 
  Sparkles, 
  X, 
  Send, 
  Bot, 
  User, 
  AlertTriangle, 
  CheckCircle, 
  Play, 
  RefreshCw,
  Cpu
} from "lucide-react";
import { CpeDevice, AiDiagnosticResult, AiSuggestedAction, AiChatMessage } from "@citacs/shared";

interface AiCopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCpe?: CpeDevice | null;
}

export function AiCopilotDrawer({ isOpen, onClose, selectedCpe }: AiCopilotDrawerProps) {
  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: selectedCpe 
        ? `Olá! Estou analisando a ONT **${selectedCpe.serialNumber}** (${selectedCpe.manufacturer} ${selectedCpe.modelName}). Posso diagnosticar problemas de sinal óptico, Wi-Fi ou sugerir comandos TR-069. Como posso ajudar?`
        : "Olá! Sou o Copilot de IA do CITacs. Posso te ajudar a identificar problemas em lote na rede GPON, sugerir configurações de Wi-Fi e diagnosticar ONTs.",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [diagnostic, setDiagnostic] = useState<AiDiagnosticResult | null>(null);
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDiagnose = async () => {
    if (!selectedCpe) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/ai/diagnose/${encodeURIComponent(selectedCpe.id)}`, {
        method: "POST",
      });
      const data = await res.json();
      setDiagnostic(data);
      setMessages((prev) => [
        ...prev,
        {
          id: `diag-${Date.now()}`,
          role: "assistant",
          content: `📊 **Laudo Concluído para ${selectedCpe.serialNumber}**\n\n**Gravidade:** ${data.severity.toUpperCase()}\n\n${data.rootCauseAnalysis}`,
          timestamp: new Date().toISOString(),
          suggestedActions: data.suggestedActions,
        },
      ]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg: AiChatMessage = {
      id: `usr-${Date.now()}`,
      role: "user",
      content: input,
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
          cpeId: selectedCpe?.id,
        }),
      });
      const reply = await res.json();
      setMessages((prev) => [...prev, reply]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteAction = async (action: AiSuggestedAction) => {
    if (!selectedCpe) return;
    setExecutingActionId(action.id);
    try {
      if (action.commandType === "reboot") {
        await fetch(`/api/cpes/${encodeURIComponent(selectedCpe.id)}/reboot`, { method: "POST" });
        alert(`Comando de Reboot enviado para a ONT ${selectedCpe.serialNumber}!`);
      } else if (action.commandType === "wifiConfig") {
        await fetch(`/api/cpes/${encodeURIComponent(selectedCpe.id)}/wifi`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action.parameters),
        });
        alert(`Configurações de Wi-Fi atualizadas para ${selectedCpe.serialNumber}!`);
      } else {
        alert(`Ação registrada: ${action.title}`);
      }
    } catch (err) {
      alert("Falha ao disparar comando para a CPE.");
    } finally {
      setExecutingActionId(null);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-card border-l border-border shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Top Header */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center border border-primary/30">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground">Copilot IA CITacs</h3>
            <p className="text-[11px] text-muted-foreground">Assistente de NOC e TR-069</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* CPE Context Ribbon */}
      {selectedCpe && (
        <div className="px-4 py-2 bg-primary/10 border-b border-primary/20 flex items-center justify-between text-xs">
          <div className="truncate">
            <span className="font-semibold text-primary">{selectedCpe.serialNumber}</span>
            <span className="text-muted-foreground ml-1.5">({selectedCpe.modelName})</span>
          </div>
          <button
            onClick={handleDiagnose}
            disabled={loading}
            className="flex items-center gap-1 px-2 py-1 rounded bg-primary text-primary-foreground font-medium text-[11px] hover:bg-primary/90 transition-colors"
          >
            <Cpu className="w-3 h-3" />
            <span>Diagnosticar</span>
          </button>
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}
            >
              {!isUser && (
                <div className="w-7 h-7 rounded-lg bg-primary/20 text-primary flex items-center justify-center shrink-0 border border-primary/30 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-xl px-3.5 py-2.5 space-y-2 ${
                  isUser
                    ? "bg-primary text-primary-foreground text-right"
                    : "bg-secondary/70 border border-border text-foreground"
                }`}
              >
                <div className="whitespace-pre-wrap text-xs leading-relaxed">
                  {msg.content}
                </div>

                {/* Render Suggested Actions if any */}
                {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                  <div className="pt-2 border-t border-border/60 space-y-1.5 mt-2">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                      Ações Recomendadas com 1 Clique:
                    </span>
                    {msg.suggestedActions.map((action) => (
                      <button
                        key={action.id}
                        disabled={executingActionId === action.id}
                        onClick={() => handleExecuteAction(action)}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-card hover:bg-accent border border-border/80 text-left text-xs transition-colors group"
                      >
                        <div className="truncate mr-2">
                          <div className="font-medium text-foreground group-hover:text-primary transition-colors">
                            {action.title}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {action.description}
                          </div>
                        </div>
                        <Play className="w-3.5 h-3.5 text-primary shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse p-2">
            <Sparkles className="w-3.5 h-3.5 text-primary animate-spin" />
            <span>Processando diagnóstico com IA...</span>
          </div>
        )}
      </div>

      {/* Input Footer */}
      <form onSubmit={handleSendMessage} className="p-3 border-t border-border bg-card">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              selectedCpe
                ? `Pergunte sobre a ONT ${selectedCpe.serialNumber}...`
                : "Pergunte ao Copilot sobre a rede..."
            }
            className="flex-1 bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
