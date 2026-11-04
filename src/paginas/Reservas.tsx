import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AvisoDeError } from "../Aviso";
import {
  ErrorDeApi,
  NOMBRE_DE_ESTADO_DE_RESERVA,
  PASOS_DE_RESERVA,
  apuntarReserva,
  cambiarReserva,
  horaDeSala,
  soles,
  verOpcionesDeReserva,
  verReservas,
  verReservados,
  type EstadoDeReserva,
  type NuevaReserva,
  type ReservaEnLista,
} from "../api";
import { useCarga } from "../datos";

/**
 * Las reservas de box: confirmar tras la llamada, apuntar las que llegan por
 * teléfono o WhatsApp, y la noche misma marcar quién se sentó.
 *
 * La web solo deja una solicitud: no aparta la mesa ni cobra. Aquí es donde se
 * convierte en una reserva de verdad, con su depósito acordado.
 */

const CLASE: Record<EstadoDeReserva, string> = {
  SOLICITADA: "estado estado--agotado",
  CONFIRMADA: "estado estado--publicado",
  SENTADA: "estado estado--cerrado",
  NO_VINO: "estado estado--cancelado",
  CANCELADO: "estado estado--cancelado",
};

/** Cómo se lee cada paso en un botón: el verbo, no el estado. */
const VERBO: Record<EstadoDeReserva, string> = {
  SOLICITADA: "Reabrir",
  CONFIRMADA: "Confirmar",
  SENTADA: "Se sentaron",
  NO_VINO: "No vinieron",
  CANCELADO: "Cancelar",
};

