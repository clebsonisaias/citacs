"use client";
import { useMemo, useState } from "react";

export default function ParamTable({ rows }: { rows: Array<[string, string, boolean]> }) {
  const [filter, setFilter] = useState("");
  const shown = useMemo(() => {
    const f = filter.toLowerCase();
    return (f ? rows.filter(([p, v]) => p.toLowerCase().includes(f) || v.toLowerCase().includes(f)) : rows).slice(0, 500);
  }, [rows, filter]);

  return (
    <section className="card">
      <h2>Parâmetros ({rows.length})</h2>
      <div className="toolbar">
        <label htmlFor="pf" className="muted" style={{ alignSelf: "center" }}>Filtrar</label>
        <input id="pf" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="ex.: WLANConfiguration" style={{ flex: "1 1 260px" }} />
      </div>
      {shown.length === 0 ? (
        <p className="empty">Nenhum parâmetro com “{filter}”.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Parâmetro</th><th>Valor</th><th>Gravável</th></tr></thead>
            <tbody>
              {shown.map(([p, v, w]) => (
                <tr key={p}><td className="mono">{p}</td><td className="mono">{v}</td><td>{w ? "sim" : ""}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {shown.length === 500 && <p className="muted">Mostrando os primeiros 500. Use o filtro para refinar.</p>}
    </section>
  );
}
