import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AvisoDeError } from "../Aviso";
import {
  ErrorDeApi,
  apuntarGasto,
  borrarGasto,
  corregirGasto,
  crearCategoriaDeGasto,
  horaDeSala,
  soles,
  verGastos,
  verOpcionesDeGasto,
  type GastoEnLista,
  type OpcionesDeGasto,
} from "../api";
import { useCarga } from "../datos";

/**
 * Los gastos de la casa, mes a mes.
 *
 * Los que van a una noche —el caché del DJ, los vigilantes— son los que restan
 * en su margen: el informe post-evento de la IA los cuenta así. Por eso
 * conviene atarlos a la noche al apuntarlos.
 */

/** El mes actual en hora de Lima, como «2026-10». */
function mesDeHoy(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit" }).format(new Date());
}

function moverMes(mes: string, delta: number): string {
  const [a, m] = mes.split("-").map(Number);
  const fecha = new Date(Date.UTC(a, m - 1 + delta, 1));
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, "0")}`;
}

function nombreDelMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(a, m - 1, 15)),
  );
}

export function Gastos() {
  const [mes, setMes] = useState(mesDeHoy());
  const [version, setVersion] = useState(0);
  const carga = useCarga(() => verGastos(mes), [mes, version]);
  const opciones = useCarga(verOpcionesDeGasto, [version]);
  const [abierto, setAbierto] = useState<string | null>(null);
  const recargar = () => setVersion((v) => v + 1);

  return (
    <section>
      <header className="cabecera">
        <h2>Gastos</h2>
        <div className="cabecera__acciones">
          <button type="button" className="boton-fantasma" onClick={() => setMes(moverMes(mes, -1))} aria-label="Mes anterior">
            ←
          </button>
          <span className="contador mes">{nombreDelMes(mes)}</span>
          <button type="button" className="boton-fantasma" onClick={() => setMes(moverMes(mes, 1))} aria-label="Mes siguiente">
            →
          </button>
          {abierto !== "nuevo" && (
            <button type="button" className="boton" onClick={() => setAbierto("nuevo")}>
              Apuntar gasto
            </button>
          )}
        </div>
      </header>

      {abierto === "nuevo" && opciones.fase === "listo" && (
        <FichaDeGasto
          opciones={opciones.datos}
          alGuardar={() => {
            setAbierto(null);
            recargar();
          }}
          alCancelar={() => setAbierto(null)}
        />
      )}

      {carga.fase === "cargando" && <p className="aviso">Cargando los gastos…</p>}
      {carga.fase === "error" && (
        <AvisoDeError que="los gastos" mensaje={carga.mensaje} estadoHttp={carga.estadoHttp} />
      )}
      {carga.fase === "listo" && (
        <>
          <div className="tarjetas">
            <div className="tarjeta">
              <p className="tarjeta__cifra tarjeta__cifra--dinero">{soles(carga.datos.totalCentimos)}</p>
              <p className="tarjeta__pie">Total del mes · {carga.datos.gastos.length} gastos</p>
            </div>
            {carga.datos.porCategoria.slice(0, 3).map((c) => (
              <div key={c.categoria} className="tarjeta">
                <p className="tarjeta__cifra tarjeta__cifra--dinero">{soles(c.totalCentimos)}</p>
                <p className="tarjeta__pie">
                  {c.categoria} · {c.gastos}
                </p>
              </div>
            ))}
          </div>

          {carga.datos.gastos.length === 0 ? (
            <p className="aviso">No hay gastos apuntados en {nombreDelMes(mes)}.</p>
          ) : (
            <div className="tabla-scroll">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Categoría</th>
                    <th>Descripción</th>
                    <th>Noche</th>
                    <th className="num">Importe</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {carga.datos.gastos.map((g) =>
                    abierto === g.id && opciones.fase === "listo" ? (
                      <tr key={g.id}>
                        <td colSpan={6}>
                          <FichaDeGasto
                            inicial={g}
                            opciones={opciones.datos}
                            alGuardar={() => {
                              setAbierto(null);
                              recargar();
                            }}
                            alCancelar={() => setAbierto(null)}
                          />
                        </td>
                      </tr>
                    ) : (
                      <tr key={g.id}>
                        <td className="sutil">{horaDeSala(g.fecha, { dateStyle: "medium" })}</td>
                        <td>
                          <span className="etiqueta">{g.categoria}</span>
                        </td>
                        <td>
                          {g.descripcion ?? <span className="sutil">—</span>}
                          {g.apuntadoPor && <span className="sutil"> · {g.apuntadoPor}</span>}
                        </td>
                        <td>
                          {g.nocheSlug ? (
                            <Link to={`/panel/eventos/${g.nocheSlug}`} className="enlace">
                              {g.noche}
                            </Link>
                          ) : (
                            <span className="sutil">General</span>
                          )}
                        </td>
                        <td className="num precio">{soles(g.importeCentimos)}</td>
                        <td className="acciones">
                          <button type="button" className="boton-secundario" onClick={() => setAbierto(g.id)}>
                            Editar
                          </button>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function FichaDeGasto({
  inicial,
  opciones,
  alGuardar,
  alCancelar,
}: {
  inicial?: GastoEnLista;
  opciones: OpcionesDeGasto;
  alGuardar: () => void;
  alCancelar: () => void;
}) {
  const [categorias, setCategorias] = useState(opciones.categorias.filter((c) => c.activa || c.id === inicial?.categoriaId));
  const [categoriaId, setCategoriaId] = useState(inicial?.categoriaId ?? categorias[0]?.id ?? "");
  const [nocheSlug, setNocheSlug] = useState(inicial?.nocheSlug ?? "");
  const [importe, setImporte] = useState(inicial ? String(inicial.importeCentimos / 100) : "");
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? "");
  const [fecha, setFecha] = useState(
    inicial
      ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date(inicial.fecha))
      : new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date()),
  );
  const [categoriaNueva, setCategoriaNueva] = useState("");
  const [fallo, setFallo] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setFallo(null);
    const datos = {
      categoriaId,
      eventoSlug: nocheSlug || null,
      importeCentimos: Math.round(Number(importe) * 100),
      descripcion: descripcion.trim(),
      // Mediodía de Lima: el día que se ve es el día que se guarda, en cualquier zona.
      fecha: new Date(`${fecha}T12:00:00-05:00`).toISOString(),
    };
    try {
      if (inicial) await corregirGasto(inicial.id, datos);
      else await apuntarGasto(datos);
      toast.success(inicial ? "Gasto corregido" : "Gasto apuntado");
      alGuardar();
    } catch (err) {
      setFallo(err instanceof ErrorDeApi ? err.message : "No se pudo guardar el gasto.");
    }
  }

  async function borrar() {
    if (!inicial || !window.confirm("¿Borrar este gasto?")) return;
    try {
      await borrarGasto(inicial.id);
      toast.success("Gasto borrado");
      alGuardar();
    } catch (err) {
      toast.error(err instanceof ErrorDeApi ? err.message : "No se pudo borrar.");
    }
  }

  async function nuevaCategoria() {
    if (categoriaNueva.trim().length < 2) return;
    try {
      const c = await crearCategoriaDeGasto(categoriaNueva.trim());
      setCategorias((previas) => [...previas, c]);
      setCategoriaId(c.id);
      setCategoriaNueva("");
    } catch (err) {
      toast.error(err instanceof ErrorDeApi ? err.message : "No se pudo crear la categoría.");
    }
  }

  return (
    <form className="tipo-form" onSubmit={(e) => void enviar(e)}>
      {fallo && <p className="aviso aviso--error">{fallo}</p>}
      <div className="tipo-form__campos">
        <label>
          Categoría
          <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} required>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Importe (S/)
          <input type="number" min="0.10" step="0.10" value={importe} onChange={(e) => setImporte(e.target.value)} required autoFocus />
        </label>
        <label>
          Fecha
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        </label>
        <label>
          Noche (opcional)
          <select value={nocheSlug} onChange={(e) => setNocheSlug(e.target.value)}>
            <option value="">General, de ninguna noche</option>
            {opciones.noches.map((n) => (
              <option key={n.slug} value={n.slug}>
                {horaDeSala(n.empiezaA, { dateStyle: "medium" })} · {n.titulo}
              </option>
            ))}
          </select>
        </label>
        <label className="tipo-form__ancho">
          Descripción
          <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={300} placeholder="8 vigilantes, caché DJ Beto, limpieza al cierre…" />
        </label>
        <div className="tipo-form__ancho alta-rapida">
          <input
            value={categoriaNueva}
            onChange={(e) => setCategoriaNueva(e.target.value)}
            placeholder="¿Falta una categoría? Escríbela"
            aria-label="Categoría nueva"
            maxLength={60}
          />
          <button type="button" className="boton-secundario" onClick={() => void nuevaCategoria()} disabled={categoriaNueva.trim().length < 2}>
            Crear categoría
          </button>
        </div>
      </div>
      <div className="tipo-form__acciones">
        {inicial && (
          <button type="button" className="boton--peligro" onClick={() => void borrar()}>
            Borrar
          </button>
        )}
        <button type="button" onClick={alCancelar}>
          Cancelar
        </button>
        <button type="submit">{inicial ? "Guardar cambios" : "Apuntar"}</button>
      </div>
    </form>
  );
}
