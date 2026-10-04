import { Grid, OrbitControls, PointerLockControls, Text } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { PuertaPlano, ZonaPlano } from "./evacuacion";
import { tonoDeZona } from "./evacuacion";
import { FocosDeSala, MobiliarioDeZona, Sala, altoDeSala } from "./ambiente-3d";

/**
 * Vista 3D del local.
 *
 * Dos modos, porque responden a dos preguntas distintas:
 *
 * - **Órbita** — mirar el local desde fuera. Para entender la planta: dónde está
 *   cada zona, por dónde se sale, qué queda lejos de qué.
 * - **Caminar** — cámara a 1,70 m con el ratón capturado. Para lo otro: ver el
 *   sitio a la altura a la que lo ve un cliente. Un plano cenital no transmite
 *   que el techo de la pista está a 5,5 m y el del altillo a 3.
 *
 * Se dibuja con Three.js dentro del propio Next.js y no con un motor de juego.
 * El local son cajas sobre un plano: no hace falta física, ni animación de
 * personajes, ni un build de 20 MB aparte.
 */

export type DatosEscena = {
  nombre: string;
  planoAncho: number;
  planoFondo: number;
  zonas: ZonaPlano[];
  puertas: PuertaPlano[];
};

type Modo = "orbita" | "caminar";

/**
 * Qué se dibuja: el esquema o el local amueblado.
 *
 * Las dos vistas se quedan porque responden a preguntas distintas y ninguna
 * sustituye a la otra. El **esquema** —cajas de colores translúcidas— es la
 * herramienta: se ve la planta entera de un vistazo, se comparan superficies y
 * se sigue el reparto de la evacuación. El **ambiente** es el local: paredes,
 * barra, boxes y focos barriendo, para enseñárselo a alguien o para colocar algo
 * sabiendo cómo se va a ver desde dentro.
 *
 * Arranca en ambiente porque es lo que se entiende sin explicación.
 */
type Vista = "ambiente" | "esquema";

/* Paleta de la escena, en los valores de la identidad Concreto y Neón. */
const NEGRO = "#080808";
const CONCRETO = "#111111";
const LINEA = "#2a2a2a";
const LINEA_FUERTE = "#3d3d3d";
/** Las dos luces de la marca: magenta y violeta de neón. */
const CHARTREUSE = "#ff3d9a";
const MAGENTA = "#a374ff";
const TINTA = "#f2f2f0";

function colorZona(zona: ZonaPlano, resaltada: boolean): THREE.Color {
  const hue = tonoDeZona(zona) / 360;
  return new THREE.Color().setHSL(hue, resaltada ? 0.9 : 0.6, resaltada ? 0.6 : 0.45);
}

function Zona({
  zona,
  centroPlano,
  resaltada,
  onSelect,
}: {
  zona: ZonaPlano;
  centroPlano: { x: number; z: number };
  resaltada: boolean;
  onSelect?: (id: string) => void;
}) {
  const [encima, setEncima] = useState(false);
  const alto = Math.max(zona.alto, 0.15);
  const activa = resaltada || encima;
  const color = useMemo(() => colorZona(zona, activa), [zona, activa]);

  // El origen del plano está en una esquina y el de Three.js en el centro: por
  // eso se resta medio local a cada coordenada.
  const px = zona.x + zona.ancho / 2 - centroPlano.x;
  const pz = zona.y + zona.fondo / 2 - centroPlano.z;

  const geometria = useMemo(
    () => new THREE.BoxGeometry(zona.ancho, alto, zona.fondo),
    [zona.ancho, alto, zona.fondo],
  );

  return (
    <group position={[px, 0, pz]}>
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
        <boxGeometry args={[zona.ancho, alto, zona.fondo]} />
        {/*
         * Semitransparente a propósito: si las zonas fueran opacas, desde fuera
         * solo se vería la caja de delante y el local se leería como un bloque.
         */}
        <meshStandardMaterial
          color={color}
          transparent
          opacity={activa ? 0.5 : 0.26}
          roughness={0.75}
          depthWrite={false}
        />
      </mesh>

      {/* Aristas: son las que hacen legible el volumen a través de la transparencia. */}
      <lineSegments position={[0, alto / 2, 0]}>
        <edgesGeometry args={[geometria]} />
        <lineBasicMaterial color={color} transparent opacity={0.95} />
      </lineSegments>

      <Text
        position={[0, alto + 0.7, 0]}
        fontSize={0.95}
        color={activa ? CHARTREUSE : TINTA}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.05}
        outlineColor={NEGRO}
      >
        {zona.nombre.toUpperCase()}
      </Text>
    </group>
  );
}

