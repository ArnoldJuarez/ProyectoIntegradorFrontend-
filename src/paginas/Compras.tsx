import { useState } from "react";
import { toast } from "sonner";
import { AvisoDeError } from "../Aviso";
import {
  ErrorDeApi,
  NOMBRE_DE_ESTADO_DE_ORDEN,
  cancelarOrden,
  crearOrden,
  crearProveedor,
  editarOrden,
  editarProveedor,
  enviarOrden,
  horaDeSala,
  listarProveedores,
  recibirOrden,
  soles,
  verOpcionesDeAlmacen,
  verOrden,
  verOrdenes,
  verStock,
  type EstadoDeOrden,
  type FichaDeOrden,
  type LineaDeStock,
  type Proveedor,
} from "../api";
import { useCarga } from "../datos";

/**
 * Pedidos a proveedor: de borrador a mercancía en el almacén.
 *
 * Los prepara quien lleva el almacén, o el agente de inventario al aprobar su
 * propuesta: los dos aparecen aquí igual, en borrador. Se revisan, se envían
 * (eso lo hace una persona: llamar o escribir al proveedor) y, cuando llega la
 * mercancía, se marcan como recibidos. Recibir es lo que suma el stock.
 */

const CLASE_DE_ESTADO: Record<EstadoDeOrden, string> = {
  BORRADOR: "estado estado--borrador",
  ENVIADO: "estado estado--agotado",
  RECIBIDO: "estado estado--publicado",
  CANCELADO: "estado estado--cancelado",
};

type Vista = "pedidos" | "proveedores";

export function Compras() {
  const [vista, setVista] = useState<Vista>("pedidos");
  return (
    <section>
      <header className="cabecera">
        <h2>Compras</h2>
        <span className="contador">Pedidos a proveedor y a quién se le compra</span>
      </header>
      <div className="pestanas" role="tablist">
        {(["pedidos", "proveedores"] as Vista[]).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={vista === v}
            className={vista === v ? "pestana pestana--activa" : "pestana"}
            onClick={() => setVista(v)}
          >
            {v === "pedidos" ? "Pedidos" : "Proveedores"}
          </button>
        ))}
      </div>
      {vista === "pedidos" ? <Pedidos /> : <Proveedores />}
    </section>
  );
}

// ─────────────────────────── Pedidos ───────────────────────────

