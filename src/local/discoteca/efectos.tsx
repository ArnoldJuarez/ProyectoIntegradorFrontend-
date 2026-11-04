import { useFrame } from "@react-three/fiber";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { aleatorio, type Caja } from "./comun";

/**
 * Lo que se mueve y lo que brilla: el suelo LED, la pantalla, los haces de luz,
 * la bola de espejos y la gente.
 *
 * Todo con materiales que emiten y sin luces de verdad salvo las imprescindibles:
 * cada luz real cuesta en cada píxel de la escena, y una discoteca necesita
 * decenas. El brillo lo pone el bloom del posprocesado sobre lo que emite.
 *
 * Las animaciones respetan `animar`: con «Luces de fiesta» apagado la escena se
 * queda quieta, que es como se mira para entender el plano sin marearse.
 */

const NEGRO = new THREE.Color("#000000");
const SIN_OBSTACULOS: { x0: number; x1: number; z0: number; z1: number }[] = [];

// ── Tira de neón ────────────────────────────────────────────────────

/** Un tubo de neón recto. `toneMapped={false}` para que el bloom lo haga brillar. */
export function Neon({
  desde,
  hasta,
  color,
  grosor = 0.05,
  intensidad = 2.2,
}: {
  desde: [number, number, number];
  hasta: [number, number, number];
  color: string;
  grosor?: number;
  intensidad?: number;
}) {
  const { posicion, largo, rotacion } = useMemo(() => {
    const a = new THREE.Vector3(...desde);
    const b = new THREE.Vector3(...hasta);
    const medio = a.clone().add(b).multiplyScalar(0.5);
    const dir = b.clone().sub(a);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return { posicion: medio, largo: dir.length(), rotacion: new THREE.Euler().setFromQuaternion(q) };
  }, [desde, hasta]);
  const c = useMemo(() => new THREE.Color(color).multiplyScalar(intensidad), [color, intensidad]);

  return (
    <mesh position={posicion} rotation={rotacion}>
      <cylinderGeometry args={[grosor, grosor, largo, 6]} />
      <meshBasicMaterial color={c} toneMapped={false} />
    </mesh>
  );
}

/** Un rectángulo de neón en el suelo o en el techo de una zona. */
export function MarcoDeNeon({ c, y, color, margen = 0.15 }: { c: Caja; y: number; color: string; margen?: number }) {
  const x0 = c.x0 + margen;
  const x1 = c.x1 - margen;
  const z0 = c.z0 + margen;
  const z1 = c.z1 - margen;
  return (
    <group>
      <Neon desde={[x0, y, z0]} hasta={[x1, y, z0]} color={color} />
      <Neon desde={[x1, y, z0]} hasta={[x1, y, z1]} color={color} />
      <Neon desde={[x1, y, z1]} hasta={[x0, y, z1]} color={color} />
      <Neon desde={[x0, y, z1]} hasta={[x0, y, z0]} color={color} />
    </group>
  );
}

// ── Suelo LED ───────────────────────────────────────────────────────

