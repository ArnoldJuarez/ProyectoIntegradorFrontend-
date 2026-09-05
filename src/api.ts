/**
 * Cliente de la API de Spring Boot.
 *
 * A diferencia del proyecto anterior —donde las páginas consultaban PostgreSQL
 * directamente porque corrían en el servidor—, aquí todo pasa por HTTP: el
 * React vive entero en el navegador y el backend es un servicio aparte.
 *
 * `credentials: "include"` va desde ya aunque todavía no haya login: la sesión
 * viajará en una cookie, y en peticiones a otro origen el navegador no la manda
 * si no se le pide. Ponerlo después, cuando entre la autenticación, significa
 * depurar por qué el backend dice que no estás identificado teniendo la cookie
 * delante.
 */

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

/**
 * Error con el código HTTP a mano, para poder distinguir un 403 de un 500.
 *
 * El campo va declarado y asignado por separado, sin usar el atajo de
 * declararlo en el constructor: la plantilla de Vite activa
 * `erasableSyntaxOnly`, que prohíbe la sintaxis de TypeScript que genera código
 * en tiempo de ejecución. El dev server no se queja porque solo borra los
 * tipos; el error sale al compilar.
 */
export class ErrorDeApi extends Error {
  readonly estado: number;

  constructor(estado: number, mensaje: string) {
    super(mensaje);
    this.name = "ErrorDeApi";
    this.estado = estado;
  }
}

/** Mensaje de error que manda el backend, si lo manda. */
type Problema = { error?: string };

async function pedir<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  let respuesta: Response;

  try {
    respuesta = await fetch(`${BASE}${ruta}`, {
      ...opciones,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(opciones.body ? { "Content-Type": "application/json" } : {}),
        ...opciones.headers,
      },
    });
  } catch {
    // fetch solo lanza cuando la petición no llega a salir: el backend está
    // apagado, o CORS la bloqueó. Es el fallo más habitual en desarrollo y
    // merece un mensaje que diga qué mirar.
    throw new ErrorDeApi(0, `No se pudo conectar con el backend en ${BASE}.`);
  }

  if (!respuesta.ok) {
    // El backend explica el fallo cuando puede decir algo útil. Si no, se cae
    // al código, que al menos distingue un 403 de un 500.
    const cuerpo = (await respuesta.json().catch(() => null)) as Problema | null;
    throw new ErrorDeApi(
      respuesta.status,
      cuerpo?.error ?? `El backend respondió ${respuesta.status}.`,
    );
  }

  // 204 y compañía no traen cuerpo: pedirles json() revienta.
  if (respuesta.status === 204) {
    return undefined as T;
  }

  return respuesta.json() as Promise<T>;
}

// ─────────────────────────── Sesión ───────────────────────────

export type Rol = "ADMIN" | "MANAGER" | "PROMOTER" | "DOOR" | "BAR" | "STAFF" | "CUSTOMER";

export type Sesion = {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
};

export function entrar(email: string, password: string): Promise<Sesion> {
  return pedir<Sesion>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function salir(): Promise<void> {
  return pedir<void>("/api/auth/logout", { method: "POST" });
}

/**
 * Quién soy, o `null` si no hay sesión.
 *
 * El 401 no es un error aquí: es la respuesta normal de alguien que todavía no
 * ha entrado. Cualquier otro fallo sí se propaga, porque un backend apagado no
 * debe parecer "no has iniciado sesión".
 */
export async function quienSoy(): Promise<Sesion | null> {
  try {
    return await pedir<Sesion>("/api/auth/yo");
  } catch (e) {
    if (e instanceof ErrorDeApi && e.estado === 401) return null;
    throw e;
  }
}

// ─────────────────────────── Inventario ───────────────────────────

export type UnidadDeProducto = "UNIDAD" | "BOTELLA" | "CAJA" | "LITRO";

/** Espejo de ProductoController.ProductoResumen en el backend. */
export type Producto = {
  id: string;
  sku: string;
  nombre: string;
  categoria: string;
  unidad: UnidadDeProducto;
  precioCentimos: number;
  alertaDeStock: number;
};

export function listarProductos(): Promise<Producto[]> {
  return pedir<Producto[]>("/api/inventario/productos");
}

// ─────────────────────────── Eventos ───────────────────────────

export type EstadoDeEvento = "DRAFT" | "PUBLISHED" | "SOLD_OUT" | "CANCELLED" | "FINISHED";

/**
 * Las fechas llegan como texto ISO-8601 en UTC (`2026-09-12T04:30:00Z`), no como
 * horas ya formateadas: el backend manda el instante y aquí se decide en qué
 * zona y en qué idioma se enseña. Ver `horaDeSala`.
 */
export type Evento = {
  id: string;
  slug: string;
  titulo: string;
  sala: string;
  puertasA: string;
  empiezaA: string;
  estado: EstadoDeEvento;
  aforoALaVenta: number;
  vendidas: number;
  recaudadoCentimos: number;
};

export type TipoDeEntrada = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precioCentimos: number;
  cantidad: number;
  vendidas: number;
  disponibles: number;
  activo: boolean;
};

