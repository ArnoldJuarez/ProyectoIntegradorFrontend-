import { useState } from "react";
import { FichaDeProducto, MovimientoDeStock } from "./FormulariosDeAlmacen";
import { AvisoDeError } from "../Aviso";
import {
  horaDeSala,
  listarProveedores,
  soles,
  verMovimientos,
  verOpcionesDeAlmacen,
  verStock,
} from "../api";
import { useCarga } from "../datos";

/**
 * El almacén del panel.
 *
 * Tres vistas de lo mismo, en el orden en que se necesitan:
 *
 * - **Stock** — cuánto queda de cada cosa. Es lo que se abre un jueves por la
 *   tarde para saber qué pedir, así que va primero y con lo que falta arriba.
 * - **Movimientos** — el histórico. Sirve cuando el stock no cuadra y hay que
 *   averiguar por qué.
 * - **Proveedores** — a quién llamar para reponer.
 */

type Vista = "stock" | "movimientos" | "proveedores";

/** Las tarjetas de arriba: el estado del almacén de un vistazo. */
function Resumen({
  referencias,
  porDebajoDelUmbral,
  sinExistencias,
  valorTotalCentimos,
}: {
  referencias: number;
  porDebajoDelUmbral: number;
  sinExistencias: number;
  valorTotalCentimos: number;
}) {
  return (
    <div className="tarjetas">
      <div className="tarjeta">
        <p className="tarjeta__cifra">{referencias}</p>
        <p className="tarjeta__pie">Referencias</p>
      </div>
      {/* Se marcan en alerta solo cuando hay algo que hacer: un cero en rojo
          hace que se deje de mirar el rojo. */}
      <div className={porDebajoDelUmbral > 0 ? "tarjeta tarjeta--alerta" : "tarjeta"}>
        <p className="tarjeta__cifra">{porDebajoDelUmbral}</p>
        <p className="tarjeta__pie">Por reponer</p>
      </div>
      <div className={sinExistencias > 0 ? "tarjeta tarjeta--alerta" : "tarjeta"}>
        <p className="tarjeta__cifra">{sinExistencias}</p>
        <p className="tarjeta__pie">Agotados</p>
      </div>
      <div className="tarjeta">
        <p className="tarjeta__cifra tarjeta__cifra--dinero">{soles(valorTotalCentimos)}</p>
        <p className="tarjeta__pie">Valor a coste</p>
      </div>
    </div>
  );
}

/**
 * El stock, con lo que hace falta para cambiarlo.
 *
 * El alta y los movimientos se abren aquí y no en otra pantalla porque las dos
 * decisiones se toman mirando esta tabla: se da de alta un producto cuando se ve
 * que falta, y se registra una compra cuando se ve el aviso de reponer.
 */
