import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { ZonaPlano } from "./evacuacion";

/**
 * El local amueblado.
 *
 * La vista de cajas transparentes sigue existiendo y sirve para lo suyo —leer la
 * planta, discutir aforos, ver por dónde se sale—. Esto es lo otro: entrar y
 * reconocer el sitio. Un cliente no entiende «zona de 20 × 8 m con aforo 0»;
 * entiende una barra con botellas detrás y unos boxes con su mesa.
 *
 * ── Por qué está modelado y no texturizado ──
 *
 * Se podrían pegar fotos en las paredes y quedaría antes. Pero una foto de una
 * pared es una foto de OTRA pared: en cuanto la cámara se mueve, se nota que es
 * un cartón. Además cada imagen son cientos de kilobytes que hay que descargar,
 * y esto vive dentro del panel, que se abre con la sala en marcha y a veces con
 * la conexión del local.
 *
 * Todo lo de aquí son cajas, cilindros y planos: no pesa nada, se adapta a
 * cualquier medida que tenga la sala en la base de datos —que es el requisito de
 * verdad, porque las zonas las edita el usuario— y se ve igual desde cualquier
 * ángulo.
 *
 * ── Cómo sabe qué poner en cada sitio ──
 *
 * Por el NOMBRE de la zona. Es información que ya existe y que el local escribe
 * sin saber que va a mover un modelo 3D: quien llama «Barra» a una zona quiere
 * una barra. Si el nombre no dice nada reconocible, se amuebla con mesas altas,
 * que es lo que no desentona en ningún sitio.
 */

const CONCRETO = "#1e1e1e";
const CONCRETO_CLARO = "#272727";
const METAL = "#3a3a3a";
const MADERA = "#241c14";
const CHARTREUSE = "#c9ff00";
const MAGENTA = "#ff2b6e";
const CIAN = "#22d3ee";

/** Alto libre de la sala. Manda la zona más alta y, si no hay ninguna, 5,5 m. */
export function altoDeSala(zonas: ZonaPlano[]): number {
  const maximo = zonas.reduce((alto, zona) => Math.max(alto, zona.alto), 0);
  return Math.max(maximo + 0.6, 5.5);
}

type Centro = { x: number; z: number };

/** Pasa una zona de coordenadas de plano (esquina) a coordenadas de escena (centro). */
function situar(zona: ZonaPlano, centro: Centro) {
  return {
    x: zona.x + zona.ancho / 2 - centro.x,
    z: zona.y + zona.fondo / 2 - centro.z,
  };
}

/* ─────────────────────────── ARQUITECTURA ─────────────────────────── */

/**
 * Las cuatro paredes y el techo.
 *
 * Es lo que más cambia la sensación por menos geometría: sin paredes, la cámara
 * en modo caminar mira al vacío negro y el sitio no parece un interior, parece
 * un escenario flotando. Con ellas aparece el eco visual de estar dentro.
 *
 * Paredes y techo son planos con la normal mirando hacia dentro: el que queda
 * entre la cámara y la sala no se dibuja, así que en órbita se ve el interior
 * como en una casa de muñecas y caminando la sala está cerrada. Sale gratis y
 * sin que la cámara tenga que decidir nada.
 */
