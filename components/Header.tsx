import Link from "next/link";

export default function Header() {
  return (
    <header className="top">
      <Link href="/" className="brand">CIT<span>acs</span></Link>
      <form action="/api/logout" method="post">
        <button className="btn" type="submit">Sair</button>
      </form>
    </header>
  );
}
