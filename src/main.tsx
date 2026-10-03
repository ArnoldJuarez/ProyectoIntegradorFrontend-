import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import App from "./App.tsx";
import { Barra } from "./barra/Barra.tsx";
import { ArqueoDetalle } from "./paginas/ArqueoDetalle.tsx";
import { Caja } from "./paginas/Caja.tsx";
import { ClienteDetalle } from "./paginas/ClienteDetalle.tsx";
import { Clientes } from "./paginas/Clientes.tsx";
import { EventoDetalle } from "./paginas/EventoDetalle.tsx";
import { EventoForm } from "./paginas/EventoForm.tsx";
import { Eventos } from "./paginas/Eventos.tsx";
import { Inventario } from "./paginas/Inventario.tsx";
import { PedidoDetalle } from "./paginas/PedidoDetalle.tsx";
import { Pedidos } from "./paginas/Pedidos.tsx";
import { Segmentos } from "./paginas/Segmentos.tsx";
import { Resumen } from "./panel/Resumen.tsx";
import { Torre } from "./panel/Torre.tsx";
import { Agenda } from "./publico/Agenda.tsx";
import { FichaDeNoche } from "./publico/FichaDeNoche.tsx";
import { MisEntradas } from "./publico/MisEntradas.tsx";
import { Portada } from "./publico/Portada.tsx";
import { SitioPublico } from "./publico/SitioPublico.tsx";
import { Puerta } from "./puerta/Puerta.tsx";
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
            {/*
              «Tus entradas». Va en la zona pública y sin sesión: quien compró
              no tiene cuenta, y lo único que tiene es este enlace con su
              código. La ruta es la misma que en el sistema anterior para que
              los enlaces ya compartidos sigan funcionando.
            */}
            <Route path="entradas/:codigo" element={<MisEntradas />} />
          </Route>

          <Route path="panel" element={<App />}>
            {/*
              El resumen es la portada del panel. Antes esto redirigía a
              eventos porque el resumen no estaba migrado todavía.
            */}
            <Route index element={<Resumen />} />
            <Route path="noche" element={<Torre />} />
            <Route path="eventos" element={<Eventos />} />
            {/*
              "nueva" va ANTES que ":slug". React Router elige la ruta más
              específica, pero dejarlo al azar del orden es de las cosas que se
              rompen al reordenar el archivo: una noche con el slug "nueva"
              sería inalcanzable.
            */}
            <Route path="eventos/nueva" element={<EventoForm />} />
            <Route path="eventos/:slug/editar" element={<EventoForm />} />
            <Route path="eventos/:slug" element={<EventoDetalle />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="clientes/:id" element={<ClienteDetalle />} />
            <Route path="crm" element={<Segmentos />} />
            <Route path="pedidos" element={<Pedidos />} />
            <Route path="pedidos/:codigo" element={<PedidoDetalle />} />
            <Route path="caja" element={<Caja />} />
            <Route path="caja/:id" element={<ArqueoDetalle />} />
            <Route path="inventario" element={<Inventario />} />
          </Route>

          {/*
            La puerta va suelta y no bajo /panel a propósito: un portero no
            tiene permiso sobre ninguna ruta del panel, así que colgarla de ahí
            le enseñaría una navegación entera que le responde 403.
          */}
          <Route path="puerta" element={<Puerta />} />

          {/*
            La barra, por lo mismo que la puerta: un rol que no ve el panel y
            una pantalla que se usa de pie con una tablet.
          */}
          <Route path="barra" element={<Barra />} />

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
