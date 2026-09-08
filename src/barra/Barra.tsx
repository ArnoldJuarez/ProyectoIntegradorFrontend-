import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ErrorDeApi,
  NOMBRE_DE_PAGO,
  abrirTurno,
  cerrarTurno,
  cobrarEnBarra,
  soles,
  verBarra,
  type BotonDeProducto,
  type MetodoDePago,
  type PantallaDeBarra,
  type TurnoCerrado,
} from "../api";
import { Login } from "../Login";
import { useSesion } from "../sesion";
import "./barra.css";

/**
 * El punto de venta de la barra.
 *
 * <p>Fuera de `/panel`, igual que la puerta: quien sirve copas no tiene permiso
 * sobre ninguna ruta del panel, así que colgarla de ahí le enseñaría una
 * navegación entera que le responde 403. Y porque esto se usa de pie, en una
 * tablet, con gente esperando — el panel está pensado para sentarse.
 */
const ROLES_DE_BARRA = ["DIRECCION", "GERENCIA", "BARRA"];

/** Los métodos de pago, en el orden en que se usan de verdad. */
const PAGOS: MetodoDePago[] = ["EFECTIVO", "TARJETA", "YAPE", "PLIN", "TRANSFERENCIA"];

export function Barra() {
  const { estado, entrar, salir } = useSesion();

  if (estado.fase === "comprobando") {
    return <p className="tpv__aviso">Comprobando la sesión…</p>;
  }

  if (estado.fase === "error") {
    return (
      <div className="tpv__aviso tpv__aviso--mal">
        <p>No se pudo hablar con el backend.</p>
        <p className="tpv__pista">{estado.mensaje}</p>
      </div>
    );
  }

  if (estado.fase === "fuera") {
    return (
      <div className="tpv tpv--login">
        <Login alEntrar={entrar} />
      </div>
    );
  }

  if (!ROLES_DE_BARRA.includes(estado.usuario.rol)) {
    return (
      <div className="tpv__aviso tpv__aviso--mal">
        <p>La barra es para dirección, gerencia y personal de barra.</p>
        <p className="tpv__pista">
          Tu cuenta es de {estado.usuario.rol.toLowerCase()}. <Link to="/panel">Ir al panel</Link>
        </p>
      </div>
    );
  }

  return <Tpv alSalir={salir} />;
}

// ─────────────────────────────────────────────────────────────────

