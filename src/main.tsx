import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import App from "./App.tsx";
import { ClienteDetalle } from "./paginas/ClienteDetalle.tsx";
import { Clientes } from "./paginas/Clientes.tsx";
import { EventoDetalle } from "./paginas/EventoDetalle.tsx";
import { Eventos } from "./paginas/Eventos.tsx";
import { Inventario } from "./paginas/Inventario.tsx";
import { Agenda } from "./publico/Agenda.tsx";
import { FichaDeNoche } from "./publico/FichaDeNoche.tsx";
import { Portada } from "./publico/Portada.tsx";
import { SitioPublico } from "./publico/SitioPublico.tsx";
import { ProveedorDeSesion } from "./sesion.tsx";

/**
 * Dos zonas con reglas distintas.
 *
 * - **Pública** (`/`, `/agenda`, `/evento/:slug`) — cualquiera, sin cuenta. Es
 *   lo que se abre desde Instagram un viernes por la tarde.
 * - **Panel** (`/panel/...`) — el personal. Si no hay sesión, sale el login.
 *
 * Las rutas siguen las del sistema anterior a propósito: los enlaces que la
 * gente ya tenga guardados o compartidos siguen funcionando.
 */
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ProveedorDeSesion>
      <BrowserRouter>
        <Routes>
          <Route element={<SitioPublico />}>
            <Route index element={<Portada />} />
            <Route path="agenda" element={<Agenda />} />
            <Route path="evento/:slug" element={<FichaDeNoche />} />
          </Route>

          <Route path="panel" element={<App />}>
            <Route index element={<Navigate to="/panel/eventos" replace />} />
            <Route path="eventos" element={<Eventos />} />
            <Route path="eventos/:slug" element={<EventoDetalle />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="clientes/:id" element={<ClienteDetalle />} />
            <Route path="inventario" element={<Inventario />} />
          </Route>

          {/*
            Cualquier otra dirección va a la portada. `replace` para no dejarla
            en el historial: al pulsar atrás se volvería a ella y rebotaría
            otra vez.
          */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ProveedorDeSesion>
  </StrictMode>,
);
