import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { PuertaPlano, ZonaPlano } from "../evacuacion";
import {
  ALTO_DEL_EDIFICIO,
  ALTURA_DE_PLANTA,
  COLOR,
  LOSA,
  ambienteDe,
  caja,
  dentro,
  type Caja,
  type Centro,
} from "./comun";
import { Neon, Publico } from "./efectos";

/**
 * La cáscara del edificio: suelo, losas, muros con sus puertas, techos,
 * barandas y la fachada a la calle.
 *
 * ## Los muros se recortan solos
 *
 * Un edificio cerrado visto desde fuera es una caja negra. Cada muro mira de qué
 * lado está la cámara y, si está fuera, se queda en un zócalo de un metro: se ve
 * el interior sin perder dónde estaban las paredes. Como en una casa de muñecas,
 * pero girando la cámara se abre siempre el lado que toca.
 */

const GROSOR = 0.3;
const ZOCALO = 1.0;

type Hueco = { centro: number; ancho: number; y0: number; alto: number };

/** Un muro recto a lo largo de un eje, con huecos y altura que puede variar por tramos. */
function Muro({
  eje,
  fijo,
  desde,
  hasta,
  normal,
  huecos,
  topeEn,
  color,
  recortable,
}: {
  eje: "x" | "z";
  fijo: number;
  desde: number;
  hasta: number;
  /** Hacia dónde mira la cara exterior: +1 o -1 sobre el eje perpendicular. */
  normal: 1 | -1;
  huecos: Hueco[];
  /** La altura del muro en cada punto del recorrido. */
  topeEn: (t: number) => number;
  color: string;
  recortable: boolean;
}) {
  const grupo = useRef<THREE.Group>(null);
  const centro = (desde + hasta) / 2;

  const piezas = useMemo(() => {
    const cortes = new Set<number>([desde, hasta]);
    for (const h of huecos) {
      cortes.add(THREE.MathUtils.clamp(h.centro - h.ancho / 2, desde, hasta));
      cortes.add(THREE.MathUtils.clamp(h.centro + h.ancho / 2, desde, hasta));
    }
    // Los cambios de altura (el parapeto de la terraza) también parten el muro.
    const paso = 0.5;
    for (let t = desde; t < hasta; t += paso) {
      if (Math.abs(topeEn(t) - topeEn(t + paso)) > 0.01) cortes.add(t + paso / 2);
    }
    const lista = [...cortes].sort((a, b) => a - b);
    const salida: { t0: number; t1: number; y0: number; y1: number }[] = [];
    for (let i = 0; i < lista.length - 1; i++) {
      const t0 = lista[i];
      const t1 = lista[i + 1];
      if (t1 - t0 < 0.01) continue;
      const m = (t0 + t1) / 2;
      const tope = topeEn(m);
      const enHueco = huecos.filter((h) => Math.abs(m - h.centro) < h.ancho / 2);
      if (enHueco.length === 0) {
        salida.push({ t0, t1, y0: 0, y1: tope });
        continue;
      }
      // Por debajo y por encima de cada hueco, pared; el hueco, vacío.
      const tramos = enHueco.sort((a, b) => a.y0 - b.y0);
      let y = 0;
      for (const h of tramos) {
        if (h.y0 > y) salida.push({ t0, t1, y0: y, y1: h.y0 });
        y = Math.max(y, h.y0 + h.alto);
      }
      if (tope > y) salida.push({ t0, t1, y0: y, y1: tope });
    }
    return salida;
  }, [desde, hasta, huecos, topeEn]);

  useFrame(({ camera }) => {
    const g = grupo.current;
    if (!g) return;
    const lado = eje === "x" ? camera.position.z - fijo : camera.position.x - fijo;
    const fuera = recortable && lado * normal > 0.5;
    g.children.forEach((hijo) => {
      const malla = hijo as THREE.Mesh;
      const { y0, y1 } = malla.userData as { y0: number; y1: number };
      const arriba = fuera ? Math.min(y1, ZOCALO) : y1;
      const alto = arriba - y0;
      malla.visible = alto > 0.02;
      if (malla.visible) {
        malla.scale.y = alto;
        malla.position.y = y0 + alto / 2;
      }
    });
  });

  return (
    <group ref={grupo}>
      {piezas.map((p, i) => {
        const largo = p.t1 - p.t0;
        const t = (p.t0 + p.t1) / 2;
        const pos: [number, number, number] =
          eje === "x" ? [t, (p.y0 + p.y1) / 2, fijo] : [fijo, (p.y0 + p.y1) / 2, t];
        const args: [number, number, number] = eje === "x" ? [largo, 1, GROSOR] : [GROSOR, 1, largo];
        return (
          <mesh key={i} position={pos} scale={[1, p.y1 - p.y0, 1]} userData={{ y0: p.y0, y1: p.y1, centro }}>
            <boxGeometry args={args} />
            <meshStandardMaterial color={color} roughness={0.92} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Los cuatro muros exteriores, con las puertas abiertas y la terraza a cielo abierto. */
function MurosExteriores({
  ancho,
  fondo,
  zonas,
  puertas,
  centro,
  recortar,
  techo,
}: {
  ancho: number;
  fondo: number;
  zonas: ZonaPlano[];
  puertas: PuertaPlano[];
  centro: Centro;
  recortar: boolean;
  /** Hasta dónde suben: con la planta alta escondida, solo hasta su losa. */
  techo: number;
}) {
  const terrazas = useMemo(
    () => zonas.filter((z) => ambienteDe(z, zonas) === "terraza").map((z) => caja(z, centro)),
    [zonas, centro],
  );
  const hx = ancho / 2;
  const hz = fondo / 2;

  /** Junto a una terraza el muro baja a parapeto; en el resto sube hasta el techo. */
  const tope = (x: number, z: number) =>
    Math.min(techo, terrazas.some((t) => dentro(t, x, z, -0.6)) ? ALTURA_DE_PLANTA + 1.1 : ALTO_DEL_EDIFICIO);

  const huecosDe = (cerca: (p: PuertaPlano) => boolean, coordenada: (p: PuertaPlano) => number) =>
    puertas.filter((p) => p.activo).filter(cerca).map((p) => ({
      centro: coordenada(p),
      ancho: Math.max(p.ancho, 1),
      y0: (p.piso ?? 0) * ALTURA_DE_PLANTA,
      alto: p.esSalidaEmergencia ? 2.2 : 2.8,
    }));

  const tol = 0.8;
  return (
    <group>
      <Muro
        eje="x"
        fijo={-hz}
        desde={-hx}
        hasta={hx}
        normal={-1}
        huecos={huecosDe((p) => p.y <= tol, (p) => p.x - centro.x)}
        topeEn={(t) => tope(t, -hz)}
        color={COLOR.pared}
        recortable={recortar}
      />
      <Muro
        eje="x"
        fijo={hz}
        desde={-hx}
        hasta={hx}
        normal={1}
        huecos={huecosDe((p) => p.y >= fondo - tol, (p) => p.x - centro.x)}
        topeEn={(t) => tope(t, hz)}
        color={COLOR.pared}
        recortable={recortar}
      />
      <Muro
        eje="z"
        fijo={-hx}
        desde={-hz}
        hasta={hz}
        normal={-1}
        huecos={huecosDe((p) => p.x <= tol, (p) => p.y - centro.z)}
        topeEn={(t) => tope(-hx, t)}
        color={COLOR.pared}
        recortable={recortar}
      />
      <Muro
        eje="z"
        fijo={hx}
        desde={-hz}
        hasta={hz}
        normal={1}
        huecos={huecosDe((p) => p.x >= ancho - tol, (p) => p.y - centro.z)}
        topeEn={(t) => tope(hx, t)}
        color={COLOR.pared}
        recortable={recortar}
      />
    </group>
  );
}

/**
 * Las paredes de una sala cerrada (La Cueva, los baños), con una abertura de
 * 2,6 m en el lado que mira al centro del local: por ahí se entra.
 */
export function ParedesDeSala({
  c,
  color,
  alto,
  recortar,
  sinParedEn = [],
}: {
  c: Caja;
  color: string;
  alto: number;
  recortar: boolean;
  /** Lados que no llevan pared: los que coinciden con un muro exterior. */
  sinParedEn?: ("n" | "s" | "e" | "o")[];
}) {
  // La entrada, en el lado más cercano al centro del edificio (el origen).
  const lados = [
    { lado: "n" as const, d: Math.abs(c.z0) },
    { lado: "s" as const, d: Math.abs(c.z1) },
    { lado: "o" as const, d: Math.abs(c.x0) },
    { lado: "e" as const, d: Math.abs(c.x1) },
  ].filter((l) => !sinParedEn.includes(l.lado));
  const entrada = lados.reduce((a, b) => (a.d < b.d ? a : b), lados[0])?.lado;
  const hueco = (lado: string, centro: number): Hueco[] =>
    lado === entrada ? [{ centro, ancho: 2.6, y0: 0, alto: 2.7 }] : [];
  const sinTope = () => alto;

  // Los muros internos se dibujan desde el suelo de su planta: se desplaza el grupo.
  return (
    <group position={[0, c.y0, 0]}>
      {!sinParedEn.includes("n") && (
        <Muro eje="x" fijo={c.z0} desde={c.x0} hasta={c.x1} normal={-1} huecos={hueco("n", c.cx)} topeEn={sinTope} color={color} recortable={recortar} />
      )}
      {!sinParedEn.includes("s") && (
        <Muro eje="x" fijo={c.z1} desde={c.x0} hasta={c.x1} normal={1} huecos={hueco("s", c.cx)} topeEn={sinTope} color={color} recortable={recortar} />
      )}
      {!sinParedEn.includes("o") && (
        <Muro eje="z" fijo={c.x0} desde={c.z0} hasta={c.z1} normal={-1} huecos={hueco("o", c.cz)} topeEn={sinTope} color={color} recortable={recortar} />
      )}
      {!sinParedEn.includes("e") && (
        <Muro eje="z" fijo={c.x1} desde={c.z0} hasta={c.z1} normal={1} huecos={hueco("e", c.cz)} topeEn={sinTope} color={color} recortable={recortar} />
      )}
    </group>
  );
}

// ── Losas y barandas ────────────────────────────────────────────────

/** El suelo de cada zona de la planta alta, con su canto visible desde abajo. */
function Losas({ altas }: { altas: Caja[] }) {
  return (
    <group>
      {altas.map((c, i) => (
        <mesh key={i} position={[c.cx, c.y0 - LOSA / 2, c.cz]}>
          <boxGeometry args={[c.w, LOSA, c.d]} />
          <meshStandardMaterial color={COLOR.concretoClaro} roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

/** Una baranda de vidrio con pasamanos de neón. */
export function Baranda({
  desde,
  hasta,
  y,
  color = COLOR.violeta,
}: {
  desde: [number, number];
  hasta: [number, number];
  y: number;
  color?: string;
}) {
  const largo = Math.hypot(hasta[0] - desde[0], hasta[1] - desde[1]);
  const angulo = Math.atan2(hasta[1] - desde[1], hasta[0] - desde[0]);
  const medio: [number, number] = [(desde[0] + hasta[0]) / 2, (desde[1] + hasta[1]) / 2];
  return (
    <group position={[medio[0], y, medio[1]]} rotation={[0, -angulo, 0]}>
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[largo, 1.05, 0.04]} />
        <meshPhysicalMaterial color="#9fb6ff" transparent opacity={0.16} roughness={0.05} metalness={0} depthWrite={false} />
      </mesh>
      <Neon desde={[-largo / 2, 1.1, 0]} hasta={[largo / 2, 1.1, 0]} color={color} grosor={0.035} intensidad={1.6} />
    </group>
  );
}

/**
 * Barandas automáticas: un borde de la planta alta que da a un espacio de doble
 * altura (la pista, el escenario, la escalera) lleva baranda de vidrio. Se
 * deduce del plano, no se dibuja a mano: mover el balcón mueve su baranda.
 */
function BarandasAutomaticas({ altas, bajas }: { altas: Caja[]; bajas: Caja[] }) {
  const dobles = bajas.filter((b) => b.h > ALTURA_DE_PLANTA + 0.5);
  const tramos: { desde: [number, number]; hasta: [number, number]; y: number }[] = [];

  const daAlVacio = (x: number, z: number) =>
    dobles.some((d) => dentro(d, x, z)) && !altas.some((a) => dentro(a, x, z));

  for (const a of altas) {
    const bordes: { p0: [number, number]; p1: [number, number]; fuera: [number, number] }[] = [
      { p0: [a.x0, a.z0], p1: [a.x1, a.z0], fuera: [0, -0.4] },
      { p0: [a.x0, a.z1], p1: [a.x1, a.z1], fuera: [0, 0.4] },
      { p0: [a.x0, a.z0], p1: [a.x0, a.z1], fuera: [-0.4, 0] },
      { p0: [a.x1, a.z0], p1: [a.x1, a.z1], fuera: [0.4, 0] },
    ];
    for (const b of bordes) {
      // Se recorre el borde a pasos de medio metro y se agrupan los tramos que dan al vacío.
      const largo = Math.hypot(b.p1[0] - b.p0[0], b.p1[1] - b.p0[1]);
      const pasos = Math.max(1, Math.round(largo / 0.5));
      let inicio: number | null = null;
      for (let i = 0; i <= pasos; i++) {
        const t = i / pasos;
        const x = b.p0[0] + (b.p1[0] - b.p0[0]) * t + b.fuera[0];
        const z = b.p0[1] + (b.p1[1] - b.p0[1]) * t + b.fuera[1];
        const vacio = i < pasos && daAlVacio(x, z);
        if (vacio && inicio === null) inicio = t;
        if (!vacio && inicio !== null) {
          const punto = (u: number): [number, number] => [
            b.p0[0] + (b.p1[0] - b.p0[0]) * u,
            b.p0[1] + (b.p1[1] - b.p0[1]) * u,
          ];
          tramos.push({ desde: punto(inicio), hasta: punto(t), y: a.y0 });
          inicio = null;
        }
      }
    }
  }

  return (
    <group>
      {tramos.map((t, i) => (
        <Baranda key={i} desde={t.desde} hasta={t.hasta} y={t.y} />
      ))}
    </group>
  );
}

/** El techo de cada zona cubierta, solo cuando se camina dentro: desde fuera taparía todo. */
function Techos({ cajas, terrazas }: { cajas: Caja[]; terrazas: Caja[] }) {
  return (
    <group>
      {cajas
        .filter((c) => !terrazas.includes(c))
        .map((c, i) => (
          <mesh key={i} position={[c.cx, c.y0 + c.h - 0.01, c.cz]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[c.w, c.d]} />
            <meshStandardMaterial color={COLOR.techo} roughness={1} side={THREE.DoubleSide} />
          </mesh>
        ))}
    </group>
  );
}

// ── La fachada y la calle ───────────────────────────────────────────

function Fachada({
  ancho,
  fondo,
  puertas,
  centro,
  animar,
  conGente,
}: {
  ancho: number;
  fondo: number;
  puertas: PuertaPlano[];
  centro: Centro;
  animar: boolean;
  conGente: boolean;
}) {
  const hz = fondo / 2;
  const principal =
    puertas.find((p) => !p.esSalidaEmergencia && (p.piso ?? 0) === 0 && p.y >= fondo - 1) ??
    puertas.find((p) => !p.esSalidaEmergencia);
  const xPuerta = principal ? principal.x - centro.x : 0;
  const zFuera = hz + GROSOR / 2 + 0.02;

  // La cola: unos metros de gente esperando junto a la fachada, entre catenarias.
  const cola: Caja = useMemo(
    () => ({
      cx: xPuerta + 6,
      cz: hz + 1.6,
      w: 9,
      d: 1.4,
      y0: 0,
      h: 2,
      x0: xPuerta + 1.5,
      x1: xPuerta + 10.5,
      z0: hz + 0.9,
      z1: hz + 2.3,
    }),
    [xPuerta, hz],
  );

  return (
    <group>
      {/* La acera y la calzada. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, hz + 2]}>
        <planeGeometry args={[ancho + 12, 4]} />
        <meshStandardMaterial color="#2a2830" roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, hz + 9]}>
        <planeGeometry args={[ancho + 40, 10]} />
        <meshStandardMaterial color={COLOR.asfalto} roughness={0.55} metalness={0.2} />
      </mesh>
      {[-14, -4, 6, 16].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, -0.02, hz + 9]}>
          <planeGeometry args={[4, 0.18]} />
          <meshBasicMaterial color="#77736a" />
        </mesh>
      ))}

      {/* Farolas. */}
      {[-ancho / 2 + 3, ancho / 2 - 3].map((x) => (
        <group key={x} position={[x, 0, hz + 3.6]}>
          <mesh position={[0, 2.5, 0]}>
            <cylinderGeometry args={[0.07, 0.09, 5, 8]} />
            <meshStandardMaterial color={COLOR.metalOscuro} metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[0, 5.05, 0]}>
            <sphereGeometry args={[0.22, 12, 12]} />
            <meshBasicMaterial color={new THREE.Color("#ffd9a0").multiplyScalar(2.5)} toneMapped={false} />
          </mesh>
          <pointLight position={[0, 4.8, 0]} color="#ffcf8a" intensity={14} distance={11} decay={2} />
        </group>
      ))}

      {/* Marquesina sobre la entrada, con su borde de luz. */}
      <group position={[xPuerta, 3.3, zFuera + 1.1]}>
        <mesh>
          <boxGeometry args={[6, 0.25, 2.2]} />
          <meshStandardMaterial color="#0d0b12" metalness={0.5} roughness={0.4} />
        </mesh>
        <Neon desde={[-3, -0.14, 1.1]} hasta={[3, -0.14, 1.1]} color={COLOR.magenta} intensidad={2.6} />
        <Neon desde={[-3, -0.14, -1.1]} hasta={[-3, -0.14, 1.1]} color={COLOR.magenta} intensidad={2.6} />
        <Neon desde={[3, -0.14, -1.1]} hasta={[3, -0.14, 1.1]} color={COLOR.magenta} intensidad={2.6} />
      </group>

      {/* La alfombra y los postes con cordón. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[xPuerta, 0.01, zFuera + 1.5]}>
        <planeGeometry args={[2.2, 3]} />
        <meshStandardMaterial color="#5a0f2e" roughness={0.9} />
      </mesh>
      {Array.from({ length: 6 }, (_, i) => xPuerta + 1.4 + i * 1.8).map((x) => (
        <group key={x} position={[x, 0, hz + 0.75]}>
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 1, 8]} />
            <meshStandardMaterial color={COLOR.dorado} metalness={0.9} roughness={0.25} />
          </mesh>
        </group>
      ))}
      <Neon desde={[xPuerta + 1.4, 0.85, hz + 0.75]} hasta={[xPuerta + 10.4, 0.85, hz + 0.75]} color="#ff1f5a" grosor={0.025} intensidad={1.2} />
      {conGente && <Publico c={cola} personas={14} semilla="cola" baila={false} animar={animar} color="#1c1622" />}

      {/* El letrero: el nombre de la casa en neón sobre la puerta. */}
      <group position={[xPuerta, 6.4, zFuera + 0.05]}>
        <Text
          fontSize={1.6}
          letterSpacing={0.08}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.04}
          outlineColor="#ff8ac4"
        >
          SSIOMAMA
          <meshBasicMaterial color={new THREE.Color(COLOR.magenta).multiplyScalar(2.4)} toneMapped={false} />
        </Text>
        <Text position={[0, -1.25, 0]} fontSize={0.42} letterSpacing={0.4} anchorX="center" anchorY="middle">
          DISCOTECA · AREQUIPA
          <meshBasicMaterial color={new THREE.Color(COLOR.violeta).multiplyScalar(2)} toneMapped={false} />
        </Text>
      </group>

      {/* Tiras verticales de neón en las esquinas de la fachada. */}
      {[-ancho / 2 + 0.3, ancho / 2 - 0.3].map((x) => (
        <Neon key={x} desde={[x, 0.3, zFuera]} hasta={[x, ALTO_DEL_EDIFICIO - 0.3, zFuera]} color={COLOR.violeta} intensidad={1.8} />
      ))}
    </group>
  );
}

// ── El edificio entero ──────────────────────────────────────────────

export function Edificio({
  ancho,
  fondo,
  zonas,
  puertas,
  centro,
  plantas,
  recortar,
  conTecho,
  animar,
  conGente,
}: {
  ancho: number;
  fondo: number;
  zonas: ZonaPlano[];
  puertas: PuertaPlano[];
  centro: Centro;
  /** Qué plantas se ven. */
  plantas: { baja: boolean; alta: boolean };
  recortar: boolean;
  conTecho: boolean;
  animar: boolean;
  conGente: boolean;
}) {
  const bajas = useMemo(() => zonas.filter((z) => (z.piso ?? 0) === 0).map((z) => caja(z, centro)), [zonas, centro]);
  const altas = useMemo(() => zonas.filter((z) => (z.piso ?? 0) > 0).map((z) => caja(z, centro)), [zonas, centro]);
  const terrazas = useMemo(
    () => zonas.filter((z) => ambienteDe(z, zonas) === "terraza").map((z) => caja(z, centro)),
    [zonas, centro],
  );
  const todas = [...(plantas.baja ? bajas : []), ...(plantas.alta ? altas : [])];

  return (
    <group>
      {/* El suelo del edificio: hormigón pulido que recoge las luces. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[ancho, fondo]} />
        <meshStandardMaterial color={COLOR.concreto} roughness={0.32} metalness={0.35} />
      </mesh>

      {plantas.baja && (
        <>
          <MurosExteriores
            ancho={ancho}
            fondo={fondo}
            zonas={zonas}
            puertas={puertas}
            centro={centro}
            recortar={recortar}
            techo={plantas.alta ? ALTO_DEL_EDIFICIO : ALTURA_DE_PLANTA}
          />
          <Fachada ancho={ancho} fondo={fondo} puertas={puertas} centro={centro} animar={animar} conGente={conGente} />
        </>
      )}

      {plantas.alta && (
        <>
          <Losas altas={altas} />
          <BarandasAutomaticas altas={altas} bajas={bajas} />
        </>
      )}

      {conTecho && <Techos cajas={todas} terrazas={terrazas} />}
    </group>
  );
}
