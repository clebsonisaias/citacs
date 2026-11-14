import { NextResponse, type NextRequest } from "next/server";

/**
 * Sem cookie de sessão, toda página manda para /login. Quem valida a sessão de verdade é a API
 * (guard global); aqui só evitamos mostrar telas vazias para quem não entrou.
 */
export function middleware(request: NextRequest) {
  if (request.cookies.has("citacs_sessao")) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = request.nextUrl.pathname === "/" ? "" : `?de=${encodeURIComponent(request.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Tudo menos /login, a API (que se protege sozinha) e arquivos estáticos.
  matcher: ["/((?!login|api|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|jpg|webp)$).*)"],
};
