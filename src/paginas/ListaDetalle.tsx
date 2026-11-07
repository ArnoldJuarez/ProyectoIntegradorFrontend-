import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { AvisoDeError } from "../Aviso";
import {
  ErrorDeApi,
  apuntarInvitado,
  cambiarLista,
  cerrarLista,
  horaDeSala,
  marcarEntradaDeInvitado,
  quitarInvitado,
  verLista,
  type FichaDeLista,
} from "../api";
import { useCarga } from "../datos";

/**
 * Una lista de invitados: apuntar gente, marcar quién entra y ajustar el tope.
 *
 * La noche misma, quien está en la puerta con el panel abre esta pantalla y
 * marca a cada grupo según llega: «Ana +3» es una fila de cuatro personas, y
 * es lo que cuenta para la comisión del promotor.
 */
export function ListaDetalle() {
  const id = Number(useParams().id);
  const [version, setVersion] = useState(0);
  const carga = useCarga(() => verLista(id), [id, version]);
  const recargar = () => setVersion((v) => v + 1);

  if (carga.fase === "cargando") return <p className="aviso">Cargando la lista…</p>;
  if (carga.fase === "error") {
    return <AvisoDeError que="la lista" mensaje={carga.mensaje} estadoHttp={carga.estadoHttp} />;
  }
  return <Ficha lista={carga.datos} alCambiar={recargar} />;
}

function Ficha({ lista, alCambiar }: { lista: FichaDeLista; alCambiar: () => void }) {
  const navegar = useNavigate();
  const [nombre, setNombre] = useState("");
  const [personas, setPersonas] = useState("1");
  const [apuntando, setApuntando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState(lista.nombre);
  const [nuevoTope, setNuevoTope] = useState(String(lista.maxInvitados));
  const quedan = lista.maxInvitados - lista.apuntados;

  async function apuntar(e: React.FormEvent) {
    e.preventDefault();
    setApuntando(true);
    try {
      await apuntarInvitado(lista.id, nombre.trim(), Number(personas));
      setNombre("");
      setPersonas("1");
      alCambiar();
    } catch (err) {
      toast.error(err instanceof ErrorDeApi ? err.message : "No se pudo apuntar.");
    } finally {
      setApuntando(false);
    }
  }

  async function accion(hacer: () => Promise<unknown>, fallo: string) {
    try {
      await hacer();
      alCambiar();
    } catch (err) {
      toast.error(err instanceof ErrorDeApi ? err.message : fallo);
    }
  }

  async function guardarCambios(e: React.FormEvent) {
    e.preventDefault();
    try {
      await cambiarLista(lista.id, { nombre: nuevoNombre.trim(), maxInvitados: Number(nuevoTope) });
      toast.success("Lista actualizada");
      setEditando(false);
      alCambiar();
    } catch (err) {
      toast.error(err instanceof ErrorDeApi ? err.message : "No se pudo guardar.");
    }
  }

  async function cerrar() {
    if (!window.confirm(`¿Cerrar la lista «${lista.nombre}»? Se borra con sus ${lista.invitados.length} filas.`)) return;
    try {
      await cerrarLista(lista.id);
      toast.success("Lista cerrada");
      navegar("/panel/promotores");
    } catch (err) {
      toast.error(err instanceof ErrorDeApi ? err.message : "No se pudo cerrar la lista.");
    }
  }

  return (
    <section>
      <p className="migas">
        <Link to="/panel/promotores" className="enlace">
          ← Promotores
        </Link>
      </p>

      <header className="cabecera">
        <h2>{lista.nombre}</h2>
        <div className="cabecera__acciones">
          <button type="button" className="boton-secundario" onClick={() => setEditando((v) => !v)}>
            {editando ? "Cancelar" : "Editar"}
          </button>
          {lista.entraron === 0 && (
            <button type="button" className="boton-fantasma boton--peligro" onClick={() => void cerrar()}>
              Cerrar lista
            </button>
          )}
        </div>
      </header>

      <p className="descripcion">
        Lista de <strong>{lista.promotor}</strong> para{" "}
        <Link to={`/panel/eventos/${lista.nocheSlug}`} className="enlace">
          {lista.noche}
        </Link>{" "}
        · {horaDeSala(lista.empiezaA)}
      </p>

      {editando && (
        <form className="tipo-form" onSubmit={(e) => void guardarCambios(e)}>
          <div className="tipo-form__campos">
            <label>
              Nombre
              <input value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} required minLength={2} maxLength={80} />
            </label>
            <label>
              Tope de personas
              <input type="number" min={1} max={500} value={nuevoTope} onChange={(e) => setNuevoTope(e.target.value)} required />
            </label>
          </div>
          <div className="tipo-form__acciones">
            <button type="submit">Guardar</button>
          </div>
        </form>
      )}

      <div className="tarjetas">
        <div className="tarjeta">
          <p className="tarjeta__cifra">{lista.apuntados}</p>
          <p className="tarjeta__pie">Apuntados de {lista.maxInvitados}</p>
        </div>
        <div className={quedan <= 0 ? "tarjeta tarjeta--alerta" : "tarjeta"}>
          <p className="tarjeta__cifra">{Math.max(0, quedan)}</p>
          <p className="tarjeta__pie">Plazas libres</p>
        </div>
        <div className="tarjeta">
          <p className="tarjeta__cifra">{lista.entraron}</p>
          <p className="tarjeta__pie">Han entrado</p>
        </div>
      </div>

      <form className="alta-rapida alta-rapida--fila" onSubmit={(e) => void apuntar(e)}>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre y apellido"
          aria-label="Nombre del invitado"
          required
          maxLength={120}
          disabled={quedan <= 0}
        />
        <label className="alta-rapida__personas">
          Personas
          <input
            type="number"
            min={1}
            max={Math.max(1, Math.min(20, quedan))}
            value={personas}
            onChange={(e) => setPersonas(e.target.value)}
            disabled={quedan <= 0}
          />
        </label>
        <button type="submit" className="boton" disabled={apuntando || quedan <= 0}>
          {quedan <= 0 ? "Lista llena" : apuntando ? "Apuntando…" : "Apuntar"}
        </button>
      </form>

      {lista.invitados.length === 0 ? (
        <p className="aviso">Todavía no hay nadie apuntado.</p>
      ) : (
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr>
                <th>Invitado</th>
                <th className="num">Personas</th>
                <th>Entrada</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lista.invitados.map((i) => (
                <tr key={i.id}>
                  <td>{i.nombreCompleto}</td>
                  <td className="num">{i.personas}</td>
                  <td>
                    <label className="casilla">
                      <input
                        type="checkbox"
                        checked={i.entro}
                        onChange={(e) =>
                          void accion(() => marcarEntradaDeInvitado(i.id, e.target.checked), "No se pudo marcar.")
                        }
                      />
                      {i.entro ? (
                        <span>
                          Entró <span className="sutil">{i.entroEn ? horaDeSala(i.entroEn, { timeStyle: "short" }) : ""}</span>
                        </span>
                      ) : (
                        <span className="sutil">Pendiente</span>
                      )}
                    </label>
                  </td>
                  <td className="acciones">
                    {!i.entro && (
                      <button
                        type="button"
                        className="boton-fantasma"
                        onClick={() => void accion(() => quitarInvitado(i.id), "No se pudo quitar.")}
                      >
                        Quitar
                      </button>
                    )}
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
