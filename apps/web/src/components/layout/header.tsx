"use client";

import { Sparkles, Bell, RefreshCw, UserCheck } from "lucide-react";

interface HeaderProps {
  onOpenCopilot?: () => void;
  copilotOpen?: boolean;
}

export function Header({ onOpenCopilot, copilotOpen }: HeaderProps) {
  return (
    <header className="h-16 border-b border-border bg-card/40 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          GenieACS CWMP :7550 Ativo
        </span>
      </div>

      <div className="flex items-center gap-3">
        {onOpenCopilot && (
          <button
            onClick={onOpenCopilot}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all shadow-sm ${
              copilotOpen
                ? "bg-primary text-primary-foreground ring-2 ring-primary/40"
                : "bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Copilot IA</span>
          </button>
        )}

        <button className="p-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors border border-border/40">
          <RefreshCw className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 pl-3 border-l border-border/80">
          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-primary border border-border">
            ADM
          </div>
          <div className="text-xs">
            <div className="font-medium text-foreground">Administrador NOC</div>
            <div className="text-[10px] text-muted-foreground">admin@citmax.com.br</div>
          </div>
        </div>
      </div>
    </header>
  );
}
