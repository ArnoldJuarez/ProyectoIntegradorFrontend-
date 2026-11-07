import { useState } from "react";
import {
  ErrorDeApi,
  NOMBRE_DE_MOVIMIENTO,
  NOMBRE_DE_UNIDAD,
  crearProducto,
  editarProducto,
  moverStock,
  type LineaDeStock,
  type OpcionesDeAlmacen,
  type TipoDeMovimiento,
  type UnidadDeProducto,
} from "../api";

/**
 * Los dos formularios del almacén: dar de alta un producto y mover existencias.
 *
 * Viven en un archivo aparte de la pantalla de inventario porque son lo único
 * que escribe: el resto de esa pantalla son tres tablas de solo lectura, y
 * mezclarlas haría un archivo donde cuesta ver qué toca la base y qué no.
 */

/**
 * La ficha de un producto: el mismo formulario para dar de alta y para editar.
 *
 * Es el mismo porque los campos son los mismos, y separarlos en dos garantiza
 * que uno se quede atrás cuando se añada uno nuevo. Lo que cambia es de dónde
 * salen los valores iniciales y a qué endpoint se envía.
 *
 * Al dar de alta, el producto nace con cero unidades: meter mercancía es una
 * compra, y tiene que serlo.
 */
export function FichaDeProducto({
  inicial,
  opciones,
  alGuardar,
  alCancelar,
}: {
  /** La línea de stock que se edita, o nada si es un alta. */
  inicial?: LineaDeStock;
  opciones: OpcionesDeAlmacen;
  alGuardar: (mensaje: string) => void;
  alCancelar: () => void;
}) {
  const [nombre, setNombre] = useState(inicial?.producto ?? "");
  const [categoriaId, setCategoriaId] = useState(
    opciones.categorias.find((c) => c.nombre === inicial?.categoria)?.id ??
      opciones.categorias[0]?.id ??
      "",
  );
  const [unidad, setUnidad] = useState<UnidadDeProducto>(inicial?.unidad ?? "BOTELLA");
  // El dinero se teclea en soles y viaja en céntimos: entero de punta a punta,
  // y solo se divide al pintarlo.
  // El dinero llega en céntimos y se teclea en soles: se divide solo aquí.
  const [coste, setCoste] = useState(inicial ? String(inicial.costeCentimos / 100) : "");
  const [precio, setPrecio] = useState(inicial ? String(inicial.precioCentimos / 100) : "");
  const [umbral, setUmbral] = useState(String(inicial?.alertaDeStock ?? 6));
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (guardando) return;

    setGuardando(true);
    setFallo(null);

    try {
      const datos = {
        nombre: nombre.trim(),
        categoriaId,
        unidad,
        costeCentimos: Math.round(Number(coste) * 100),
        precioCentimos: Math.round(Number(precio) * 100),
        alertaDeStock: Number(umbral),
        activo: true,
      };

      if (inicial) {
        await editarProducto(inicial.productoId, datos);
        alGuardar(datos.nombre + ": ficha actualizada.");
      } else {
        await crearProducto(datos);
        alGuardar("Producto dado de alta con cero unidades.");
      }
    } catch (e) {
      setFallo(e instanceof ErrorDeApi ? e.message : "No se pudo guardar el producto.");
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
            minLength={2}
            maxLength={120}
            autoFocus
            placeholder="Cerveza Cusqueña 330ml"
          />
        </label>

        <label>
          Categoría
          <select
            value={categoriaId}
            onChange={(e) => setCategoriaId(Number(e.target.value))}
            required
          >
            {opciones.categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>

        <label>
          Unidad
          <select
            value={unidad}
            onChange={(e) => setUnidad(e.target.value as UnidadDeProducto)}
            required
          >
            {opciones.unidades.map((u) => (
              <option key={u} value={u}>
                {NOMBRE_DE_UNIDAD[u]}
              </option>
            ))}
          </select>
        </label>

        <label>
          Coste (S/)
          <input
            type="number"
            min="0"
            step="0.10"
            value={coste}
            onChange={(e) => setCoste(e.target.value)}
            required
          />
        </label>

        <label>
          Precio (S/)
          <input
            type="number"
            min="0"
            step="0.10"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            required
          />
        </label>

        <label>
          Umbral de reposición
          <input
            type="number"
            min="0"
            value={umbral}
            onChange={(e) => setUmbral(e.target.value)}
            required
          />
        </label>
      </div>

      {/*
        Decirlo aquí evita que alguien busque el campo de existencias: el alta
        no lo tiene a propósito, porque mercancía sin un movimiento que la
        explique deja el histórico descuadrado desde el primer día. Al editar el
        aviso sobra, y en su lugar se dice lo que no se toca.
      */}
      <p className="campo__pista">
        {inicial
          ? "El código de almacén y las existencias no se tocan desde aquí: el stock solo lo mueven los movimientos."
          : "El producto nace con cero unidades y su código de almacén se genera solo. Para meter mercancía, regístrala como compra desde el botón «Mover»."}
      </p>

      <div className="tipo-form__acciones">
        <button type="button" onClick={alCancelar}>
          Cancelar
        </button>
        <button type="submit" disabled={guardando}>
          {guardando ? "Guardando…" : inicial ? "Guardar cambios" : "Dar de alta"}
        </button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────

/** Compra, merma o ajuste sobre un producto concreto. */
export function MovimientoDeStock({
  linea,
  opciones,
  alMover,
  alCancelar,
}: {
  linea: LineaDeStock;
  opciones: OpcionesDeAlmacen;
  alMover: (mensaje: string) => void;
  alCancelar: () => void;
}) {
  const [tipo, setTipo] = useState<TipoDeMovimiento>("COMPRA");
  const [salaId, setSalaId] = useState(opciones.salas[0]?.id ?? "");
  const [unidades, setUnidades] = useState("");
  const [coste, setCoste] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  const esCompra = tipo === "COMPRA";
  const esAjuste = tipo === "AJUSTE";

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (guardando) return;

    setGuardando(true);
    setFallo(null);

    try {
      const hecho = await moverStock(linea.productoId, {
        tipo,
        salaId,
        unidades: Number(unidades),
        // El coste solo se manda en una compra: en una merma no se pagó nada.
        costeUnitarioCentimos: esCompra && coste ? Math.round(Number(coste) * 100) : null,
        nota: nota.trim(),
      });
      alMover(`${linea.producto}: quedan ${hecho.stockResultante}.`);
    } catch (e) {
      setFallo(e instanceof ErrorDeApi ? e.message : "No se pudo registrar el movimiento.");
      setGuardando(false);
    }
  }

  return (
    <form className="tipo-form" onSubmit={(e) => void enviar(e)}>
      {fallo && <p className="aviso aviso--error">{fallo}</p>}

      <div className="tipo-form__campos">
        <label>
          Movimiento
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoDeMovimiento)}
            required
          >
            {/* La venta no está en la lista: la escribe la barra al cobrar. */}
            {opciones.tiposDeMovimiento.map((t) => (
              <option key={t} value={t}>
                {NOMBRE_DE_MOVIMIENTO[t]}
              </option>
            ))}
          </select>
        </label>

        <label>
          Sala
          <select value={salaId} onChange={(e) => setSalaId(Number(e.target.value))} required>
            {opciones.salas.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </label>

        <label>
          Unidades
          <input
            type="number"
            /* Solo el ajuste admite negativo: en compra y merma el sentido lo
               pone el servidor, para no obligar a nadie a recordarlo. */
            min={esAjuste ? undefined : 1}
            value={unidades}
            onChange={(e) => setUnidades(e.target.value)}
            required
            autoFocus
          />
          <span className="campo__pista">
            {esCompra
              ? "Suma al stock."
              : esAjuste
                ? "Con signo: negativo si sobra en el sistema."
                : "Resta del stock."}
          </span>
        </label>

        {/* El coste solo aparece en una compra, porque solo ahí significa algo. */}
        {esCompra && (
          <label>
            Coste por unidad (S/)
            <input
              type="number"
              min="0"
              step="0.10"
              value={coste}
              onChange={(e) => setCoste(e.target.value)}
              placeholder="Opcional"
            />
            <span className="campo__pista">
              Si lo pones, pasa a ser el coste de referencia del producto.
            </span>
          </label>
        )}

        <label className="tipo-form__ancho">
          Nota
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            maxLength={200}
            placeholder="Nº de albarán, «se rompió una caja», «recuento del lunes»…"
          />
        </label>
      </div>

      <div className="tipo-form__acciones">
        <button type="button" onClick={alCancelar}>
          Cancelar
        </button>
        <button type="submit" disabled={guardando}>
          {guardando ? "Registrando…" : "Registrar"}
        </button>
      </div>
    </form>
  );
}
