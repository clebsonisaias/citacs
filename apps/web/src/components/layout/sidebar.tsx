"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Radio, 
  Cpu, 
  Sparkles, 
  Activity, 
  Settings, 
  ShieldCheck, 
  FileText,
  Layers,
  BookOpen,
  X
} from "lucide-react";
import { useNav } from "./nav-context";

export function Sidebar() {
  const pathname = usePathname();
  const { mobileMenuOpen, setMobileMenuOpen } = useNav();

  const navItems = [
    { label: "Visão Geral", href: "/", icon: Activity },
    { label: "CPEs / ONTs", href: "/cpes", icon: Radio },
    { label: "Copilot IA NOC", href: "/ai-copilot", icon: Sparkles, badge: "AI" },
    { label: "Diagnósticos em Lote", href: "/diagnostics", icon: Cpu },
    { label: "Presets TR-069", href: "/presets", icon: Layers },
    { label: "Auditoria & Logs", href: "/logs", icon: FileText },
    { label: "Como Configurar Roteadores", href: "/router-config", icon: BookOpen },
    { label: "Configurações", href: "/settings", icon: Settings },
  ];

  const renderNavContent = (isMobile = false) => (
    <div className="flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between px-2 py-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-bold text-xl border border-primary/30">
              CIT
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight text-white flex items-center gap-1.5">
                CITacs <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary font-mono font-medium">v1.0</span>
              </h1>
              <p className="text-xs text-muted-foreground">GenieACS TR-069 + AI</p>
            </div>
          </div>
          {isMobile && (
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden"
              aria-label="Fechar Menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  if (isMobile) setMobileMenuOpen(false);
                }}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm shadow-primary/20"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ${
                    isActive ? "bg-black/30 text-white" : "bg-primary/20 text-primary"
                  }`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="pt-4 border-t border-border/80">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-secondary/40 border border-border/50 text-xs text-muted-foreground">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-foreground truncate">CITmax &amp; Netgo</div>
            <div className="text-[11px] truncate text-muted-foreground">GenieACS TR-069 Online</div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 border-r border-border bg-card/60 flex-col p-4 min-h-screen shrink-0 sticky top-0 h-screen overflow-y-auto">
        {renderNavContent(false)}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer content */}
          <div className="relative w-72 max-w-[85vw] bg-card border-r border-border p-4 flex flex-col justify-between shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {renderNavContent(true)}
          </div>
        </div>
      )}
    </>
  );
}
