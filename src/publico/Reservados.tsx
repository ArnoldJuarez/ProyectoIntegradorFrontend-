import { useState, type FormEvent } from "react";
import { ErrorDeApi, pedirReserva, soles, verReservados } from "../api";
import { useCarga } from "../datos";

/**
 * Solicitud de reservado para una noche.
 *
 * Pedirlo **no aparta la mesa**: deja una solicitud y alguien del local llama
 * para confirmarla y acordar el depósito. Se dice antes de rellenar nada, no
 * después de enviarlo: quien cree que ha reservado y llega sin mesa se enfada
 * con razón.
 */
export function Reservados({ slug }: { slug: string }) {
  const carga = useCarga(() => verReservados(slug), [slug]);

  const [mesaId, setMesaId] = useState<number | "">("");
  const [personas, setPersonas] = useState(2);
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [notas, setNotas] = useState("");

  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setError(null);

    try {
      const { mensaje } = await pedirReserva({
        slug,
        mesaId: Number(mesaId),
        personas,
        notas: notas.trim(),
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        email: email.trim(),
        telefono: telefono.trim(),
      });
      setHecho(mensaje);
    } catch (e) {
      // El backend manda un motivo escrito para leer: "ese reservado acaban de
      // pedirlo", "es para un máximo de 6 personas". Se enseña tal cual.
      setError(
        e instanceof ErrorDeApi ? e.message : "No hemos podido registrar la solicitud.",
      );
      setEnviando(false);
    }
  }

  if (carga.fase === "cargando") return <p className="aviso">Cargando los reservados…</p>;

  // Si los reservados no cargan, la ficha de la noche sigue siendo útil: no se
  // enseña un error grande por una sección secundaria.
  if (carga.fase === "error") return null;

  const mesas = carga.datos;
  const libres = mesas.filter((m) => m.libre);

  if (mesas.length === 0) return null;

  if (hecho) {
    return (
      <>
        <h2 className="seccion__titulo">Reservados</h2>
        <p className="boletin__hecho" role="status">
          {hecho}
        </p>
      </>
    );
  }

  return (
    <>
      <h2 className="seccion__titulo">Reservados</h2>

      <ul className="mesas">
        {mesas.map((m) => (
          <li key={m.id} className={m.libre ? "mesa" : "mesa mesa--pedida"}>
            <div>
              <p className="mesa__nombre">{m.nombre}</p>
              <p className="mesa__detalle">
                {m.zona && <>{m.zona} · </>}
                hasta {m.plazas} personas
                {m.consumoMinimoCentimos > 0 && (
                  <> · consumo mínimo {soles(m.consumoMinimoCentimos)}</>
                )}
              </p>
            </div>
            {!m.libre && <span className="mesa__estado">Pedido</span>}
          </li>
        ))}
      </ul>

      {libres.length === 0 ? (
        <p className="aviso">Todos los reservados de esta noche están pedidos.</p>
      ) : (
        <form className="reserva" onSubmit={enviar}>
          <p className="reserva__nota">
            Pedirlo no lo aparta todavía: te llamamos para confirmarlo y acordar el depósito.
          </p>

          <div className="reserva__fila">
            <label htmlFor="mesa">Reservado</label>
            <select
              id="mesa"
              required
              value={mesaId}
              onChange={(e) => setMesaId(e.target.value ? Number(e.target.value) : "")}
              disabled={enviando}
            >
              <option value="">Elige uno</option>
              {libres.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre} · hasta {m.plazas}
                </option>
              ))}
            </select>
          </div>

          <div className="reserva__fila">
            <label htmlFor="personas">Cuántos venís</label>
            <input
              id="personas"
              type="number"
              min={1}
              max={30}
              required
              value={personas}
              onChange={(e) => setPersonas(Number(e.target.value))}
              disabled={enviando}
            />
          </div>

          <div className="reserva__fila">
            <label htmlFor="nombre">Nombre</label>
            <input
              id="nombre"
              type="text"
              maxLength={80}
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              disabled={enviando}
            />
          </div>

          <div className="reserva__fila">
            <label htmlFor="apellido">Apellido</label>
            <input
              id="apellido"
              type="text"
              maxLength={80}
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
              disabled={enviando}
            />
          </div>

          <div className="reserva__fila">
            <label htmlFor="email">Correo</label>
            <input
              id="email"
              type="email"
              maxLength={160}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={enviando}
            />
          </div>

          <div className="reserva__fila">
            <label htmlFor="telefono">Teléfono</label>
            <input
              id="telefono"
              type="tel"
              maxLength={30}
              required
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              disabled={enviando}
            />
          </div>

          <div className="reserva__fila reserva__fila--ancha">
            <label htmlFor="notas">Algo que debamos saber</label>
            <textarea
              id="notas"
              rows={2}
              maxLength={500}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              disabled={enviando}
            />
          </div>

          {error && (
            <p className="boletin__error reserva__fila--ancha" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="boton reserva__fila--ancha" disabled={enviando}>
            {enviando ? "Enviando…" : "Pedir reservado"}
          </button>
        </form>
      )}
    </>
  );
}