/** Baldosas de luz que laten en ondas desde el centro de la pista. */
export function SueloLed({ c, animar, colores }: { c: Caja; animar: boolean; colores: string[] }) {
  const malla = useRef<THREE.InstancedMesh>(null);
  const lado = 1;
  const nx = Math.max(1, Math.floor(c.w / lado));
  const nz = Math.max(1, Math.floor(c.d / lado));
  const total = nx * nz;
  const paleta = useMemo(() => colores.map((col) => new THREE.Color(col)), [colores]);
  const tmp = useMemo(() => new THREE.Color(), []);

  useLayoutEffect(() => {
    const m = malla.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const ox = c.cx - (nx * lado) / 2 + lado / 2;
    const oz = c.cz - (nz * lado) / 2 + lado / 2;
    let i = 0;
    for (let ix = 0; ix < nx; ix++) {
      for (let iz = 0; iz < nz; iz++) {
        o.position.set(ox + ix * lado, c.y0 + 0.012, oz + iz * lado);
        o.rotation.set(-Math.PI / 2, 0, 0);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
        m.setColorAt(i, paleta[(ix + iz) % paleta.length]);
        i++;
      }
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [c, nx, nz, paleta]);

  useFrame(({ clock }) => {
    const m = malla.current;
    if (!m || !animar) return;
    const t = clock.elapsedTime;
    let i = 0;
    for (let ix = 0; ix < nx; ix++) {
      for (let iz = 0; iz < nz; iz++) {
        const dx = ix - nx / 2;
        const dz = iz - nz / 2;
        const onda = Math.sin(Math.hypot(dx, dz) * 0.7 - t * 3.2);
        const indice = Math.floor((t * 0.6 + ix * 0.13 + iz * 0.07) % paleta.length);
        tmp.copy(paleta[indice]).multiplyScalar(Math.max(0, onda) * 1.6 + 0.08);
        m.setColorAt(i++, tmp);
      }
    }
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={malla} args={[undefined, undefined, total]} frustumCulled={false}>
      <planeGeometry args={[lado * 0.94, lado * 0.94]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

// ── Pantalla LED ────────────────────────────────────────────────────

const SOMBREADO_DE_PANTALLA = {
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTiempo;
    uniform vec3 uA;
    uniform vec3 uB;
    varying vec2 vUv;
    void main() {
      // Píxeles gruesos, como una pantalla LED vista de cerca.
      vec2 celda = floor(vUv * vec2(96.0, 40.0)) / vec2(96.0, 40.0);
      float barras = sin(celda.x * 18.0 + uTiempo * 2.4) * 0.5 + 0.5;
      float ecualizador = step(celda.y, 0.25 + 0.55 * abs(sin(floor(celda.x * 24.0) * 1.7 + uTiempo * 3.0)));
      float onda = sin(length(celda - 0.5) * 22.0 - uTiempo * 4.0) * 0.5 + 0.5;
      vec3 color = mix(uA, uB, barras) * (0.35 + 0.65 * onda);
      color += ecualizador * mix(uB, vec3(1.0), 0.3) * 0.8;
      // Rejilla entre píxeles.
      vec2 g = fract(vUv * vec2(96.0, 40.0));
      float rejilla = step(0.12, g.x) * step(0.12, g.y);
      gl_FragColor = vec4(color * rejilla * 1.8, 1.0);
    }
  `,
};

export function PantallaLed({
  posicion,
  ancho,
  alto,
  rotacionY = 0,
  animar,
}: {
  posicion: [number, number, number];
  ancho: number;
  alto: number;
  rotacionY?: number;
  animar: boolean;
}) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        ...SOMBREADO_DE_PANTALLA,
        uniforms: {
          uTiempo: { value: 0 },
          uA: { value: new THREE.Color("#ff3d9a") },
          uB: { value: new THREE.Color("#5b2bff") },
        },
        toneMapped: false,
      }),
    [],
  );
  useFrame((_, delta) => {
    if (animar) material.uniforms.uTiempo.value += delta;
  });
  return (
    <mesh position={posicion} rotation={[0, rotacionY, 0]} material={material}>
      <planeGeometry args={[ancho, alto]} />
    </mesh>
  );
}

// ── Haces de luz ────────────────────────────────────────────────────

const SOMBREADO_DE_HAZ = {
  vertexShader: /* glsl */ `
    varying float vAltura;
    void main() {
      vAltura = uv.y;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor;
    varying float vAltura;
    void main() {
      // Intenso en la boca del foco y desvaneciéndose hacia el suelo.
      gl_FragColor = vec4(uColor, pow(vAltura, 2.2) * 0.32);
    }
  `,
};

/**
 * Un cabezal móvil con su haz de luz visible en el humo.
 *
 * El haz es un cono transparente con mezcla aditiva, no una luz: se ve igual de
 * bien y no cuesta nada. Barre siguiendo una figura de Lissajous para que cada
 * foco vaya a su aire.
 */
export function CabezalMovil({
  posicion,
  color,
  largo = 7,
  fase = 0,
  animar,
}: {
  posicion: [number, number, number];
  color: string;
  largo?: number;
  fase?: number;
  animar: boolean;
}) {
  const brazo = useRef<THREE.Group>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        ...SOMBREADO_DE_HAZ,
        uniforms: { uColor: { value: new THREE.Color(color).multiplyScalar(1.4) } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [color],
  );

  useFrame(({ clock }) => {
    if (!brazo.current) return;
    const t = animar ? clock.elapsedTime * 0.7 + fase : fase;
    brazo.current.rotation.x = Math.sin(t * 1.3) * 0.55;
    brazo.current.rotation.z = Math.cos(t * 0.9) * 0.6;
  });

  return (
    <group position={posicion}>
      <mesh>
        <boxGeometry args={[0.32, 0.22, 0.32]} />
        <meshStandardMaterial color="#111" metalness={0.8} roughness={0.35} />
      </mesh>
      <group ref={brazo}>
        <mesh position={[0, -largo / 2, 0]} material={material}>
          <coneGeometry args={[largo * 0.16, largo, 24, 1, true]} />
        </mesh>
        <mesh position={[0, -0.15, 0]}>
          <sphereGeometry args={[0.07, 10, 10]} />
          <meshBasicMaterial color={new THREE.Color(color).multiplyScalar(3)} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

// ── Bola de espejos ─────────────────────────────────────────────────

export function BolaDeEspejos({ posicion, animar }: { posicion: [number, number, number]; animar: boolean }) {
  const bola = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (bola.current && animar) bola.current.rotation.y += delta * 0.6;
  });
  return (
    <group position={posicion}>
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 1.2]} />
        <meshBasicMaterial color="#555" />
      </mesh>
      <mesh ref={bola}>
        <icosahedronGeometry args={[0.55, 2]} />
        <meshStandardMaterial color="#e8e8f0" metalness={1} roughness={0.08} flatShading emissive="#3a2a40" />
      </mesh>
    </group>
  );
}

// ── La gente ────────────────────────────────────────────────────────

/**
 * Siluetas de público repartidas por una zona.
 *
 * Una sola malla instanciada por zona: cien personas son una llamada de dibujo.
 * Sirven para dar escala —una pista vacía de 18 m no dice cuánta gente cabe— y
 * en las pistas se balancean al ritmo.
 */
export function Publico({
  c,
  personas,
  semilla,
  baila,
  animar,
  evitar = SIN_OBSTACULOS,
  color = "#2a2033",
}: {
  c: Caja;
  personas: number;
  semilla: string;
  baila: boolean;
  animar: boolean;
  /** Rectángulos (en la escena) donde no poner a nadie: la barra, el escenario. */
  evitar?: { x0: number; x1: number; z0: number; z1: number }[];
  color?: string;
}) {
  const malla = useRef<THREE.InstancedMesh>(null);
  const cabezas = useRef<THREE.InstancedMesh>(null);
  const cuerpos = useMemo(() => {
    const azar = aleatorio(semilla);
    const lista: { x: number; z: number; alto: number; fase: number; giro: number }[] = [];
    let intentos = 0;
    while (lista.length < personas && intentos < personas * 12) {
      intentos++;
      const x = c.x0 + 0.5 + azar() * (c.w - 1);
      const z = c.z0 + 0.5 + azar() * (c.d - 1);
      if (evitar.some((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1)) continue;
      if (lista.some((p) => Math.hypot(p.x - x, p.z - z) < 0.55)) continue;
      lista.push({ x, z, alto: 1.55 + azar() * 0.3, fase: azar() * Math.PI * 2, giro: azar() * Math.PI * 2 });
    }
    return lista;
  }, [c, personas, semilla, evitar]);

  const o = useMemo(() => new THREE.Object3D(), []);

  /** Coloca cuerpo y cabeza de cada persona; `salto` y `vaiven` son el baile. */
  const colocar = useCallback(
    (t: number | null) => {
      const m = malla.current;
      const h = cabezas.current;
      if (!m || !h) return;
      cuerpos.forEach((p, i) => {
        const salto = t === null ? 0 : Math.max(0, Math.sin(t * 7.6 + p.fase)) * 0.12;
        const vaiven = t === null ? 0 : Math.sin(t * 3.8 + p.fase) * 0.06;
        const giro = t === null ? p.giro : p.giro + Math.sin(t * 1.5 + p.fase) * 0.4;
        const cuerpo = p.alto - 0.3;
        o.position.set(p.x, c.y0 + cuerpo / 2 + salto, p.z);
        o.rotation.set(0, giro, vaiven);
        o.scale.set(1, cuerpo / 1.4, 1);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
        o.position.set(p.x + Math.sin(vaiven) * -0.2, c.y0 + cuerpo + 0.14 + salto, p.z);
        o.rotation.set(0, 0, 0);
        o.scale.set(1, 1, 1);
        o.updateMatrix();
        h.setMatrixAt(i, o.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
      h.instanceMatrix.needsUpdate = true;
    },
    [cuerpos, c.y0, o],
  );

  useLayoutEffect(() => colocar(null), [colocar]);

  useFrame(({ clock }) => {
    if (baila && animar) colocar(clock.elapsedTime);
  });

  if (cuerpos.length === 0) return null;
  return (
    <group>
      <instancedMesh ref={malla} args={[undefined, undefined, cuerpos.length]} frustumCulled={false}>
        <capsuleGeometry args={[0.19, 1.0, 4, 8]} />
        <meshStandardMaterial color={color} roughness={0.7} emissive={NEGRO} />
      </instancedMesh>
      <instancedMesh ref={cabezas} args={[undefined, undefined, cuerpos.length]} frustumCulled={false}>
        <sphereGeometry args={[0.12, 10, 8]} />
        <meshStandardMaterial color="#3a2c33" roughness={0.6} />
      </instancedMesh>
    </group>
  );
}

// ── Guirnalda de bombillas ──────────────────────────────────────────

/** Bombillas colgando en catenaria entre dos puntos: la luz de la terraza. */
export function Guirnalda({
  desde,
  hasta,
  caida = 0.6,
  bombillas = 14,
  color = "#ffcf8a",
}: {
  desde: [number, number, number];
  hasta: [number, number, number];
  caida?: number;
  bombillas?: number;
  color?: string;
}) {
  const puntos = useMemo(() => {
    const lista: THREE.Vector3[] = [];
    for (let i = 0; i <= bombillas; i++) {
      const t = i / bombillas;
      lista.push(
        new THREE.Vector3(
          THREE.MathUtils.lerp(desde[0], hasta[0], t),
          THREE.MathUtils.lerp(desde[1], hasta[1], t) - Math.sin(t * Math.PI) * caida,
          THREE.MathUtils.lerp(desde[2], hasta[2], t),
        ),
      );
    }
    return lista;
  }, [desde, hasta, caida, bombillas]);
  const cable = useMemo(
    () => new THREE.Line(new THREE.BufferGeometry().setFromPoints(puntos), new THREE.LineBasicMaterial({ color: "#222" })),
    [puntos],
  );
  const brillo = useMemo(() => new THREE.Color(color).multiplyScalar(3), [color]);

  return (
    <group>
      <primitive object={cable} />
      {puntos.map((p, i) => (
        <mesh key={i} position={[p.x, p.y - 0.08, p.z]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshBasicMaterial color={brillo} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
