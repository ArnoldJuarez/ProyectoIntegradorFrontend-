import { useState, type FormEvent } from "react";
import { ErrorDeApi, apuntarseAlBoletin } from "../api";

/**
 * Aviso cuando salga el próximo cartel.
 *
 * Dos campos y no más. Cada campo de más es gente que empieza a rellenarlo y lo
 * deja: quien está mirando una discoteca en el móvil un jueves no va a escribir
 * su apellido y su distrito para que le avisen de una fecha.
 */
export function Boletin() {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setError(null);

    try {
      const { mensaje } = await apuntarseAlBoletin(nombre.trim(), email.trim());
      setHecho(mensaje);
    } catch (e) {
      setError(
        e instanceof ErrorDeApi ? e.message : "No hemos podido apuntarte. Inténtalo otra vez.",
      );
      setEnviando(false);
    }
  }

  // Una vez apuntado, el formulario desaparece: dejarlo ahí invita a volver a
  // enviarlo y a dudar de si funcionó.
  if (hecho) {
    return (
      <section className="seccion boletin">
        <p className="boletin__hecho" role="status">
          {hecho}
        </p>
      </section>
    );
  }

  return (
    <section className="seccion boletin">
      <h2 className="seccion__titulo">Que no se te pase la próxima</h2>
      <p className="boletin__texto">
        Te escribimos cuando salga cartel nuevo. Nada más: ni promociones diarias ni mensajes de
        madrugada.
      </p>

      <form className="boletin__form" onSubmit={enviar}>
        <label className="visualmente-oculto" htmlFor="boletin-nombre">
          Nombre
        </label>
        <input
          id="boletin-nombre"
          type="text"
          placeholder="Tu nombre"
          autoComplete="given-name"
          maxLength={80}
          required
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          disabled={enviando}
        />

        <label className="visualmente-oculto" htmlFor="boletin-email">
          Correo
        </label>
        <input
          id="boletin-email"
          type="email"
          placeholder="tu@correo.com"
          autoComplete="email"
          maxLength={160}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={enviando}
        />

        <button type="submit" className="boton" disabled={enviando}>
          {enviando ? "Apuntando…" : "Avísame"}
        </button>
      </form>

      {error && (
        <p className="boletin__error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
