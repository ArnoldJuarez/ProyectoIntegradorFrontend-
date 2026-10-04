import {
  ArrowUpRight,
  BarChart3,
  Boxes,
  CalendarDays,
  Contact,
  Gauge,
  LayoutDashboard,
  LogOut,
  Map as Plano,
  Megaphone,
  ScanLine,
  Sparkles,
  Ticket,
  Users,
  Wallet,
  Wine,
  Globe,
  type LucideIcon,
} from "lucide-react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Login } from "./Login";
import { useSesion } from "./sesion";
import "./App.css";

type Seccion = { a: string; texto: string; icono: LucideIcon; exacta?: boolean };

/**
 * Las secciones del panel, agrupadas por lo que se está haciendo.
 *
 * En constantes y no escritas a mano en el JSX: son catorce enlaces con las
 * mismas clases, y repetir el `<NavLink>` catorce veces es catorce sitios donde
 * cambiar una clase.
 *
 * `exacta` es para las rutas que son prefijo de otras. Sin ella, «Resumen»
 * (`/panel`) se quedaría encendido en todas las secciones.
 */
const GRUPOS: { titulo: string; secciones: Seccion[] }[] = [
  {
    titulo: "Hoy",
    secciones: [
      { a: "/panel", texto: "Resumen", icono: LayoutDashboard, exacta: true },
      { a: "/panel/noche", texto: "Torre de control", icono: Gauge },
    ],
  },
  {
    titulo: "Ventas",
    secciones: [
      { a: "/panel/eventos", texto: "Eventos", icono: CalendarDays },
      { a: "/panel/pedidos", texto: "Pedidos", icono: Ticket },
      { a: "/panel/promotores", texto: "Promotores", icono: Megaphone },
    ],
  },
  {
    titulo: "Clientes",
    secciones: [
      { a: "/panel/clientes", texto: "Clientes", icono: Contact },
      { a: "/panel/crm", texto: "Segmentos y campañas", icono: Users },
    ],
  },
  {
    titulo: "Operación",
    secciones: [
      { a: "/panel/caja", texto: "Caja", icono: Wallet },
      { a: "/panel/inventario", texto: "Inventario", icono: Boxes },
      { a: "/panel/local", texto: "El local", icono: Plano },
    ],
  },
  {
    titulo: "Inteligencia",
    secciones: [
      { a: "/panel/propuestas", texto: "Propuestas IA", icono: Sparkles },
      { a: "/panel/ia", texto: "Métricas IA", icono: BarChart3 },
    ],
  },
];

/*
 * La barra y la puerta no son secciones del panel: son las dos pantallas de
 * turno, a pantalla completa y pensadas para usarse de pie. Se enlazan desde
 * aquí porque quien abre el panel a las once de la noche va a necesitarlas.
 */
const PANTALLAS_DE_TURNO: Seccion[] = [
  { a: "/barra", texto: "Barra", icono: Wine },
  { a: "/puerta", texto: "Puerta", icono: ScanLine },
  { a: "/", texto: "Ver la web", icono: Globe },
];

const ROL: Record<string, string> = {
  DIRECCION: "Dirección",
  GERENCIA: "Gerencia",
  PROMOTOR: "Promotor",
  PUERTA: "Puerta",
  BARRA: "Barra",
  PERSONAL: "Personal",
};

function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/**
 * El armazón: marca, navegación y quién está dentro.
 *
 * Toda la aplicación cuelga de aquí, y aquí se decide lo único que no depende de
 * la ruta: si hay sesión se pinta la pantalla que toque, y si no, el login.
 *
 * El menú va en una columna a la izquierda, agrupado por lo que se hace. En
 * móvil se convierte en una tira horizontal de una sola línea que se desliza.
 */
export default function App() {
  const { estado, entrar, salir } = useSesion();
  const { pathname } = useLocation();

  if (estado.fase !== "dentro") {
    return (
      <div className="portal">
        <aside className="portal__arte" aria-hidden="true">
          <p className="portal__marca">SSIOMAMA</p>
          <p className="portal__lema">
            Las mejores fiestas <span>se viven aquí.</span>
          </p>
          <p className="portal__pie">Av. Dolores 119 · J. L. Bustamante y Rivero · Arequipa</p>
        </aside>

        <main className="portal__lado">
          <p className="portal__marca-movil">SSIOMAMA</p>

          {estado.fase === "comprobando" && <p className="aviso">Comprobando la sesión…</p>}

          {estado.fase === "error" && (
            <div className="aviso aviso--error">
              <p className="aviso__titulo">No se pudo hablar con el backend</p>
              <p>{estado.mensaje}</p>
              <p className="aviso__pista">
                Arráncalo con <code>./mvnw spring-boot:run</code> en la carpeta del backend.
              </p>
            </div>
          )}

          {estado.fase === "fuera" && <Login alEntrar={entrar} />}
        </main>
      </div>
    );
  }

  return (
    <div className="armazon">
      <aside className="lateral">
        <div className="lateral__cuerpo">
          <Link to="/panel" className="lateral__marca">
            <span className="lateral__punto" aria-hidden="true" />
            SSIOMAMA
          </Link>

          <nav className="menu" aria-label="Secciones del panel">
            {GRUPOS.map((g) => (
              <div key={g.titulo} className="menu__grupo">
                <p className="menu__titulo">{g.titulo}</p>
                {g.secciones.map((s) => (
                  <NavLink key={s.a} to={s.a} end={s.exacta}>
                    <s.icono aria-hidden="true" />
                    {s.texto}
                  </NavLink>
                ))}
              </div>
            ))}

            <span className="menu__corte" aria-hidden="true" />
            <div className="menu__grupo">
              <p className="menu__titulo">Turno</p>
              {PANTALLAS_DE_TURNO.map((p) => (
                <Link key={p.a} to={p.a} className="menu__fuera">
                  <p.icono aria-hidden="true" />
                  {p.texto}
                  <ArrowUpRight className="menu__flecha" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </nav>

          {/* Quién está dentro, al fondo de la columna. En móvil no se enseña:
              el nombre no es lo que se consulta con el teléfono en la mano. */}
          <div className="lateral__pie">
            <div className="lateral__usuario">
              <span className="lateral__avatar" aria-hidden="true">
                {iniciales(estado.usuario.nombre)}
              </span>
              <div style={{ minWidth: 0 }}>
                <p className="lateral__nombre">{estado.usuario.nombre}</p>
                <p className="lateral__rol">{ROL[estado.usuario.rol] ?? estado.usuario.rol}</p>
              </div>
            </div>
            <button type="button" className="salir" onClick={salir}>
              <LogOut size={14} aria-hidden="true" />
              Cerrar sesión
            </button>
          </div>
        </div>
      </aside>

      <main className="contenido">
        {/* La clave por ruta reinicia la entrada suave al cambiar de sección. */}
        <div key={pathname} className="contenido__ancho aparecer">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