export type EventoDetalle = {
  id: string;
  slug: string;
  titulo: string;
  descripcion: string | null;
  portada: string | null;
  sala: string;
  aforoDeSala: number;
  puertasA: string;
  empiezaA: string;
  terminaA: string;
  edadMinima: number;
  vestimenta: string | null;
  estado: EstadoDeEvento;
  vendidas: number;
  recaudadoCentimos: number;
  tiposDeEntrada: TipoDeEntrada[];
};

export function listarEventos(): Promise<Evento[]> {
  return pedir<Evento[]>("/api/eventos");
}

// ─────────────────────────── Clientes ───────────────────────────
//
// Datos personales de gente real. Solo los sirve el panel, detrás de rol.

export type TipoDeInteraccion =
  | "PURCHASE"
  | "VISIT"
  | "RESERVATION"
  | "CAMPAIGN"
  | "CHAT"
  | "COMPLAINT"
  | "NOTE";

export type CanalDeInteraccion =
  | "WEB"
  | "WHATSAPP"
  | "EMAIL"
  | "PHONE"
  | "INSTAGRAM"
  | "IN_PERSON";

export type ClienteEnLista = {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  visitas: number;
  gastadoCentimos: number;
  ultimaVisita: string | null;
  aceptaMarketing: boolean;
};

export type LineaDeHistorial = {
  id: string;
  tipo: TipoDeInteraccion;
  canal: CanalDeInteraccion | null;
  resumen: string;
  cuando: string;
};

export type FichaDeCliente = {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  fechaDeNacimiento: string | null;
  distrito: string | null;
  visitas: number;
  gastadoCentimos: number;
  ultimaVisita: string | null;
  aceptaMarketing: boolean;
  consintioEn: string | null;
  creadoEn: string;
  gastoMedioCentimos: number;
  historial: LineaDeHistorial[];
};

export function listarClientes(buscar = ""): Promise<ClienteEnLista[]> {
  const query = buscar.trim() ? `?buscar=${encodeURIComponent(buscar.trim())}` : "";
  return pedir<ClienteEnLista[]>(`/api/clientes${query}`);
}

export function verCliente(id: string): Promise<FichaDeCliente> {
  return pedir<FichaDeCliente>(`/api/clientes/${encodeURIComponent(id)}`);
}

/** Cómo se llama cada tipo de interacción en la pantalla. */
export const NOMBRE_DE_INTERACCION: Record<TipoDeInteraccion, string> = {
  PURCHASE: "Compra",
  VISIT: "Visita",
  RESERVATION: "Reserva",
  CAMPAIGN: "Campaña",
  CHAT: "Chat",
  COMPLAINT: "Queja",
  NOTE: "Nota",
};

export const NOMBRE_DE_CANAL: Record<CanalDeInteraccion, string> = {
  WEB: "Web",
  WHATSAPP: "WhatsApp",
  EMAIL: "Correo",
  PHONE: "Teléfono",
  INSTAGRAM: "Instagram",
  IN_PERSON: "En el local",
};

// ─────────────────────── Cartelera pública ───────────────────────
//
// Otro tipo, no el del panel: lo que se enseña a un cliente es distinto de lo
// que ve la casa. Si fuera el mismo, añadir un campo interno al panel lo
// publicaría en internet sin que nadie lo notara.

export type ArtistaEnCartel = {
  nombre: string;
  genero: string | null;
  imagen: string | null;
  instagram: string | null;
  empiezaA: string | null;
  terminaA: string | null;
  cabezaDeCartel: boolean;
};

