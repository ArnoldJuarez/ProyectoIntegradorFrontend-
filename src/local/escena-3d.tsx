import { Billboard, Grid, OrbitControls, PointerLockControls, Stars, Text } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { ElementoPlano, PuertaPlano, ZonaPlano } from "./evacuacion";
import { tonoDeZona } from "./evacuacion";
import { AmbienteDeZona } from "./discoteca/ambientes";
import { ALTO_DEL_EDIFICIO, ALTURA_DE_PLANTA, COLOR, ambienteDe, caja, situarPuerta, type Ambiente, type Centro } from "./discoteca/comun";
import { Edificio } from "./discoteca/edificio";
import { ElementosEn3D, EvacuacionEn3D, RutasEn3D } from "./discoteca/evacuacion-3d";
import { formatearSegundos, type Incendio, type Simulacion } from "./simulador/motor";

/**
 * La discoteca en 3D.
 *
 * Dos vistas, porque responden a preguntas distintas:
 *
 * - **Ambiente** — el local como es: dos plantas, cada zona con su mobiliario y
 *   su luz (la pista con suelo LED y cabezales, La Cueva en rojo, la terraza con
 *   guirnaldas…), la fachada a la calle y el público. Es para enseñarlo y para
 *   entender cómo se vive cada rincón.
 * - **Esquema** — cajas translúcidas por zona, apiladas por planta, sobre una
 *   retícula de un metro. Es la herramienta: comparar superficies, ver qué hay
 *   encima de qué y seguir la evacuación.
 *
 * Y dos formas de moverse: **órbita**, para mirar desde fuera (los muros que dan
 * a la cámara se recortan solos), y **caminar**, a 1,70 m del suelo, para verlo
 * a la altura de un cliente, en la planta que se elija.
 *
 * Todo se dibuja a partir del plano guardado: mover una zona en el editor la
 * mueve aquí con sus muebles. Nada está modelado a mano.
 */

export type DatosEscena = {
  nombre: string;
  planoAncho: number;
  planoFondo: number;
  zonas: ZonaPlano[];
  puertas: PuertaPlano[];
  /** Extintores, zonas seguras, punto de reunión… Opcional: sin ellos no hay capa de seguridad. */
  elementos?: ElementoPlano[];
  /** Para cuánta gente simular la evacuación. */
  aforo?: number;
};

type Modo = "orbita" | "caminar";
type Vista = "ambiente" | "esquema";
type Plantas = "todas" | "baja" | "alta";

type Encuadre = {
  nombre: string;
  camara: [number, number, number];
  mira: [number, number, number];
  /** Qué plantas hay que ver para que no lo tape la de arriba. */
  plantas: Plantas;
};

// ── Esquema: cajas por zona ─────────────────────────────────────────

function colorZona(zona: ZonaPlano, resaltada: boolean): THREE.Color {
  const hue = tonoDeZona(zona) / 360;
  return new THREE.Color().setHSL(hue, resaltada ? 0.9 : 0.6, resaltada ? 0.6 : 0.45);
}

function ZonaEsquema({
  zona,
  centro,
  resaltada,
  onSelect,
}: {
  zona: ZonaPlano;
  centro: Centro;
  resaltada: boolean;
  onSelect?: (id: string) => void;
}) {
  const [encima, setEncima] = useState(false);
  const c = useMemo(() => caja(zona, centro), [zona, centro]);
  const alto = Math.max(zona.alto, 0.15);
  const activa = resaltada || encima;
  const color = useMemo(() => colorZona(zona, activa), [zona, activa]);
  const geometria = useMemo(() => new THREE.BoxGeometry(c.w, alto, c.d), [c.w, alto, c.d]);

  return (
    <group position={[c.cx, c.y0, c.cz]}>
      <mesh
        position={[0, alto / 2, 0]}
        onPointerOver={(e) => {
          e.stopPropagation();
          setEncima(true);
        }}
        onPointerOut={() => setEncima(false)}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(zona.id);
        }}
      >
        <boxGeometry args={[c.w, alto, c.d]} />
        <meshStandardMaterial color={color} transparent opacity={activa ? 0.5 : 0.24} roughness={0.75} depthWrite={false} />
      </mesh>
      <lineSegments position={[0, alto / 2, 0]}>
        <edgesGeometry args={[geometria]} />
        <lineBasicMaterial color={color} transparent opacity={0.95} />
      </lineSegments>
      <Billboard position={[0, Math.min(alto, 4) + 0.7, 0]}>
        <Text fontSize={0.7} color={activa ? COLOR.magenta : "#f2f2f0"} anchorX="center" anchorY="middle" outlineWidth={0.04} outlineColor="#000">
          {zona.nombre.toUpperCase()}
        </Text>
      </Billboard>
    </group>
  );
}