function Stock() {
  /*
   * Un contador para volver a pedir el stock. `useCarga` no trae «recargar» a
   * propósito, así que se le añade una dependencia que cambia a mano. Aquí hace
   * falta porque el resumen de arriba —agotados, valor a coste— cambia con cada
   * movimiento.
   */
  const [version, setVersion] = useState(0);
  const carga = useCarga(verStock, [version]);
  const opciones = useCarga(verOpcionesDeAlmacen, []);

  /** Qué formulario está abierto: "nuevo", el id de un producto, o nada. */
  const [abierto, setAbierto] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  if (carga.fase === "cargando") return <p className="aviso">Cargando el stock…</p>;
  if (carga.fase === "error") {
    return <AvisoDeError que="el stock" mensaje={carga.mensaje} estadoHttp={carga.estadoHttp} />;
  }

  const { resumen, lineas } = carga.datos;

  function refrescar(mensaje: string | null) {
    setAbierto(null);
    setAviso(mensaje);
    setVersion((v) => v + 1);
  }

  return (
    <>
      <Resumen {...resumen} />

      {aviso && <p className="aviso">{aviso}</p>}

      {/* Las opciones tardan lo mismo que el stock, pero si fallaran solas no
          se puede escribir: se dice y se deja la tabla, que sí sirve. */}
      {opciones.fase === "error" && (
        <p className="aviso aviso--error">
          No se pudieron cargar las categorías y salas, así que no se puede dar de alta ni
          mover nada: {opciones.mensaje}
        </p>
      )}

      {opciones.fase === "listo" && abierto === "nuevo" && (
        <FichaDeProducto
          opciones={opciones.datos}
          alGuardar={refrescar}
          alCancelar={() => setAbierto(null)}
        />
      )}

      <div className="tabla-scroll">
        <table className="tabla">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Producto</th>
              <th>Categoría</th>
              {/* Ya no hay columna «Sala»: el saldo dejó de estar desglosado
                  por local y ahora hay una única cifra por producto. */}
              <th className="num">Quedan</th>
              <th className="num">Umbral</th>
              <th className="num">Valor</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lineas.map((l) =>
              abierto === l.productoId && opciones.fase === "listo" ? (
                <tr key={l.productoId}>
                  <td colSpan={7}>
                    <p className="campo__pista">
                      {l.producto} · quedan {l.cantidad}
                    </p>
                    <MovimientoDeStock
                      linea={l}
                      opciones={opciones.datos}
                      alMover={refrescar}
                      alCancelar={() => setAbierto(null)}
                    />
                  </td>
                </tr>
              ) : abierto === "ficha-" + l.productoId && opciones.fase === "listo" ? (
                <tr key={l.productoId}>
                  <td colSpan={7}>
                    <FichaDeProducto
                      inicial={l}
                      opciones={opciones.datos}
                      alGuardar={refrescar}
                      alCancelar={() => setAbierto(null)}
                    />
                  </td>
                </tr>
              ) : (
                <tr
                  key={l.productoId}
                  className={l.necesitaReposicion ? "fila--alerta" : undefined}
                >
                  <td className="sku">{l.sku}</td>
                  <td>
                    {l.producto}
                    {/* El aviso va pegado al producto, no en una columna aparte:
                        así se lee sin cruzar la tabla entera con la vista.

                        Los tres casos son distintos y el texto lo dice: no queda
                        nada, se está justo en el umbral, o ya se bajó de él.
                        «Faltan 0» —que es lo que salía al estar en el límite— no
                        significa nada para quien tiene que decidir si pide. */}
                    {l.cantidad === 0 ? (
                      <span className="marca marca--grave"> Agotado</span>
                    ) : l.faltanParaElUmbral > 0 ? (
                      <span className="marca"> Faltan {l.faltanParaElUmbral}</span>
                    ) : l.necesitaReposicion ? (
                      <span className="marca"> En el límite</span>
                    ) : null}
                  </td>
                  <td>{l.categoria}</td>
                  <td className="num">
                    {l.cantidad} <span className="sutil">{l.unidad.toLowerCase()}</span>
                  </td>
                  <td className="num sutil">{l.alertaDeStock}</td>
                  <td className="num precio">{soles(l.valorACosteCentimos)}</td>
                  <td className="acciones">
                    <button
                      type="button"
                      onClick={() => setAbierto(l.productoId)}
                      disabled={opciones.fase !== "listo"}
                    >
                      Mover
                    </button>
                    <button
                      type="button"
                      onClick={() => setAbierto("ficha-" + l.productoId)}
                      disabled={opciones.fase !== "listo"}
                    >
                      Ficha
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      {abierto === null && (
        <button
          type="button"
          className="boton-secundario"
          onClick={() => setAbierto("nuevo")}
          disabled={opciones.fase !== "listo"}
        >
          Nuevo producto
        </button>
      )}
    </>
  );
}

function Movimientos() {
  const carga = useCarga(() => verMovimientos(), []);

  if (carga.fase === "cargando") return <p className="aviso">Cargando el histórico…</p>;
  if (carga.fase === "error") {
    return (
      <AvisoDeError que="los movimientos" mensaje={carga.mensaje} estadoHttp={carga.estadoHttp} />
    );
  }

  const movimientos = carga.datos;

  if (movimientos.length === 0) {
    return <p className="aviso">Todavía no hay movimientos registrados.</p>;
  }

  return (
    <div className="tabla-scroll">
      <table className="tabla">
        <thead>
          <tr>
            <th>Cuándo</th>
            <th>Producto</th>
            <th>Motivo</th>
            <th className="num">Unidades</th>
            <th className="num">Importe</th>
            <th>Referencia</th>
          </tr>
        </thead>
        <tbody>
          {movimientos.map((m) => (
            <tr key={m.id}>
              <td className="sutil">{horaDeSala(m.cuando)}</td>
              <td>
                {m.producto}
                <span className="sutil"> · {m.sala}</span>
              </td>
              <td>
                <span className="etiqueta">{m.tipoEtiqueta}</span>
              </td>
              {/* El sentido se enseña con flecha y color, no solo con el número:
                  un «−3» y un «3» se confunden de un vistazo en una columna. */}
              <td className={m.esEntrada ? "num movimiento--entra" : "num movimiento--sale"}>
                {m.esEntrada ? "▲" : "▼"} {m.unidades}
              </td>
              <td className="num">
                {m.importeCentimos > 0 ? soles(m.importeCentimos) : <span className="sutil">—</span>}
              </td>
              <td className="sutil">{m.referencia ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Proveedores() {
  const carga = useCarga(listarProveedores, []);

  if (carga.fase === "cargando") return <p className="aviso">Cargando…</p>;
  if (carga.fase === "error") {
    return (
      <AvisoDeError que="los proveedores" mensaje={carga.mensaje} estadoHttp={carga.estadoHttp} />
    );
  }

  if (carga.datos.length === 0) {
    return <p className="aviso">No hay proveedores dados de alta.</p>;
  }

  return (
    <div className="tabla-scroll">
      <table className="tabla">
        <thead>
          <tr>
            <th>Proveedor</th>
            <th>Contacto</th>
            <th>Correo</th>
            <th>Teléfono</th>
          </tr>
        </thead>
        <tbody>
          {carga.datos.map((p) => (
            <tr key={p.id}>
              <td>{p.nombre}</td>
              <td>{p.personaDeContacto ?? <span className="sutil">—</span>}</td>
              <td>{p.email ?? <span className="sutil">—</span>}</td>
              <td>{p.telefono ?? <span className="sutil">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Inventario() {
  const [vista, setVista] = useState<Vista>("stock");

  const pestanas: { id: Vista; nombre: string }[] = [
    { id: "stock", nombre: "Stock" },
    { id: "movimientos", nombre: "Movimientos" },
    { id: "proveedores", nombre: "Proveedores" },
  ];

  return (
    <section>
      <header className="cabecera">
        <h2>Almacén</h2>
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

      {vista === "stock" && <Stock />}
      {vista === "movimientos" && <Movimientos />}
      {vista === "proveedores" && <Proveedores />}
    </section>
  );
}
