import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { NavProvider } from "@/components/layout/nav-context";

export const metadata: Metadata = {
  title: "CITacs - GenieACS TR-069 + Copilot IA",
  description: "Plataforma Inteligente de Gerenciamento e Diagnóstico TR-069",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="antialiased bg-background text-foreground flex min-h-screen">
        <NavProvider>
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0 w-full overflow-x-hidden min-h-screen">
            {children}
          </div>
        </NavProvider>
      </body>
    </html>
  );
}
