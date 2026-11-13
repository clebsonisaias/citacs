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
  Layers
} from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { label: "Visão Geral", href: "/", icon: Activity },
    { label: "CPEs / ONTs", href: "/cpes", icon: Radio },
    { label: "Copilot IA NOC", href: "/ai-copilot", icon: Sparkles, badge: "AI" },
    { label: "Diagnósticos em Lote", href: "/diagnostics", icon: Cpu },
    { label: "Presets TR-069", href: "/presets", icon: Layers },
    { label: "Auditoria & Logs", href: "/logs", icon: FileText },
    { label: "Configurações", href: "/settings", icon: Settings },
  ];

  return (
    <aside className="w-64 border-r border-border bg-card/60 flex flex-col justify-between p-4 min-h-screen">
      <div>
        <div className="flex items-center gap-3 px-2 py-4 mb-4">
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

        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
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
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <div className="flex-1 truncate">
            <div className="font-medium text-foreground">CITmax Telecom</div>
            <div className="text-[11px] truncate">170.82.252.195 (GenieACS Online)</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