// ── Puertas y salidas ───────────────────────────────────────────────

function Puerta({ puerta, centro }: { puerta: PuertaPlano; centro: Centro }) {
  const { x, z, y0 } = situarPuerta(puerta, centro);
  const salida = puerta.esSalidaEmergencia;
  const color = salida ? "#3ee6a0" : "#f2f2f0";
  return (
    <group position={[x, y0, z]}>
      <mesh position={[0, 1.2, 0]}>
        <boxGeometry args={[Math.max(puerta.ancho, 0.8), 2.4, 0.08]} />
        <meshStandardMaterial color={salida ? "#0f3a2a" : "#1b1622"} metalness={0.4} roughness={0.5} transparent opacity={0.85} />
      </mesh>
      <Billboard position={[0, 2.95, 0]}>
        <mesh>
          <planeGeometry args={[salida ? 1.5 : 2.4, 0.42]} />
          <meshBasicMaterial color={salida ? "#0b5a3a" : "#120f18"} />
        </mesh>
        <Text position={[0, 0, 0.01]} fontSize={0.24} anchorX="center" anchorY="middle">
          {salida ? "SALIDA" : puerta.nombre.toUpperCase()}
          <meshBasicMaterial color={new THREE.Color(color).multiplyScalar(salida ? 2.4 : 1.4)} toneMapped={false} />
        </Text>
      </Billboard>
    </group>
  );
}

// ── Cámara ──────────────────────────────────────────────────────────

/**
 * Lleva la cámara a un encuadre con una transición suave. Mientras se mueve
 * sola se ignora el ratón; en cuanto llega, el control vuelve a quien mira.
 */
function Encuadrador({ destino }: { destino: Encuadre | null }) {
  const { camera, controls } = useThree();
  const viaje = useRef<{ desde: THREE.Vector3; hacia: THREE.Vector3; mDesde: THREE.Vector3; mHacia: THREE.Vector3; t: number } | null>(null);

  useEffect(() => {
    if (!destino) return;
    const orbita = controls as unknown as OrbitControlsImpl | null;
    viaje.current = {
      desde: camera.position.clone(),
      hacia: new THREE.Vector3(...destino.camara),
      mDesde: orbita?.target.clone() ?? new THREE.Vector3(),
      mHacia: new THREE.Vector3(...destino.mira),
      t: 0,
    };
  }, [destino, camera, controls]);

  useFrame((_, delta) => {
    const v = viaje.current;
    if (!v) return;
    const orbita = controls as unknown as OrbitControlsImpl | null;
    v.t = Math.min(1, v.t + delta / 1.1);
    const e = 1 - Math.pow(1 - v.t, 3);
    camera.position.lerpVectors(v.desde, v.hacia, e);
    if (orbita) {
      orbita.target.lerpVectors(v.mDesde, v.mHacia, e);
      orbita.update();
    } else {
      camera.lookAt(v.mHacia);
    }
    if (v.t >= 1) viaje.current = null;
  });

  return null;
}

