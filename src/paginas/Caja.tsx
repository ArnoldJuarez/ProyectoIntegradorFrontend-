import { Link } from "react-router-dom";
import { AvisoDeError } from "../Aviso";
import { horaDeSala, listarArqueos, soles } from "../api";
import { useCarga } from "../datos";

/**
 * Los arqueos de caja del panel.
 *
 * Un arqueo es el turno de una persona en la barra: se abre con un fondo, se
 * cobran cosas contra él, y al cerrar se cuenta el dinero. Lo único que importa
 * de la lista es **cuáles no cuadraron**, así que eso es lo que se destaca.
 */
export function Caja() {
  const carga = useCarga(listarArqueos, []);

  if (carga.fase === "cargando") return <p className="aviso">Cargando los arqueos…</p>;
  if (carga.fase === "error") {
    return <AvisoDeError que="los arqueos" mensaje={carga.mensaje} estadoHttp={carga.estadoHttp} />;
  }

  const arqueos = carga.datos;
  const abiertas = arqueos.filter((a) => a.estaAbierta).length;
  const descuadradas = arqueos.filter((a) => !a.estaAbierta && !a.cuadro).length;

  return (
    <section>
      <header className="cabecera">
        <h2>Caja</h2>
        <span className="contador">
          {arqueos.length} {arqueos.length === 1 ? "arqueo" : "arqueos"}
        </span>
      </header>

      <div className="tarjetas">
        <div className={abiertas > 0 ? "tarjeta tarjeta--alerta" : "tarjeta"}>
          <p className="tarjeta__cifra">{abiertas}</p>
          <p className="tarjeta__pie">Sin cerrar</p>
        </div>
        <div className={descuadradas > 0 ? "tarjeta tarjeta--alerta" : "tarjeta"}>
          <p className="tarjeta__cifra">{descuadradas}</p>
          <p className="tarjeta__pie">Descuadradas</p>
        </div>
      </div>

      {arqueos.length === 0 ? (
        <p className="aviso">Todavía no se ha abierto ninguna caja.</p>
      ) : (
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr>
                <th>Abierta</th>
                <th>Responsable</th>
                <th>Sala</th>
                <th className="num">Fondo</th>
                {/* «Efectivo» y no «Vendido»: los cobros con tarjeta no llegan
                    al cajón y no salen en esta cifra. */}
                <th className="num">Efectivo</th>
                <th className="num">Contado</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {arqueos.map((a) => (
                <tr
                  key={a.id}
                  className={!a.estaAbierta && !a.cuadro ? "fila--alerta" : undefined}
                >
                  <td>
                    <Link to={`/panel/caja/${a.id}`} className="enlace">
                      {horaDeSala(a.abiertaEn)}
                    </Link>
                  </td>
                  <td>{a.responsable}</td>
                  <td className="sutil">{a.sala}</td>
                  <td className="num sutil">{soles(a.aperturaCentimos)}</td>
                  <td className="num precio">{soles(a.efectivoCobradoCentimos)}</td>
                  <td className="num">
                    {a.contadoCentimos === null ? (
                      <span className="sutil">—</span>
                    ) : (
                      soles(a.contadoCentimos)
                    )}
                  </td>
                  <td>
                    <Resultado
                      estaAbierta={a.estaAbierta}
                      cuadro={a.cuadro}
                      diferenciaCentimos={a.diferenciaCentimos}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/**
 * Cómo acabó una caja.
 *
 * Son tres estados y no dos: abierta, cuadrada y descuadrada. Enseñar una caja
 * abierta como «cuadrada» sería dar por buena una caja que nadie ha contado.
 */
export function Resultado({
  estaAbierta,
  cuadro,
  diferenciaCentimos,
}: {
  estaAbierta: boolean;
  cuadro: boolean;
  diferenciaCentimos: number | null;
}) {
  if (estaAbierta) {
    return <span className="etiqueta">Abierta</span>;
  }

  if (cuadro) {
    return <span className="estado estado--published">Cuadra</span>;
  }

  const diferencia = diferenciaCentimos ?? 0;

  // El signo se dice con palabras, no solo con el número: «sobra» y «falta» no
  // significan lo mismo para quien tiene que dar explicaciones.
  return (
    <span className="estado estado--sold_out">
      {diferencia > 0 ? "Sobra" : "Falta"} {soles(Math.abs(diferencia))}
    </span>
  );
}
