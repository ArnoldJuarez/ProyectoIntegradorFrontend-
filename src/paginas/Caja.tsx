import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AvisoDeError } from "../Aviso";
import { ErrorDeApi, cambiarBarra, crearBarra, horaDeSala, listarArqueos, soles, verBarrasDelLocal } from "../api";
import { useCarga } from "../datos";

/**
 * Las barras del local. Cada turno de caja se abre en una, y así el expediente
 * de cada noche puede decir cuánto vendió cada barra y no solo cada persona.
 */
function BarrasDelLocal() {
  const [version, setVersion] = useState(0);
  const carga = useCarga(verBarrasDelLocal, [version]);
  const [nombre, setNombre] = useState("");

  if (carga.fase !== "listo") return null;

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    try {
      await crearBarra(nombre.trim());
      toast.success(`Barra «${nombre.trim()}» dada de alta`);
      setNombre("");
      setVersion((v) => v + 1);
    } catch (err) {
      toast.error(err instanceof ErrorDeApi ? err.message : "No se pudo crear la barra.");
    }
  }

  async function alternar(id: number, activa: boolean) {
    try {
      await cambiarBarra(id, activa);
      setVersion((v) => v + 1);
    } catch (err) {
      toast.error(err instanceof ErrorDeApi ? err.message : "No se pudo cambiar la barra.");
    }
  }

  return (
    <details className="apartado">
      <summary className="subtitulo">
        Barras del local · {carga.datos.filter((b) => b.activa).length} activas
      </summary>
      <p className="sutil">
        Quien abre caja elige en qué barra está (si hay más de una). Retirar una barra no borra sus turnos viejos.
      </p>
      <ul className="avisos">
        {carga.datos.map((b) => (
          <li key={b.id} className={b.activa ? "aviso-noche--bien" : "aviso-noche--neutro"}>
            <strong>{b.nombre}</strong>
            <span className="sutil">{b.activa ? "se monta" : "retirada"}</span>
            <button type="button" className="boton-fantasma" onClick={() => void alternar(b.id, !b.activa)}>
              {b.activa ? "Retirar" : "Volver a montar"}
            </button>
          </li>
        ))}
      </ul>
      <form className="tipo-form" onSubmit={(e) => void crear(e)}>
        <div className="tipo-form__campos">
          <label>
            Nueva barra
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} minLength={2} maxLength={40} placeholder="Barra VIP, Barra terraza…" required />
          </label>
        </div>
        <div className="tipo-form__acciones">
          <button type="submit">Añadir barra</button>
        </div>
      </form>
    </details>
  );
}

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

      <BarrasDelLocal />

      {arqueos.length === 0 ? (
        <p className="aviso">Todavía no se ha abierto ninguna caja.</p>
      ) : (
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr>
                <th>Abierta</th>
                <th>Responsable</th>
                <th>Barra</th>
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
                  <td className="sutil">{a.barra ?? a.sala}</td>
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
