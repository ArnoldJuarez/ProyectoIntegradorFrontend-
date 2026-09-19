import { useState } from "react";
import { AvisoDeError } from "../Aviso";
import {
  ErrorDeApi,
  NOMBRE_DE_CANAL_DE_CAMPANIA,
  cancelarCampania,
  horaDeSala,
  redactarCampania,
  soles,
  verCampanias,
  verSegmento,
  verSegmentos,
  type CampaniaEnLista,
  type CanalDeCampania,
  type SegmentoEnLista,
} from "../api";
import { useCarga } from "../datos";

/**
 * El CRM: a quién se le escribe y qué se le escribe.
 *
 * Dos pestañas porque son dos preguntas distintas. «Segmentos» responde *quién
 * hay*; «Campañas» responde *qué se les ha escrito*. Juntarlas en una sola
 * pantalla haría una lista larga donde no se encuentra ninguna de las dos.
 */
type Vista = "segmentos" | "campanias";

const CANALES: CanalDeCampania[] = ["CORREO", "SMS", "WHATSAPP", "PUSH"];

export function Segmentos() {
  const [vista, setVista] = useState<Vista>("segmentos");

  const pestanas: { id: Vista; nombre: string }[] = [
    { id: "segmentos", nombre: "Segmentos" },
    { id: "campanias", nombre: "Campañas" },
  ];

  return (
    <section>
      <header className="cabecera">
        <h2>CRM</h2>
      </header>

      <div className="pestanas" role="tablist">
        {pestanas.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={vista === p.id}
            className={vista === p.id ? "pestana pestana--activa" : "pestana"}
            onClick={() => setVista(p.id)}
          >
            {p.nombre}
          </button>
        ))}
      </div>

      {vista === "segmentos" && <ListaDeSegmentos />}
      {vista === "campanias" && <ListaDeCampanias />}
    </section>
  );
}

// ─────────────────────────── Segmentos ───────────────────────────

function ListaDeSegmentos() {
  const carga = useCarga(verSegmentos, []);
  /** Qué segmento está desplegado con su gente. */
  const [abierto, setAbierto] = useState<string | null>(null);

  if (carga.fase === "cargando") return <p className="aviso">Calculando los segmentos…</p>;
  if (carga.fase === "error") {
    return (
      <AvisoDeError que="los segmentos" mensaje={carga.mensaje} estadoHttp={carga.estadoHttp} />
    );
  }

  const segmentos = carga.datos;

  if (segmentos.length === 0) {
    return <p className="aviso">Todavía no hay ningún segmento definido.</p>;
  }

  return (
    <>
      {/*
        No hay botón de «recalcular» y no es un olvido: no existe nada que
        recalcular. La lista se deduce de la regla en cada petición, así que ya
        está al día por definición.
      */}
      <p className="campo__pista">
        Cada segmento es una regla, no una lista. Se vuelve a evaluar cada vez que abres esta
        pantalla: quien volvió ayer ya no aparece en «dormidos».
      </p>

      <div className="segmentos">
        {segmentos.map((s) => (
          <Segmento
            key={s.id}
            segmento={s}
            abierto={abierto === s.id}
            alAbrir={() => setAbierto(abierto === s.id ? null : s.id)}
          />
        ))}
      </div>
    </>
  );
}

