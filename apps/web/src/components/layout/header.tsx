"use client";

import { Sparkles, RefreshCw, Menu } from "lucide-react";
import { useNav } from "./nav-context";

interface HeaderProps {
  onOpenCopilot?: () => void;
  copilotOpen?: boolean;
}

export function Header({ onOpenCopilot, copilotOpen }: HeaderProps) {
  const { toggleMobileMenu } = useNav();

  return (
    <header className="h-16 border-b border-border bg-card/40 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 w-full">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Mobile Hamburger Menu Toggle */}
        <button
          onClick={toggleMobileMenu}
          className="p-2 -ml-1 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden transition-colors border border-border/40 shrink-0"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="hidden sm:inline">GenieACS CWMP</span> :7550 Ativo
        </span>

        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-primary/10 text-primary border border-primary/20 shrink-0">
          <span className="font-semibold">Provedores:</span>
          <span>CITmax &amp; Netgo</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary/30 text-white font-mono font-bold">OpenAI Ativa</span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {onOpenCopilot && (
          <button
            onClick={onOpenCopilot}
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all shadow-sm ${
              copilotOpen
                ? "bg-primary text-primary-foreground ring-2 ring-primary/40"
                : "bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 sm:w-4 h-4" />
            <span>Copilot<span className="hidden sm:inline"> IA</span></span>
          </button>
        )}

        <button 
          onClick={() => window.location.reload()}
          className="p-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors border border-border/40"
          aria-label="Atualizar"
        >
          <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-border/80">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-secondary flex items-center justify-center text-[10px] sm:text-xs font-semibold text-primary border border-border shrink-0">
            ADM
          </div>
          <div className="text-xs hidden sm:block">
            <div className="font-medium text-foreground truncate max-w-[120px]">Administrador NOC</div>
            <div className="text-[10px] text-muted-foreground truncate max-w-[120px]">admin@citmax.com.br</div>
          </div>
        </div>
      </div>
    </header>
  );
}
