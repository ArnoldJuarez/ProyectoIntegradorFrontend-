import { useState } from "react";
import {
  ErrorDeApi,
  anadirTipoDeEntrada,
  editarTipoDeEntrada,
  quitarTipoDeEntrada,
  soles,
  type FormularioDeTipo,
  type TipoDeEntrada,
} from "../api";

/**
 * Poner entradas a la venta en una noche.
 *
 * Vive dentro de la ficha del evento y no en una pantalla aparte porque no se
 * entiende sin ella: cuántas entradas caben depende del aforo de la sala, y
 * cuántas se pueden quitar depende de cuántas se vendieron. Sacarlo a otra
 * página obligaría a repetir ese contexto o a decidir a ciegas.
 */
export function TiposDeEntrada({
  slug,
  tipos,
  aforoDeSala,
  alCambiar,
}: {
  slug: string;
  tipos: TipoDeEntrada[];
  aforoDeSala: number;
  /** Recarga la ficha: los totales de arriba cambian con cada operación. */
  alCambiar: () => void;
}) {
  /** Qué se está editando: el id de un tipo, "nuevo", o nada. */
  const [editando, setEditando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  const ofertadas = tipos.reduce((total, t) => total + t.cantidad, 0);
  const libre = aforoDeSala - ofertadas;

  async function quitar(tipo: TipoDeEntrada) {
    setFallo(null);
    setAviso(null);

    try {
      const hecho = await quitarTipoDeEntrada(tipo.id);
      // El mensaje importa: si tenía ventas no se borró, se retiró. Sin decirlo,
      // parece que el botón no funcionó.
      setAviso(hecho.mensaje);
      alCambiar();
    } catch (e) {
      setFallo(e instanceof ErrorDeApi ? e.message : "No se pudo quitar el tipo de entrada.");
    }
  }

  return (
    <>
      <header className="cabecera">
        <h2>Entradas</h2>
        <span className={libre < 0 ? "contador contador--alerta" : "contador"}>
          {ofertadas} de {aforoDeSala} de aforo
        </span>
      </header>

      {/*
        Las noches que vienen del sistema anterior ya ofertan más entradas que
        el aforo de la sala. Se avisa aquí en vez de esconderlo: el servidor no
        deja añadir más, pero lo que ya está mal hay que verlo para arreglarlo.
      */}
      {libre < 0 && (
        <p className="aviso aviso--error">
          Esta noche oferta {ofertadas} entradas en una sala de {aforoDeSala}. Hasta que no baje
          el cupo de algún tipo no se pueden añadir más.
        </p>
      )}

      {aviso && <p className="aviso">{aviso}</p>}
      {fallo && <p className="aviso aviso--error">{fallo}</p>}

      <div className="tabla-scroll">
        <table className="tabla">
          <thead>
            <tr>
              <th>Tipo</th>
              <th className="num">Precio</th>
              <th className="num">Vendidas</th>
              <th className="num">Quedan</th>
              <th>Venta</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {tipos.map((t) =>
              editando === t.id ? (
                <tr key={t.id}>
                  <td colSpan={6}>
                    <FormularioTipo
                      inicial={t}
                      /* El tope de un tipo que se edita es lo que queda libre
                         más lo que él mismo ya ocupa: si no, subir de 100 a 101
                         parecería imposible. */
                      tope={libre + t.cantidad}
                      vendidas={t.vendidas}
                      alGuardar={async (datos) => {
                        await editarTipoDeEntrada(t.id, datos);
                        setEditando(null);
                        alCambiar();
                      }}
                      alCancelar={() => setEditando(null)}
                    />
                  </td>
                </tr>
              ) : (
                <tr key={t.id}>
                  <td>
                    {t.nombre}
                    {t.descripcion && <span className="sutil"> · {t.descripcion}</span>}
                  </td>
                  <td className="num precio">{soles(t.precioCentimos)}</td>
                  <td className="num">
                    {t.vendidas} / {t.cantidad}
                  </td>
                  <td className="num">{t.disponibles}</td>
                  <td>
                    <span className="etiqueta">{t.activo ? "Abierta" : "Cerrada"}</span>
                  </td>
                  <td className="acciones">
                    <button type="button" onClick={() => setEditando(t.id)}>
                      Editar
                    </button>
                    <button type="button" onClick={() => void quitar(t)}>
                      {/* Se dice lo que va a pasar de verdad, no «Borrar» a
                          secas: con ventas se retira, sin ventas se borra. */}
                      {t.vendidas > 0 ? "Retirar" : "Borrar"}
                    </button>
                  </td>
                </tr>
              ),
            )}

            {editando === "nuevo" && (
              <tr>
                <td colSpan={6}>
                  <FormularioTipo
                    tope={libre}
                    vendidas={0}
                    alGuardar={async (datos) => {
                      await anadirTipoDeEntrada(slug, datos);
                      setEditando(null);
                      alCambiar();
                    }}
                    alCancelar={() => setEditando(null)}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editando === null && (
        <button type="button" className="boton-secundario" onClick={() => setEditando("nuevo")}>
          Añadir tipo de entrada
        </button>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────

/** El formulario de un tipo, en línea dentro de la tabla. */
function FormularioTipo({
  inicial,
  tope,
  vendidas,
  alGuardar,
  alCancelar,
}: {
  inicial?: TipoDeEntrada;
  /** Cuántas entradas caben todavía. Solo informativo: manda el servidor. */
  tope: number;
  vendidas: number;
  alGuardar: (datos: FormularioDeTipo) => Promise<void>;
  alCancelar: () => void;
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? "");
  // El precio se teclea en soles y viaja en céntimos: el dinero es entero de
  // punta a punta y solo se divide al pintarlo.
  const [precio, setPrecio] = useState(
    inicial ? String(inicial.precioCentimos / 100) : "",
  );
  const [cantidad, setCantidad] = useState(inicial ? String(inicial.cantidad) : "");
  const [maximo, setMaximo] = useState(String(inicial?.maxPorPedido ?? 6));
  const [consumiciones, setConsumiciones] = useState(
    String(inicial?.consumicionesIncluidas ?? 0),
  );
  const [activo, setActivo] = useState(inicial?.activo ?? true);
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (guardando) return;

    setGuardando(true);
    setFallo(null);

    try {
      await alGuardar({
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        precioCentimos: Math.round(Number(precio) * 100),
        cantidad: Number(cantidad),
        maximoPorPedido: Number(maximo),
        consumicionesIncluidas: Number(consumiciones),
        activo,
      });
    } catch (e) {
      setFallo(e instanceof ErrorDeApi ? e.message : "No se pudo guardar el tipo de entrada.");
      setGuardando(false);
    }
  }

  return (
    <form className="tipo-form" onSubmit={(e) => void enviar(e)}>
      {fallo && <p className="aviso aviso--error">{fallo}</p>}

      <div className="tipo-form__campos">
        <label>
          Nombre
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            minLength={2}
            maxLength={60}
            autoFocus
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
          Cupo
          <input
            type="number"
            min={Math.max(vendidas, 1)}
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            required
          />
          <span className="campo__pista">
            {vendidas > 0 && `Ya se vendieron ${vendidas}. `}
            {tope > 0 ? `Caben ${tope} más.` : "No queda aforo libre."}
          </span>
        </label>

        <label>
          Máx. por pedido
          <input
            type="number"
            min={1}
            max={20}
            value={maximo}
            onChange={(e) => setMaximo(e.target.value)}
            required
          />
        </label>

        <label>
          Consumiciones
          <input
            type="number"
            min={0}
            max={10}
            value={consumiciones}
            onChange={(e) => setConsumiciones(e.target.value)}
            required
          />
        </label>

        <label className="tipo-form__ancho">
          Descripción
          <input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            maxLength={300}
          />
        </label>

        <label className="tipo-form__casilla">
          <input
            type="checkbox"
            checked={activo}
            onChange={(e) => setActivo(e.target.checked)}
          />
          A la venta
        </label>
      </div>

      <div className="tipo-form__acciones">
        <button type="button" onClick={alCancelar}>
          Cancelar
        </button>
        <button type="submit" disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}
