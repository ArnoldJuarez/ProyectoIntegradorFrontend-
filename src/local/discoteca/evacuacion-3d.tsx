import { Billboard, Line, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { ElementoPlano, PuertaPlano, ZonaPlano } from "../evacuacion";
import { Estado, Simulacion, type Incendio } from "../simulador/motor";
import { calcularCampo, construirRejilla, rutasDeZonas, type Rejilla } from "../simulador/rejilla";
import { ALTURA_DE_PLANTA, type Centro } from "./comun";

/**
 * La capa de evacuación del 3D: las rutas pintadas en el suelo, los elementos
 * de seguridad en su sitio y, si se pide, la evacuación simulada con la gente
 * caminando hacia las salidas.
 *
 * Usa exactamente la misma rejilla y el mismo motor que el mapa 2D del
 * simulador: lo que se ve aquí y los números de allí son la misma simulación.
 */

const VERDE = "#3ee6a0";
const ROJO = "#ff3b4e";

type Props = {
  ancho: number;
  fondo: number;
  zonas: ZonaPlano[];
  puertas: PuertaPlano[];
  elementos: ElementoPlano[];
  centro: Centro;
  plantas: { baja: boolean; alta: boolean };
};

const visible = (piso: number, plantas: Props["plantas"]) => (piso > 0 ? plantas.alta : plantas.baja);

/** Las rutas de cada zona hasta su salida, como líneas verdes que avanzan. */
export function RutasEn3D({ ancho, fondo, zonas, puertas, centro, plantas }: Omit<Props, "elementos">) {
  const rutas = useMemo(() => {
    const r = construirRejilla(ancho, fondo, zonas, puertas);
    return rutasDeZonas(r, calcularCampo(r));
  }, [ancho, fondo, zonas, puertas]);

  const material = useRef<(THREE.Material & { dashOffset: number })[]>([]);
  useFrame((_, delta) => {
    for (const m of material.current) if (m) m.dashOffset -= delta * 1.6;
  });

  // Cada ruta se parte por plantas: un tramo de línea por planta recorrida.
  const tramos = useMemo(() => {
    const lista: { puntos: [number, number, number][]; piso: number }[] = [];
    for (const { ruta } of rutas) {
      let actual: { puntos: [number, number, number][]; piso: number } | null = null;
      for (const q of ruta) {
        if (!actual || actual.piso !== q.piso) {
          if (actual && actual.puntos.length > 1) lista.push(actual);
          actual = { puntos: [], piso: q.piso };
        }
        actual.puntos.push([q.x - centro.x, q.piso * ALTURA_DE_PLANTA + 0.06, q.y - centro.z]);
      }
      if (actual && actual.puntos.length > 1) lista.push(actual);
    }
    return lista;
  }, [rutas, centro]);

  return (
    <group>
      {tramos
        .filter((t) => visible(t.piso, plantas))
        .map((t, i) => (
          <Line
            key={i}
            points={t.puntos}
            color={new THREE.Color(VERDE).multiplyScalar(2.2)}
            lineWidth={4}
            dashed
            dashSize={0.6}
            gapSize={0.35}
            toneMapped={false}
            ref={(l) => {
              const m = (l as unknown as { material?: THREE.Material & { dashOffset: number } } | null)?.material;
              if (m) material.current[i] = m;
            }}
          />
        ))}
    </group>
  );
}

/** Cada elemento de seguridad con un objeto reconocible. */
export function ElementosEn3D({ elementos, centro, plantas }: Pick<Props, "elementos" | "centro" | "plantas">) {
  return (
    <group>
      {elementos
        .filter((e) => visible(e.piso ?? 0, plantas))
        .map((e) => {
          const pos: [number, number, number] = [e.x - centro.x, (e.piso ?? 0) * ALTURA_DE_PLANTA, e.y - centro.z];
          return (
            <group key={e.id || `${e.tipo}-${e.x}-${e.y}`} position={pos}>
              <Elemento tipo={e.tipo} nombre={e.nombre} />
            </group>
          );
        })}
    </group>
  );
}

function Cartel({ texto, color, y, ancho = 1.6 }: { texto: string; color: string; y: number; ancho?: number }) {
  return (
    <Billboard position={[0, y, 0]}>
      <mesh>
        <planeGeometry args={[ancho, 0.36]} />
        <meshBasicMaterial color={new THREE.Color(color).multiplyScalar(0.55)} toneMapped={false} />
      </mesh>
      <Text position={[0, 0, 0.01]} fontSize={0.2} anchorX="center" anchorY="middle" maxWidth={ancho - 0.1}>
        {texto}
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </Text>
    </Billboard>
  );
}

function Elemento({ tipo, nombre }: { tipo: ElementoPlano["tipo"]; nombre: string }) {
  switch (tipo) {
    case "EXTINTOR":
      return (
        <group>
          <mesh position={[0, 0.45, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.6, 14]} />
            <meshStandardMaterial color="#d61f2c" roughness={0.35} metalness={0.3} emissive="#5a0a10" />
          </mesh>
          <mesh position={[0, 0.8, 0]}>
            <cylinderGeometry args={[0.04, 0.06, 0.1, 10]} />
            <meshStandardMaterial color="#222" />
          </mesh>
          <Cartel texto="EXTINTOR" color={ROJO} y={1.25} ancho={1.1} />
        </group>
      );
    case "BOTIQUIN":
      return (
        <group position={[0, 1.4, 0]}>
          <mesh>
            <boxGeometry args={[0.45, 0.35, 0.15]} />
            <meshStandardMaterial color="#f2f2f2" />
          </mesh>
          <mesh position={[0, 0, 0.08]}>
            <boxGeometry args={[0.08, 0.24, 0.01]} />
            <meshBasicMaterial color={new THREE.Color(VERDE).multiplyScalar(1.5)} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, 0.08]}>
            <boxGeometry args={[0.24, 0.08, 0.01]} />
            <meshBasicMaterial color={new THREE.Color(VERDE).multiplyScalar(1.5)} toneMapped={false} />
          </mesh>
          <Cartel texto={nombre.toUpperCase().includes("DEA") ? "BOTIQUÍN · DEA" : "BOTIQUÍN"} color={VERDE} y={0.5} ancho={1.5} />
        </group>
      );
    case "LUZ_EMERGENCIA":
      return (
        <mesh position={[0, 2.5, 0]}>
          <boxGeometry args={[0.35, 0.1, 0.12]} />
          <meshBasicMaterial color={new THREE.Color("#fffbe0").multiplyScalar(3)} toneMapped={false} />
        </mesh>
      );
    case "ALARMA":
      return (
        <group position={[0, 1.4, 0]}>
          <mesh>
            <boxGeometry args={[0.16, 0.16, 0.08]} />
            <meshBasicMaterial color={new THREE.Color(ROJO).multiplyScalar(1.8)} toneMapped={false} />
          </mesh>
          <Cartel texto="ALARMA" color={ROJO} y={0.45} ancho={0.9} />
        </group>
      );
    case "ZONA_SEGURA":
      return (
        <group>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
            <circleGeometry args={[0.9, 32]} />
            <meshBasicMaterial color={new THREE.Color(VERDE).multiplyScalar(0.9)} transparent opacity={0.55} toneMapped={false} />
          </mesh>
          <Cartel texto="ZONA SEGURA EN SISMO" color={VERDE} y={2.2} ancho={2.3} />
        </group>
      );
    case "PUNTO_REUNION":
      return (
        <group>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
            <ringGeometry args={[2.2, 2.6, 48]} />
            <meshBasicMaterial color={new THREE.Color(VERDE).multiplyScalar(2)} toneMapped={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
            <circleGeometry args={[2.2, 48]} />
            <meshBasicMaterial color={VERDE} transparent opacity={0.18} />
          </mesh>
          <mesh position={[0, 1.4, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 2.8, 8]} />
            <meshStandardMaterial color="#bbb" metalness={0.8} roughness={0.3} />
          </mesh>
          <Cartel texto="PUNTO DE REUNIÓN" color={VERDE} y={3} ancho={2.2} />
        </group>
      );
  }
}