/** El navegador puede retirar el contexto WebGL al dejar la pestaña en segundo plano. */
function VigilanteDeContexto({ alPerder, alRecuperar }: { alPerder: () => void; alRecuperar: () => void }) {
  const gl = useThree((estado) => estado.gl);

  useEffect(() => {
    const lienzo = gl.domElement;
    const perder = (evento: Event) => {
      evento.preventDefault();
      alPerder();
    };
    const recuperar = () => alRecuperar();
    lienzo.addEventListener("webglcontextlost", perder);
    lienzo.addEventListener("webglcontextrestored", recuperar);
    if (gl.getContext().isContextLost()) alPerder();
    const alVolver = () => {
      if (document.visibilityState === "visible" && gl.getContext().isContextLost()) alRecuperar();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      lienzo.removeEventListener("webglcontextlost", perder);
      lienzo.removeEventListener("webglcontextrestored", recuperar);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [gl, alPerder, alRecuperar]);

  return null;
}

/** Moverse con WASD a la altura de los ojos, en la planta elegida. */
function Caminante({ limites, piso }: { limites: { x: number; z: number }; piso: number }) {
  const { camera } = useThree();
  const teclas = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const abajo = (e: KeyboardEvent) => (teclas.current[e.code] = true);
    const arriba = (e: KeyboardEvent) => (teclas.current[e.code] = false);
    window.addEventListener("keydown", abajo);
    window.addEventListener("keyup", arriba);
    return () => {
      window.removeEventListener("keydown", abajo);
      window.removeEventListener("keyup", arriba);
    };
  }, []);

  useFrame((_, delta) => {
    const t = teclas.current;
    const velocidad = (t.ShiftLeft || t.ShiftRight ? 10 : 5) * delta;
    const frente = new THREE.Vector3();
    camera.getWorldDirection(frente);
    frente.y = 0;
    frente.normalize();
    const lado = new THREE.Vector3().crossVectors(frente, camera.up).normalize();

    if (t.KeyW || t.ArrowUp) camera.position.addScaledVector(frente, velocidad);
    if (t.KeyS || t.ArrowDown) camera.position.addScaledVector(frente, -velocidad);
    if (t.KeyD || t.ArrowRight) camera.position.addScaledVector(lado, velocidad);
    if (t.KeyA || t.ArrowLeft) camera.position.addScaledVector(lado, -velocidad);

    camera.position.y = THREE.MathUtils.lerp(camera.position.y, piso * ALTURA_DE_PLANTA + 1.7, Math.min(1, delta * 6));
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -limites.x, limites.x);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -limites.z, limites.z);
  });

  return null;
}

// ── Encuadres ───────────────────────────────────────────────────────

const NOMBRE_DE_ENCUADRE: Partial<Record<Ambiente, string>> = {
  pista: "Pista principal",
  cueva: "La Cueva",
  lounge: "Lounge VIP",
  terraza: "Terraza",
  barra: "Barra",
  cocteleria: "Coctelería",
  balcon: "Balcón",
};

/** Los encuadres que se ofrecen: el general, la fachada y uno por ambiente con carácter. */
function encuadresDe(datos: DatosEscena, centro: Centro): Encuadre[] {
  const d = Math.hypot(datos.planoAncho, datos.planoFondo);
  const lista: Encuadre[] = [
    { nombre: "Vista general", camara: [d * 0.55, d * 0.62, d * 0.75], mira: [0, 2, 0], plantas: "todas" },
    { nombre: "Fachada", camara: [-datos.planoAncho * 0.15, 4.5, centro.z + 16], mira: [0, 4.5, centro.z], plantas: "todas" },
  ];
  const altas = datos.zonas.filter((z) => (z.piso ?? 0) > 0).map((z) => caja(z, centro));
  const vistos = new Set<string>();
  for (const zona of datos.zonas) {
    const a = ambienteDe(zona, datos.zonas);
    const nombre = NOMBRE_DE_ENCUADRE[a];
    if (!nombre || vistos.has(nombre)) continue;
    vistos.add(nombre);
    const c = caja(zona, centro);
    const lejos = Math.max(c.w, c.d) * 0.75 + 5;
    // Desde el lado del público: del centro del local hacia la zona. Así se ve
    // la barra por delante y no por detrás de la pared, y los muros que quedan
    // entre la cámara y la sala se recortan solos. La pista, que está en el
    // centro, se mira desde la calle.
    const hacia = new THREE.Vector2(-c.cx, -c.cz);
    if (hacia.length() < 4) hacia.set(0.35, 1);
    hacia.normalize();
    const tapada = (zona.piso ?? 0) === 0 && altas.some((a) => a.x0 < c.x1 && a.x1 > c.x0 && a.z0 < c.z1 && a.z1 > c.z0);
    lista.push({
      nombre,
      camara: [c.cx + hacia.x * lejos * 0.9, c.y0 + lejos * 0.55, c.cz + hacia.y * lejos * 0.9],
      mira: [c.cx, c.y0 + 1.2, c.cz],
      plantas: tapada ? "baja" : "todas",
    });
  }
  return lista;
}