function Tpv({ alSalir }: { alSalir: () => Promise<void> }) {
  const [pantalla, setPantalla] = useState<PantallaDeBarra | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  /** El carrito: cuántas unidades de cada producto, por id. */
  const [carrito, setCarrito] = useState<Record<string, number>>({});
  const [metodo, setMetodo] = useState<MetodoDePago>("EFECTIVO");
  const [cobrando, setCobrando] = useState(false);
  const [ultimoTicket, setUltimoTicket] = useState<string | null>(null);
  const [cerrado, setCerrado] = useState<TurnoCerrado | null>(null);

  const cargar = useCallback(async () => {
    try {
      setPantalla(await verBarra());
      setFallo(null);
    } catch (e) {
      setFallo(e instanceof ErrorDeApi ? e.message : "No se pudo cargar la barra.");
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  /** Todos los productos en un mapa, para poder mirar precios sin recorrer. */
  const porId = useMemo(() => {
    const mapa = new Map<string, BotonDeProducto>();
    for (const grupo of pantalla?.catalogo ?? []) {
      for (const p of grupo.productos) mapa.set(p.id, p);
    }
    return mapa;
  }, [pantalla]);

  const { unidades, total } = useMemo(() => {
    let unidades = 0;
    let total = 0;
    for (const [id, cuantas] of Object.entries(carrito)) {
      const producto = porId.get(id);
      if (!producto) continue;
      unidades += cuantas;
      total += cuantas * producto.precioCentimos;
    }
    return { unidades, total };
  }, [carrito, porId]);

  function anadir(producto: BotonDeProducto) {
    setUltimoTicket(null);
    setCarrito((previo) => ({ ...previo, [producto.id]: (previo[producto.id] ?? 0) + 1 }));
  }

  function quitar(id: string) {
    setCarrito((previo) => {
      const quedan = (previo[id] ?? 0) - 1;
      const siguiente = { ...previo };
      if (quedan <= 0) delete siguiente[id];
      else siguiente[id] = quedan;
      return siguiente;
    });
  }

  async function cobrar() {
    if (!pantalla?.turno || unidades === 0 || cobrando) return;

    setCobrando(true);
    setFallo(null);

    try {
      const hecha = await cobrarEnBarra(
        pantalla.turno.id,
        metodo,
        pantalla.nocheSlug,
        Object.entries(carrito).map(([productoId, cantidad]) => ({ productoId, cantidad })),
      );

      // El carrito se vacía en cuanto se cobra: el siguiente ya está pidiendo.
      setCarrito({});
      setUltimoTicket(`${soles(hecha.totalCentimos)} · ${NOMBRE_DE_PAGO[metodo]}`);
      // Se recarga para traer el stock y el esperado al día.
      await cargar();
    } catch (e) {
      setFallo(e instanceof ErrorDeApi ? e.message : "No se pudo registrar la venta.");
    } finally {
      setCobrando(false);
    }
  }

  if (cerrado) return <Cierre cerrado={cerrado} alSalir={alSalir} />;

  if (!pantalla) return <p className="tpv__aviso">Cargando la barra…</p>;

  if (!pantalla.turno) {
    return <Apertura alAbrir={cargar} fallo={fallo} setFallo={setFallo} alSalir={alSalir} />;
  }

  return (
    <div className="tpv">
      <header className="tpv__cabecera">
        <div>
          <p className="tpv__marca">
            <span className="tpv__latido" /> Barra
          </p>
          <h1>{pantalla.noche ?? "Sin evento"}</h1>
          <p className="tpv__sala">
            {pantalla.turno.sala} · {pantalla.turno.responsable}
          </p>
        </div>

        <div className="tpv__cajon">
          <p className="tpv__cifra">{soles(pantalla.turno.esperadoCentimos)}</p>
          {/* «En el cajón» y no «vendido»: la tarjeta no pasa por aquí. */}
          <p className="tpv__pie">en el cajón</p>
          <button type="button" onClick={() => void alSalir()}>
            Salir
          </button>
        </div>
      </header>

      {fallo && <p className="tpv__aviso tpv__aviso--mal">{fallo}</p>}

      <div className="tpv__cuerpo">
        <div className="catalogo">
          {pantalla.catalogo.map((grupo) => (
            <section key={grupo.categoria} className="catalogo__grupo">
              <h2>{grupo.categoria}</h2>
              <div className="catalogo__rejilla">
                {grupo.productos.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={p.stock <= 0 ? "tecla tecla--sin" : "tecla"}
                    onClick={() => anadir(p)}
                  >
                    <span className="tecla__nombre">{p.nombre}</span>
                    <span className="tecla__precio">{soles(p.precioCentimos)}</span>
                    {/*
                      El stock negativo se enseña sin adornos: significa que
                      falta registrar una compra, y esconderlo no lo arregla.
                      Aun así el botón sigue cobrando — ver el backend.
                    */}
                    {p.stock <= 5 && <span className="tecla__stock">{p.stock}</span>}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>

        <aside className="ticket">
          <h2>Ticket</h2>

          {unidades === 0 ? (
            <p className="ticket__vacio">
              {ultimoTicket ? `Cobrado: ${ultimoTicket}` : "Toca un producto para empezar."}
            </p>
          ) : (
            <ul className="ticket__lineas">
              {Object.entries(carrito).map(([id, cuantas]) => {
                const p = porId.get(id);
                if (!p) return null;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      className="ticket__quitar"
                      onClick={() => quitar(id)}
                      aria-label={`Quitar un ${p.nombre}`}
                    >
                      −
                    </button>
                    <span className="ticket__cuantas">{cuantas}</span>
                    <span className="ticket__nombre">{p.nombre}</span>
                    <span className="ticket__importe">{soles(cuantas * p.precioCentimos)}</span>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="ticket__total">
            <span>Total</span>
            <strong>{soles(total)}</strong>
          </div>

          <div className="pagos">
            {PAGOS.map((p) => (
              <button
                key={p}
                type="button"
                className={p === metodo ? "pago pago--elegido" : "pago"}
                onClick={() => setMetodo(p)}
              >
                {NOMBRE_DE_PAGO[p]}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="ticket__cobrar"
            onClick={() => void cobrar()}
            disabled={unidades === 0 || cobrando}
          >
            {cobrando ? "Cobrando…" : `Cobrar ${soles(total)}`}
          </button>

          <CerrarCaja
            arqueoId={pantalla.turno.id}
            esperadoCentimos={pantalla.turno.esperadoCentimos}
            alCerrar={setCerrado}
            setFallo={setFallo}
          />
        </aside>
      </div>
    </div>
  );
}

// ─────────────────────── Trozos de la pantalla ───────────────────────

/** Sin caja abierta no se cobra: primero se cuenta el fondo. */
function Apertura({
  alAbrir,
  fallo,
  setFallo,
  alSalir,
}: {
  alAbrir: () => Promise<void>;
  fallo: string | null;
  setFallo: (m: string | null) => void;
  alSalir: () => Promise<void>;
}) {
  const [fondo, setFondo] = useState("200");
  const [abriendo, setAbriendo] = useState(false);

  async function abrir(evento: React.FormEvent) {
    evento.preventDefault();
    if (abriendo) return;

    setAbriendo(true);
    setFallo(null);

    try {
      // El fondo se teclea en soles y viaja en céntimos: el dinero es entero de
      // punta a punta, y solo se divide al pintarlo.
      await abrirTurno(Math.round(Number(fondo) * 100));
      await alAbrir();
    } catch (e) {
      setFallo(e instanceof ErrorDeApi ? e.message : "No se pudo abrir la caja.");
      setAbriendo(false);
    }
  }

  return (
    <div className="tpv tpv--apertura">
      <p className="tpv__marca">
        <span className="tpv__latido" /> Barra
      </p>
      <h1>Abrir caja</h1>
      <p className="tpv__sala">
        Cuenta lo que hay en el cajón antes de empezar. Es contra eso contra lo que se cuadra
        al cerrar.
      </p>

      {fallo && <p className="tpv__aviso tpv__aviso--mal">{fallo}</p>}

      <form onSubmit={(e) => void abrir(e)} className="apertura">
        <label>
          Fondo de caja (S/)
          <input
            type="number"
            min="0"
            step="0.10"
            value={fondo}
            onChange={(e) => setFondo(e.target.value)}
            required
            inputMode="decimal"
          />
        </label>
        <button type="submit" disabled={abriendo}>
          {abriendo ? "Abriendo…" : "Abrir caja"}
        </button>
      </form>

      <button type="button" className="tpv__salir" onClick={() => void alSalir()}>
        Salir
      </button>
    </div>
  );
}

/** El cierre: se cuenta el cajón y se firma el descuadre. */
function CerrarCaja({
  arqueoId,
  esperadoCentimos,
  alCerrar,
  setFallo,
}: {
  arqueoId: string;
  esperadoCentimos: number;
  alCerrar: (c: TurnoCerrado) => void;
  setFallo: (m: string | null) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [contado, setContado] = useState("");
  const [cerrando, setCerrando] = useState(false);

  async function cerrar(evento: React.FormEvent) {
    evento.preventDefault();
    if (cerrando) return;

    setCerrando(true);
    setFallo(null);

    try {
      alCerrar(await cerrarTurno(arqueoId, Math.round(Number(contado) * 100)));
    } catch (e) {
      setFallo(e instanceof ErrorDeApi ? e.message : "No se pudo cerrar la caja.");
      setCerrando(false);
    }
  }

  if (!abierto) {
    return (
      <button type="button" className="ticket__cerrar" onClick={() => setAbierto(true)}>
        Cerrar caja
      </button>
    );
  }

  return (
    <form className="cierre" onSubmit={(e) => void cerrar(e)}>
      <p className="cierre__esperado">
        Deberían ser <strong>{soles(esperadoCentimos)}</strong>
      </p>
      <label>
        Contado (S/)
        <input
          type="number"
          min="0"
          step="0.10"
          value={contado}
          onChange={(e) => setContado(e.target.value)}
          required
          autoFocus
          inputMode="decimal"
        />
      </label>
      <div className="cierre__botones">
        <button type="button" onClick={() => setAbierto(false)}>
          Seguir cobrando
        </button>
        <button type="submit" disabled={cerrando || contado === ""}>
          {cerrando ? "Cerrando…" : "Cerrar"}
        </button>
      </div>
    </form>
  );
}

/** Lo que queda en pantalla al cerrar: el arqueo firmado. */
function Cierre({
  cerrado,
  alSalir,
}: {
  cerrado: TurnoCerrado;
  alSalir: () => Promise<void>;
}) {
  const falta = cerrado.diferenciaCentimos < 0;

  return (
    <div className="tpv tpv--apertura">
      <p className="tpv__marca">Caja cerrada</p>
      <h1>{cerrado.cuadro ? "Cuadra" : falta ? "Falta dinero" : "Sobra dinero"}</h1>

      <dl className="arqueo">
        <div>
          <dt>Fondo</dt>
          <dd>{soles(cerrado.fondoCentimos)}</dd>
        </div>
        <div>
          <dt>Esperado</dt>
          <dd>{soles(cerrado.esperadoCentimos)}</dd>
        </div>
        <div>
          <dt>Contado</dt>
          <dd>{soles(cerrado.contadoCentimos)}</dd>
        </div>
        <div className={cerrado.cuadro ? "" : "arqueo--mal"}>
          <dt>Diferencia</dt>
          <dd>{soles(cerrado.diferenciaCentimos)}</dd>
        </div>
      </dl>

      <p className="tpv__sala">
        El detalle queda en el panel, en Caja. Este arqueo ya no cambia aunque se corrija una
        venta después: es la foto del momento del cierre.
      </p>

      <button type="button" className="tpv__salir" onClick={() => void alSalir()}>
        Salir
      </button>
    </div>
  );
}