export type NocheEnCartelera = {
  slug: string;
  titulo: string;
  descripcion: string | null;
  portada: string | null;
  sala: string;
  puertasA: string;
  empiezaA: string;
  estado: EstadoDeEvento;
  edadMinima: number;
  vestimenta: string | null;
  precioDesdeCentimos: number;
  porcentajeVendido: number;
  cartel: ArtistaEnCartel[];
};

export type EntradaALaVenta = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precioCentimos: number;
  disponibles: number;
  maximoPorPedido: number;
  consumicionesIncluidas: number;
};

export type FichaDeNoche = {
  slug: string;
  titulo: string;
  descripcion: string | null;
  portada: string | null;
  sala: string;
  puertasA: string;
  empiezaA: string;
  terminaA: string;
  estado: EstadoDeEvento;
  edadMinima: number;
  vestimenta: string | null;
  porcentajeVendido: number;
  cartel: ArtistaEnCartel[];
  entradas: EntradaALaVenta[];
};

export function verAgenda(): Promise<NocheEnCartelera[]> {
  return pedir<NocheEnCartelera[]>("/api/publico/agenda");
}

export function verNoche(slug: string): Promise<FichaDeNoche> {
  return pedir<FichaDeNoche>(`/api/publico/evento/${encodeURIComponent(slug)}`);
}

/**
 * Alta en el aviso de cartel.
 *
 * La respuesta es la misma esté o no ya apuntado ese correo, así que aquí no
 * hay dos caminos que distinguir: se enseña lo que diga el backend.
 */
export function apuntarseAlBoletin(nombre: string, email: string): Promise<{ mensaje: string }> {
  return pedir<{ mensaje: string }>("/api/publico/boletin", {
    method: "POST",
    body: JSON.stringify({ nombre, email }),
  });
}

// ─────────────────────────── Reservados ───────────────────────────

export type MesaDisponible = {
  id: string;
  nombre: string;
  zona: string | null;
  plazas: number;
  consumoMinimoCentimos: number;
  libre: boolean;
};

export type SolicitudDeReserva = {
  slug: string;
  mesaId: string;
  personas: number;
  notas: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
};

export function verReservados(slug: string): Promise<MesaDisponible[]> {
  return pedir<MesaDisponible[]>(`/api/publico/reservados/${encodeURIComponent(slug)}`);
}

/**
 * Pide un reservado. **No lo aparta**: deja una solicitud que alguien del local
 * llama para confirmar y acordar el depósito. El mensaje de vuelta lo dice.
 */
export function pedirReserva(solicitud: SolicitudDeReserva): Promise<{ id: string; mensaje: string }> {
  return pedir<{ id: string; mensaje: string }>("/api/publico/reservas", {
    method: "POST",
    body: JSON.stringify(solicitud),
  });
}

export function verEvento(slug: string): Promise<EventoDetalle> {
  return pedir<EventoDetalle>(`/api/eventos/${encodeURIComponent(slug)}`);
}

/** Cómo se llama cada estado en la pantalla. */
export const NOMBRE_DE_ESTADO: Record<EstadoDeEvento, string> = {
  DRAFT: "Borrador",
  PUBLISHED: "A la venta",
  SOLD_OUT: "Agotado",
  CANCELLED: "Cancelado",
  FINISHED: "Terminado",
};

/** Zona de la sala. Todo lo que se enseña a una persona va en esta hora. */
const ZONA_DE_LA_SALA = "America/Lima";

/**
 * Formatea un instante en hora de la sala.
 *
 * Se fija la zona a mano en vez de dejar la del navegador: la hora de apertura
 * de una noche es la de la puerta, no la del huso desde el que alguien la mire.
 * Un promotor consultando el panel desde otro país tiene que ver la misma hora
 * que el portero.
 */
export function horaDeSala(iso: string, opciones?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: ZONA_DE_LA_SALA,
    ...(opciones ?? { dateStyle: "medium", timeStyle: "short" }),
  }).format(new Date(iso));
}

/**
 * Formatea céntimos como soles.
 *
 * El dinero viaja en céntimos enteros de punta a punta —igual que en la base—
 * y solo se divide aquí, en el último paso antes de pintarlo. Operar con el
 * valor dividido es como se acaba con un total de 330,00000000004.
 */
export function soles(centimos: number): string {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(centimos / 100);
}
