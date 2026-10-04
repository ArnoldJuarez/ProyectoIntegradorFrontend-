import { Suspense, lazy, useMemo, useState } from "react";
import { ErrorDeApi, guardarLocal } from "../api";
import { Plano2D } from "./plano-2d";
import {
  formatearTiempo,
  simularEvacuacion,
  type PuertaPlano,
  type TipoZona,
  type ZonaPlano,
} from "./evacuacion";

/**
 * El motor 3D, cargado aparte.
 *
 * Three.js ocupa más de un megabyte. Con `lazy` queda fuera del paquete
 * inicial: quien solo mira el plano no lo descarga.
 */
const Escena3D = lazy(() => import("./escena-3d").then((m) => ({ default: m.Escena3D })));

function Cargando3D() {
  return (
    <div className="flex h-full items-center justify-center border border-line bg-surface">
      <p className="text-sm text-muted">Cargando la vista 3D…</p>
    </div>
  );
}

export type SalaEditable = {
  id: string;
  nombre: string;
  aforo: number;
  planoAncho: number;
  planoFondo: number;
  zonas: ZonaPlano[];
  puertas: PuertaPlano[];
};

type Vista = "plano" | "3d";

export function EditorLocal({
  salas,
  alGuardar,
}: {
  salas: SalaEditable[];
  /** Tras guardar, para que la pantalla vuelva a pedir el local y quede limpio. */
  alGuardar: () => void;
}) {
  const [salaId, setSalaId] = useState(salas[0]?.id ?? "");
  const [vista, setVista] = useState<Vista>("plano");
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El estado vive aquí y no en el servidor mientras se edita: mover una zona
  // debe repintar el plano al instante, no esperar a una ida y vuelta.
  const [borrador, setBorrador] = useState<SalaEditable[]>(salas);
  const sala = borrador.find((s) => s.id === salaId) ?? borrador[0];

  const [ocupacion, setOcupacion] = useState(sala?.aforo ?? 0);

  const evacuacion = useMemo(
    () => (sala ? simularEvacuacion(sala.zonas, sala.puertas, ocupacion) : null),
    [sala, ocupacion],
  );

  if (!sala) {
    return (
      <div className="border border-dashed border-line-strong p-6">
        <p className="text-sm text-ink-soft">No hay ninguna sala creada todavía.</p>
      </div>
    );
  }

  function actualizarSala(cambios: Partial<SalaEditable>) {
    setBorrador((prev) => prev.map((s) => (s.id === sala.id ? { ...s, ...cambios } : s)));
  }

  function actualizarZona(id: string, cambios: Partial<ZonaPlano>) {
    actualizarSala({ zonas: sala.zonas.map((z) => (z.id === id ? { ...z, ...cambios } : z)) });
  }

  function actualizarPuerta(id: string, cambios: Partial<PuertaPlano>) {
    actualizarSala({ puertas: sala.puertas.map((p) => (p.id === id ? { ...p, ...cambios } : p)) });
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      await guardarLocal({
        salaId: sala.id,
        planoAncho: sala.planoAncho,
        planoFondo: sala.planoFondo,
        zonas: sala.zonas,
        puertas: sala.puertas,
      });
      alGuardar();
    } catch (e) {
      setError(e instanceof ErrorDeApi ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  const zonaActiva = sala.zonas.find((z) => z.id === seleccion) ?? null;
  const cambiado = JSON.stringify(sala) !== JSON.stringify(salas.find((s) => s.id === sala.id));

  return (
    <div className="flex flex-col gap-5">
      {/* ---- barra: sala, vista y guardado ---- */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={salaId}
          onChange={(e) => {
            setSalaId(e.target.value);
            setSeleccion(null);
            const nueva = borrador.find((s) => s.id === e.target.value);
            if (nueva) setOcupacion(nueva.aforo);
          }}
          className="eyebrow border border-line bg-surface px-3 py-2.5"
        >
          {borrador.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>

        <div className="flex border border-line bg-raised p-[3px]">
          {(["plano", "3d"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVista(v)}
              className={` px-4 py-1 text-xs font-semibold transition ${
 vista === v ? "bg-surface text-ink" : "text-muted hover:text-ink-soft"
              }`}
            >
              {v === "plano" ? "Plano" : "3D"}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {cambiado && (
            <span className="eyebrow flex items-center gap-2 text-acento-text">
              <span className="latir inline-block h-1.5 w-1.5 bg-acento" />
              Cambios sin guardar
            </span>
          )}
          <button
            type="button"
            onClick={guardar}
            disabled={guardando || !cambiado}
            className="eyebrow bg-acento px-5 py-2.5 text-on-acento transition hover:brightness-110 disabled:opacity-40"
          >
            {guardando ? "Guardando…" : "Guardar el local"}
          </button>
        </div>
      </div>

      {error && <p className="border border-bad bg-bad-wash px-4 py-2 text-sm text-bad">{error}</p>}

      <div className="grid gap-5 xl:grid-cols-[1fr_20rem]">
        <div className="min-h-[26rem]">
          {vista === "plano" ? (
            <Plano2D
              planoAncho={sala.planoAncho}
              planoFondo={sala.planoFondo}
              zonas={sala.zonas}
              puertas={sala.puertas}
              seleccion={seleccion}
              onSelectZona={setSeleccion}
              evacuacion={evacuacion}
            />
          ) : (
            <div className="h-[34rem]">
              <Suspense fallback={<Cargando3D />}>
                <Escena3D
                  datos={{
                    nombre: sala.nombre,
                    planoAncho: sala.planoAncho,
                    planoFondo: sala.planoFondo,
                    zonas: sala.zonas,
                    puertas: sala.puertas,
                  }}
                  zonaSeleccionada={seleccion}
                  onSelectZona={setSeleccion}
                />
              </Suspense>
            </div>
          )}
        </div>

        {/* ---- panel lateral: medidas y edición ---- */}
        <aside className="flex flex-col gap-4">
          <section className="border border-line bg-surface p-4">
            <h3 className="eyebrow mb-3 text-acento-text">Medidas de la sala</h3>
            <div className="grid grid-cols-2 gap-3">
              <Campo
                etiqueta="Ancho (m)"
                valor={sala.planoAncho}
                onChange={(v) => actualizarSala({ planoAncho: v })}
              />
              <Campo
                etiqueta="Fondo (m)"
                valor={sala.planoFondo}
                onChange={(v) => actualizarSala({ planoFondo: v })}
              />
            </div>
          </section>

          <section className="border border-line bg-surface p-4">
            <h3 className="eyebrow mb-3 text-acento-text">
              {zonaActiva ? `Zona · ${zonaActiva.nombre}` : `Zonas (${sala.zonas.length})`}{" "}
            </h3>

            {zonaActiva ? (
              <div className="flex flex-col gap-3">
                {/*
                  * Lo primero de la ficha, y no un detalle escondido abajo: de
                  * esto depende cómo se dibuja la zona en 3D y de qué color sale
                  * en el plano. Antes se deducía del nombre, así que renombrar
                  * una zona la cambiaba de aspecto sin avisar.
                  */}
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted">Tipo de zona</span>
                  <select
                    value={zonaActiva.tipo}
                    onChange={(e) =>
                      actualizarZona(zonaActiva.id, { tipo: e.target.value as TipoZona })
                    }
                    className="border border-line-strong bg-ground px-2 py-1.5 text-sm text-ink outline-none focus:border-acento"
                  >
                    <option value="PISTA">Pista de baile</option>
                    <option value="VIP">Reservados / VIP</option>
                    <option value="BARRA">Barra</option>
                    <option value="OTRA">Otra</option>
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <Campo
                    etiqueta="X (m)"
                    valor={zonaActiva.x}
                    onChange={(v) => actualizarZona(zonaActiva.id, { x: v })}
                  />
                  <Campo
                    etiqueta="Y (m)"
                    valor={zonaActiva.y}
                    onChange={(v) => actualizarZona(zonaActiva.id, { y: v })}
                  />
                  <Campo
                    etiqueta="Ancho (m)"
                    valor={zonaActiva.ancho}
                    onChange={(v) => actualizarZona(zonaActiva.id, { ancho: v })}
                  />
                  <Campo
                    etiqueta="Fondo (m)"
                    valor={zonaActiva.fondo}
                    onChange={(v) => actualizarZona(zonaActiva.id, { fondo: v })}
                  />
                  <Campo
                    etiqueta="Altura (m)"
                    valor={zonaActiva.alto}
                    onChange={(v) => actualizarZona(zonaActiva.id, { alto: v })}
                  />
                  <Campo
                    etiqueta="Aforo"
                    valor={zonaActiva.aforo}
                    entero
                    onChange={(v) => actualizarZona(zonaActiva.id, { aforo: v })}
                  />
                </div>
                <p className="text-xs text-muted">
                  Superficie {(zonaActiva.ancho * zonaActiva.fondo).toFixed(0)} m² ·{" "}
                  {zonaActiva.aforo > 0 && zonaActiva.ancho * zonaActiva.fondo > 0
                    ? `${(zonaActiva.aforo / (zonaActiva.ancho * zonaActiva.fondo)).toFixed(1)} pers/m²`
                    : "sin densidad"}
                </p>
                <button
                  type="button"
                  onClick={() => setSeleccion(null)}
                  className="self-start text-xs text-acento-text hover:brightness-110"
                >
                  ← Ver todas las zonas
                </button>
              </div>
            ) : (
              <ul className="flex flex-col gap-1">
                {sala.zonas.map((z) => (
                  <li key={z.id}>
                    <button
                      type="button"
                      onClick={() => setSeleccion(z.id)}
                      className="flex w-full items-baseline justify-between gap-2 px-2 py-1.5 text-left text-sm transition hover:bg-raised"
                    >
                      <span>{z.nombre}</span>
                      <span className="tnum text-xs text-muted">
                        {z.ancho}×{z.fondo} m
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="border border-line bg-surface p-4">
            <h3 className="eyebrow mb-3 text-acento-text">Puertas y salidas</h3>
            <ul className="flex flex-col gap-3">
              {sala.puertas.map((p) => (
                <li key={p.id} className="border-b border-line pb-3 last:border-0 last:pb-0">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-sm">{p.nombre}</span>
                    <label className="flex items-center gap-1.5 text-xs text-muted">
                      <input
                        type="checkbox"
                        checked={p.esSalidaEmergencia}
                        onChange={(e) =>
                          actualizarPuerta(p.id, { esSalidaEmergencia: e.target.checked })
                        }
                        className="accent-good"
                      />
                      Salida
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Campo
                      etiqueta="X"
                      valor={p.x}
                      onChange={(v) => actualizarPuerta(p.id, { x: v })}
                    />
                    <Campo
                      etiqueta="Y"
                      valor={p.y}
                      onChange={(v) => actualizarPuerta(p.id, { y: v })}
                    />
                    <Campo
                      etiqueta="Ancho"
                      valor={p.ancho}
                      onChange={(v) => actualizarPuerta(p.id, { ancho: v })}
                    />
                  </div>
                  <Campo
                    etiqueta="Caudal (pers/min)"
                    valor={p.caudalPorMinuto}
                    entero
                    onChange={(v) => actualizarPuerta(p.id, { caudalPorMinuto: v })}
                  />
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      {/* ---- simulación ---- */}
      <section className="border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-3.5">
          <h2 className="font-display text-xl font-black uppercase">Simulación de evacuación</h2>
          <label className="flex items-center gap-3 text-sm">
            <span className="eyebrow text-muted">Personas dentro</span>
            <input
              type="range"
              min={0}
              max={Math.max(sala.aforo, 100)}
              step={10}
              value={ocupacion}
              onChange={(e) => setOcupacion(Number(e.target.value))}
              className="w-40 accent-[color:var(--color-acento)]"
            />
            <span className="tnum w-12 text-right font-semibold">{ocupacion}</span>
          </label>
        </div>

        {evacuacion && Number.isFinite(evacuacion.segundos) ? (
          <div className="p-5">
            <div className="mb-5 flex flex-wrap items-end gap-6">
              <div>
                <p className="eyebrow text-muted">Tiempo de evacuación</p>
                <p className="tnum font-display text-6xl leading-none font-black text-acento-text">
                  {formatearTiempo(evacuacion.segundos)}
                </p>
              </div>
              <p className="max-w-md text-sm text-ink-soft">
                Lo marca la salida que más tarda en vaciar su cola. Cambia el ancho o el caudal de
                esa puerta y verás bajar el número.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {evacuacion.porPuerta.map((p) => {
                const critica = p.segundos === evacuacion.segundos;
                return (
                  <div
                    key={p.puerta.id}
                    className={` border p-4 ${critica ? "border-bad bg-bad-wash" : "border-line bg-raised"}`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold">{p.puerta.nombre}</span>
                      {critica && (
                        <span className="text-xs font-semibold text-bad">cuello de botella</span>
                      )}
                    </div>
                    <p className="tnum mt-1 text-sm text-ink-soft">
                      {p.personas} personas · {p.caudal}/min · {formatearTiempo(p.segundos)}
                    </p>
                  </div>
                );
              })}
            </div>

            {evacuacion.avisos.length > 0 && (
              <ul className="mt-4 flex flex-col gap-1.5">
                {evacuacion.avisos.map((aviso) => (
                  <li key={aviso} className="text-sm text-muted">
                    · {aviso}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="m-5 border border-dashed border-line-strong p-6">
            <p className="text-sm text-ink-soft">
              {evacuacion?.avisos[0] ?? "No se puede calcular la evacuación todavía."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function Campo({
  etiqueta,
  valor,
  onChange,
  entero = false,
}: {
  etiqueta: string;
  valor: number;
  onChange: (valor: number) => void;
  entero?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted">{etiqueta}</span>
      <input
        type="number"
        min={0}
        step={entero ? 1 : 0.5}
        value={valor}
        onChange={(e) => {
          const v = Number(e.target.value);
          onChange(Number.isFinite(v) && v >= 0 ? (entero ? Math.round(v) : v) : 0);
        }}
        className="tnum w-full border border-line bg-ground px-2 py-1.5 text-sm outline-none transition focus:border-acento"
      />
    </label>
  );
}
