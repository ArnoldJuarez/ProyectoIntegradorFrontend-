import { Suspense, lazy, useMemo, useState } from "react";
import { toast } from "sonner";
import { ErrorDeApi, guardarLocal } from "../api";
import { Plano2D } from "./plano-2d";
import {
  NOMBRE_DE_ELEMENTO,
  type ElementoPlano,
  type PuertaPlano,
  type TipoDeElemento,
  type TipoZona,
  type ZonaPlano,
} from "./evacuacion";
import { SimuladorDeEvacuacion } from "./simulador/SimuladorDeEvacuacion";

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
  elementos: ElementoPlano[];
};

type Vista = "plano" | "3d";

const NOMBRE_DE_PLANTA: Record<number, string> = { 0: "Planta baja", 1: "Planta alta" };

function nombreDePlanta(piso: number): string {
  return NOMBRE_DE_PLANTA[piso] ?? `Planta ${piso}`;
}

export function EditorLocal({
  salas,
  alGuardar,
}: {
  salas: SalaEditable[];
  /** Tras guardar, para que la pantalla vuelva a pedir el local y quede limpio. */
  alGuardar: () => void;
}) {
  const [salaId, setSalaId] = useState(salas[0]?.id ?? "");
  const [vista, setVista] = useState<Vista>("3d");
  // El plano 2D se dibuja planta a planta: superpuestas, el balcón taparía la
  // pista que tiene debajo y no se podría editar ninguna de las dos.
  const [planta, setPlanta] = useState(0);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El estado vive aquí y no en el servidor mientras se edita: mover una zona
  // debe repintar el plano al instante, no esperar a una ida y vuelta.
  const [borrador, setBorrador] = useState<SalaEditable[]>(salas);
  const sala = borrador.find((s) => s.id === salaId) ?? borrador[0];

  // El plano que recibe el simulador: estable mientras no cambie la sala, para
  // no recalcular la evacuación en cada render.
  const plano = useMemo(
    () =>
      sala
        ? { ancho: sala.planoAncho, fondo: sala.planoFondo, zonas: sala.zonas, puertas: sala.puertas, elementos: sala.elementos }
        : null,
    [sala],
  );

  if (!sala) {
    return (
      <div className="rounded-xl border border-dashed border-line-strong p-6">
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

  // Los elementos nuevos no tienen id hasta guardarlos: se identifican por su posición en la lista.
  function actualizarElemento(i: number, cambios: Partial<ElementoPlano>) {
    actualizarSala({ elementos: sala.elementos.map((e, k) => (k === i ? { ...e, ...cambios } : e)) });
  }

  function anadirElemento(tipo: TipoDeElemento) {
    const fuera = tipo === "PUNTO_REUNION";
    actualizarSala({
      elementos: [
        ...sala.elementos,
        {
          id: "",
          tipo,
          nombre: NOMBRE_DE_ELEMENTO[tipo],
          piso: fuera ? 0 : planta,
          x: Math.round(sala.planoAncho / 2),
          // El punto de reunión nace en la calle, a seis metros de la fachada.
          y: fuera ? sala.planoFondo + 6 : Math.round(sala.planoFondo / 2),
        },
      ],
    });
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
        elementos: sala.elementos,
      });
      toast.success(`Plano de ${sala.nombre} guardado`);
      alGuardar();
    } catch (e) {
      setError(e instanceof ErrorDeApi ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  const zonaActiva = sala.zonas.find((z) => z.id === seleccion) ?? null;
  const plantas = [...new Set([0, ...sala.zonas.map((z) => z.piso ?? 0), ...sala.puertas.map((p) => p.piso ?? 0)])].sort();
  const zonasDeLaPlanta = sala.zonas.filter((z) => (z.piso ?? 0) === planta);
  const puertasDeLaPlanta = sala.puertas.filter((p) => (p.piso ?? 0) === planta);
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
          }}
          className="h-10 rounded-lg border border-line bg-surface px-3 text-sm font-medium"
        >
          {borrador.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>

        <div className="flex rounded-xl border border-line bg-ground p-1">
          {(["plano", "3d"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVista(v)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors duration-150 ${
 vista === v ? "bg-raised text-ink shadow-sm" : "text-muted hover:text-ink-soft"
              }`}
            >
              {v === "plano" ? "Plano" : "3D"}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {cambiado && (
            <span className="eyebrow flex items-center gap-2 text-acento-text">
              <span className="latir inline-block size-1.5 rounded-full bg-acento-text" />
              Cambios sin guardar
            </span>
          )}
          <button
            type="button"
            onClick={guardar}
            disabled={guardando || !cambiado}
            className="h-10 rounded-lg bg-acento px-5 text-sm font-semibold text-on-acento transition-[transform,filter,opacity] duration-150 hover:brightness-110 disabled:opacity-40"
          >
            {guardando ? "Guardando…" : "Guardar el local"}
          </button>
        </div>
      </div>

      {error && <p className="rounded-xl border border-alarma-dim bg-bad-wash px-4 py-2.5 text-sm text-bad">{error}</p>}

      <div className="grid gap-5 xl:grid-cols-[1fr_20rem]">
        <div className="min-h-[26rem]">
          {vista === "plano" ? (
            <div className="flex flex-col gap-3">
              {plantas.length > 1 && (
                <div className="flex w-fit rounded-xl border border-line bg-ground p-1">
                  {plantas.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPlanta(p)}
                      className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors duration-150 ${
                        planta === p ? "bg-raised text-ink shadow-sm" : "text-muted hover:text-ink-soft"
                      }`}
                    >
                      {nombreDePlanta(p)}
                    </button>
                  ))}
                </div>
              )}
              <Plano2D
                planoAncho={sala.planoAncho}
                planoFondo={sala.planoFondo}
                zonas={zonasDeLaPlanta}
                puertas={puertasDeLaPlanta}
                seleccion={seleccion}
                onSelectZona={setSeleccion}
              />
            </div>
          ) : (
            <div className="h-[44rem]">
              <Suspense fallback={<Cargando3D />}>
                <Escena3D
                  datos={{
                    nombre: sala.nombre,
                    planoAncho: sala.planoAncho,
                    planoFondo: sala.planoFondo,
                    zonas: sala.zonas,
                    puertas: sala.puertas,
                    elementos: sala.elementos,
                    aforo: sala.aforo,
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
          <section className="rounded-2xl border border-line bg-surface p-4">
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

          <section className="rounded-2xl border border-line bg-surface p-4">
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
                  <span className="text-xs text-muted">Planta</span>
                  <select
                    value={zonaActiva.piso ?? 0}
                    onChange={(e) => {
                      actualizarZona(zonaActiva.id, { piso: Number(e.target.value) });
                      setPlanta(Number(e.target.value));
                    }}
                    className="h-9 rounded-lg border border-line bg-ground px-2 text-sm text-ink outline-none transition-colors duration-150 focus:border-acento-text"
                  >
                    <option value={0}>Planta baja</option>
                    <option value={1}>Planta alta</option>
                  </select>
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted">Tipo de zona</span>
                  <select
                    value={zonaActiva.tipo}
                    onChange={(e) =>
                      actualizarZona(zonaActiva.id, { tipo: e.target.value as TipoZona })
                    }
                    className="h-9 rounded-lg border border-line bg-ground px-2 text-sm text-ink outline-none transition-colors duration-150 focus:border-acento-text"
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
                {[...sala.zonas].sort((a, b) => (a.piso ?? 0) - (b.piso ?? 0)).map((z, i, todas) => (
                  <li key={z.id}>
                    {(i === 0 || (todas[i - 1].piso ?? 0) !== (z.piso ?? 0)) && (
                      <p className="eyebrow mt-2 mb-1 px-2.5 text-muted">{nombreDePlanta(z.piso ?? 0)}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setSeleccion(z.id);
                        setPlanta(z.piso ?? 0);
                      }}
                      className="flex w-full items-baseline justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors duration-150 hover:bg-raised"
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

          <section className="rounded-2xl border border-line bg-surface p-4">
            <h3 className="eyebrow mb-3 text-acento-text">Puertas y salidas</h3>
            <ul className="flex flex-col gap-3">
              {sala.puertas.map((p) => (
                <li key={p.id} className="border-b border-line pb-3 last:border-0 last:pb-0">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-sm">
                      {p.nombre}
                      <span className="text-xs text-muted"> · {nombreDePlanta(p.piso ?? 0)}</span>
                    </span>
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

          <section className="rounded-2xl border border-line bg-surface p-4">
            <h3 className="eyebrow mb-3 text-acento-text">Seguridad ({sala.elementos.length})</h3>
            <p className="mb-3 text-xs text-muted">
              Extintores, botiquín, luces, alarmas, zonas seguras y punto de reunión. El punto de reunión va fuera: su Y
              puede pasar del fondo de la sala (la calle).
            </p>
            <select
              value=""
              onChange={(e) => e.target.value && anadirElemento(e.target.value as TipoDeElemento)}
              className="mb-3 h-9 w-full rounded-lg border border-line bg-ground px-2 text-sm text-ink"
              aria-label="Añadir un elemento de seguridad"
            >
              <option value="">+ Añadir en la {planta === 0 ? "planta baja" : "planta alta"}…</option>
              {(Object.keys(NOMBRE_DE_ELEMENTO) as TipoDeElemento[]).map((t) => (
                <option key={t} value={t}>
                  {NOMBRE_DE_ELEMENTO[t]}
                </option>
              ))}
            </select>
            <ul className="flex max-h-[28rem] flex-col gap-3 overflow-y-auto pr-1">
              {sala.elementos.map((el, i) => (
                <li key={el.id || `nuevo-${i}`} className="border-b border-line pb-3 last:border-0 last:pb-0">
                  <div className="mb-2 flex items-center gap-2">
                    <input
                      value={el.nombre}
                      onChange={(e) => actualizarElemento(i, { nombre: e.target.value })}
                      maxLength={80}
                      className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-ground px-2 text-sm"
                      aria-label="Nombre del elemento"
                    />
                    <button
                      type="button"
                      onClick={() => actualizarSala({ elementos: sala.elementos.filter((_, k) => k !== i) })}
                      className="text-xs text-bad hover:brightness-110"
                    >
                      Quitar
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <label className="col-span-2 flex flex-col gap-1">
                      <span className="text-xs text-muted">Tipo</span>
                      <select
                        value={el.tipo}
                        onChange={(e) => actualizarElemento(i, { tipo: e.target.value as TipoDeElemento })}
                        className="h-9 rounded-lg border border-line bg-ground px-1 text-xs text-ink"
                      >
                        {(Object.keys(NOMBRE_DE_ELEMENTO) as TipoDeElemento[]).map((t) => (
                          <option key={t} value={t}>
                            {NOMBRE_DE_ELEMENTO[t]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="col-span-2 flex flex-col gap-1">
                      <span className="text-xs text-muted">Planta</span>
                      <select
                        value={el.piso}
                        onChange={(e) => actualizarElemento(i, { piso: Number(e.target.value) })}
                        className="h-9 rounded-lg border border-line bg-ground px-1 text-xs text-ink"
                      >
                        <option value={0}>Baja</option>
                        <option value={1}>Alta</option>
                      </select>
                    </label>
                    <div className="col-span-2">
                      <Campo etiqueta="X (m)" valor={el.x} onChange={(v) => actualizarElemento(i, { x: v })} />
                    </div>
                    <div className="col-span-2">
                      <Campo etiqueta="Y (m)" valor={el.y} onChange={(v) => actualizarElemento(i, { y: v })} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      {/* ---- simulación ---- */}
      <section className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-3.5">
          <h2 className="text-xl">Simulador de evacuación</h2>
          <p className="text-sm text-muted">
            Rutas reales (rodean paredes y bajan por la escalera), colas en cada salida e incendios. Usa el plano tal y
            como está en pantalla, aunque no lo hayas guardado.
          </p>
        </div>
        <div className="p-5">{plano && <SimuladorDeEvacuacion plano={plano} aforo={sala.aforo} modo="panel" />}</div>
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
        className="tnum h-9 w-full rounded-lg border border-line bg-ground px-2.5 text-base outline-none transition-colors duration-150 focus:border-acento-text"
      />
    </label>
  );
}
