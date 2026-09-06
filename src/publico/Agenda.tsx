import { Link } from "react-router-dom";
import { AvisoDeError } from "../Aviso";
import { horaDeSala, soles, verAgenda } from "../api";
import { useCarga } from "../datos";

/**
 * Todas las fechas anunciadas, agrupadas por mes.
 *
 * Con dos noches por semana, una rejilla corrida de veinte carteles no dice
 * cuándo acaba un mes y empieza el siguiente. Quien está decidiendo su salida
 * piensa en meses, no en una lista.
 */
export function Agenda() {
  const carga = useCarga(verAgenda, []);

  if (carga.fase === "cargando") return <p className="aviso">Cargando la agenda…</p>;
  if (carga.fase === "error") {
    return <AvisoDeError que="la agenda" mensaje={carga.mensaje} estadoHttp={carga.estadoHttp} />;
  }

  const noches = carga.datos;

  // Agrupa conservando el orden que ya trae el backend (de la más cercana en
  // adelante): basta con mirar si cambió el mes respecto de la anterior.
  const meses: { mes: string; noches: typeof noches }[] = [];
  for (const noche of noches) {
    const mes = horaDeSala(noche.puertasA, { month: "long", year: "numeric" });
    const ultimo = meses.at(-1);
    if (ultimo && ultimo.mes === mes) ultimo.noches.push(noche);
    else meses.push({ mes, noches: [noche] });
  }

  return (
    <div className="publico">
      <section className="seccion">
        <h2 className="seccion__titulo">Agenda</h2>

        {noches.length === 0 ? (
          <p className="aviso">No hay fechas anunciadas ahora mismo.</p>
        ) : (
          meses.map(({ mes, noches: delMes }) => (
            <div key={mes} className="mes">
              <h3 className="mes__titulo">{mes}</h3>
              <ul className="lista-noches">
                {delMes.map((n) => (
                  <li key={n.slug}>
                    <Link to={`/evento/${n.slug}`} className="fila-noche">
                      <span className="fila-noche__dia">
                        {horaDeSala(n.puertasA, { weekday: "short", day: "numeric" })}
                      </span>
                      <span className="fila-noche__titulo">{n.titulo}</span>
                      <span className="fila-noche__precio">
                        {n.estado === "AGOTADO"
                          ? "Agotado"
                          : `desde ${soles(n.precioDesdeCentimos)}`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