export function Sala({
  ancho,
  fondo,
  alto,
}: {
  ancho: number;
  fondo: number;
  alto: number;
}) {
  const grosor = 0.25;

  return (
    <group>
      {/* Suelo de hormigón pulido: refleja un poco, que es lo que hace que las luces se noten. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ancho, fondo]} />
        <meshStandardMaterial color={CONCRETO} roughness={0.38} metalness={0.25} />
      </mesh>

      {/*
       * Las paredes son PLANOS mirando hacia dentro, no cajas.
       *
       * Es lo que convierte la sala en una casa de muñecas: un plano solo se
       * dibuja por la cara a la que apunta su normal, así que la pared que queda
       * entre la cámara y la sala desaparece sola al orbitar, y estando dentro
       * están las cuatro. La cámara nunca tiene que saber dónde está.
       *
       * Con cajas no funciona, y es un error que parece resuelto y no lo está:
       * poner `BackSide` en una caja no la hace invisible desde fuera, enseña su
       * cara INTERIOR — que en un muro de 25 cm ocupa exactamente lo mismo. La
       * sala seguía siendo un cubo cerrado y el interior, negro.
       */}
      {[
        { pos: [0, alto / 2, -fondo / 2] as const, rot: [0, 0, 0] as const, w: ancho },
        { pos: [0, alto / 2, fondo / 2] as const, rot: [0, Math.PI, 0] as const, w: ancho },
        { pos: [-ancho / 2, alto / 2, 0] as const, rot: [0, Math.PI / 2, 0] as const, w: fondo },
        { pos: [ancho / 2, alto / 2, 0] as const, rot: [0, -Math.PI / 2, 0] as const, w: fondo },
      ].map((pared, i) => (
        <mesh key={i} position={pared.pos} rotation={pared.rot} receiveShadow>
          <planeGeometry args={[pared.w, alto]} />
          <meshStandardMaterial color={CONCRETO_CLARO} roughness={0.95} />
        </mesh>
      ))}

      {/*
       * Tira de LED perimetral a la altura de la vista.
       *
       * Es el detalle que más «discoteca» aporta por menos coste: una línea
       * emisiva no ilumina nada de verdad —no es una luz, es un material que
       * brilla— pero dibuja el contorno de la sala en la oscuridad y da la
       * referencia de dónde están las paredes cuando todo lo demás está negro.
       */}
      {[
        { pos: [0, 2.6, -fondo / 2 + grosor] as const, args: [ancho, 0.06, 0.04] as const },
        { pos: [0, 2.6, fondo / 2 - grosor] as const, args: [ancho, 0.06, 0.04] as const },
        { pos: [-ancho / 2 + grosor, 2.6, 0] as const, args: [0.04, 0.06, fondo] as const },
        { pos: [ancho / 2 - grosor, 2.6, 0] as const, args: [0.04, 0.06, fondo] as const },
      ].map((tira, i) => (
        <mesh key={`led-${i}`} position={tira.pos}>
          <boxGeometry args={tira.args} />
          <meshBasicMaterial color={MAGENTA} toneMapped={false} />
        </mesh>
      ))}

      {/* Techo: mismo truco, la normal mirando al suelo. Desde arriba no estorba. */}
      <mesh position={[0, alto, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ancho, fondo]} />
        <meshStandardMaterial color="#0a0a0a" roughness={1} />
      </mesh>

      {/* Estructura de truss cruzando el techo: sostiene los focos y da escala. */}
      {[-fondo * 0.25, fondo * 0.25].map((z, i) => (
        <mesh key={`truss-${i}`} position={[0, alto - 0.45, z]}>
          <boxGeometry args={[ancho * 0.9, 0.28, 0.28]} />
          <meshStandardMaterial color={METAL} roughness={0.5} metalness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

/* ─────────────────────────── MOBILIARIO ─────────────────────────── */

/**
 * La barra: mostrador, estantería con botellas y taburetes.
 *
 * Las botellas van en `instancedMesh`. Son cuarenta objetos idénticos, y
 * dibujarlos de uno en uno son cuarenta llamadas a la tarjeta gráfica; en una
 * sola instancia es una. En una escena que además tiene que ir fluida dentro de
 * un panel de gestión, esa diferencia es la que decide si se puede tener
 * botellas o no.
 */
function Barra({ zona, centro }: { zona: ZonaPlano; centro: Centro }) {
  const { x, z } = situar(zona, centro);
  const alLargo = zona.ancho >= zona.fondo;
  const largo = Math.max((alLargo ? zona.ancho : zona.fondo) * 0.85, 2);
  const botellas = useRef<THREE.InstancedMesh>(null);
  const filas = 3;
  const porFila = Math.max(Math.floor(largo / 0.22), 4);
  const total = filas * porFila;

  useLayoutEffect(() => {
    const malla = botellas.current;
    if (!malla) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let i = 0;
    for (let fila = 0; fila < filas; fila++) {
      for (let n = 0; n < porFila; n++) {
        dummy.position.set(
          -largo / 2 + 0.11 + n * (largo / porFila),
          0.35 + fila * 0.55,
          -0.12 + (fila % 2) * 0.05,
        );
        // Altura y giro ligeramente distintos: una fila de botellas clonadas
        // canta a copia y pega; con variación parece un almacén de verdad.
        dummy.scale.set(1, 0.8 + ((i * 37) % 10) / 22, 1);
        dummy.rotation.y = ((i * 53) % 100) / 40;
        dummy.updateMatrix();
        malla.setMatrixAt(i, dummy.matrix);
        malla.setColorAt(i, color.setHSL(((i * 29) % 360) / 360, 0.45, 0.42));
        i++;
      }
    }
    malla.instanceMatrix.needsUpdate = true;
    if (malla.instanceColor) malla.instanceColor.needsUpdate = true;
  }, [largo, porFila, total]);

  const taburetes = Math.max(Math.floor(largo / 1.1), 2);

  return (
    <group position={[x, 0, z]} rotation={[0, alLargo ? 0 : Math.PI / 2, 0]}>
      {/* Mostrador. */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[largo, 1.1, 0.7]} />
        <meshStandardMaterial color={MADERA} roughness={0.6} />
      </mesh>
      {/* Encimera, un poco más ancha para que se lea el canto. */}
      <mesh position={[0, 1.13, 0]}>
        <boxGeometry args={[largo + 0.12, 0.06, 0.82]} />
        <meshStandardMaterial color="#3a3a3a" roughness={0.25} metalness={0.55} />
      </mesh>
      {/* Tira encendida bajo el mostrador: el pie flotante de las barras de verdad. */}
      <mesh position={[0, 0.08, 0.36]}>
        <boxGeometry args={[largo, 0.05, 0.03]} />
        <meshBasicMaterial color={CHARTREUSE} toneMapped={false} />
      </mesh>

      {/* Estantería del fondo, con su panel retroiluminado. */}
      <group position={[0, 0, -0.9]}>
        <mesh position={[0, 1.2, -0.1]}>
          <boxGeometry args={[largo, 2.4, 0.08]} />
          <meshStandardMaterial
            color="#101010"
            emissive={MAGENTA}
            emissiveIntensity={0.35}
            roughness={0.8}
          />
        </mesh>
        {Array.from({ length: filas }).map((_, i) => (
          <mesh key={i} position={[0, 0.32 + i * 0.55, 0.05]}>
            <boxGeometry args={[largo, 0.04, 0.26]} />
            <meshStandardMaterial color={METAL} roughness={0.5} metalness={0.6} />
          </mesh>
        ))}
        <instancedMesh ref={botellas} args={[undefined, undefined, total]} castShadow>
          <cylinderGeometry args={[0.035, 0.045, 0.3, 6]} />
          <meshStandardMaterial roughness={0.25} metalness={0.1} />
        </instancedMesh>
      </group>

      {/*
       * Luz propia de la barra.
       *
       * Los focos del techo barren la pista, no la barra, así que sin esto las
       * botellas eran una mancha oscura. Es una luz pequeña y sin sombras: hace
       * el trabajo de las tiras que toda barra tiene por debajo del estante.
       */}
      <pointLight position={[0, 2, -0.7]} color={CIAN} intensity={55} distance={9} decay={1.5} />

      {/* Taburetes. */}
      {Array.from({ length: taburetes }).map((_, i) => {
        const px = -largo / 2 + largo / (taburetes + 1) + i * (largo / (taburetes + 1));
        return (
          <group key={i} position={[px, 0, 0.95]}>
            <mesh position={[0, 0.36, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 0.72, 8]} />
              <meshStandardMaterial color={METAL} metalness={0.8} roughness={0.35} />
            </mesh>
            <mesh position={[0, 0.75, 0]} castShadow>
              <cylinderGeometry args={[0.19, 0.19, 0.08, 12]} />
              <meshStandardMaterial color="#191919" roughness={0.85} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/**
 * Los boxes: sofá en L, mesa baja y una botella con su cubitera.
 *
 * Se reparten en rejilla dentro de la zona, calculando cuántos caben en vez de
 * poner un número fijo: la zona la dimensiona el usuario en el panel y un número
 * fijo se vería ridículo en una zona de 40 m² y apelotonado en una de 8.
 */
function Boxes({ zona, centro }: { zona: ZonaPlano; centro: Centro }) {
  const { x, z } = situar(zona, centro);

  const sitios = useMemo(() => {
    const separacion = 3.4;
    const columnas = Math.max(Math.floor(zona.ancho / separacion), 1);
    const filas = Math.max(Math.floor(zona.fondo / separacion), 1);
    const puntos: { px: number; pz: number; giro: number }[] = [];
    for (let c = 0; c < columnas; c++) {
      for (let f = 0; f < filas; f++) {
        puntos.push({
          px: -zona.ancho / 2 + (zona.ancho / columnas) * (c + 0.5),
          pz: -zona.fondo / 2 + (zona.fondo / filas) * (f + 0.5),
          giro: ((c + f) % 2) * Math.PI,
        });
      }
    }
    return puntos.slice(0, 12);
  }, [zona.ancho, zona.fondo]);

  return (
    <group position={[x, 0, z]}>
      {/* Luz de ambiente de la zona: los boxes se venden por lo que se ve de ellos. */}
      <pointLight
        position={[0, 2.6, 0]}
        color={MAGENTA}
        intensity={70}
        distance={Math.max(zona.ancho, zona.fondo)}
        decay={1.5}
      />

      {sitios.map((sitio, i) => (
        <group key={i} position={[sitio.px, 0, sitio.pz]} rotation={[0, sitio.giro, 0]}>
          {/* Asiento y respaldo del sofá. */}
          <mesh position={[0, 0.22, -0.9]} castShadow>
            <boxGeometry args={[2.2, 0.44, 0.7]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
          </mesh>
          <mesh position={[0, 0.62, -1.18]}>
            <boxGeometry args={[2.2, 0.55, 0.16]} />
            <meshStandardMaterial color="#202020" roughness={0.95} />
          </mesh>
          {/* Brazo lateral: convierte el banco en un box. */}
          <mesh position={[-1.03, 0.4, -0.9]}>
            <boxGeometry args={[0.16, 0.8, 0.7]} />
            <meshStandardMaterial color="#202020" roughness={0.95} />
          </mesh>

          {/* Mesa baja con canto encendido. */}
          <mesh position={[0, 0.2, 0]} castShadow>
            <cylinderGeometry args={[0.42, 0.36, 0.4, 16]} />
            <meshStandardMaterial color="#151515" roughness={0.5} metalness={0.3} />
          </mesh>
          <mesh position={[0, 0.42, 0]}>
            <cylinderGeometry args={[0.46, 0.46, 0.03, 20]} />
            <meshBasicMaterial color={CHARTREUSE} toneMapped={false} />
          </mesh>

          {/* La sellada y su cubitera: es lo que se pide en un box. */}
          <mesh position={[0.12, 0.62, 0.05]}>
            <cylinderGeometry args={[0.05, 0.06, 0.34, 8]} />
            <meshStandardMaterial color="#0f2a12" roughness={0.2} />
          </mesh>
          <mesh position={[-0.15, 0.53, -0.05]}>
            <cylinderGeometry args={[0.14, 0.11, 0.18, 12]} />
            <meshStandardMaterial color="#3a3a3a" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * La pista: suelo luminoso, cabina elevada y torres de sonido.
 *
 * El suelo es una rejilla de paneles emisivos que laten. No es una luz —no
 * ilumina a los demás objetos— y eso es a propósito: cuarenta luces reales
 * hundirían el rendimiento, mientras que cuarenta materiales que brillan cuestan
 * lo mismo que cuarenta cajas. El ojo lo lee igual porque hay focos de verdad
 * encima haciendo el trabajo.
 */
function Pista({ zona, centro }: { zona: ZonaPlano; centro: Centro }) {
  const { x, z } = situar(zona, centro);
  const paneles = useRef<THREE.InstancedMesh>(null);
  const lado = 1.2;
  const columnas = Math.max(Math.floor(zona.ancho / lado), 2);
  const filas = Math.max(Math.floor(zona.fondo / lado), 2);
  const total = columnas * filas;
  const fases = useMemo(
    () => Array.from({ length: total }, (_, i) => ((i * 97) % 100) / 100),
    [total],
  );

  useLayoutEffect(() => {
    const malla = paneles.current;
    if (!malla) return;
    const dummy = new THREE.Object3D();
    let i = 0;
    for (let c = 0; c < columnas; c++) {
      for (let f = 0; f < filas; f++) {
        dummy.position.set(
          -zona.ancho / 2 + (zona.ancho / columnas) * (c + 0.5),
          0.02,
          -zona.fondo / 2 + (zona.fondo / filas) * (f + 0.5),
        );
        dummy.scale.set((zona.ancho / columnas) * 0.92, 1, (zona.fondo / filas) * 0.92);
        dummy.updateMatrix();
        malla.setMatrixAt(i, dummy.matrix);
        i++;
      }
    }
    malla.instanceMatrix.needsUpdate = true;
  }, [columnas, filas, zona.ancho, zona.fondo]);

  /*
   * El latido. Se escribe el color de cada panel en cada fotograma, que es
   * barato porque son datos, no geometría. La onda avanza con la posición del
   * panel para que el suelo parezca recorrido por la música y no un parpadeo
   * general, que es lo que se ve cuando todos laten a la vez.
   */
  const color = useMemo(() => new THREE.Color(), []);
  const chartreuse = useMemo(() => new THREE.Color(CHARTREUSE), []);
  const magenta = useMemo(() => new THREE.Color(MAGENTA), []);

  useFrame((estado) => {
    const malla = paneles.current;
    if (!malla) return;
    const t = estado.clock.elapsedTime;
    for (let i = 0; i < total; i++) {
      const onda = (Math.sin(t * 2.2 + fases[i] * Math.PI * 2) + 1) / 2;
      color.copy(fases[i] > 0.5 ? chartreuse : magenta).multiplyScalar(0.06 + onda * 0.34);
      malla.setColorAt(i, color);
    }
    if (malla.instanceColor) malla.instanceColor.needsUpdate = true;
  });

  return (
    <group position={[x, 0, z]}>
      <instancedMesh ref={paneles} args={[undefined, undefined, total]}>
        <boxGeometry args={[1, 0.04, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      {/* Cabina, al fondo de la pista y elevada: como en la sala de verdad. */}
      <group position={[0, 0, -zona.fondo / 2 + 1.2]}>
        <mesh position={[0, 0.45, 0]} castShadow>
          <boxGeometry args={[2.6, 0.9, 1]} />
          <meshStandardMaterial color="#101010" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.92, 0]}>
          <boxGeometry args={[2.8, 0.06, 1.2]} />
          <meshStandardMaterial color={METAL} metalness={0.7} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.5, 0.52]}>
          <boxGeometry args={[2.5, 0.5, 0.02]} />
          <meshBasicMaterial color={CIAN} toneMapped={false} />
        </mesh>

        {/* Torres de sonido a los lados. */}
        {[-2.1, 2.1].map((px) => (
          <group key={px} position={[px, 0, 0]}>
            <mesh position={[0, 0.9, 0]} castShadow>
              <boxGeometry args={[0.7, 1.8, 0.7]} />
              <meshStandardMaterial color="#0d0d0d" roughness={0.9} />
            </mesh>
            {[0.55, 1.25].map((py) => (
              <mesh key={py} position={[0, py, 0.36]}>
                <cylinderGeometry args={[0.22, 0.22, 0.04, 16]} />
                <meshStandardMaterial color="#050505" roughness={0.6} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    </group>
  );
}

/** Mesas altas: lo que se pone donde el nombre de la zona no dice nada. */
function MesasAltas({ zona, centro }: { zona: ZonaPlano; centro: Centro }) {
  const { x, z } = situar(zona, centro);
  const sitios = useMemo(() => {
    const separacion = 2.6;
    const columnas = Math.max(Math.floor(zona.ancho / separacion), 1);
    const filas = Math.max(Math.floor(zona.fondo / separacion), 1);
    const puntos: { px: number; pz: number }[] = [];
    for (let c = 0; c < columnas; c++) {
      for (let f = 0; f < filas; f++) {
        puntos.push({
          px: -zona.ancho / 2 + (zona.ancho / columnas) * (c + 0.5),
          pz: -zona.fondo / 2 + (zona.fondo / filas) * (f + 0.5),
        });
      }
    }
    return puntos.slice(0, 14);
  }, [zona.ancho, zona.fondo]);

  return (
    <group position={[x, 0, z]}>
      {sitios.map((sitio, i) => (
        <group key={i} position={[sitio.px, 0, sitio.pz]}>
          <mesh position={[0, 0.03, 0]}>
            <cylinderGeometry args={[0.34, 0.34, 0.06, 16]} />
            <meshStandardMaterial color="#151515" metalness={0.5} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.53, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 1, 10]} />
            <meshStandardMaterial color={METAL} metalness={0.8} roughness={0.35} />
          </mesh>
          <mesh position={[0, 1.05, 0]} castShadow>
            <cylinderGeometry args={[0.42, 0.42, 0.05, 20]} />
            <meshStandardMaterial color="#1d1d1d" roughness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Elige el mobiliario según el TIPO de la zona.
 *
 * Antes lo adivinaba leyendo el nombre: `nombre.includes("vip")`. Funcionaba
 * mientras las zonas se llamaran como el programador esperaba, y fallaba en
 * silencio en cuanto alguien renombraba «Zona VIP» a «Altillo» desde el editor
 * del local — la zona seguía existiendo, seguía siendo VIP, y de pronto se
 * pintaba con mesas altas. Ahora el tipo es un dato de la zona.
 */
export function MobiliarioDeZona({ zona, centro }: { zona: ZonaPlano; centro: Centro }) {
  switch (zona.tipo) {
    case "BARRA":
      return <Barra zona={zona} centro={centro} />;
    case "VIP":
      return <Boxes zona={zona} centro={centro} />;
    case "PISTA":
      return <Pista zona={zona} centro={centro} />;
    default:
      return <MesasAltas zona={zona} centro={centro} />;
  }
}

/**
 * Los focos de la sala, barriendo.
 *
 * Tres y no más. Cada luz con sombras multiplica el coste de cada fotograma, y
 * aquí las sombras están apagadas a propósito: en una sala a oscuras casi todo
 * está en sombra ya, así que lo que aportan no compensa lo que cuestan dentro de
 * un panel que también tiene que atender formularios.
 *
 * El barrido es una rotación lenta de los objetivos. Sin movimiento, la escena
 * parece una maqueta de arquitecto; con él, parece un local encendido.
 */
export function FocosDeSala({ ancho, fondo, alto }: { ancho: number; fondo: number; alto: number }) {
  const radio = Math.min(ancho, fondo) * 0.3;

  /*
   * Intensidades en cientos, no en decenas.
   *
   * Desde la r155 Three.js usa iluminación física por defecto: la intensidad de
   * un foco va en candelas y cae con el cuadrado de la distancia. Los valores
   * que servían antes —un 1, un 5— dejan la sala prácticamente a oscuras a cinco
   * metros de altura. Estos están medidos contra el alto real de la sala.
   */
  const focos = [
    { color: CHARTREUSE, x: -ancho * 0.25, z: -fondo * 0.2, intensidad: 480, velocidad: 0.35 },
    { color: MAGENTA, x: ancho * 0.25, z: 0, intensidad: 420, velocidad: 0.47 },
    { color: CIAN, x: 0, z: fondo * 0.25, intensidad: 320, velocidad: 0.59 },
  ];

  return (
    <>
      {focos.map((foco, i) => (
        <Foco
          key={i}
          {...foco}
          alto={alto}
          radio={radio}
          desfase={(i * Math.PI * 2) / 3}
        />
      ))}
    </>
  );
}

/**
 * Un foco con su objetivo móvil.
 *
 * El objetivo de un `SpotLight` de Three.js es un objeto de la escena, no una
 * coordenada, y ahí hay una trampa: si se intenta pasar por JSX leyendo un
 * `ref`, en el primer pintado ese `ref` todavía vale `null` —y como cambiar un
 * `ref` no vuelve a pintar, la luz no se monta nunca. Por eso el objetivo se
 * crea a mano, se mete en la escena con `primitive` y se enlaza en un efecto.
 *
 * `updateMatrixWorld()` en cada fotograma no es opcional: el objetivo no tiene
 * hijos ni geometría, así que Three no lo recalcula solo, y sin eso el foco
 * apunta al sitio donde el objetivo estaba al empezar.
 */
function Foco({
  color,
  x,
  z,
  alto,
  intensidad,
  velocidad,
  desfase,
  radio,
}: {
  color: string;
  x: number;
  z: number;
  alto: number;
  intensidad: number;
  velocidad: number;
  desfase: number;
  radio: number;
}) {
  const luz = useRef<THREE.SpotLight>(null);
  const objetivo = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    if (luz.current) luz.current.target = objetivo;
  }, [objetivo]);

  useFrame((estado) => {
    const t = estado.clock.elapsedTime;
    objetivo.position.set(
      Math.cos(t * velocidad + desfase) * radio,
      0,
      Math.sin(t * velocidad * 1.3 + desfase) * radio,
    );
    objetivo.updateMatrixWorld();
  });

  return (
    <>
      <primitive object={objetivo} />
      <spotLight
        ref={luz}
        position={[x, alto - 0.7, z]}
        color={color}
        intensity={intensidad}
        angle={0.42}
        penumbra={0.75}
        distance={alto * 4}
        decay={1.4}
      />
      {/* La carcasa colgada del truss: sin ella la luz sale de la nada. */}
      <mesh position={[x, alto - 0.62, z]}>
        <cylinderGeometry args={[0.12, 0.16, 0.34, 10]} />
        <meshStandardMaterial color={METAL} metalness={0.7} roughness={0.4} />
      </mesh>
    </>
  );
}