/**
 * La huella de la zona en el suelo, para poder seleccionarla en modo ambiente.
 *
 * En el esquema se pincha la caja de la zona, pero amueblado no hay caja: hay
 * sofás y una barra. Así que la zona se convierte en una alfombra —invisible
 * mientras no haga falta, encendida por el borde cuando el ratón pasa o cuando
 * está seleccionada—. Se queda a ras de suelo (2 cm) para no pelearse por el
 * mismo plano con el suelo de la sala, que es lo que produce ese parpadeo de
 * franjas cuando dos superficies coinciden exactamente.
 */
function SueloDeZona({
  zona,
  centroPlano,
  resaltada,
  onSelect,
}: {
  zona: ZonaPlano;
  centroPlano: { x: number; z: number };
  resaltada: boolean;
  onSelect?: (id: string) => void;
}) {
  const [encima, setEncima] = useState(false);
  const activa = resaltada || encima;
  const color = useMemo(() => colorZona(zona, true), [zona]);

  const px = zona.x + zona.ancho / 2 - centroPlano.x;
  const pz = zona.y + zona.fondo / 2 - centroPlano.z;

  return (
    <group position={[px, 0.02, pz]}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
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
        <planeGeometry args={[zona.ancho, zona.fondo]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={activa ? 0.16 : 0}
          depthWrite={false}
        />
      </mesh>

      {activa && (
        <Text
          position={[0, 1.6, 0]}
          fontSize={0.8}
          color={CHARTREUSE}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.05}
          outlineColor={NEGRO}
        >
          {zona.nombre.toUpperCase()}
        </Text>
      )}
    </group>
  );
}

function Puerta({
  puerta,
  centroPlano,
}: {
  puerta: PuertaPlano;
  centroPlano: { x: number; z: number };
}) {
  /*
   * Las salidas de emergencia van en chartreuse, y no es capricho: la identidad
   * nace de "el color de una luz de emergencia". Aquí el color hace literalmente
   * ese trabajo. La puerta de entrada va en tinta, que es lo neutro.
   */
  // Las salidas de emergencia, en verde como su cartel de verdad.
  const color = puerta.esSalidaEmergencia ? "#3ee6a0" : TINTA;

  return (
    <group position={[puerta.x - centroPlano.x, 0, puerta.y - centroPlano.z]}>
      <mesh position={[0, 1.05, 0]}>
        <boxGeometry args={[Math.max(puerta.ancho, 0.6), 2.1, 0.35]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={puerta.esSalidaEmergencia ? 0.9 : 0.25}
        />
      </mesh>
      <Text
        position={[0, 2.8, 0]}
        fontSize={0.62}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.04}
        outlineColor={NEGRO}
      >
        {puerta.esSalidaEmergencia ? "SALIDA" : puerta.nombre.toUpperCase()}
      </Text>
    </group>
  );
}

/**
 * Vigila la pérdida del contexto WebGL.
 *
 * Es la causa por la que la escena aparecía en negro con todo bien construido:
 * el navegador **retira** el contexto gráfico cuando la pestaña deja de pintar,
 * cuando el sistema recupera memoria de vídeo o cuando el controlador se
 * reinicia. Medido en esta misma escena: dieciséis mallas, cuatro grupos de
 * aristas, tres luces… y cero llamadas de dibujo, porque `render()` sale por la
 * puerta de atrás en cuanto el contexto está perdido.
 *
 * La parte que casi nadie escribe es `preventDefault()`. Sin él el navegador ni
 * siquiera **intenta** restaurar el contexto, así que el lienzo se queda negro
 * para siempre y solo lo arregla recargar la página. Con él llega
 * `webglcontextrestored`, y ahí hay que rehacer la escena entera: las texturas,
 * los búferes y los programas compilados murieron con el contexto anterior.
 */
