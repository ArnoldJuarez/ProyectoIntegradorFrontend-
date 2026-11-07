import { Text } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { ZonaPlano } from "../evacuacion";
import { ALTURA_DE_PLANTA, COLOR, LUZ_DE, aleatorio, ambienteDe, caja, dentro, type Ambiente, type Caja, type Centro } from "./comun";
import { ParedesDeSala } from "./edificio";
import {
  BolaDeEspejos,
  CabezalMovil,
  Guirnalda,
  MarcoDeNeon,
  Neon,
  PantallaLed,
  Publico,
  SueloLed,
} from "./efectos";

/**
 * El mobiliario y la luz de cada ambiente.
 *
 * Cada zona del plano se amuebla según su ambiente (ver `ambienteDe`): la pista
 * lleva suelo LED y cabezales, la barra su contrabarra de botellas iluminadas,
 * La Cueva ladrillo y luz roja, la terraza madera, plantas y guirnaldas. Todo se
 * coloca a partir de las medidas de la zona, así que mover o agrandar una zona en
 * el editor reorganiza sus muebles solo.
 */

export type PropsDeAmbiente = {
  zona: ZonaPlano;
  c: Caja;
  todas: ZonaPlano[];
  centro: Centro;
  animar: boolean;
  conGente: boolean;
  recortar: boolean;
};

// ── Piezas sueltas ──────────────────────────────────────────────────

function Suelo({ c, color, rugosidad = 0.6, metal = 0.1 }: { c: Caja; color: string; rugosidad?: number; metal?: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[c.cx, c.y0 + 0.006, c.cz]}>
      <planeGeometry args={[c.w, c.d]} />
      <meshStandardMaterial color={color} roughness={rugosidad} metalness={metal} />
    </mesh>
  );
}

function Luz({ c, color, intensidad, alto }: { c: Caja; color: string; intensidad?: number; alto?: number }) {
  const area = c.w * c.d;
  return (
    <pointLight
      position={[c.cx, c.y0 + (alto ?? Math.min(c.h - 0.4, 3.6)), c.cz]}
      color={color}
      intensity={intensidad ?? Math.min(90, 14 + area * 0.35)}
      distance={Math.max(c.w, c.d) * 1.25}
      decay={1.6}
    />
  );
}

function Taburete({ x, y, z, color = COLOR.metal }: { x: number; y: number; z: number; color?: string }) {
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.38, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.76, 6]} />
        <meshStandardMaterial color={COLOR.metalOscuro} metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.78, 0]}>
        <cylinderGeometry args={[0.19, 0.17, 0.07, 14]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
    </group>
  );
}

function MesaAlta({ x, y, z, color = COLOR.metalOscuro, brillo }: { x: number; y: number; z: number; color?: string; brillo?: string }) {
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.04, 0.2, 1.1, 8]} />
        <meshStandardMaterial color={COLOR.metalOscuro} metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0, 1.11, 0]}>
        <cylinderGeometry args={[0.36, 0.36, 0.04, 20]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.4} />
      </mesh>
      {brillo && (
        <mesh position={[0, 1.2, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.14, 10]} />
          <meshBasicMaterial color={new THREE.Color(brillo).multiplyScalar(2.2)} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

/** Un sofá en U alrededor de una mesa baja, mirando hacia `+z` del grupo. */
function Reservado({
  ancho,
  fondo,
  color,
  brillo,
}: {
  ancho: number;
  fondo: number;
  color: string;
  brillo: string;
}) {
  const asiento = 0.42;
  const prof = 0.65;
  return (
    <group>
      {/* El respaldo de fondo y los dos laterales. */}
      <mesh position={[0, asiento / 2, -fondo / 2 + prof / 2]}>
        <boxGeometry args={[ancho, asiento, prof]} />
        <meshStandardMaterial color={color} roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.72, -fondo / 2 + 0.12]}>
        <boxGeometry args={[ancho, 0.62, 0.24]} />
        <meshStandardMaterial color={color} roughness={0.75} />
      </mesh>
      {[-1, 1].map((lado) => (
        <group key={lado}>
          <mesh position={[(lado * (ancho - prof)) / 2, asiento / 2, prof / 2 - 0.1]}>
            <boxGeometry args={[prof, asiento, fondo - prof - 0.2]} />
            <meshStandardMaterial color={color} roughness={0.75} />
          </mesh>
          <mesh position={[(lado * (ancho - 0.24)) / 2, 0.72, prof / 2 - 0.1]}>
            <boxGeometry args={[0.24, 0.62, fondo - prof - 0.2]} />
            <meshStandardMaterial color={color} roughness={0.75} />
          </mesh>
        </group>
      ))}
      {/* La mesa con su cubitera iluminada. */}
      <mesh position={[0, 0.25, prof / 2 - 0.1]}>
        <boxGeometry args={[ancho - prof * 2 - 0.35, 0.5, Math.max(0.5, fondo - prof * 2 - 0.2)]} />
        <meshStandardMaterial color="#0c0a10" roughness={0.15} metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.62, prof / 2 - 0.1]}>
        <cylinderGeometry args={[0.13, 0.1, 0.24, 14]} />
        <meshBasicMaterial color={new THREE.Color(brillo).multiplyScalar(1.8)} toneMapped={false} />
      </mesh>
      <mesh position={[0.06, 0.86, prof / 2 - 0.12]}>
        <cylinderGeometry args={[0.035, 0.045, 0.32, 8]} />
        <meshStandardMaterial color="#1f4d2a" roughness={0.2} metalness={0.3} />
      </mesh>
      <Neon desde={[-ancho / 2, 0.06, fondo / 2 - 0.15]} hasta={[ancho / 2, 0.06, fondo / 2 - 0.15]} color={brillo} grosor={0.02} intensidad={1.4} />
    </group>
  );
}

function Planta({ x, y, z, alto = 1.4 }: { x: number; y: number; z: number; alto?: number }) {
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[0.6, 0.6, 0.6]} />
        <meshStandardMaterial color="#2b2622" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.6 + alto / 2, 0]}>
        <coneGeometry args={[0.45, alto, 7]} />
        <meshStandardMaterial color={COLOR.cesped} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.75 + alto * 0.35, 0]}>
        <sphereGeometry args={[0.42, 8, 8]} />
        <meshStandardMaterial color="#25472d" roughness={0.9} />
      </mesh>
    </group>
  );
}