function Pedidos() {
  const [version, setVersion] = useState(0);
  const ordenes = useCarga(verOrdenes, [version]);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const recargar = () => setVersion((v) => v + 1);

  if (ordenes.fase === "cargando") return <p className="aviso">Cargando los pedidos…</p>;
  if (ordenes.fase === "error") {
    return <AvisoDeError que="los pedidos" mensaje={ordenes.mensaje} estadoHttp={ordenes.estadoHttp} />;
  }

  const borradores = ordenes.datos.filter((o) => o.estado === "BORRADOR").length;
  const enCamino = ordenes.datos.filter((o) => o.estado === "ENVIADO");

  return (
    <>
      <div className="tarjetas">
        <div className={borradores > 0 ? "tarjeta tarjeta--alerta" : "tarjeta"}>
          <p className="tarjeta__cifra">{borradores}</p>
          <p className="tarjeta__pie">Borradores por revisar</p>
        </div>
        <div className="tarjeta">
          <p className="tarjeta__cifra">{enCamino.length}</p>
          <p className="tarjeta__pie">En camino</p>
        </div>
        <div className="tarjeta">
          <p className="tarjeta__cifra tarjeta__cifra--dinero">
            {soles(enCamino.reduce((t, o) => t + o.totalCentimos, 0))}
          </p>
          <p className="tarjeta__pie">Por recibir</p>
        </div>
      </div>

      {!creando && (
        <p>
          <button type="button" className="boton" onClick={() => setCreando(true)}>
            Nuevo pedido
          </button>
        </p>
      )}
      {creando && (
        <EditorDeOrden
          alGuardar={(id) => {
            setCreando(false);
            setAbierta(id);
            recargar();
          }}
          alCancelar={() => setCreando(false)}
        />
      )}

      {ordenes.datos.length === 0 ? (
        <p className="aviso">Todavía no hay pedidos a proveedor.</p>
      ) : (
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Proveedor</th>
                <th>Estado</th>
                <th className="num">Líneas</th>
                <th className="num">Total</th>
                <th>Creado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {ordenes.datos.map((o) => (
                <tr key={o.id} className={abierta === o.id ? "fila--abierta" : undefined}>
                  <td className="sku">{o.codigo}</td>
                  <td>{o.proveedor}</td>
                  <td>
                    <span className={CLASE_DE_ESTADO[o.estado]}>{NOMBRE_DE_ESTADO_DE_ORDEN[o.estado]}</span>
                  </td>
                  <td className="num">{o.lineas}</td>
                  <td className="num precio">{soles(o.totalCentimos)}</td>
                  <td className="sutil">{horaDeSala(o.creadoEn, { dateStyle: "medium" })}</td>
                  <td className="acciones">
                    <button
                      type="button"
                      className="boton-secundario"
                      onClick={() => setAbierta(abierta === o.id ? null : o.id)}
                    >
                      {abierta === o.id ? "Cerrar" : "Abrir"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {abierta && <DetalleDeOrden key={abierta} id={abierta} alCambiar={recargar} />}
    </>
  );
}

/** La ficha de un pedido con lo que se puede hacer según su estado. */
function DetalleDeOrden({ id, alCambiar }: { id: string; alCambiar: () => void }) {
  const [version, setVersion] = useState(0);
  const orden = useCarga(() => verOrden(id), [id, version]);
  const opciones = useCarga(verOpcionesDeAlmacen, []);
  const [editando, setEditando] = useState(false);
  const [salaId, setSalaId] = useState("");
  const [ocupado, setOcupado] = useState(false);

  if (orden.fase === "cargando") return <p className="aviso">Cargando el pedido…</p>;
  if (orden.fase === "error") return <p className="aviso aviso--error">{orden.mensaje}</p>;
  const o = orden.datos;

  async function hacer(accion: () => Promise<FichaDeOrden>, exito: string) {
    setOcupado(true);
    try {
      await accion();
      toast.success(exito);
      setVersion((v) => v + 1);
      alCambiar();
    } catch (err) {
      toast.error(err instanceof ErrorDeApi ? err.message : "No se pudo.");
    } finally {
      setOcupado(false);
    }
  }

  if (editando) {
    return (
      <EditorDeOrden
        inicial={o}
        alGuardar={() => {
          setEditando(false);
          setVersion((v) => v + 1);
          alCambiar();
        }}
        alCancelar={() => setEditando(false)}
      />
    );
  }

  const salas = opciones.fase === "listo" ? opciones.datos.salas : [];
  const sala = salaId || salas[0]?.id || "";

  return (
    <div className="apartado detalle-orden">
      <div className="apartado__cabecera">
        <h3 className="subtitulo">
          {o.codigo} · {o.proveedor}{" "}
          <span className={CLASE_DE_ESTADO[o.estado]}>{NOMBRE_DE_ESTADO_DE_ORDEN[o.estado]}</span>
        </h3>
        <div className="cabecera__acciones">
          {o.estado === "BORRADOR" && (
            <>
              <button type="button" className="boton-secundario" onClick={() => setEditando(true)} disabled={ocupado}>
                Editar
              </button>
              <button
                type="button"
                className="boton"
                onClick={() => void hacer(() => enviarOrden(o.id), "Marcado como enviado")}
                disabled={ocupado}
              >
                Marcar enviado
              </button>
            </>
          )}
          {(o.estado === "BORRADOR" || o.estado === "ENVIADO") && (
            <button
              type="button"
              className="boton-fantasma boton--peligro"
              onClick={() => {
                if (window.confirm(`¿Cancelar ${o.codigo}?`)) void hacer(() => cancelarOrden(o.id), "Pedido cancelado");
              }}
              disabled={ocupado}
            >
              Cancelar pedido
            </button>
          )}
        </div>
      </div>

      <p className="sutil">
        Creado {horaDeSala(o.creadoEn)}
        {o.esperadoEn && ` · llega ${horaDeSala(o.esperadoEn, { dateStyle: "medium" })}`}
        {o.recibidoEn && ` · recibido ${horaDeSala(o.recibidoEn)}`}
      </p>

      <div className="tabla-scroll">
        <table className="tabla">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Producto</th>
              <th className="num">Cantidad</th>
              <th className="num">Coste unidad</th>
              <th className="num">Importe</th>
            </tr>
          </thead>
          <tbody>
            {o.lineas.map((l) => (
              <tr key={l.productoId}>
                <td className="sku">{l.sku}</td>
                <td>{l.producto}</td>
                <td className="num">{l.cantidad}</td>
                <td className="num">{soles(l.costeUnitarioCentimos)}</td>
                <td className="num precio">{soles(l.importeCentimos)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={4} className="num">
                <strong>Total</strong>
              </td>
              <td className="num precio">
                <strong>{soles(o.totalCentimos)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {(o.estado === "BORRADOR" || o.estado === "ENVIADO") && (
        <div className="recepcion">
          <p className="campo__pista">
            Cuando llegue la mercancía, recíbela: cada línea entra en el almacén como una compra, con el código del
            pedido en el histórico, y su coste pasa a ser el de referencia del producto.
          </p>
          <div className="portada-acciones">
            {salas.length > 1 && (
              <select value={sala} onChange={(e) => setSalaId(e.target.value)} aria-label="Sala donde entra">
                {salas.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              className="boton"
              disabled={ocupado || !sala}
              onClick={() => void hacer(() => recibirOrden(o.id, sala), "Mercancía recibida: el stock ya está sumado")}
            >
              Recibir mercancía
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

type LineaEditable = { productoId: string; cantidad: string; coste: string };

/** Crear o editar un borrador: proveedor, fecha prevista y líneas. */
function EditorDeOrden({
  inicial,
  alGuardar,
  alCancelar,
}: {
  inicial?: FichaDeOrden;
  alGuardar: (id: string) => void;
  alCancelar: () => void;
}) {
  const proveedores = useCarga(listarProveedores, []);
  const stock = useCarga(verStock, []);
  const [proveedorId, setProveedorId] = useState(inicial?.proveedorId ?? "");
  const [esperado, setEsperado] = useState(inicial?.esperadoEn ? inicial.esperadoEn.slice(0, 10) : "");
  const [lineas, setLineas] = useState<LineaEditable[]>(
    inicial?.lineas.map((l) => ({
      productoId: l.productoId,
      cantidad: String(l.cantidad),
      coste: String(l.costeUnitarioCentimos / 100),
    })) ?? [{ productoId: "", cantidad: "", coste: "" }],
  );
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  if (proveedores.fase === "cargando" || stock.fase === "cargando") return <p className="aviso">Cargando…</p>;
  if (proveedores.fase === "error") return <p className="aviso aviso--error">{proveedores.mensaje}</p>;
  if (stock.fase === "error") return <p className="aviso aviso--error">{stock.mensaje}</p>;

  const productos: LineaDeStock[] = stock.datos.lineas;
  const elegido = proveedorId || proveedores.datos[0]?.id || "";
  const total = lineas.reduce(
    (t, l) => t + (Number(l.cantidad) || 0) * Math.round((Number(l.coste) || 0) * 100),
    0,
  );

  function cambiarLinea(i: number, cambio: Partial<LineaEditable>) {
    setLineas((previas) =>
      previas.map((l, j) => {
        if (j !== i) return l;
        const nueva = { ...l, ...cambio };
        // Al elegir producto se propone su coste de referencia, que es lo habitual.
        if (cambio.productoId && !l.coste) {
          const p = productos.find((x) => x.productoId === cambio.productoId);
          if (p) nueva.coste = String(p.costeCentimos / 100);
        }
        return nueva;
      }),
    );
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setFallo(null);
    const datos = {
      proveedorId: elegido,
      esperadoEn: esperado ? new Date(`${esperado}T12:00:00-05:00`).toISOString() : null,
      lineas: lineas
        .filter((l) => l.productoId)
        .map((l) => ({
          productoId: l.productoId,
          cantidad: Number(l.cantidad),
          costeUnitarioCentimos: Math.round(Number(l.coste) * 100),
        })),
    };
    try {
      const guardada = inicial ? await editarOrden(inicial.id, datos) : await crearOrden(datos);
      toast.success(inicial ? "Pedido actualizado" : `Pedido ${guardada.codigo} creado en borrador`);
      alGuardar(guardada.id);
    } catch (err) {
      setFallo(err instanceof ErrorDeApi ? err.message : "No se pudo guardar el pedido.");
      setGuardando(false);
    }
  }

  return (
    <form className="tipo-form" onSubmit={(e) => void enviar(e)}>
      {fallo && <p className="aviso aviso--error">{fallo}</p>}
      <div className="tipo-form__campos">
        <label>
          Proveedor
          <select value={elegido} onChange={(e) => setProveedorId(e.target.value)} required>
            {proveedores.datos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Llega el (opcional)
          <input type="date" value={esperado} onChange={(e) => setEsperado(e.target.value)} />
        </label>
      </div>

      <div className="lineas-de-pedido">
        {lineas.map((l, i) => (
          <div key={i} className="lineas-de-pedido__fila">
            <select
              value={l.productoId}
              onChange={(e) => cambiarLinea(i, { productoId: e.target.value })}
              aria-label="Producto"
              required={i === 0}
            >
              <option value="">Elige un producto…</option>
              {productos.map((p) => (
                <option key={p.productoId} value={p.productoId}>
                  {p.producto} · quedan {p.cantidad}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={l.cantidad}
              onChange={(e) => cambiarLinea(i, { cantidad: e.target.value })}
              placeholder="Cantidad"
              aria-label="Cantidad"
              required={Boolean(l.productoId)}
            />
            <input
              type="number"
              min={0}
              step="0.10"
              value={l.coste}
              onChange={(e) => cambiarLinea(i, { coste: e.target.value })}
              placeholder="Coste S/"
              aria-label="Coste por unidad en soles"
              required={Boolean(l.productoId)}
            />
            <button
              type="button"
              className="boton-fantasma"
              onClick={() => setLineas((previas) => previas.filter((_, j) => j !== i))}
              disabled={lineas.length === 1}
              aria-label="Quitar línea"
            >
              Quitar
            </button>
          </div>
        ))}
        <button
          type="button"
          className="boton-secundario"
          onClick={() => setLineas((previas) => [...previas, { productoId: "", cantidad: "", coste: "" }])}
        >
          Añadir línea
        </button>
      </div>

      <p className="campo__pista">
        Total del pedido: <strong>{soles(total)}</strong>
      </p>

      <div className="tipo-form__acciones">
        <button type="button" onClick={alCancelar}>
          Cancelar
        </button>
        <button type="submit" disabled={guardando}>
          {guardando ? "Guardando…" : inicial ? "Guardar cambios" : "Crear borrador"}
        </button>
      </div>
    </form>
  );
}

// ─────────────────────────── Proveedores ───────────────────────────

function Proveedores() {
  const [version, setVersion] = useState(0);
  const carga = useCarga(listarProveedores, [version]);
  const [abierto, setAbierto] = useState<string | null>(null);
  const recargar = () => setVersion((v) => v + 1);

  if (carga.fase === "cargando") return <p className="aviso">Cargando…</p>;
  if (carga.fase === "error") {
    return <AvisoDeError que="los proveedores" mensaje={carga.mensaje} estadoHttp={carga.estadoHttp} />;
  }

  return (
    <>
      {abierto !== "nuevo" && (
        <p>
          <button type="button" className="boton" onClick={() => setAbierto("nuevo")}>
            Nuevo proveedor
          </button>
        </p>
      )}
      {abierto === "nuevo" && (
        <FichaDeProveedor
          alGuardar={() => {
            setAbierto(null);
            recargar();
          }}
          alCancelar={() => setAbierto(null)}
        />
      )}
      <div className="tabla-scroll">
        <table className="tabla">
          <thead>
            <tr>
              <th>Proveedor</th>
              <th>Contacto</th>
              <th>Correo</th>
              <th>Teléfono</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {carga.datos.map((p) =>
              abierto === p.id ? (
                <tr key={p.id}>
                  <td colSpan={5}>
                    <FichaDeProveedor
                      inicial={p}
                      alGuardar={() => {
                        setAbierto(null);
                        recargar();
                      }}
                      alCancelar={() => setAbierto(null)}
                    />
                  </td>
                </tr>
              ) : (
                <tr key={p.id}>
                  <td>
                    <strong>{p.nombre}</strong>
                  </td>
                  <td>{p.personaDeContacto ?? <span className="sutil">—</span>}</td>
                  <td>{p.email ?? <span className="sutil">—</span>}</td>
                  <td>{p.telefono ?? <span className="sutil">—</span>}</td>
                  <td className="acciones">
                    <button type="button" className="boton-secundario" onClick={() => setAbierto(p.id)}>
                      Editar
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function FichaDeProveedor({
  inicial,
  alGuardar,
  alCancelar,
}: {
  inicial?: Proveedor;
  alGuardar: () => void;
  alCancelar: () => void;
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [contacto, setContacto] = useState(inicial?.personaDeContacto ?? "");
  const [email, setEmail] = useState(inicial?.email ?? "");
  const [telefono, setTelefono] = useState(inicial?.telefono ?? "");
  const [fallo, setFallo] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const datos = { nombre: nombre.trim(), personaDeContacto: contacto.trim(), email: email.trim(), telefono: telefono.trim() };
    try {
      if (inicial) await editarProveedor(inicial.id, datos);
      else await crearProveedor(datos);
      toast.success(inicial ? "Proveedor actualizado" : "Proveedor dado de alta");
      alGuardar();
    } catch (err) {
      setFallo(err instanceof ErrorDeApi ? err.message : "No se pudo guardar.");
    }
  }

  return (
    <form className="tipo-form" onSubmit={(e) => void enviar(e)}>
      {fallo && <p className="aviso aviso--error">{fallo}</p>}
      <div className="tipo-form__campos">
        <label>
          Empresa
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} required minLength={2} maxLength={120} autoFocus />
        </label>
        <label>
          Persona de contacto
          <input value={contacto} onChange={(e) => setContacto(e.target.value)} maxLength={120} />
        </label>
        <label>
          Correo
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={160} />
        </label>
        <label>
          Teléfono
          <input value={telefono} onChange={(e) => setTelefono(e.target.value)} maxLength={30} />
        </label>
      </div>
      <div className="tipo-form__acciones">
        <button type="button" onClick={alCancelar}>
          Cancelar
        </button>
        <button type="submit">{inicial ? "Guardar cambios" : "Dar de alta"}</button>
      </div>
    </form>
  );
}
