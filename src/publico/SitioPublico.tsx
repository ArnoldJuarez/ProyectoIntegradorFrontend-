import { Link, NavLink, Outlet } from "react-router-dom";
import { CLUB, pendiente } from "../config";
// App.css trae las variables de color y los avisos, que comparten las dos zonas.
import "../App.css";
import "./publico.css";
import { ChatConserje } from "./ChatConserje";

/**
 * El armazón de la web pública: lo que ve un cliente.
 *
 * No comprueba sesión ni la necesita. Es deliberado: la cartelera es lo primero
 * que abre alguien desde Instagram, y pedirle una cuenta para ver qué hay el
 * viernes sería la forma más rápida de perderlo.
 */
export function SitioPublico() {
  const hayWhatsapp = CLUB.whatsapp.length > 0 && !pendiente(CLUB.whatsapp);

  return (
    <div className="sitio">
      <header className="barra">
        <Link to="/" className="barra__marca">
          {CLUB.name}
        </Link>

        <nav className="barra__nav">
          <NavLink to="/" end>
            Inicio
          </NavLink>
          <NavLink to="/agenda">Agenda</NavLink>
          {hayWhatsapp && (
            <a
              href={`https://wa.me/${CLUB.whatsapp}`}
              target="_blank"
              rel="noreferrer noopener"
            >
              Reservas
            </a>
          )}
        </nav>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="pie">
        <div>
          <p className="pie__marca">{CLUB.name}</p>
          <p>{CLUB.address}</p>
          <p>{CLUB.hours}</p>
        </div>

        <div>
          {/*
            Instagram sin enlazar si no hay usuario: enseñar la palabra es
            mejor que un enlace a un perfil inventado.
          */}
          {CLUB.instagram ? (
            <p>
              <a
                href={`https://instagram.com/${CLUB.instagram}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                @{CLUB.instagram}
              </a>
            </p>
          ) : (
            <p>Instagram</p>
          )}
          <p>{CLUB.phone}</p>
          <p className="pie__legal">
            Solo mayores de {CLUB.minAge}. Se reserva el derecho de admisión.
          </p>
        </div>

        {/* La puerta del personal, discreta pero encontrable. */}
        <p className="pie__personal">
          <Link to="/panel">Acceso del personal</Link>
        </p>
      </footer>

      <ChatConserje />
    </div>
  );
}