export function Reservas() {
  const [pasadas, setPasadas] = useState(false);
  const [version, setVersion] = useState(0);
  const carga = useCarga(() => verReservas(pasadas), [pasadas, version]);
  const [apuntando, setApuntando] = useState(false);
  const recargar = () => setVersion((v) => v + 1);

  if (carga.fase === "cargando") return <p className="aviso">Cargando las reservas…</p>;
  if (carga.fase === "error") {
    return <AvisoDeError que="las reservas" mensaje={carga.mensaje} estadoHttp={carga.estadoHttp} />;
  }

  const reservas = carga.datos;
  const porConfirmar = reservas.filter((r) => r.estado === "SOLICITADA").length;
  const confirmadas = reservas.filter((r) => r.estado === "CONFIRMADA");

  // Agrupadas por noche: es como se trabajan, una noche detrás de otra.
  const porNoche = new Map<string, ReservaEnLista[]>();
  for (const r of reservas) porNoche.set(r.nocheSlug, [...(porNoche.get(r.nocheSlug) ?? []), r]);

  return (
    <section>
      <header className="cabecera">
        <h2>Reservas de box</h2>
        <div className="cabecera__acciones">
          <div className="pestanas" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={!pasadas}
              className={!pasadas ? "pestana pestana--activa" : "pestana"}
              onClick={() => setPasadas(false)}
            >
              Próximas
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={pasadas}
              className={pasadas ? "pestana pestana--activa" : "pestana"}
              onClick={() => setPasadas(true)}
            >
              Últimos 60 días
            </button>
          </div>
          {!apuntando && !pasadas && (
            <button type="button" className="boton" onClick={() => setApuntando(true)}>
              Apuntar reserva
            </button>
          )}
        </div>
      </header>

      {!pasadas && (
        <div className="tarjetas">
          <div className={porConfirmar > 0 ? "tarjeta tarjeta--alerta" : "tarjeta"}>
            <p className="tarjeta__cifra">{porConfirmar}</p>
            <p className="tarjeta__pie">Por confirmar (hay que llamar)</p>
          </div>
          <div className="tarjeta">
            <p className="tarjeta__cifra">{confirmadas.length}</p>
            <p className="tarjeta__pie">Confirmadas</p>
          </div>
          <div className="tarjeta">
            <p className="tarjeta__cifra tarjeta__cifra--dinero">
              {soles(confirmadas.reduce((t, r) => t + r.depositoCentimos, 0))}
            </p>
            <p className="tarjeta__pie">Depósitos acordados</p>
          </div>
        </div>
      )}

      {apuntando && (
        <ApuntarReserva
          alGuardar={() => {
            setApuntando(false);
            recargar();
          }}
          alCancelar={() => setApuntando(false)}
        />
      )}

      {reservas.length === 0 ? (
        <p className="aviso">{pasadas ? "No hubo reservas en los últimos 60 días." : "No hay reservas para las próximas noches."}</p>
      ) : (
        [...porNoche.entries()].map(([slug, filas]) => (
          <div key={slug} className="apartado">
            <h3 className="subtitulo">
              <Link to={`/panel/eventos/${slug}`} className="enlace">
                {filas[0].noche}
              </Link>
              <span className="sutil"> · {horaDeSala(filas[0].empiezaA, { dateStyle: "full" })}</span>
            </h3>
            <div className="tabla-scroll">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Box</th>
                    <th>Cliente</th>
                    <th className="num">Personas</th>
                    <th className="num">Depósito</th>
                    <th>Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filas.map((r) => (
                    <FilaDeReserva key={r.id} reserva={r} alCambiar={recargar} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </section>
  );
}

function FilaDeReserva({ reserva: r, alCambiar }: { reserva: ReservaEnLista; alCambiar: () => void }) {
  const [abierta, setAbierta] = useState(false);
  const [deposito, setDeposito] = useState(String(r.depositoCentimos / 100));
  const [notas, setNotas] = useState(r.notas ?? "");
  const [ocupado, setOcupado] = useState(false);

  async function pasarA(estado: EstadoDeReserva) {
    setOcupado(true);
    try {
      await cambiarReserva(r.id, {
        estado,
        depositoCentimos: Math.round(Number(deposito || 0) * 100),
        notas: notas.trim(),
      });
      toast.success(`${r.mesa}: ${NOMBRE_DE_ESTADO_DE_RESERVA[estado].toLowerCase()}`);
      setAbierta(false);
      alCambiar();
    } catch (err) {
      toast.error(err instanceof ErrorDeApi ? err.message : "No se pudo cambiar la reserva.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <tr>
        <td>
          <strong>{r.mesa}</strong>
          <br />
          <span className="sutil">
            {r.zona ?? "Sin zona"} · hasta {r.plazas} · mínimo {soles(r.consumoMinimoCentimos)}
          </span>
        </td>
        <td>
          <Link to={`/panel/clientes/${r.clienteId}`} className="enlace">
            {r.cliente}
          </Link>
          <br />
          <span className="sutil">
            {r.telefono ? <a href={`tel:${r.telefono}`}>{r.telefono}</a> : "sin teléfono"} · {r.email}
          </span>
        </td>
        <td className="num">{r.personas}</td>
        <td className="num precio">{r.depositoCentimos > 0 ? soles(r.depositoCentimos) : <span className="sutil">—</span>}</td>
        <td>
          <span className={CLASE[r.estado]}>{NOMBRE_DE_ESTADO_DE_RESERVA[r.estado]}</span>
        </td>
        <td className="acciones">
          <button type="button" className="boton-secundario" onClick={() => setAbierta((v) => !v)}>
            {abierta ? "Cerrar" : "Gestionar"}
          </button>
        </td>
      </tr>
      {abierta && (
        <tr>
          <td colSpan={6}>
            <div className="tipo-form">
              <div className="tipo-form__campos">
                <label>
                  Depósito acordado (S/)
                  <input type="number" min={0} step="1" value={deposito} onChange={(e) => setDeposito(e.target.value)} />
                </label>
                <label className="tipo-form__ancho">
                  Notas
                  <input value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={500} placeholder="Paga por Yape el jueves, cumpleaños de…" />
                </label>
              </div>
              <div className="tipo-form__acciones">
                <button type="button" disabled={ocupado} onClick={() => void pasarA(r.estado)}>
                  Guardar depósito y notas
                </button>
                {PASOS_DE_RESERVA[r.estado].map((destino) => (
                  <button
                    key={destino}
                    type="button"
                    className={destino === "CANCELADO" || destino === "NO_VINO" ? "boton--peligro" : undefined}
                    disabled={ocupado}
                    onClick={() => void pasarA(destino)}
                  >
                    {VERBO[destino]}
                  </button>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/** Una reserva que llega por teléfono, WhatsApp o Instagram. */
function ApuntarReserva({ alGuardar, alCancelar }: { alGuardar: () => void; alCancelar: () => void }) {
  const opciones = useCarga(verOpcionesDeReserva, []);
  const [datos, setDatos] = useState<NuevaReserva>({
    slug: "",
    mesaId: "",
    personas: 4,
    notas: "",
    nombre: "",
    apellido: "",
    email: "",
    telefono: "",
    canal: "TELEFONO",
  });
  const slug = datos.slug || (opciones.fase === "listo" ? opciones.datos.noches[0]?.slug ?? "" : "");
  // Qué boxes siguen libres esa noche: la misma consulta que usa la web.
  const libres = useCarga(() => (slug ? verReservados(slug) : Promise.resolve([])), [slug]);
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  if (opciones.fase === "cargando") return <p className="aviso">Cargando noches y boxes…</p>;
  if (opciones.fase === "error") return <p className="aviso aviso--error">{opciones.mensaje}</p>;
  if (opciones.datos.noches.length === 0) {
    return <p className="aviso">No hay noches publicadas próximas en las que apuntar una reserva.</p>;
  }

  const mesasLibres = libres.fase === "listo" ? libres.datos.filter((m) => m.libre) : [];
  const mesaId = datos.mesaId && mesasLibres.some((m) => m.id === datos.mesaId) ? datos.mesaId : mesasLibres[0]?.id ?? "";
  const cambiar = (cambio: Partial<NuevaReserva>) => setDatos((d) => ({ ...d, ...cambio }));

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setFallo(null);
    try {
      const r = await apuntarReserva({ ...datos, slug, mesaId });
      toast.success(`${r.mesa} apuntado para ${r.cliente}`);
      alGuardar();
    } catch (err) {
      setFallo(err instanceof ErrorDeApi ? err.message : "No se pudo apuntar la reserva.");
      setGuardando(false);
    }
  }

  return (
    <form className="tipo-form" onSubmit={(e) => void enviar(e)}>
      {fallo && <p className="aviso aviso--error">{fallo}</p>}
      <div className="tipo-form__campos">
        <label>
          Noche
          <select value={slug} onChange={(e) => cambiar({ slug: e.target.value, mesaId: "" })}>
            {opciones.datos.noches.map((n) => (
              <option key={n.slug} value={n.slug}>
                {horaDeSala(n.empiezaA, { dateStyle: "medium" })} · {n.titulo}
              </option>
            ))}
          </select>
        </label>
        <label>
          Box
          <select value={mesaId} onChange={(e) => cambiar({ mesaId: e.target.value })} required>
            {mesasLibres.length === 0 && <option value="">No queda ningún box libre</option>}
            {mesasLibres.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre} · {m.zona ?? "sin zona"} · hasta {m.plazas}
              </option>
            ))}
          </select>
        </label>
        <label>
          Personas
          <input type="number" min={1} max={30} value={datos.personas} onChange={(e) => cambiar({ personas: Number(e.target.value) })} required />
        </label>
        <label>
          Llegó por
          <select value={datos.canal} onChange={(e) => cambiar({ canal: e.target.value as NuevaReserva["canal"] })}>
            <option value="TELEFONO">Teléfono</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="INSTAGRAM">Instagram</option>
          </select>
        </label>
        <label>
          Nombre
          <input value={datos.nombre} onChange={(e) => cambiar({ nombre: e.target.value })} required maxLength={80} />
        </label>
        <label>
          Apellido
          <input value={datos.apellido} onChange={(e) => cambiar({ apellido: e.target.value })} maxLength={80} />
        </label>
        <label>
          Teléfono
          <input value={datos.telefono} onChange={(e) => cambiar({ telefono: e.target.value })} required minLength={6} maxLength={30} />
        </label>
        <label>
          Correo
          <input type="email" value={datos.email} onChange={(e) => cambiar({ email: e.target.value })} required maxLength={160} />
        </label>
        <label className="tipo-form__ancho">
          Notas
          <input value={datos.notas} onChange={(e) => cambiar({ notas: e.target.value })} maxLength={500} placeholder="Cumpleaños, depósito por Yape…" />
        </label>
      </div>
      <p className="campo__pista">
        Queda como «solicitada». Confírmala desde la lista cuando esté el depósito acordado.
      </p>
      <div className="tipo-form__acciones">
        <button type="button" onClick={alCancelar}>
          Cancelar
        </button>
        <button type="submit" disabled={guardando || !mesaId}>
          {guardando ? "Apuntando…" : "Apuntar"}
        </button>
      </div>
    </form>
  );
}
