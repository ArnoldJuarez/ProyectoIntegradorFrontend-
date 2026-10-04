import { Link, NavLink, Outlet } from "react-router-dom";
import { Login } from "./Login";
import { useSesion } from "./sesion";
import "./App.css";

/**
 * Las secciones del panel, en el orden en que se miran.
 *
 * En una constante y no escritas a mano en el JSX: son once enlaces con las
 * mismas clases, y repetir el `<NavLink>` en cada una es un sitio más donde
 * cambiar una clase.
 *
 * `exacta` es para las rutas que son prefijo de otras. Sin ella, «Resumen»
 * (`/panel`) se quedaría encendido en todas las secciones y «Eventos» seguiría
 * encendido dentro de la ficha de una noche.
 */
const SECCIONES = [
  { a: "/panel", texto: "Resumen", exacta: true },
  { a: "/panel/noche", texto: "Torre de control" },
  { a: "/panel/eventos", texto: "Eventos", exacta: true },
  { a: "/panel/pedidos", texto: "Pedidos" },
  { a: "/panel/clientes", texto: "Clientes" },
  { a: "/panel/promotores", texto: "Promotores" },
  { a: "/panel/crm", texto: "CRM" },
  { a: "/panel/caja", texto: "Caja" },
  { a: "/panel/inventario", texto: "Inventario" },
  { a: "/panel/local", texto: "El local" },
  { a: "/panel/propuestas", texto: "Propuestas IA" },
  { a: "/panel/ia", texto: "Métricas IA" },
];

/*
 * La barra y la puerta no son secciones del panel: son las dos pantallas de
 * turno, a pantalla completa y pensadas para usarse de pie. Se enlazan desde
 * aquí porque quien abre el panel a las once de la noche va a necesitarlas, y
 * buscarlas escribiendo la dirección a mano no es un plan. Dirección y gerencia
 * entran en las dos, así que ninguno de estos enlaces lleva a un 403.
 */
const PANTALLAS_DE_TURNO = [
  { a: "/barra", texto: "Barra ↗" },
  { a: "/puerta", texto: "Puerta ↗" },
  { a: "/", texto: "Ver la web ↗" },
];

/**
 * El armazón: marca, navegación y quién está dentro.
 *
 * Toda la aplicación cuelga de aquí, y aquí se decide lo único que no depende de
 * la ruta: si hay sesión se pinta la pantalla que toque, y si no, el login. Así
 * ninguna página tiene que preocuparse de comprobarlo por su cuenta.
 *
 * El menú va en una **columna a la izquierda**, como en el sistema anterior.
 * En una fila horizontal, con once entradas, no cabían en una ventana estrecha:
 * o se desbordaban por la derecha —dejando secciones fuera de pantalla que
 * nadie encuentra— o se envolvían en cuatro líneas y había que pasar media
 * pantalla antes de ver la primera cifra. En columna el número de secciones
 * deja de importar.
 *
 * En móvil la columna se convierte en una tira horizontal de una sola línea que
 * se desliza, porque ahí una columna se comería la pantalla entera.
 */
export default function App() {
  const { estado, entrar, salir } = useSesion();

  // Sin sesión no hay panel que enmarcar. Lo único que se enseña es el login, y
  // dejar la barra lateral con el menú de dirección detrás sería enseñar la casa
  // a quien todavía no ha llamado al timbre.
  if (estado.fase !== "dentro") {
    return (
      <div className="portal">
        <h1 className="portal__marca">SSIOMAMA</h1>
        <p className="portal__pie">
          React + Spring Boot · datos reales de <code>teca</code>
        </p>

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
      </div>
    );
  }

  return (
    <div className="armazon">
      <aside className="lateral">
        <div className="lateral__cuerpo">
          <Link to="/" className="lateral__marca">
            <span className="lateral__punto" aria-hidden="true" />
            SSIOMAMA
          </Link>

          <nav className="menu">
            {SECCIONES.map((s) => (
              <NavLink key={s.a} to={s.a} end={s.exacta}>
                {s.texto}
              </NavLink>
            ))}

            {/* Separadas del resto: salen del panel. */}
            <span className="menu__corte" aria-hidden="true" />
            {PANTALLAS_DE_TURNO.map((p) => (
              <Link key={p.a} to={p.a} className="menu__fuera">
                {p.texto}
              </Link>
            ))}
          </nav>

          {/*
            Quién está dentro, al fondo de la columna. `margin-top: auto` lo
            empuja abajo en escritorio; en móvil la tira ya no tiene «abajo», y
            por eso ahí se esconde: el nombre y el rol no son lo que se consulta
            con el teléfono en la mano.
          */}
          <div className="lateral__pie">
            <p className="lateral__nombre">{estado.usuario.nombre}</p>
            <p className="lateral__rol">{estado.usuario.rol}</p>
            <button type="button" className="salir" onClick={salir}>
              Cerrar sesión
            </button>
          </div>
        </div>
      </aside>

      <main className="contenido">
        <Outlet />
      </main>
    </div>
  );
}