// ── La escena ───────────────────────────────────────────────────────

export function Escena3D({
  datos,
  zonaSeleccionada,
  onSelectZona,
  conEvacuacion = false,
}: {
  datos: DatosEscena;
  zonaSeleccionada?: string | null;
  onSelectZona?: (id: string) => void;
  /** Arrancar con la capa de evacuación visible (la web pública). */
  conEvacuacion?: boolean;
}) {
  const [modo, setModo] = useState<Modo>("orbita");
  const [vista, setVista] = useState<Vista>("ambiente");
  const [plantas, setPlantas] = useState<Plantas>("todas");
  const [conGente, setConGente] = useState(true);
  const [fiesta, setFiesta] = useState(true);
  const [nombres, setNombres] = useState(false);
  const [pisoCaminando, setPisoCaminando] = useState(0);
  const [destino, setDestino] = useState<Encuadre | null>(null);
  const [evacuacion, setEvacuacion] = useState(conEvacuacion);
  const [simulando, setSimulando] = useState(false);
  const [conIncendio, setConIncendio] = useState(false);
  const [marcador, setMarcador] = useState<{ t: number; fuera: number; total: number; fin: boolean } | null>(null);
  const elementos = useMemo(() => datos.elementos ?? [], [datos.elementos]);

  // El incendio de la simulación 3D empieza en la barra principal: es donde
  // hay fuego, alcohol y electricidad juntos. Si no hay barra, en la pista.
  const incendio = useMemo<Incendio | null>(() => {
    if (!conIncendio) return null;
    const barra =
      datos.zonas.find((z) => z.tipo === "BARRA" && (z.piso ?? 0) === 0) ?? datos.zonas.find((z) => z.tipo === "PISTA");
    if (!barra) return null;
    return { piso: barra.piso ?? 0, x: barra.x + barra.ancho / 2, y: barra.y + barra.fondo / 2, radio: 1.5, crece: 0.06, radioMaximo: 6 };
  }, [conIncendio, datos.zonas]);

  const avanzar = useCallback((s: Simulacion) => {
    setMarcador({ t: s.tiempo, fuera: s.fuera, total: s.personas.length, fin: s.terminada });
  }, []);

  const centro = useMemo(() => ({ x: datos.planoAncho / 2, z: datos.planoFondo / 2 }), [datos.planoAncho, datos.planoFondo]);
  const diagonal = Math.hypot(datos.planoAncho, datos.planoFondo) || 30;
  const hayPlantaAlta = datos.zonas.some((z) => (z.piso ?? 0) > 0);
  const encuadres = useMemo(() => encuadresDe(datos, centro), [datos, centro]);

  const verBaja = plantas !== "alta";
  const verAlta = plantas !== "baja";
  const zonasVisibles = datos.zonas.filter((z) => ((z.piso ?? 0) > 0 ? verAlta : verBaja));
  const puertasVisibles = datos.puertas.filter((p) => p.activo && ((p.piso ?? 0) > 0 ? verAlta : verBaja));

  const [generacion, setGeneracion] = useState(0);
  const [contextoPerdido, setContextoPerdido] = useState(false);
  const alPerder = useCallback(() => setContextoPerdido(true), []);
  const alRecuperar = useCallback(() => {
    setContextoPerdido(false);
    setGeneracion((n) => n + 1);
  }, []);

  // El lienzo a veces nace con tamaño 0 dentro de un contenedor que aún se está
  // maquetando: se le empuja un «resize» un par de cuadros después.
  useEffect(() => {
    let cuadro = 0;
    const empujar = () => window.dispatchEvent(new Event("resize"));
    cuadro = requestAnimationFrame(() => {
      empujar();
      cuadro = requestAnimationFrame(empujar);
    });
    const tarde = setTimeout(empujar, 250);
    return () => {
      cancelAnimationFrame(cuadro);
      clearTimeout(tarde);
    };
  }, [modo, generacion]);

  if (datos.planoAncho <= 0 || datos.planoFondo <= 0) {
    return (
      <div className="flex h-full items-center justify-center border border-dashed border-line-strong p-8 text-center">
        <p className="text-sm text-ink-soft">Esta sala no tiene medidas. Pon el ancho y el fondo en metros para poder verla en 3D.</p>
      </div>
    );
  }

  const boton = (activo: boolean) =>
    `eyebrow px-3 py-1 transition ${activo ? "bg-acento text-on-acento" : "text-muted hover:text-ink"}`;
  const grupo = "flex gap-1 border border-line bg-ground/85 p-[3px] backdrop-blur";

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-line" style={{ background: COLOR.noche }}>
      <div className="absolute left-3 right-3 top-3 z-10 flex flex-wrap gap-2">
        <div className={grupo}>
          {(["orbita", "caminar"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setModo(m)} className={boton(modo === m)}>
              {m === "orbita" ? "Órbita" : "Caminar"}
            </button>
          ))}
        </div>
        <div className={grupo}>
          {(["ambiente", "esquema"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setVista(v)} className={boton(vista === v)}>
              {v === "ambiente" ? "Ambiente" : "Esquema"}
            </button>
          ))}
        </div>
        {hayPlantaAlta && modo === "orbita" && (
          <div className={grupo}>
            {(["todas", "baja", "alta"] as const).map((p) => (
              <button key={p} type="button" onClick={() => setPlantas(p)} className={boton(plantas === p)}>
                {p === "todas" ? "Las 2 plantas" : p === "baja" ? "Planta baja" : "Planta alta"}
              </button>
            ))}
          </div>
        )}
        {vista === "ambiente" && (
          <div className={grupo}>
            <button
              type="button"
              onClick={() => {
                setEvacuacion((v) => !v);
                setSimulando(false);
              }}
              className={boton(evacuacion)}
              aria-pressed={evacuacion}
            >
              Evacuación
            </button>
            {evacuacion && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMarcador(null);
                    setSimulando((v) => !v);
                  }}
                  className={boton(simulando)}
                >
                  {simulando ? "■ Parar" : "▶ Evacuar"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConIncendio((v) => !v);
                    setMarcador(null);
                  }}
                  className={boton(conIncendio)}
                  aria-pressed={conIncendio}
                >
                  Con incendio
                </button>
              </>
            )}
          </div>
        )}
        {vista === "ambiente" && (
          <div className={grupo}>
            <button type="button" onClick={() => setConGente((v) => !v)} className={boton(conGente)} aria-pressed={conGente}>
              Gente
            </button>
            <button type="button" onClick={() => setFiesta((v) => !v)} className={boton(fiesta)} aria-pressed={fiesta}>
              Luces de fiesta
            </button>
            <button type="button" onClick={() => setNombres((v) => !v)} className={boton(nombres)} aria-pressed={nombres}>
              Nombres
            </button>
          </div>
        )}
        {modo === "orbita" && (
          <select
            className="eyebrow border border-line bg-ground/85 px-2 py-1 text-ink backdrop-blur"
            value=""
            onChange={(e) => {
              const elegido = encuadres.find((x) => x.nombre === e.target.value);
              if (elegido) {
                setDestino({ ...elegido });
                setPlantas(elegido.plantas);
              }
            }}
            aria-label="Ir a un encuadre"
          >
            <option value="" disabled>
              Ir a…
            </option>
            {encuadres.map((x) => (
              <option key={x.nombre} value={x.nombre}>
                {x.nombre}
              </option>
            ))}
          </select>
        )}
        {modo === "caminar" && hayPlantaAlta && (
          <div className={grupo}>
            <button type="button" onClick={() => setPisoCaminando((p) => (p === 0 ? 1 : 0))} className={boton(true)}>
              {pisoCaminando === 0 ? "Subir a la planta alta ↑" : "Bajar a la planta baja ↓"}
            </button>
          </div>
        )}
      </div>

      {contextoPerdido && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-ground/90 p-6 text-center backdrop-blur">
          <p className="font-display text-2xl font-black uppercase text-alarma">Se perdió la tarjeta gráfica</p>
          <p className="max-w-sm text-sm text-ink-soft">
            El navegador retiró el contexto 3D, normalmente al dejar la pestaña en segundo plano. Se recupera solo al volver; si
            no, vuelve a montarla aquí.
          </p>
          <button
            type="button"
            onClick={alRecuperar}
            className="eyebrow border border-line-strong px-4 py-2 text-ink transition hover:border-acento hover:text-acento-text"
          >
            Montar de nuevo
          </button>
        </div>
      )}

      {modo === "caminar" && (
        <p className="eyebrow absolute bottom-3 left-3 z-10 bg-ground/85 px-3 py-1.5 text-ink-soft backdrop-blur">
          Clic para mirar · WASD para moverte · Mayús para correr · Esc para salir
        </p>
      )}

      <Canvas
        key={`${modo}-${generacion}`}
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={
          modo === "orbita"
            ? { position: [diagonal * 0.55, diagonal * 0.62, diagonal * 0.75], fov: 45, near: 0.1, far: 600 }
            : { position: [0, 1.7 + pisoCaminando * ALTURA_DE_PLANTA, centro.z - 3], fov: 72, near: 0.05, far: 300 }
        }
        onPointerMissed={() => onSelectZona?.("")}
      >
        <color attach="background" args={[COLOR.noche]} />
        {vista === "ambiente" ? (
          <>
            {/* La noche: cielo con estrellas, un poco de humo y poca luz general. */}
            <fogExp2 attach="fog" args={[COLOR.noche, modo === "caminar" ? 0.03 : 0.006]} />
            <Stars radius={180} depth={60} count={2500} factor={4} saturation={0} fade speed={fiesta ? 0.6 : 0} />
            <hemisphereLight args={["#4a3870", "#0a0612", 0.85]} />
            <ambientLight intensity={0.12} />
            <directionalLight position={[20, 40, 30]} intensity={0.25} color="#8a7dff" />

            <Edificio
              ancho={datos.planoAncho}
              fondo={datos.planoFondo}
              zonas={datos.zonas}
              puertas={datos.puertas}
              centro={centro}
              plantas={{ baja: verBaja, alta: verAlta }}
              recortar={modo === "orbita"}
              conTecho={modo === "caminar"}
              animar={fiesta}
              conGente={conGente && !simulando}
            />
            {zonasVisibles.map((zona) => (
              <AmbienteDeZona
                key={zona.id}
                zona={zona}
                todas={datos.zonas}
                centro={centro}
                animar={fiesta}
                conGente={conGente && !simulando}
                recortar={modo === "orbita"}
              />
            ))}
            {nombres &&
              zonasVisibles.map((zona) => {
                const c = caja(zona, centro);
                return (
                  <Billboard key={`n-${zona.id}`} position={[c.cx, c.y0 + Math.min(c.h, 3.4) + 0.6, c.cz]}>
                    <Text
                      fontSize={0.62}
                      anchorX="center"
                      anchorY="middle"
                      outlineWidth={0.05}
                      outlineColor="#000"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectZona?.(zona.id);
                      }}
                    >
                      {zona.nombre.toUpperCase()}
                      <meshBasicMaterial color={zonaSeleccionada === zona.id ? COLOR.magenta : "#ffffff"} toneMapped={false} />
                    </Text>
                  </Billboard>
                );
              })}
            {puertasVisibles.map((p) => (
              <Puerta key={p.id} puerta={p} centro={centro} />
            ))}

            {evacuacion && (
              <>
                <RutasEn3D
                  ancho={datos.planoAncho}
                  fondo={datos.planoFondo}
                  zonas={datos.zonas}
                  puertas={datos.puertas}
                  centro={centro}
                  plantas={{ baja: verBaja, alta: verAlta }}
                />
                <ElementosEn3D elementos={elementos} centro={centro} plantas={{ baja: verBaja, alta: verAlta }} />
              </>
            )}
            {evacuacion && simulando && (
              <EvacuacionEn3D
                ancho={datos.planoAncho}
                fondo={datos.planoFondo}
                zonas={datos.zonas}
                puertas={datos.puertas}
                centro={centro}
                personas={Math.max(50, datos.aforo ?? 300)}
                incendio={incendio}
                velocidad={4}
                alAvanzar={avanzar}
              />
            )}

            <EffectComposer multisampling={0}>
              <Bloom mipmapBlur intensity={1.15} luminanceThreshold={0.55} luminanceSmoothing={0.25} />
              <Vignette eskil={false} offset={0.2} darkness={0.75} />
            </EffectComposer>
          </>
        ) : (
          <>
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 22, 8]} intensity={1} color={COLOR.magenta} />
            <directionalLight position={[-12, 8, -10]} intensity={0.4} color={COLOR.violeta} />
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
              <planeGeometry args={[datos.planoAncho, datos.planoFondo]} />
              <meshStandardMaterial color="#111" roughness={1} />
            </mesh>
            <Grid
              args={[datos.planoAncho, datos.planoFondo]}
              cellSize={1}
              cellThickness={0.5}
              cellColor="#2a2a2a"
              sectionSize={5}
              sectionThickness={1}
              sectionColor="#3d3d3d"
              fadeDistance={diagonal * 2.2}
              infiniteGrid={false}
              position={[0, 0.01, 0]}
            />
            {/* La losa de la planta alta, como un plano de referencia. */}
            {hayPlantaAlta && verAlta && (
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, ALTURA_DE_PLANTA - 0.01, 0]}>
                <planeGeometry args={[datos.planoAncho, datos.planoFondo]} />
                <meshBasicMaterial color={COLOR.violeta} transparent opacity={0.04} depthWrite={false} side={THREE.DoubleSide} />
              </mesh>
            )}
            {zonasVisibles.map((zona) => (
              <ZonaEsquema key={zona.id} zona={zona} centro={centro} resaltada={zonaSeleccionada === zona.id} onSelect={onSelectZona} />
            ))}
            {puertasVisibles.map((p) => (
              <Puerta key={p.id} puerta={p} centro={centro} />
            ))}
          </>
        )}

        <VigilanteDeContexto alPerder={alPerder} alRecuperar={alRecuperar} />

        {modo === "orbita" ? (
          <>
            <OrbitControls
              makeDefault
              enablePan
              target={[0, 2, 0]}
              minDistance={3}
              maxDistance={diagonal * 2.4}
              maxPolarAngle={Math.PI / 2.02}
            />
            <Encuadrador destino={destino} />
          </>
        ) : (
          <>
            <PointerLockControls makeDefault />
            <Caminante limites={{ x: centro.x - 0.5, z: centro.z - 0.5 }} piso={pisoCaminando} />
          </>
        )}
      </Canvas>

      {evacuacion && simulando && marcador && (
        <div className="pointer-events-none absolute bottom-12 left-3 z-10 border border-line bg-ground/85 px-3 py-2 backdrop-blur">
          <p className="eyebrow text-muted">{marcador.fin ? "Evacuación completa" : "Evacuando · ×4"}</p>
          <p className="font-display text-2xl text-ink">{formatearSegundos(marcador.t)}</p>
          <p className="text-xs text-ink-soft">
            {marcador.fuera} de {marcador.total} fuera{conIncendio ? " · incendio en la barra" : ""}
          </p>
        </div>
      )}

      <p className="eyebrow pointer-events-none absolute bottom-3 right-3 z-10 bg-ground/70 px-2 py-1 text-muted backdrop-blur">
        {datos.planoAncho} × {datos.planoFondo} m{hayPlantaAlta ? ` · 2 plantas · ${ALTO_DEL_EDIFICIO} m` : ""}
      </p>
    </div>
  );
}