function Altavoz({ x, y, z, alto = 2.2, girar = 0 }: { x: number; y: number; z: number; alto?: number; girar?: number }) {
  return (
    <group position={[x, y, z]} rotation={[0, girar, 0]}>
      <mesh position={[0, alto / 2, 0]}>
        <boxGeometry args={[0.8, alto, 0.7]} />
        <meshStandardMaterial color="#0a0a0c" roughness={0.6} />
      </mesh>
      {Array.from({ length: Math.floor(alto / 0.55) }, (_, i) => (
        <mesh key={i} position={[0, 0.35 + i * 0.55, 0.36]}>
          <circleGeometry args={[0.22, 20]} />
          <meshStandardMaterial color="#1a1a1e" roughness={0.4} metalness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

/** Botellas iluminadas en la contrabarra: una sola malla instanciada. */
function Botellas({
  x0,
  x1,
  z,
  y,
  baldas,
  semilla,
  alongZ = false,
}: {
  x0: number;
  x1: number;
  z: number;
  y: number;
  baldas: number;
  semilla: string;
  alongZ?: boolean;
}) {
  const malla = useRef<THREE.InstancedMesh>(null);
  const largo = Math.abs(x1 - x0);
  const porBalda = Math.max(4, Math.floor(largo / 0.16));
  const total = porBalda * baldas;
  const tonos = useMemo(() => ["#ffb347", "#ff6a3d", "#7be0ff", "#c9ff7a", "#ff3d9a", "#ffe0a0"].map((t) => new THREE.Color(t)), []);

  useLayoutEffect(() => {
    const m = malla.current;
    if (!m) return;
    const azar = aleatorio(semilla);
    const o = new THREE.Object3D();
    let i = 0;
    for (let b = 0; b < baldas; b++) {
      for (let k = 0; k < porBalda; k++) {
        const t = Math.min(x0, x1) + (k + 0.5) * (largo / porBalda);
        const alto = 0.24 + azar() * 0.12;
        if (alongZ) o.position.set(z, y + b * 0.42 + alto / 2, t);
        else o.position.set(t, y + b * 0.42 + alto / 2, z);
        o.scale.set(1, alto / 0.3, 1);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
        m.setColorAt(i, tonos[Math.floor(azar() * tonos.length)].clone().multiplyScalar(0.6 + azar() * 0.9));
        i++;
      }
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [x0, x1, z, y, baldas, porBalda, largo, semilla, tonos, alongZ]);

  return (
    <instancedMesh ref={malla} args={[undefined, undefined, total]} frustumCulled={false}>
      <cylinderGeometry args={[0.035, 0.045, 0.3, 6]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

/**
 * El lado de la zona que da al centro del local: es hacia donde se orienta la
 * barra, el escenario o la cabina. Devuelve el borde y la normal que apunta
 * hacia dentro del local.
 */
function ladoHaciaElCentro(c: Caja): { eje: "x" | "z"; signo: 1 | -1 } {
  const dx = -c.cx;
  const dz = -c.cz;
  // Normalizado por las medidas: una zona alargada se orienta por su lado largo.
  return Math.abs(dx) / c.w > Math.abs(dz) / c.d
    ? { eje: "x", signo: dx > 0 ? 1 : -1 }
    : { eje: "z", signo: dz > 0 ? 1 : -1 };
}

/** Cuánta gente se dibuja: una parte del aforo, con tope para no fundir la tarjeta gráfica. */
function personasDe(zona: ZonaPlano, c: Caja, factor = 0.55, tope = 130): number {
  const porAforo = zona.aforo > 0 ? zona.aforo * factor : c.w * c.d * 0.25;
  return Math.round(Math.min(tope, porAforo, c.w * c.d * 1.2));
}

// ── Escenario ───────────────────────────────────────────────────────

function Escenario({ c, animar }: PropsDeAmbiente) {
  const alto = 1.0;
  const { eje, signo } = ladoHaciaElCentro(c);
  // El escenario mira a la pista: su fondo es el lado contrario.
  const rotY = eje === "z" ? (signo > 0 ? 0 : Math.PI) : signo > 0 ? Math.PI / 2 : -Math.PI / 2;
  const frente = eje === "z" ? c.d : c.w;
  const largo = eje === "z" ? c.w : c.d;

  return (
    <group position={[c.cx, c.y0, c.cz]} rotation={[0, rotY, 0]}>
      {/* La tarima con su canto de luz. */}
      <mesh position={[0, alto / 2, 0]}>
        <boxGeometry args={[largo, alto, frente]} />
        <meshStandardMaterial color="#0d0b12" roughness={0.4} metalness={0.3} />
      </mesh>
      <Neon desde={[-largo / 2, alto, frente / 2]} hasta={[largo / 2, alto, frente / 2]} color={COLOR.magenta} intensidad={3} />
      <Neon desde={[-largo / 2, 0.08, frente / 2 + 0.02]} hasta={[largo / 2, 0.08, frente / 2 + 0.02]} color={COLOR.violeta} intensidad={2} />

      {/* La pantalla LED de fondo. */}
      <PantallaLed posicion={[0, alto + c.h * 0.38, -frente / 2 + 0.25]} ancho={largo * 0.82} alto={c.h * 0.6} animar={animar} />
      <mesh position={[0, alto + c.h * 0.38, -frente / 2 + 0.18]}>
        <boxGeometry args={[largo * 0.86, c.h * 0.64, 0.1]} />
        <meshStandardMaterial color="#050507" />
      </mesh>

      {/* La cabina del DJ. */}
      <group position={[0, alto, 0.2]}>
        <mesh position={[0, 0.55, 0]}>
          <boxGeometry args={[3.2, 1.1, 1]} />
          <meshStandardMaterial color="#09080c" roughness={0.3} metalness={0.5} />
        </mesh>
        <mesh position={[0, 0.55, 0.51]}>
          <planeGeometry args={[3.1, 1]} />
          <meshBasicMaterial color={new THREE.Color(COLOR.magenta).multiplyScalar(1.4)} toneMapped={false} />
        </mesh>
        <Text position={[0, 0.58, 0.52]} fontSize={0.36} letterSpacing={0.2} anchorX="center" anchorY="middle">
          SSIOMAMA
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </Text>
        {[-0.9, 0, 0.9].map((x) => (
          <mesh key={x} position={[x, 1.14, 0]}>
            <boxGeometry args={[0.7, 0.06, 0.55]} />
            <meshStandardMaterial color="#222" emissive="#1b6cff" emissiveIntensity={0.6} />
          </mesh>
        ))}
        <Publico c={{ cx: 0, cz: -0.6, w: 1.4, d: 0.6, x0: -0.7, x1: 0.7, z0: -0.9, z1: -0.3, y0: 0, h: 2 }} personas={1} semilla="dj" baila animar={animar} color="#2d2236" />
      </group>

      {/* Columnas de sonido a los lados. */}
      <Altavoz x={-largo / 2 + 0.6} y={alto} z={frente / 2 - 0.7} alto={2.8} />
      <Altavoz x={largo / 2 - 0.6} y={alto} z={frente / 2 - 0.7} alto={2.8} />
      {[-largo / 2 + 1.2, largo / 2 - 1.2].map((x) => (
        <group key={x} position={[x, c.h - 1.6, frente / 2 + 0.6]}>
          {Array.from({ length: 5 }, (_, i) => (
            <mesh key={i} position={[0, -i * 0.42, 0]} rotation={[0.08 * i, 0, 0]}>
              <boxGeometry args={[1, 0.38, 0.6]} />
              <meshStandardMaterial color="#0b0b0e" roughness={0.6} />
            </mesh>
          ))}
        </group>
      ))}

      {/* El truss de luces sobre el escenario. */}
      <mesh position={[0, c.h - 0.6, frente / 2 - 0.4]}>
        <boxGeometry args={[largo * 0.95, 0.35, 0.35]} />
        <meshStandardMaterial color={COLOR.metal} metalness={0.8} roughness={0.35} wireframe />
      </mesh>
      {[-0.36, -0.12, 0.12, 0.36].map((f, i) => (
        <CabezalMovil
          key={f}
          posicion={[largo * f, c.h - 0.85, frente / 2 - 0.4]}
          color={i % 2 ? COLOR.violeta : COLOR.magenta}
          largo={c.h - 1}
          fase={i * 1.7}
          animar={animar}
        />
      ))}
      <pointLight position={[0, alto + 3, frente / 2]} color={COLOR.magenta} intensity={60} distance={18} decay={1.5} />
    </group>
  );
}

// ── Pista principal ─────────────────────────────────────────────────

function Pista({ zona, c, animar, conGente }: PropsDeAmbiente) {
  const truss = c.y0 + Math.min(c.h - 0.8, 7.5);
  return (
    <group>
      <SueloLed c={c} animar={animar} colores={[COLOR.magenta, COLOR.violeta, "#3b5bff", "#ff6ad5"]} />
      {/* Parrilla de truss sobre la pista. */}
      {[c.z0 + c.d * 0.3, c.z0 + c.d * 0.7].map((z) => (
        <mesh key={z} position={[c.cx, truss, z]}>
          <boxGeometry args={[c.w * 0.92, 0.32, 0.32]} />
          <meshStandardMaterial color={COLOR.metal} metalness={0.8} roughness={0.35} wireframe />
        </mesh>
      ))}
      {[c.x0 + c.w * 0.2, c.x0 + c.w * 0.5, c.x0 + c.w * 0.8].flatMap((x, i) =>
        [c.z0 + c.d * 0.3, c.z0 + c.d * 0.7].map((z, j) => (
          <CabezalMovil
            key={`${i}-${j}`}
            posicion={[x, truss - 0.3, z]}
            color={[COLOR.magenta, COLOR.violeta, COLOR.cian][(i + j) % 3]}
            largo={truss - c.y0 - 0.3}
            fase={i * 2.1 + j * 0.9}
            animar={animar}
          />
        )),
      )}
      <BolaDeEspejos posicion={[c.cx, truss - 1.2, c.cz]} animar={animar} />
      <pointLight position={[c.cx - c.w * 0.25, c.y0 + 4, c.cz]} color={COLOR.magenta} intensity={70} distance={20} decay={1.5} />
      <pointLight position={[c.cx + c.w * 0.25, c.y0 + 4, c.cz]} color={COLOR.violeta} intensity={70} distance={20} decay={1.5} />
      {conGente && <Publico c={c} personas={personasDe(zona, c, 0.7, 150)} semilla={String(zona.id)} baila animar={animar} />}
    </group>
  );
}

// ── La Cueva ────────────────────────────────────────────────────────

function Cueva({ zona, c, animar, conGente, recortar, todas, centro }: PropsDeAmbiente) {
  const { eje, signo } = ladoHaciaElCentro(c);
  // La cabina, contra la pared opuesta a la entrada.
  const cabina: [number, number, number] =
    eje === "z"
      ? [c.cx, c.y0, signo > 0 ? c.z0 + 1.2 : c.z1 - 1.2]
      : [signo > 0 ? c.x0 + 1.2 : c.x1 - 1.2, c.y0, c.cz];
  const pista = useMemo(
    () => ({ ...c, x0: c.x0 + 1, x1: c.x1 - 1, z0: c.z0 + 1, z1: c.z1 - 1, w: c.w - 2, d: c.d - 2 }),
    [c],
  );
  return (
    <group>
      <Suelo c={c} color="#1e0d0a" rugosidad={0.35} metal={0.3} />
      <ParedesDeSala c={c} color={COLOR.ladrillo} alto={c.h} recortar={recortar} sinParedEn={ladosExteriores(c, todas, centro)} />
      <MarcoDeNeon c={c} y={c.y0 + c.h - 0.25} color="#ff4a1c" margen={0.3} />
      <MarcoDeNeon c={c} y={c.y0 + 0.08} color="#ff2a6a" margen={0.3} />
      <group position={cabina}>
        <mesh position={[0, 0.55, 0]}>
          <boxGeometry args={eje === "z" ? [2.6, 1.1, 1] : [1, 1.1, 2.6]} />
          <meshStandardMaterial color="#120806" roughness={0.4} metalness={0.4} />
        </mesh>
        <mesh position={[0, 1.13, 0]}>
          <boxGeometry args={eje === "z" ? [2.4, 0.06, 0.7] : [0.7, 0.06, 2.4]} />
          <meshBasicMaterial color={new THREE.Color("#ff4a1c").multiplyScalar(1.6)} toneMapped={false} />
        </mesh>
      </group>
      <Text
        position={[cabina[0], c.y0 + 2.6, cabina[2]]}
        rotation={[0, eje === "z" ? (signo > 0 ? 0 : Math.PI) : signo > 0 ? Math.PI / 2 : -Math.PI / 2, 0]}
        fontSize={0.8}
        letterSpacing={0.12}
        anchorX="center"
        anchorY="middle"
      >
        LA CUEVA
        <meshBasicMaterial color={new THREE.Color("#ff5a2a").multiplyScalar(2.4)} toneMapped={false} />
      </Text>
      <BolaDeEspejos posicion={[c.cx, c.y0 + c.h - 1, c.cz]} animar={animar} />
      <CabezalMovil posicion={[c.cx - c.w * 0.25, c.y0 + c.h - 0.3, c.cz]} color="#ff4a1c" largo={c.h - 0.4} fase={0.4} animar={animar} />
      <CabezalMovil posicion={[c.cx + c.w * 0.25, c.y0 + c.h - 0.3, c.cz]} color="#ffb000" largo={c.h - 0.4} fase={2.2} animar={animar} />
      <Luz c={c} color="#ff3a14" intensidad={55} />
      {conGente && <Publico c={pista} personas={personasDe(zona, c, 0.7)} semilla={String(zona.id)} baila animar={animar} color="#2b1a1a" />}
    </group>
  );
}

/** Los lados de una zona que coinciden con un muro exterior: ahí no hace falta pared propia. */
function ladosExteriores(c: Caja, todas: ZonaPlano[], centro: Centro): ("n" | "s" | "e" | "o")[] {
  const lados: ("n" | "s" | "e" | "o")[] = [];
  const tol = 1.2;
  if (Math.abs(c.z0 + centro.z) < tol) lados.push("n");
  if (Math.abs(c.z1 - centro.z) < tol) lados.push("s");
  if (Math.abs(c.x0 + centro.x) < tol) lados.push("o");
  if (Math.abs(c.x1 - centro.x) < tol) lados.push("e");
  void todas;
  return lados;
}

// ── Reservados ──────────────────────────────────────────────────────

/** Una fila de reservados a lo largo del lado largo de la zona, mirando al centro del local. */
function FilaDeReservados({ c, color, brillo }: { c: Caja; color: string; brillo: string }) {
  const largoEnX = c.w >= c.d;
  const largo = largoEnX ? c.w : c.d;
  const fondo = Math.min(largoEnX ? c.d : c.w, 3.2);
  const n = Math.max(1, Math.floor(largo / 3.3));
  const paso = largo / n;
  const { eje, signo } = ladoHaciaElCentro(c);
  // Los sofás de espaldas a la pared, mirando al centro del local.
  const rotY = largoEnX
    ? eje === "z" && signo < 0
      ? Math.PI
      : 0
    : eje === "x" && signo < 0
      ? -Math.PI / 2
      : Math.PI / 2;

  return (
    <group>
      {Array.from({ length: n }, (_, i) => {
        const t = -largo / 2 + paso * (i + 0.5);
        const pos: [number, number, number] = largoEnX ? [c.cx + t, c.y0, c.cz] : [c.cx, c.y0, c.cz + t];
        return (
          <group key={i} position={pos} rotation={[0, rotY, 0]}>
            <Reservado ancho={paso - 0.5} fondo={fondo - 0.3} color={color} brillo={brillo} />
            {/* El panel que separa un reservado del siguiente, con su línea de luz. */}
            {i > 0 && (
              <group position={[-paso / 2, 0, 0]}>
                <mesh position={[0, 0.65, -0.2]}>
                  <boxGeometry args={[0.08, 1.3, fondo - 0.6]} />
                  <meshStandardMaterial color="#120f18" roughness={0.6} />
                </mesh>
                <Neon desde={[0, 1.32, -fondo / 2 + 0.2]} hasta={[0, 1.32, fondo / 2 - 0.6]} color={brillo} grosor={0.025} />
              </group>
            )}
          </group>
        );
      })}
    </group>
  );
}

function Boxes({ zona, c, conGente, animar }: PropsDeAmbiente) {
  return (
    <group>
      <Suelo c={c} color="#120c1a" rugosidad={0.8} />
      <FilaDeReservados c={c} color={COLOR.terciopelo} brillo={COLOR.violeta} />
      <MarcoDeNeon c={c} y={c.y0 + Math.min(c.h, 4) - 0.15} color={COLOR.violeta} margen={0.2} />
      <Luz c={c} color={LUZ_DE.boxes} intensidad={25} />
      {conGente && <Publico c={c} personas={personasDe(zona, c, 0.5, 30)} semilla={String(zona.id)} baila={false} animar={animar} color="#251a30" />}
    </group>
  );
}

function Lounge({ zona, c, conGente, animar }: PropsDeAmbiente) {
  // Reservados contra el lado largo más alejado del vacío y un sofá corrido enfrente.
  const filas = useMemo(() => {
    const largoEnX = c.w >= c.d;
    const fondoFila = 3;
    return largoEnX
      ? [
          { ...c, z0: c.z0, z1: c.z0 + fondoFila, d: fondoFila, cz: c.z0 + fondoFila / 2 },
          { ...c, z0: c.z1 - fondoFila, z1: c.z1, d: fondoFila, cz: c.z1 - fondoFila / 2 },
        ]
      : [
          { ...c, x0: c.x0, x1: c.x0 + fondoFila, w: fondoFila, cx: c.x0 + fondoFila / 2 },
          { ...c, x0: c.x1 - fondoFila, x1: c.x1, w: fondoFila, cx: c.x1 - fondoFila / 2 },
        ];
  }, [c]);

  return (
    <group>
      {/* Moqueta violeta y una alfombra central más clara. */}
      <Suelo c={c} color="#1d0f2c" rugosidad={0.95} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[c.cx, c.y0 + 0.012, c.cz]}>
        <planeGeometry args={[c.w * 0.4, c.d * 0.35]} />
        <meshStandardMaterial color="#2c1745" roughness={1} />
      </mesh>
      {filas.map((f, i) => (
        <FilaDeReservados key={i} c={f} color="#4a1d63" brillo={COLOR.dorado} />
      ))}
      {/* La lámpara de araña: un anillo de luces doradas. */}
      <group position={[c.cx, c.y0 + c.h - 0.9, c.cz]}>
        {Array.from({ length: 16 }, (_, i) => {
          const a = (i / 16) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 1.1, Math.sin(i * 1.3) * 0.12, Math.sin(a) * 1.1]}>
              <sphereGeometry args={[0.07, 8, 8]} />
              <meshBasicMaterial color={new THREE.Color("#ffd27a").multiplyScalar(3)} toneMapped={false} />
            </mesh>
          );
        })}
        <mesh>
          <torusGeometry args={[1.1, 0.025, 6, 40]} />
          <meshStandardMaterial color={COLOR.dorado} metalness={1} roughness={0.2} />
        </mesh>
      </group>
      <MarcoDeNeon c={c} y={c.y0 + c.h - 0.12} color={COLOR.dorado} margen={0.15} />
      <Luz c={c} color={LUZ_DE.lounge} intensidad={40} />
      <pointLight position={[c.cx, c.y0 + c.h - 1, c.cz]} color="#ffd27a" intensity={18} distance={9} decay={1.6} />
      {conGente && <Publico c={c} personas={personasDe(zona, c, 0.5, 40)} semilla={String(zona.id)} baila={false} animar={animar} color="#2a1d36" />}
    </group>
  );
}

// ── Barras ──────────────────────────────────────────────────────────

/**
 * Una barra: mostrador, contrabarra de botellas iluminadas y taburetes.
 *
 * El mostrador mira hacia el centro del local y la contrabarra queda contra la
 * pared del fondo de la zona, que es como se monta una barra de verdad: de
 * espaldas a la pared, de cara al público.
 */
function MontarBarra({
  zona,
  c,
  conGente,
  animar,
  encimera,
  luz,
  madera,
}: PropsDeAmbiente & { encimera: string; luz: string; madera: string }) {
  const { eje, signo } = ladoHaciaElCentro(c);
  const largo = eje === "z" ? c.w : c.d;
  const prof = eje === "z" ? c.d : c.w;
  const rotY = eje === "z" ? (signo > 0 ? 0 : Math.PI) : signo > 0 ? Math.PI / 2 : -Math.PI / 2;
  const largoBarra = largo * 0.86;
  // Distancias medidas desde el fondo de la zona hacia el público.
  const zContra = -prof / 2 + 0.35;
  const zMostrador = Math.min(-prof / 2 + 2.6, prof / 2 - 1.4);
  const lamparas = Math.max(2, Math.floor(largoBarra / 1.8));

  return (
    <group position={[c.cx, c.y0, c.cz]} rotation={[0, rotY, 0]}>
      {/* La contrabarra con sus baldas y su luz de fondo. */}
      <mesh position={[0, 1.6, zContra - 0.1]}>
        <boxGeometry args={[largoBarra, 3.2, 0.2]} />
        <meshStandardMaterial color="#0b0910" roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.95, zContra + 0.005]}>
        <planeGeometry args={[largoBarra - 0.2, 1.5]} />
        <meshBasicMaterial color={new THREE.Color(luz).multiplyScalar(0.55)} toneMapped={false} />
      </mesh>
      {[1.2, 1.62, 2.04, 2.46].map((y) => (
        <mesh key={y} position={[0, y, zContra + 0.12]}>
          <boxGeometry args={[largoBarra - 0.2, 0.03, 0.26]} />
          <meshStandardMaterial color="#2a2530" metalness={0.5} roughness={0.3} />
        </mesh>
      ))}
      <Botellas x0={-largoBarra / 2 + 0.2} x1={largoBarra / 2 - 0.2} z={zContra + 0.12} y={1.23} baldas={4} semilla={String(zona.id)} />
      <mesh position={[0, 0.45, zContra + 0.3]}>
        <boxGeometry args={[largoBarra, 0.9, 0.5]} />
        <meshStandardMaterial color={madera} roughness={0.6} />
      </mesh>

      {/* El mostrador: frente iluminado y encimera. */}
      <mesh position={[0, 0.55, zMostrador]}>
        <boxGeometry args={[largoBarra, 1.1, 0.65]} />
        <meshStandardMaterial color={madera} roughness={0.5} metalness={0.15} />
      </mesh>
      <mesh position={[0, 1.13, zMostrador + 0.05]}>
        <boxGeometry args={[largoBarra + 0.1, 0.06, 0.8]} />
        <meshStandardMaterial color={encimera} roughness={0.12} metalness={0.5} />
      </mesh>
      <Neon desde={[-largoBarra / 2, 1.06, zMostrador + 0.34]} hasta={[largoBarra / 2, 1.06, zMostrador + 0.34]} color={luz} grosor={0.03} intensidad={2.4} />
      <Neon desde={[-largoBarra / 2, 0.06, zMostrador + 0.34]} hasta={[largoBarra / 2, 0.06, zMostrador + 0.34]} color={luz} grosor={0.025} intensidad={1.6} />

      {/* Lámparas colgantes sobre el mostrador. */}
      {Array.from({ length: lamparas }, (_, i) => {
        const x = -largoBarra / 2 + (largoBarra / lamparas) * (i + 0.5);
        const techo = Math.min(c.h, ALTURA_DE_PLANTA - 0.3);
        return (
          <group key={i} position={[x, 0, zMostrador]}>
            <mesh position={[0, (techo + 2.2) / 2, 0]}>
              <cylinderGeometry args={[0.006, 0.006, techo - 2.2]} />
              <meshBasicMaterial color="#333" />
            </mesh>
            <mesh position={[0, 2.15, 0]}>
              <sphereGeometry args={[0.09, 10, 10]} />
              <meshBasicMaterial color={new THREE.Color(luz).multiplyScalar(3)} toneMapped={false} />
            </mesh>
          </group>
        );
      })}

      {/* Taburetes del lado del público. */}
      {Array.from({ length: Math.floor(largoBarra / 0.75) }, (_, i) => (
        <Taburete key={i} x={-largoBarra / 2 + 0.4 + i * 0.75} y={0} z={zMostrador + 0.85} />
      ))}

      {/* Quien atiende, detrás del mostrador. */}
      {conGente && (
        <Publico
          c={{ cx: 0, cz: (zContra + zMostrador) / 2, w: largoBarra - 1, d: 0.7, x0: -largoBarra / 2 + 0.5, x1: largoBarra / 2 - 0.5, z0: zMostrador - 0.95, z1: zMostrador - 0.45, y0: 0, h: 2 }}
          personas={Math.max(2, Math.round(largoBarra / 3))}
          semilla={`${zona.id}-personal`}
          baila={false}
          animar={animar}
          color="#101015"
        />
      )}
      <pointLight position={[0, 2.6, zMostrador]} color={luz} intensity={30} distance={10} decay={1.6} />
    </group>
  );
}

function Barra(p: PropsDeAmbiente) {
  return (
    <group>
      <Suelo c={p.c} color="#15121a" rugosidad={0.4} metal={0.3} />
      <MontarBarra {...p} encimera="#e9e4dc" luz={LUZ_DE.barra} madera="#1a1410" />
      {p.conGente && <PublicoDeBarra p={p} c={p.c} />}
    </group>
  );
}

/** El público de pie delante de la barra: en la franja de la zona que da al local. */
function PublicoDeBarra({ p, c }: { p: PropsDeAmbiente; c: Caja }) {
  const { eje, signo } = ladoHaciaElCentro(c);
  const franja: Caja =
    eje === "z"
      ? signo > 0
        ? { ...c, z0: c.z1 - Math.min(3, c.d / 2), d: Math.min(3, c.d / 2) }
        : { ...c, z1: c.z0 + Math.min(3, c.d / 2), d: Math.min(3, c.d / 2) }
      : signo > 0
        ? { ...c, x0: c.x1 - Math.min(3, c.w / 2), w: Math.min(3, c.w / 2) }
        : { ...c, x1: c.x0 + Math.min(3, c.w / 2), w: Math.min(3, c.w / 2) };
  return <Publico c={franja} personas={personasDe(p.zona, c, 0.45, 40)} semilla={String(p.zona.id)} baila={false} animar={p.animar} />;
}

function BarraVip(p: PropsDeAmbiente) {
  return (
    <group>
      <Suelo c={p.c} color="#1a1220" rugosidad={0.3} metal={0.4} />
      <MontarBarra {...p} encimera="#f4efe6" luz={LUZ_DE["barra-vip"]} madera="#141016" />
      <MarcoDeNeon c={p.c} y={p.c.y0 + p.c.h - 0.12} color={COLOR.dorado} />
      {p.conGente && <PublicoDeBarra p={p} c={p.c} />}
    </group>
  );
}

function Cocteleria(p: PropsDeAmbiente) {
  const { c, zona, conGente, animar, recortar, todas, centro } = p;
  const azar = useMemo(() => aleatorio(String(zona.id)), [zona.id]);
  const mesas = useMemo(() => {
    const lista: [number, number][] = [];
    for (let i = 0; i < 6; i++) lista.push([c.x0 + 1.5 + azar() * (c.w - 3), c.z0 + 1.5 + azar() * (c.d * 0.45)]);
    return lista;
  }, [c, azar]);
  return (
    <group>
      {/* Parquet cálido: es el rincón tranquilo de la casa. */}
      <Suelo c={c} color={COLOR.madera} rugosidad={0.55} metal={0.05} />
      <ParedesDeSala c={c} color="#1c130d" alto={Math.min(c.h, ALTURA_DE_PLANTA - LOSA_SEGURA)} recortar={recortar} sinParedEn={ladosExteriores(c, todas, centro)} />
      <MontarBarra {...p} encimera="#b08d57" luz={LUZ_DE.cocteleria} madera={COLOR.maderaClara} />
      {mesas.map(([x, z], i) => (
        <group key={i}>
          <MesaAlta x={x} y={c.y0} z={z} color="#3a2618" brillo="#ffb066" />
          <Taburete x={x + 0.55} y={c.y0} z={z} color="#5a3a24" />
          <Taburete x={x - 0.55} y={c.y0} z={z} color="#5a3a24" />
        </group>
      ))}
      <Luz c={c} color="#ff9a3c" intensidad={30} />
      {conGente && <Publico c={c} personas={personasDe(zona, c, 0.5, 25)} semilla={String(zona.id)} baila={false} animar={animar} color="#2a1f1a" />}
    </group>
  );
}

const LOSA_SEGURA = 0.35;

// ── Vestíbulo ───────────────────────────────────────────────────────

function Vestibulo({ zona, c, conGente, animar }: PropsDeAmbiente) {
  const { eje, signo } = ladoHaciaElCentro(c);
  void eje;
  void signo;
  // La calle queda en +z (la fachada): la taquilla mira a la puerta y los
  // tornos de control de acceso cierran el paso hacia dentro.
  const zTornos = c.z0 + c.d * 0.35;
  return (
    <group>
      <Suelo c={c} color="#1b1922" rugosidad={0.15} metal={0.5} />
      {/* La taquilla. */}
      <group position={[c.x0 + 1.4, c.y0, c.z1 - 2.2]}>
        <mesh position={[0, 0.55, 0]}>
          <boxGeometry args={[2.2, 1.1, 0.8]} />
          <meshStandardMaterial color="#0f0d14" roughness={0.3} metalness={0.4} />
        </mesh>
        <Neon desde={[-1.1, 1.1, 0.41]} hasta={[1.1, 1.1, 0.41]} color={COLOR.cian} grosor={0.025} />
        <mesh position={[0.4, 1.35, 0]} rotation={[-0.3, 0, 0]}>
          <boxGeometry args={[0.5, 0.32, 0.03]} />
          <meshBasicMaterial color={new THREE.Color("#7fd6ff").multiplyScalar(1.4)} toneMapped={false} />
        </mesh>
        <Text position={[0, 2.3, 0]} fontSize={0.32} letterSpacing={0.2} anchorX="center" anchorY="middle">
          TAQUILLA
          <meshBasicMaterial color={new THREE.Color("#7fd6ff").multiplyScalar(2)} toneMapped={false} />
        </Text>
      </group>
      {/* El guardarropa: mostrador y percheros con abrigos. */}
      <group position={[c.x1 - 1.6, c.y0, c.z1 - 3]}>
        <mesh position={[0, 0.55, 0.9]}>
          <boxGeometry args={[2.4, 1.1, 0.6]} />
          <meshStandardMaterial color="#0f0d14" roughness={0.3} metalness={0.4} />
        </mesh>
        {[-0.5, 0.5].map((dz) => (
          <group key={dz} position={[0, 0, dz - 0.4]}>
            <mesh position={[0, 1.8, 0]}>
              <boxGeometry args={[2.2, 0.03, 0.03]} />
              <meshStandardMaterial color={COLOR.metal} metalness={0.9} roughness={0.2} />
            </mesh>
            {Array.from({ length: 9 }, (_, i) => (
              <mesh key={i} position={[-1 + i * 0.25, 1.35, 0]}>
                <boxGeometry args={[0.12, 0.85, 0.45]} />
                <meshStandardMaterial color={["#1d1d24", "#3a2a1a", "#1a2236", "#2a1630"][i % 4]} roughness={0.9} />
              </mesh>
            ))}
          </group>
        ))}
        <Text position={[0, 2.4, 0.9]} fontSize={0.28} letterSpacing={0.2} anchorX="center" anchorY="middle">
          GUARDARROPA
          <meshBasicMaterial color={new THREE.Color("#7fd6ff").multiplyScalar(2)} toneMapped={false} />
        </Text>
      </group>
      {/* El control de acceso: tornos con su luz verde, donde se escanea la entrada. */}
      {[-1.2, 0, 1.2].map((dx) => (
        <group key={dx} position={[c.cx + dx, c.y0, zTornos]}>
          <mesh position={[0, 0.5, 0]}>
            <boxGeometry args={[0.25, 1, 0.9]} />
            <meshStandardMaterial color="#cfd3da" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, 1.02, 0.3]}>
            <boxGeometry args={[0.2, 0.04, 0.2]} />
            <meshBasicMaterial color={new THREE.Color("#3ee6a0").multiplyScalar(2.4)} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {/* La pared del logotipo frente a la puerta. */}
      <Text position={[c.cx, c.y0 + 2.6, zTornos - 0.6]} rotation={[0, Math.PI, 0]} fontSize={0.6} letterSpacing={0.15} anchorX="center" anchorY="middle">
        BIENVENIDOS
        <meshBasicMaterial color={new THREE.Color(COLOR.magenta).multiplyScalar(2)} toneMapped={false} />
      </Text>
      <Luz c={c} color={LUZ_DE.vestibulo} intensidad={28} />
      {conGente && (
        <Publico
          c={{ ...c, z0: zTornos + 0.8, d: c.z1 - zTornos - 0.8 }}
          personas={8}
          semilla={String(zona.id)}
          baila={false}
          animar={animar}
          color="#1f1a26"
        />
      )}
    </group>
  );
}

// ── Baños ───────────────────────────────────────────────────────────

function Banos({ c, recortar, todas, centro }: PropsDeAmbiente) {
  const largoEnX = c.w >= c.d;
  const n = Math.max(2, Math.floor((largoEnX ? c.w : c.d) / 1.4) - 2);
  return (
    <group>
      <Suelo c={c} color="#2a3038" rugosidad={0.2} metal={0.2} />
      <ParedesDeSala c={c} color="#262b33" alto={Math.min(c.h, 3.2)} recortar={recortar} sinParedEn={ladosExteriores(c, todas, centro)} />
      {/* Cabinas contra el fondo y lavabos con espejo enfrente. */}
      {Array.from({ length: n }, (_, i) => {
        const t = (largoEnX ? c.x0 : c.z0) + 1.2 + i * 1.4;
        return largoEnX ? (
          <mesh key={i} position={[t, c.y0 + 1, c.z0 + 0.9]}>
            <boxGeometry args={[0.06, 2, 1.6]} />
            <meshStandardMaterial color="#3a4250" roughness={0.4} />
          </mesh>
        ) : (
          <mesh key={i} position={[c.x0 + 0.9, c.y0 + 1, t]}>
            <boxGeometry args={[1.6, 2, 0.06]} />
            <meshStandardMaterial color="#3a4250" roughness={0.4} />
          </mesh>
        );
      })}
      <mesh position={largoEnX ? [c.cx, c.y0 + 0.45, c.z1 - 0.5] : [c.x1 - 0.5, c.y0 + 0.45, c.cz]}>
        <boxGeometry args={largoEnX ? [c.w * 0.6, 0.9, 0.6] : [0.6, 0.9, c.d * 0.6]} />
        <meshStandardMaterial color="#d9dde3" roughness={0.15} />
      </mesh>
      <Neon
        desde={largoEnX ? [c.cx - c.w * 0.3, c.y0 + 2.1, c.z1 - 0.2] : [c.x1 - 0.2, c.y0 + 2.1, c.cz - c.d * 0.3]}
        hasta={largoEnX ? [c.cx + c.w * 0.3, c.y0 + 2.1, c.z1 - 0.2] : [c.x1 - 0.2, c.y0 + 2.1, c.cz + c.d * 0.3]}
        color={COLOR.cian}
        intensidad={2}
      />
      <Luz c={c} color={LUZ_DE.banos} intensidad={18} />
    </group>
  );
}

// ── Escalera ────────────────────────────────────────────────────────

/**
 * La escalera entre plantas. Arranca en el lado más lejano de la planta alta y
 * desembarca en el borde que toca con una zona de arriba, para que se pueda
 * subir caminando de una planta a otra.
 */
function Escalera({ c, todas, centro }: PropsDeAmbiente) {
  const altas = useMemo(() => todas.filter((z) => (z.piso ?? 0) > 0).map((z) => caja(z, centro)), [todas, centro]);
  const largoEnZ = c.d >= c.w;
  const largo = largoEnZ ? c.d : c.w;
  const ancho = Math.min(largoEnZ ? c.w : c.d, 3.2) - 0.4;
  // ¿Qué extremo toca una zona de la planta alta?
  const tocaInicio = largoEnZ
    ? altas.some((a) => dentro(a, c.cx, c.z0 - 0.5))
    : altas.some((a) => dentro(a, c.x0 - 0.5, c.cz));
  const huella = 0.3;
  const peldanos = Math.round(ALTURA_DE_PLANTA / 0.18);
  const recorrido = Math.min(largo - 0.6, peldanos * huella);
  const contrahuella = ALTURA_DE_PLANTA / peldanos;
  const paso = recorrido / peldanos;
  const malla = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const m = malla.current;
    if (!m) return;
    const o = new THREE.Object3D();
    for (let i = 0; i < peldanos; i++) {
      // Del extremo libre hacia el que toca la planta alta.
      const avance = largo / 2 - 0.3 - (i + 0.5) * paso;
      const t = tocaInicio ? avance : -avance;
      const y = (i + 1) * contrahuella;
      if (largoEnZ) o.position.set(c.cx, c.y0 + y / 2, c.cz + t);
      else o.position.set(c.cx + t, c.y0 + y / 2, c.cz);
      o.scale.set(1, y, 1);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [c, largo, paso, peldanos, contrahuella, tocaInicio, largoEnZ]);

  const fin = tocaInicio ? -1 : 1;
  const z0 = largo / 2 - 0.3;
  const z1 = largo / 2 - 0.3 - recorrido;
  const p = (u: number, lado: number, y: number): [number, number, number] =>
    largoEnZ ? [c.cx + lado * (ancho / 2), c.y0 + y, c.cz - fin * u] : [c.cx - fin * u, c.y0 + y, c.cz + lado * (ancho / 2)];

  return (
    <group>
      <instancedMesh ref={malla} args={[undefined, undefined, peldanos]}>
        <boxGeometry args={largoEnZ ? [ancho, 1, paso] : [paso, 1, ancho]} />
        <meshStandardMaterial color="#1c1922" roughness={0.5} metalness={0.3} />
      </instancedMesh>
      {/* Pasamanos de neón que suben con la escalera. */}
      {[-1, 1].map((lado) => (
        <Neon key={lado} desde={p(z0, lado, 1)} hasta={p(z1, lado, ALTURA_DE_PLANTA + 1)} color={COLOR.magenta} grosor={0.03} intensidad={2} />
      ))}
      {/* Una luz en cada peldaño, como balizas. */}
      {Array.from({ length: Math.floor(peldanos / 3) }, (_, i) => {
        const k = i * 3 + 1;
        const u = z0 - (k + 0.5) * paso;
        return (
          <mesh key={i} position={p(u, 0, (k + 1) * contrahuella + 0.01)} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={largoEnZ ? [ancho * 0.9, 0.04] : [0.04, ancho * 0.9]} />
            <meshBasicMaterial color={new THREE.Color(COLOR.violeta).multiplyScalar(2)} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
}

// ── Terraza ─────────────────────────────────────────────────────────

function Terraza({ zona, c, conGente, animar }: PropsDeAmbiente) {
  const azar = useMemo(() => aleatorio(String(zona.id)), [zona.id]);
  const sofas = useMemo(() => {
    const lista: { x: number; z: number; r: number }[] = [];
    const filas = Math.max(1, Math.floor(c.d / 4.5));
    for (let i = 0; i < filas; i++) {
      lista.push({ x: c.x0 + 2.2, z: c.z0 + 2.4 + i * 4.5, r: Math.PI / 2 });
      lista.push({ x: c.x1 - 2.2, z: c.z0 + 2.4 + i * 4.5, r: -Math.PI / 2 });
    }
    return lista;
  }, [c]);
  const postes: [number, number][] = [
    [c.x0 + 0.4, c.z0 + 0.4],
    [c.x1 - 0.4, c.z0 + 0.4],
    [c.x1 - 0.4, c.z1 - 0.4],
    [c.x0 + 0.4, c.z1 - 0.4],
  ];
  const altoPoste = 3.4;

  return (
    <group>
      {/* Tarima de madera exterior. */}
      <Suelo c={c} color="#4a3322" rugosidad={0.85} />
      {Array.from({ length: Math.floor(c.w / 0.4) }, (_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[c.x0 + 0.2 + i * 0.4, c.y0 + 0.008, c.cz]}>
          <planeGeometry args={[0.02, c.d]} />
          <meshBasicMaterial color="#2a1c12" />
        </mesh>
      ))}
      {/* Jardineras a lo largo del parapeto. */}
      {Array.from({ length: Math.floor(c.d / 2.2) }, (_, i) => (
        <Planta key={`p${i}`} x={c.x1 - 0.5} y={c.y0} z={c.z0 + 1.1 + i * 2.2} alto={1 + azar() * 0.9} />
      ))}
      {Array.from({ length: Math.floor(c.w / 2.6) }, (_, i) => (
        <Planta key={`q${i}`} x={c.x0 + 1.3 + i * 2.6} y={c.y0} z={c.z1 - 0.5} alto={0.8 + azar() * 0.8} />
      ))}
      {/* Sofás de exterior con mesa baja. */}
      {sofas.map((s, i) => (
        <group key={i} position={[s.x, c.y0, s.z]} rotation={[0, s.r, 0]}>
          <Reservado ancho={3} fondo={2.4} color="#d8cdb8" brillo="#ffcf8a" />
        </group>
      ))}
      {/* Estufas de exterior con su llama. */}
      {[
        [c.cx - c.w * 0.18, c.cz],
        [c.cx + c.w * 0.18, c.cz + c.d * 0.25],
      ].map(([x, z], i) => (
        <group key={i} position={[x, c.y0, z]}>
          <mesh position={[0, 1.1, 0]}>
            <cylinderGeometry args={[0.05, 0.14, 2.2, 10]} />
            <meshStandardMaterial color={COLOR.metal} metalness={0.9} roughness={0.3} />
          </mesh>
          <mesh position={[0, 2.3, 0]}>
            <coneGeometry args={[0.45, 0.25, 16, 1, true]} />
            <meshStandardMaterial color={COLOR.metal} metalness={0.9} roughness={0.3} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 1.95, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.5, 10]} />
            <meshBasicMaterial color={new THREE.Color("#ff7a1a").multiplyScalar(2.6)} toneMapped={false} />
          </mesh>
          <pointLight position={[0, 2, 0]} color="#ff8a3a" intensity={10} distance={6} decay={2} />
        </group>
      ))}
      {/* Postes y guirnaldas de bombillas cruzando la terraza. */}
      {postes.map(([x, z], i) => (
        <mesh key={i} position={[x, c.y0 + altoPoste / 2, z]}>
          <cylinderGeometry args={[0.05, 0.05, altoPoste, 8]} />
          <meshStandardMaterial color="#2a2018" roughness={0.8} />
        </mesh>
      ))}
      <Guirnalda desde={[postes[0][0], c.y0 + altoPoste, postes[0][1]]} hasta={[postes[2][0], c.y0 + altoPoste, postes[2][1]]} bombillas={22} caida={0.9} />
      <Guirnalda desde={[postes[1][0], c.y0 + altoPoste, postes[1][1]]} hasta={[postes[3][0], c.y0 + altoPoste, postes[3][1]]} bombillas={22} caida={0.9} />
      <Guirnalda desde={[postes[0][0], c.y0 + altoPoste, postes[0][1]]} hasta={[postes[1][0], c.y0 + altoPoste, postes[1][1]]} bombillas={12} caida={0.4} />
      <Guirnalda desde={[postes[3][0], c.y0 + altoPoste, postes[3][1]]} hasta={[postes[2][0], c.y0 + altoPoste, postes[2][1]]} bombillas={12} caida={0.4} />
      <Luz c={c} color={LUZ_DE.terraza} intensidad={35} alto={3} />
      {conGente && <Publico c={c} personas={personasDe(zona, c, 0.45, 60)} semilla={String(zona.id)} baila={false} animar={animar} color="#2a2430" />}
    </group>
  );
}

// ── Balcón y mirador ────────────────────────────────────────────────

function Balcon({ zona, c, conGente, animar }: PropsDeAmbiente) {
  const largoEnX = c.w >= c.d;
  const n = Math.max(2, Math.floor((largoEnX ? c.w : c.d) / 2.4));
  return (
    <group>
      <Suelo c={c} color="#18131f" rugosidad={0.35} metal={0.35} />
      {Array.from({ length: n }, (_, i) => {
        const t = (largoEnX ? c.x0 : c.z0) + (i + 0.5) * ((largoEnX ? c.w : c.d) / n);
        // Las mesas altas, en la mitad que da a la baranda (al norte en el plano, hacia la pista).
        const x = largoEnX ? t : c.x0 + 1.1;
        const z = largoEnX ? c.z0 + 1.1 : t;
        return (
          <group key={i}>
            <MesaAlta x={x} y={c.y0} z={z} brillo={COLOR.violeta} />
            <Taburete x={x + 0.5} y={c.y0} z={z + 0.3} />
            <Taburete x={x - 0.5} y={c.y0} z={z + 0.3} />
          </group>
        );
      })}
      <MarcoDeNeon c={c} y={c.y0 + c.h - 0.12} color={LUZ_DE.balcon} margen={0.2} />
      <Luz c={c} color={LUZ_DE.balcon} intensidad={22} />
      {conGente && <Publico c={c} personas={personasDe(zona, c, 0.5, 45)} semilla={String(zona.id)} baila={false} animar={animar} color="#251c2e" />}
    </group>
  );
}

function Generico({ zona, c }: PropsDeAmbiente) {
  const color = LUZ_DE.generico;
  return (
    <group>
      <Suelo c={c} color={COLOR.concretoClaro} />
      <MarcoDeNeon c={c} y={c.y0 + 0.05} color={color} />
      <Luz c={c} color={color} intensidad={14} />
      <Text position={[c.cx, c.y0 + 1.6, c.cz]} fontSize={0.5} anchorX="center" anchorY="middle">
        {zona.nombre.toUpperCase()}
        <meshBasicMaterial color={new THREE.Color(color).multiplyScalar(1.6)} toneMapped={false} />
      </Text>
    </group>
  );
}

const POR_AMBIENTE: Record<Ambiente, (p: PropsDeAmbiente) => React.JSX.Element> = {
  escenario: Escenario,
  pista: Pista,
  cueva: Cueva,
  boxes: Boxes,
  lounge: Lounge,
  barra: Barra,
  "barra-vip": BarraVip,
  cocteleria: Cocteleria,
  vestibulo: Vestibulo,
  banos: Banos,
  escalera: Escalera,
  terraza: Terraza,
  balcon: Balcon,
  generico: Generico,
};

/** El ambiente de una zona, ya montado. */
export function AmbienteDeZona(props: Omit<PropsDeAmbiente, "c">) {
  const c = useMemo(() => caja(props.zona, props.centro), [props.zona, props.centro]);
  const Componente = POR_AMBIENTE[ambienteDe(props.zona, props.todas)];
  return <Componente {...props} c={c} />;
}
