import { Suspense } from "react";
import type { Metadata } from "next";
import { Chakra_Petch, IBM_Plex_Mono } from "next/font/google";
import { LoginPainel } from "./login-painel";

const display = Chakra_Petch({ subsets: ["latin"], weight: ["500", "700"], variable: "--fonte-display" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--fonte-mono" });

export const metadata: Metadata = { title: "Entrar · CITacs" };

export default function LoginPage() {
  return (
    <div className={`${display.variable} ${mono.variable}`}>
      <Suspense>
        <LoginPainel />
      </Suspense>
    </div>
  );
}