function Segmento({
  segmento,
  abierto,
  alAbrir,
}: {
  segmento: SegmentoEnLista;
  abierto: boolean;
  alAbrir: () => void;
}) {
  const sinContacto = segmento.miembros - segmento.contactables;

  return (
    <article className={segmento.reglaReconocida ? "segmento" : "segmento segmento--roto"}>
      <header className="segmento__cabecera">
        <div>
          <h3>{segmento.nombre}</h3>
          {segmento.descripcion && <p className="segmento__desc">{segmento.descripcion}</p>}
          <p className="segmento__regla">{segmento.regla}</p>
        </div>
        <p className="segmento__cifra">{segmento.miembros}</p>
      </header>

      {!segmento.reglaReconocida && (
        <p className="aviso aviso--error">
          La regla guardada tiene un tipo que este sistema no sabe evaluar, así que el
          segmento sale vacío. Hay que revisarla en la base de datos.
        </p>
      )}

      <dl className="segmento__datos">
        <div>
          <dt>Se les puede escribir</dt>
          <dd>
            {segmento.contactables}
            {/* La diferencia se dice en voz alta: si no, el número grande
                promete un alcance que no existe. */}
            {sinContacto > 0 && (
              <span className="sutil"> · {sinContacto} sin permiso</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Han gastado</dt>
          <dd className="precio">{soles(segmento.valorCentimos)}</dd>
        </div>
      </dl>

      <button type="button" className="boton-secundario" onClick={alAbrir}>
        {abierto ? "Ocultar la lista" : "Ver quién está dentro"}
      </button>

      {abierto && <Miembros segmentoId={segmento.id} />}
    </article>
  );
}

/** La gente que cae dentro ahora mismo. */
function Miembros({ segmentoId }: { segmentoId: string }) {
  const carga = useCarga(() => verSegmento(segmentoId), [segmentoId]);

  if (carga.fase === "cargando") return <p className="aviso">Cargando…</p>;
  if (carga.fase === "error") {
    return (
      <AvisoDeError que="el segmento" mensaje={carga.mensaje} estadoHttp={carga.estadoHttp} />
    );
  }

  const { miembros } = carga.datos;

  if (miembros.length === 0) {
    return <p className="aviso">Ahora mismo no hay nadie en este segmento.</p>;
  }

  return (
    <div className="tabla-scroll">
      <table className="tabla">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Correo</th>
            <th className="num">Visitas</th>
            <th className="num">Gastado</th>
            <th>Última visita</th>
            <th>Permiso</th>
          </tr>
        </thead>
        <tbody>
          {miembros.map((m) => (
            <tr key={m.id}>
              <td>{m.nombre}</td>
              <td className="sku">{m.email}</td>
              <td className="num">{m.visitas}</td>
              <td className="num precio">{soles(m.gastadoCentimos)}</td>
              <td>{m.ultimaVisita ? horaDeSala(m.ultimaVisita, { dateStyle: "medium" }) : "—"}</td>
              <td>
                <span className="etiqueta">{m.aceptaMarketing ? "Sí" : "No"}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────── Campañas ───────────────────────────

function ListaDeCampanias() {
  const [version, setVersion] = useState(0);
  const campanias = useCarga(verCampanias, [version]);
  const segmentos = useCarga(verSegmentos, []);
  const [redactando, setRedactando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  if (campanias.fase === "cargando") return <p className="aviso">Cargando las campañas…</p>;
  if (campanias.fase === "error") {
    return (
      <AvisoDeError
        que="las campañas"
        mensaje={campanias.mensaje}
        estadoHttp={campanias.estadoHttp}
      />
    );
  }

  async function cancelar(campania: CampaniaEnLista) {
    setFallo(null);
    setAviso(null);
    try {
      await cancelarCampania(campania.id);
      setAviso(`«${campania.nombre}» queda cancelada. No se borra: queda el rastro.`);
      setVersion((v) => v + 1);
    } catch (e) {
      setFallo(e instanceof ErrorDeApi ? e.message : "No se pudo cancelar la campaña.");
    }
  }

  return (
    <>
      {/*
        Dicho arriba del todo y sin rodeos. Una pantalla de campañas que parece
        mandar correos es la clase de cosa que alguien enseña sin saber que no
        manda nada.
      */}
      <p className="campo__pista">
        El sistema <strong>no envía</strong> las campañas: no hay proveedor de correo ni de
        SMS conectado. Aquí se redactan y se guardan; el envío se hace por fuera.
      </p>

      {aviso && <p className="aviso">{aviso}</p>}
      {fallo && <p className="aviso aviso--error">{fallo}</p>}

      {segmentos.fase === "listo" && redactando && (
        <FormularioDeCampania
          segmentos={segmentos.datos}
          alGuardar={(mensaje) => {
            setRedactando(false);
            setAviso(mensaje);
            setVersion((v) => v + 1);
          }}
          alCancelar={() => setRedactando(false)}
        />
      )}

      {campanias.datos.length === 0 ? (
        <p className="aviso">Todavía no se ha redactado ninguna campaña.</p>
      ) : (
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr>
                <th>Campaña</th>
                <th>Canal</th>
                <th>Dirigida a</th>
                <th>Estado</th>
                <th>Redactada</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {campanias.datos.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.nombre}
                    {c.asunto && <span className="sutil"> · {c.asunto}</span>}
                  </td>
                  <td>{c.canalEtiqueta}</td>
                  <td>{c.segmento}</td>
                  <td>
                    <span className="etiqueta">{c.estadoEtiqueta}</span>
                  </td>
                  <td>{horaDeSala(c.creadoEn, { dateStyle: "medium" })}</td>
                  <td className="acciones">
                    {c.sePuedeTocar && (
                      <button type="button" onClick={() => void cancelar(c)}>
                        Cancelar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!redactando && (
        <button
          type="button"
          className="boton-secundario"
          onClick={() => setRedactando(true)}
          disabled={segmentos.fase !== "listo"}
        >
          Redactar campaña
        </button>
      )}
    </>
  );
}

function FormularioDeCampania({
  segmentos,
  alGuardar,
  alCancelar,
}: {
  segmentos: SegmentoEnLista[];
  alGuardar: (mensaje: string) => void;
  alCancelar: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [canal, setCanal] = useState<CanalDeCampania>("CORREO");
  const [segmentoId, setSegmentoId] = useState(segmentos[0]?.id ?? "");
  const [asunto, setAsunto] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  // Solo el correo tiene asunto. Los demás canales son un mensaje a secas.
  const llevaAsunto = canal === "CORREO";
  const elegido = segmentos.find((s) => s.id === segmentoId);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (guardando) return;

    setGuardando(true);
    setFallo(null);

    try {
      await redactarCampania({
        nombre: nombre.trim(),
        canal,
        segmentoId,
        asunto: llevaAsunto ? asunto.trim() : "",
        cuerpo: cuerpo.trim(),
      });
      alGuardar("Campaña redactada. Queda en borrador: el sistema no la manda.");
    } catch (e) {
      setFallo(e instanceof ErrorDeApi ? e.message : "No se pudo guardar la campaña.");
      setGuardando(false);
    }
  }

  return (
    <form className="tipo-form" onSubmit={(e) => void enviar(e)}>
      {fallo && <p className="aviso aviso--error">{fallo}</p>}

      <div className="tipo-form__campos">
        <label className="tipo-form__ancho">
          Nombre
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            maxLength={120}
            autoFocus
            placeholder="Vuelve este viernes"
          />
        </label>

        <label>
          Canal
          <select
            value={canal}
            onChange={(e) => setCanal(e.target.value as CanalDeCampania)}
            required
          >
            {CANALES.map((c) => (
              <option key={c} value={c}>
                {NOMBRE_DE_CANAL_DE_CAMPANIA[c]}
              </option>
            ))}
          </select>
        </label>

        <label>
          Dirigida a
          <select value={segmentoId} onChange={(e) => setSegmentoId(e.target.value)} required>
            {segmentos.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre} · {s.contactables} contactables
              </option>
            ))}
          </select>
          {elegido && (
            <span className="campo__pista">
              {elegido.regla}. Llegaría a {elegido.contactables} de {elegido.miembros}.
            </span>
          )}
        </label>

        {llevaAsunto && (
          <label className="tipo-form__ancho">
            Asunto
            <input
              value={asunto}
              onChange={(e) => setAsunto(e.target.value)}
              required
              maxLength={200}
              placeholder="Te echamos de menos"
            />
          </label>
        )}

        <label className="tipo-form__ancho">
          Mensaje
          <textarea
            value={cuerpo}
            onChange={(e) => setCuerpo(e.target.value)}
            required
            rows={4}
            maxLength={4000}
          />
        </label>
      </div>

      <div className="tipo-form__acciones">
        <button type="button" onClick={alCancelar}>
          Cancelar
        </button>
        <button type="submit" disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar borrador"}
        </button>
      </div>
    </form>
  );
}
