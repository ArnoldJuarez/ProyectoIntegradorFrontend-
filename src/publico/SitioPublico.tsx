import { Link, NavLink, Outlet } from "react-router-dom";
import { CLUB, pendiente } from "../config";
// App.css trae los avisos y las fichas, que comparten las dos zonas.
import "../App.css";
import "./publico.css";
import { ChatConserje } from "./ChatConserje";

/**
 * El armazón de la web pública: lo que ve un cliente.
 *
 * No comprueba sesión ni la necesita. Es deliberado: la cartelera es lo primero
 * que abre alguien desde Instagram, y pedirle una cuenta para ver qué hay el
 * viernes sería la forma más rápida de perderlo.
 *
 * El botón de la barra es el de los flyers: «reservas de box y listas», por
 * WhatsApp, que es como de verdad reserva la gente.
 */
export function SitioPublico() {
  const hayWhatsapp = CLUB.whatsapp.length > 0 && !pendiente(CLUB.whatsapp);
  const instagram = CLUB.instagram && !pendiente(CLUB.instagram) ? CLUB.instagram : null;

  return (
    <div className="sitio">
      <header className="barra">
        <div className="barra__dentro">
          <Link to="/" className="barra__marca">
            SSIOMAMA
          </Link>

          <nav className="barra__nav" aria-label="Secciones">
            <NavLink to="/agenda">Agenda</NavLink>
            <Link to="/#reservados" className="barra__secundario">
              Boxes
            </Link>
            <Link to="/#llegar" className="barra__secundario">
              Cómo llegar
            </Link>
            {hayWhatsapp && (
              <a
                href={`https://wa.me/${CLUB.whatsapp}?text=${encodeURIComponent("Hola, quiero reservar un box")}`}
                target="_blank"
                rel="noreferrer noopener"
                className="boton barra__cta"
              >
                Reservar
              </a>
            )}
          </nav>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="pie">
        <div className="pie__dentro">
          <div>
            <p className="pie__marca">SSIOMAMA</p>
            <p>Las mejores fiestas se viven aquí.</p>
            <p className="pie__legal">
              Solo mayores de {CLUB.minAge}, con DNI. Se reserva el derecho de admisión.
            </p>
          </div>

          <div>
            <p className="pie__rotulo">Dónde</p>
            <p>{CLUB.address}</p>
            <p>{CLUB.hours}</p>
            {CLUB.mapsUrl && (
              <p>
                <a href={CLUB.mapsUrl} target="_blank" rel="noreferrer noopener">
                  Abrir en Google Maps →
                </a>
              </p>
            )}
          </div>

          <div>
            <p className="pie__rotulo">Reservas de box y listas</p>
            {hayWhatsapp ? (
              <p>
                <a href={`https://wa.me/${CLUB.whatsapp}`} target="_blank" rel="noreferrer noopener">
                  {CLUB.phone} · WhatsApp
                </a>
              </p>
            ) : (
              <p>{CLUB.phone}</p>
            )}
            {instagram && (
              <p>
                <a href={`https://instagram.com/${instagram}`} target="_blank" rel="noreferrer noopener">
                  @{instagram} en Instagram
                </a>
              </p>
            )}
          </div>

          {/* La puerta del personal, discreta pero encontrable. */}
          <p className="pie__personal">
            <span>
              © {new Date().getFullYear()} {CLUB.name} · Arequipa
            </span>
            <Link to="/panel">Acceso del personal</Link>
          </p>
        </div>
      </footer>

      <ChatConserje />
    </div>
  );
}