// ── La evacuación en movimiento ─────────────────────────────────────

/**
 * La simulación corriendo dentro de la escena: cada persona es una figura que
 * camina hacia su salida, en ámbar si hace cola y en rojo si el fuego la alcanzó.
 */
export function EvacuacionEn3D({
  ancho,
  fondo,
  zonas,
  puertas,
  centro,
  personas,
  incendio,
  velocidad,
  alTerminar,
  alAvanzar,
}: Omit<Props, "elementos" | "plantas"> & {
  personas: number;
  incendio: Incendio | null;
  velocidad: number;
  alTerminar?: (s: Simulacion) => void;
  alAvanzar?: (s: Simulacion) => void;
}) {
  const rejilla: Rejilla = useMemo(() => construirRejilla(ancho, fondo, zonas, puertas), [ancho, fondo, zonas, puertas]);
  const sim = useMemo(() => new Simulacion(rejilla, { personas, incendio, semilla: "3d" }), [rejilla, personas, incendio]);
  const malla = useRef<THREE.InstancedMesh>(null);
  const fuego = useRef<THREE.Mesh>(null);
  const o = useMemo(() => new THREE.Object3D(), []);
  const colores = useMemo(
    () => ({
      camina: new THREE.Color("#7fe7ff").multiplyScalar(1.6),
      cola: new THREE.Color("#ffbe55").multiplyScalar(1.8),
      espera: new THREE.Color("#d9d3e3"),
      escalera: new THREE.Color("#a374ff").multiplyScalar(1.6),
      herida: new THREE.Color(ROJO).multiplyScalar(2),
    }),
    [],
  );
  const avisado = useRef(false);
  const ultimoAviso = useRef(0);

  useEffect(() => {
    avisado.current = false;
  }, [sim]);

  useFrame((_, delta) => {
    const m = malla.current;
    if (!m) return;
    sim.avanzar(Math.min(0.1, delta) * velocidad);
    sim.personas.forEach((p, i) => {
      const fuera = p.estado === Estado.Fuera;
      o.position.set(p.x - centro.x, p.piso * ALTURA_DE_PLANTA + (fuera ? -50 : 0.85), p.y - centro.z);
      o.scale.setScalar(fuera ? 0 : 1);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(
        i,
        p.afectada
          ? colores.herida
          : p.estado === Estado.EnCola
            ? colores.cola
            : p.estado === Estado.EnEscalera
              ? colores.escalera
              : p.estado === Estado.Esperando
                ? colores.espera
                : colores.camina,
      );
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;

    if (fuego.current && sim.incendio) {
      const r = sim.radioDelFuego * (1 + Math.sin(performance.now() / 90) * 0.04);
      fuego.current.scale.set(r, Math.max(1, r * 0.6), r);
    }

    const ahora = performance.now();
    if (alAvanzar && ahora - ultimoAviso.current > 250) {
      ultimoAviso.current = ahora;
      alAvanzar(sim);
    }
    if (sim.terminada && !avisado.current) {
      avisado.current = true;
      alTerminar?.(sim);
    }
  });

  return (
    <group>
      <instancedMesh key={sim.personas.length} ref={malla} args={[undefined, undefined, Math.max(1, sim.personas.length)]} frustumCulled={false}>
        <capsuleGeometry args={[0.2, 1.1, 4, 8]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      {incendio && (
        <group position={[incendio.x - centro.x, incendio.piso * ALTURA_DE_PLANTA, incendio.y - centro.z]}>
          <mesh ref={fuego} position={[0, 0.5, 0]}>
            <sphereGeometry args={[1, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshBasicMaterial color={new THREE.Color("#ff5a1a").multiplyScalar(2.2)} transparent opacity={0.55} toneMapped={false} depthWrite={false} />
          </mesh>
          <pointLight position={[0, 1.5, 0]} color="#ff6a2a" intensity={60} distance={14} decay={1.6} />
          <Cartel texto="INCENDIO" color={ROJO} y={3.2} ancho={1.4} />
        </group>
      )}
    </group>
  );
}
