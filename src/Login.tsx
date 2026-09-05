import { useState, type FormEvent } from "react";
import { ErrorDeApi, entrar, type Sesion } from "./api";

/**
 * Acceso del personal.
 *
 * No guarda el token en ningún sitio: la sesión viaja en una cookie `httpOnly`
 * que este código ni siquiera puede leer. Es lo que impide que un XSS se lleve
 * la sesión de un administrador, y la razón de que aquí no haya nada parecido a
 * `localStorage.setItem("token", ...)`.
 */
export function Login({ alEntrar }: { alEntrar: (sesion: Sesion) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setError(null);

    try {
      alEntrar(await entrar(email, password));
    } catch (e) {
      setError(
        e instanceof ErrorDeApi ? e.message : "No se pudo iniciar sesión.",
      );
      setEnviando(false);
    }
  }

  return (
    <div className="login">
      <h2>Acceso del personal</h2>
      <p className="login__nota">
        Panel de gestión. Si eres cliente y buscas tus entradas, están en el enlace que te llegó al
        comprar.
      </p>

      <form onSubmit={enviar}>
        <label htmlFor="email">Correo</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={enviando}
        />

        <label htmlFor="password">Contraseña</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={enviando}
        />

        {/* role="alert" para que un lector de pantalla lo anuncie al aparecer. */}
        {error && (
          <p className="login__error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" disabled={enviando}>
          {enviando ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <div className="login__pruebas">
        <p className="login__pruebas-titulo">Cuentas de prueba</p>
        <ul>
          <li>
            <code>admin@ssiomama.test</code> · discoteca
          </li>
          <li>
            <code>sala@ssiomama.test</code> · discoteca
          </li>
          <li>
            <code>puerta@ssiomama.test</code> · discoteca <span>(no ve el inventario)</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
