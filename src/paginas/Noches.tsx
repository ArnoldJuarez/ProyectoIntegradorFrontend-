import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AvisoDeError } from "../Aviso";
import { horaDeSala, soles, verNochesCelebradas, type NocheEnHistorico } from "../api";
import { useCarga } from "../datos";
import "./expediente.css";

/**
 * Noches celebradas: todas las que ya pasaron, con sus cifras clave en una tabla
 * que se puede ordenar y filtrar por día de la semana.
 *
 * Es la puerta de entrada al expediente de cada noche. Ordenar por resultado o
 * filtrar solo los sábados contesta en un vistazo preguntas que antes pedían
 * abrir las noches una a una: «¿cuál fue el mejor sábado?», «¿los jueves
 * compensan?».
 */

type Columna = "empiezaA" | "dentro" | "ocupacionPct" | "taquillaCentimos" | "barraCentimos" | "costesCentimos" | "resultadoCentimos";

const COLUMNAS: { id: Columna; texto: string; num: boolean }[] = [
  { id: "empiezaA", texto: "Noche", num: false },
  { id: "dentro", texto: "Dentro", num: true },
  { id: "ocupacionPct", texto: "Aforo", num: true },
  { id: "taquillaCentimos", texto: "Taquilla", num: true },
  { id: "barraCentimos", texto: "Barra", num: true },
  { id: "costesCentimos", texto: "Costes", num: true },
  { id: "resultadoCentimos", texto: "Resultado", num: true },
];

function valor(n: NocheEnHistorico, c: Columna): number {
  return c === "empiezaA" ? Date.parse(n.empiezaA) : (n[c] ?? -1);
}

export function Noches() {
  const carga = useCarga(() => verNochesCelebradas(120), []);
  const [orden, setOrden] = useState<{ col: Columna; desc: boolean }>({ col: "empiezaA", desc: true });
  const [dia, setDia] = useState("");

  const dias = useMemo(
    () => (carga.fase === "listo" ? [...new Set(carga.datos.map((n) => n.diaDeLaSemana))] : []),
    [carga],
  );

  if (carga.fase === "cargando") return <p className="aviso">Cargando las noches…</p>;
  if (carga.fase === "error") {
    return <AvisoDeError que="las noches celebradas" mensaje={carga.mensaje} estadoHttp={carga.estadoHttp} />;
  }

  const filtradas = carga.datos.filter((n) => !dia || n.diaDeLaSemana === dia);
  const ordenadas = [...filtradas].sort((a, b) => {
    const d = valor(a, orden.col) - valor(b, orden.col);
    return orden.desc ? -d : d;
  });

  // Solo las que tuvieron gente: una noche vacía (sin accesos registrados) bajaría todas las medias.
  const conGente = filtradas.filter((n) => n.dentro > 0);
  const media = (f: (n: NocheEnHistorico) => number) =>
    conGente.length === 0 ? 0 : Math.round(conGente.reduce((s, n) => s + f(n), 0) / conGente.length);
  const mejor = [...conGente].sort((a, b) => b.resultadoCentimos - a.resultadoCentimos)[0];

  function ordenarPor(col: Columna) {
    setOrden((o) => (o.col === col ? { col, desc: !o.desc } : { col, desc: true }));
  }

  return (
    <section>
      <header className="cabecera">
        <h2>Noches celebradas</h2>
        <div className="cabecera__acciones">
          <label className="contador">
            Día{" "}
            <select value={dia} onChange={(e) => setDia(e.target.value)}>
              <option value="">Todos</option>
              {dias.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <div className="tarjetas">
        <div className="tarjeta">
          <p className="tarjeta__cifra">{conGente.length}</p>
          <p className="tarjeta__pie">Noches con gente{dia && ` · ${dia}`}</p>
        </div>
        <div className="tarjeta">
          <p className="tarjeta__cifra">{media((n) => n.dentro)}</p>
          <p className="tarjeta__pie">Personas por noche, de media</p>
        </div>
        <div className="tarjeta">
          <p className="tarjeta__cifra tarjeta__cifra--dinero">{soles(media((n) => n.taquillaCentimos + n.barraCentimos))}</p>
          <p className="tarjeta__pie">Ingresos por noche, de media</p>
        </div>
        <div className="tarjeta">
          <p className="tarjeta__cifra tarjeta__cifra--dinero">{soles(media((n) => n.resultadoCentimos))}</p>
          <p className="tarjeta__pie">
            Resultado medio{mejor && ` · mejor: ${mejor.titulo} (${horaDeSala(mejor.empiezaA, { day: "numeric", month: "short" })})`}
          </p>
        </div>
      </div>

      <p className="sutil">
        Toca una noche para ver su expediente completo: asistencia por hora, cada barra y cada caja, promotores, costes e
        incidencias. Toca una columna para ordenar.
      </p>

      <div className="tabla-scroll">
        <table className="tabla">
          <thead>
            <tr>
              {COLUMNAS.map((c) => (
                <th key={c.id} className={c.num ? "num" : undefined} aria-sort={orden.col === c.id ? (orden.desc ? "descending" : "ascending") : "none"}>
                  <button type="button" className="ordenar" onClick={() => ordenarPor(c.id)}>
                    {c.texto}
                    {orden.col === c.id && (orden.desc ? " ↓" : " ↑")}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((n) => (
              <tr key={n.slug} className={n.dentro === 0 ? "fila--apagada" : undefined}>
                <td>
                  <Link to={`/panel/eventos/${n.slug}/noche`} className="enlace">
                    <strong>{n.titulo}</strong>
                  </Link>
                  <br />
                  <span className="sutil">
                    {n.diaDeLaSemana} {horaDeSala(n.empiezaA, { dateStyle: "medium" })}
                    {n.incidencias > 0 && ` · ${n.incidencias} ${n.incidencias === 1 ? "incidencia" : "incidencias"}`}
                  </span>
                </td>
                <td className="num">{n.dentro}</td>
                <td className="num">{n.ocupacionPct === null ? "—" : `${n.ocupacionPct} %`}</td>
                <td className="num precio">{soles(n.taquillaCentimos)}</td>
                <td className="num precio">{soles(n.barraCentimos)}</td>
                <td className="num">{soles(n.costesCentimos)}</td>
                <td className={`num precio ${n.resultadoCentimos < 0 ? "variacion--baja" : ""}`}>
                  <strong>{soles(n.resultadoCentimos)}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ordenadas.some((n) => n.dentro === 0) && (
        <p className="sutil">
          Las filas apagadas son noches ya pasadas sin accesos registrados en la puerta: o no se escaneó, o todavía no
          hay datos.
        </p>
      )}
    </section>
  );
}