function VigilanteDeContexto({
  alPerder,
  alRecuperar,
}: {
  alPerder: () => void;
  alRecuperar: () => void;
}) {
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

    /*
     * El contexto puede haberse perdido ANTES de que este efecto llegue a
     * suscribirse —pasa cuando la pestaña nace en segundo plano—, y entonces no
     * queda ningún evento por escuchar. Sin esta comprobación el lienzo se
     * quedaba negro sin que nada lo dijera, que es exactamente el síntoma que
     * había que explicar.
     */
    if (gl.getContext().isContextLost()) alPerder();

    /*
     * Y al volver a la pestaña: si el contexto sigue perdido y el navegador no
     * ha mandado `webglcontextrestored`, lo rehacemos nosotros. Volver y
     * encontrarse un rectángulo negro es la peor manera de descubrir esto.
     */
    const alVolver = () => {
      if (document.visibilityState === "visible" && gl.getContext().isContextLost()) {
        alRecuperar();
      }
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

/** Movimiento con WASD mientras el ratón está capturado. */
function Caminante({ limites }: { limites: { x: number; z: number } }) {
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
    const velocidad = 6 * delta;
    const frente = new THREE.Vector3();
    camera.getWorldDirection(frente);
    frente.y = 0;
    frente.normalize();
    const lado = new THREE.Vector3().crossVectors(frente, camera.up).normalize();

    const t = teclas.current;
    if (t.KeyW || t.ArrowUp) camera.position.addScaledVector(frente, velocidad);
    if (t.KeyS || t.ArrowDown) camera.position.addScaledVector(frente, -velocidad);
    if (t.KeyD || t.ArrowRight) camera.position.addScaledVector(lado, velocidad);
    if (t.KeyA || t.ArrowLeft) camera.position.addScaledVector(lado, -velocidad);

    // Altura de ojos fija y sin salirse del local: sin esto se acaba flotando
    // fuera del edificio y se pierde la referencia de escala.
    camera.position.y = 1.7;
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -limites.x, limites.x);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -limites.z, limites.z);
  });

  return null;
}

