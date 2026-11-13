import Link from "next/link";
export default function NotFound() {
  return (
    <main><div className="card empty">CPE não encontrada. <Link href="/">Voltar para a lista</Link></div></main>
  );
}
