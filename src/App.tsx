import { Link, NavLink, Outlet } from "react-router-dom";
import { Login } from "./Login";
import { useSesion } from "./sesion";
import "./App.css";

/**
 * El armazón: marca, navegación y quién está dentro.
 *
 * Toda la aplicación cuelga de aquí, y aquí se decide lo único que no depende de
 * la ruta: si hay sesión se pinta la pantalla que toque, y si no, el login. Así
 * ninguna página tiene que preocuparse de comprobarlo por su cuenta.
 */
export default function App() {
  const { estado, entrar, salir } = useSesion();
  const dentro = estado.fase === "dentro";

  return (
    <div className="app">
      <header className="marca">
        <div className="marca__fila">
          <div>
            <h1>SSIOMAMA</h1>
            <p className="marca__pie">
              React + Spring Boot · datos reales de <code>discoteca</code>
            </p>
          </div>

          {dentro && (
            <div className="usuario">
              <span className="usuario__nombre">{estado.usuario.nombre}</span>
              <span className="usuario__rol">{estado.usuario.rol}</span>
              <button type="button" className="salir" onClick={salir}>
                Salir
              </button>
            </div>
          )}
        </div>

        {dentro && (
          <nav className="nav">
            {/* `end` para que "Eventos" no se quede activo estando en un evento. */}
            <NavLink to="/panel/eventos" end>
              Eventos
            </NavLink>
            <NavLink to="/panel/clientes">Clientes</NavLink>
            <NavLink to="/panel/caja">Caja</NavLink>
            <NavLink to="/panel/inventario">Inventario</NavLink>
            <Link to="/" className="nav__salida">
              Ver la web ↗
            </Link>
          </nav>
        )}
      </header>

      <main>
        {estado.fase === "comprobando" && <p className="aviso">Comprobando la sesión…</p>}

        {estado.fase === "error" && (
          <div className="aviso aviso--error">
            <p className="aviso__titulo">No se pudo hablar con el backend</p>
            <p>{estado.mensaje}</p>
            <p className="aviso__pista">
              Arráncalo con <code>cd backend</code> y <code>./mvnw spring-boot:run</code>
            </p>
          </div>
        )}

        {estado.fase === "fuera" && <Login alEntrar={entrar} />}

        {dentro && <Outlet />}
      </main>
    </div>
  );
}