export function Escena3D({
  datos,
  zonaSeleccionada,
  onSelectZona,
}: {
  datos: DatosEscena;
  zonaSeleccionada?: string | null;
  onSelectZona?: (id: string) => void;
}) {
  const [modo, setModo] = useState<Modo>("orbita");
  const [vista, setVista] = useState<Vista>("ambiente");
  const contenedor = useRef<HTMLDivElement>(null);
  const centroPlano = { x: datos.planoAncho / 2, z: datos.planoFondo / 2 };
  const diagonal = Math.hypot(datos.planoAncho, datos.planoFondo) || 30;
  const altoSala = altoDeSala(datos.zonas);

  /*
   * `generacion` es la llave del lienzo: subirla desmonta el `Canvas` y lo
   * vuelve a montar de cero. Es la única forma fiable de rehacer la escena tras
   * recuperar el contexto, porque los recursos de la GPU no sobreviven.
   */
  const [generacion, setGeneracion] = useState(0);
  const [contextoPerdido, setContextoPerdido] = useState(false);

  const alPerder = useCallback(() => setContextoPerdido(true), []);
  const alRecuperar = useCallback(() => {
    setContextoPerdido(false);
    setGeneracion((n) => n + 1);
  }, []);

  /**
   * Empujón de redimensionado al montar.
   *
   * R3F calcula el tamaño del lienzo con un `ResizeObserver`. Si el observador
   * no llega a dispararse —pasa cuando el contenedor termina de dimensionarse
   * después del primer fotograma, o en navegadores embebidos que no componen la
   * página— el lienzo se queda en su tamaño por defecto de 300×150 y la escena
   * aparece como un rectángulo diminuto en la esquina.
   *
   * Un evento `resize` sintético en los dos fotogramas siguientes fuerza el
   * recálculo. En un navegador donde el observador sí funciona esto no cambia
   * nada: vuelve a medir lo mismo.
   */
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
        <p className="text-sm text-ink-soft">
          Esta sala no tiene medidas. Pon el ancho y el fondo en metros para poder verla en 3D.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={contenedor}
      className="relative h-full w-full overflow-hidden rounded-2xl border border-line bg-ground"
    >
      <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-2">
        <div className="flex gap-1 border border-line bg-ground/85 p-[3px] backdrop-blur">
          {(["orbita", "caminar"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              className={`eyebrow px-3 py-1 transition ${
 modo === m ? "bg-acento text-on-acento" : "text-muted hover:text-ink"
              }`}
            >
              {m === "orbita" ? "Órbita" : "Caminar"}
            </button>
          ))}
        </div>

        <div className="flex gap-1 border border-line bg-ground/85 p-[3px] backdrop-blur">
          {(["ambiente", "esquema"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVista(v)}
              className={`eyebrow px-3 py-1 transition ${
 vista === v ? "bg-acento text-on-acento" : "text-muted hover:text-ink"
              }`}
            >
              {v === "ambiente" ? "Ambiente" : "Esquema"}
            </button>
          ))}
        </div>
      </div>

      {contextoPerdido && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-ground/90 p-6 text-center backdrop-blur">
          <p className="font-display text-2xl font-black uppercase text-alarma">
            Se perdió la tarjeta gráfica
          </p>
          <p className="max-w-sm text-sm text-ink-soft">
            El navegador retiró el contexto 3D, normalmente al dejar la pestaña en segundo plano. Se
            recupera solo al volver; si no, vuelve a montarla aquí.
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
          Clic para mirar · WASD para moverte · Esc para salir
        </p>
      )}

      <Canvas
        key={generacion}
        camera={{ position: [0, diagonal * 0.55, diagonal * 0.75], fov: 55 }}
        dpr={[1, 2]}
        gl={{
          antialias: true,
          /*
           * Un poco más de exposición.
           *
           * R3F mapea el tono con ACES, que comprime las luces altas y oscurece
           * las bajas. En una escena que ya es casi toda penumbra eso deja el
           * interior por debajo de lo que distingue un monitor normal. Subir la
           * exposición aclara sin tocar las luces, así que la penumbra sigue
           * siendo penumbra y no se pierde el ambiente.
           */
          toneMappingExposure: 1.35,
        }}
        // El lienzo llena el contenedor por CSS aunque el observador falle: así
        // nunca se ve el rectángulo de 300×150 en la esquina.
        style={{ width: "100%", height: "100%", display: "block" }}
        resize={{ debounce: 0, scroll: false }}
      >
        <color attach="background" args={[NEGRO]} />
        <fog attach="fog" args={[NEGRO, diagonal * 0.9, diagonal * 2.6]} />

        {vista === "ambiente" ? (
          <>
            {/*
             * Casi a oscuras. La sala la iluminan los focos del techo, que es lo
             * que la hace parecer una sala; con una luz ambiente generosa se ve
             * todo pero parece una maqueta de arquitecto a mediodía.
             *
             * El `hemisphereLight` es el relleno mínimo para que las caras que no
             * mira ningún foco no se vayan a negro absoluto: magenta por arriba y
             * chartreuse rebotando del suelo, los dos colores de la identidad.
             */}
            <ambientLight intensity={0.32} />
            <hemisphereLight args={[MAGENTA, CHARTREUSE, 0.45]} />

            <Sala ancho={datos.planoAncho} fondo={datos.planoFondo} alto={altoSala} />
            <FocosDeSala ancho={datos.planoAncho} fondo={datos.planoFondo} alto={altoSala} />

            {datos.zonas.map((zona) => (
              <MobiliarioDeZona key={zona.id} zona={zona} centro={centroPlano} />
            ))}

            {/* Sin cajas que señalar, la selección se hace pisando el suelo de la zona. */}
            {datos.zonas.map((zona) => (
              <SueloDeZona
                key={`suelo-${zona.id}`}
                zona={zona}
                centroPlano={centroPlano}
                resaltada={zonaSeleccionada === zona.id}
                onSelect={onSelectZona}
              />
            ))}
          </>
        ) : (
          <>
            {/* Luz cenital ácida y relleno magenta: la iluminación de la sala. */}
            <ambientLight intensity={0.4} />
            <directionalLight position={[10, 22, 8]} intensity={1} color={CHARTREUSE} />
            <directionalLight position={[-12, 8, -10]} intensity={0.4} color={MAGENTA} />

            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
              <planeGeometry args={[datos.planoAncho, datos.planoFondo]} />
              <meshStandardMaterial color={CONCRETO} roughness={1} />
            </mesh>

            {/* Retícula de un metro: la referencia de escala de toda la escena. */}
            <Grid
              args={[datos.planoAncho, datos.planoFondo]}
              cellSize={1}
              cellThickness={0.5}
              cellColor={LINEA}
              sectionSize={5}
              sectionThickness={1}
              sectionColor={LINEA_FUERTE}
              fadeDistance={diagonal * 2.2}
              infiniteGrid={false}
              position={[0, 0.01, 0]}
            />

            {datos.zonas.map((zona) => (
              <Zona
                key={zona.id}
                zona={zona}
                centroPlano={centroPlano}
                resaltada={zonaSeleccionada === zona.id}
                onSelect={onSelectZona}
              />
            ))}
          </>
        )}

        {datos.puertas
          .filter((p) => p.activo)
          .map((puerta) => (
            <Puerta key={puerta.id} puerta={puerta} centroPlano={centroPlano} />
          ))}

        <VigilanteDeContexto alPerder={alPerder} alRecuperar={alRecuperar} />

        {modo === "orbita" ? (
          <OrbitControls
            makeDefault
            enablePan
            minDistance={4}
            maxDistance={diagonal * 2.2}
            maxPolarAngle={Math.PI / 2.05}
          />
        ) : (
          <>
            <PointerLockControls makeDefault />
            <Caminante limites={{ x: centroPlano.x - 0.5, z: centroPlano.z - 0.5 }} />
          </>
        )}
      </Canvas>
    </div>
  );
}
