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
 * La dirección de una imagen lista para pintarla.
 *
 * Los flyers subidos desde el panel los sirve el backend (`/api/publico/...`),
 * y el backend vive en otro origen: una ruta relativa iría a parar al servidor
 * del frontend. Las fotos fijas (`/fotos/...`) sí son del frontend y se dejan.
 */
export function imagen(ruta: string): string {
  return ruta.startsWith("/api/") ? `${BASE}${ruta}` : ruta;
}

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
        // Un FormData lleva su propio Content-Type con el separador de partes:
        // ponerle JSON encima rompe la subida de archivos.
        ...(typeof opciones.body === "string" ? { "Content-Type": "application/json" } : {}),
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

export type Rol = "DIRECCION" | "GERENCIA" | "PROMOTOR" | "PUERTA" | "BARRA" | "PERSONAL";

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

// ───────────────────── Almacén: stock y movimientos ─────────────────────
//
// El catálogo dice qué productos existen; esto dice cuántos quedan. Son cosas
// distintas: un producto puede estar en el catálogo con cero unidades.
//
// El saldo dejó de estar desglosado por sala: antes vivía en una tabla aparte
// con una fila por producto y sala, y ahora es una sola columna del producto.
// Por eso esta línea ya no trae ni `id` propio ni `sala`: la identifica el
// producto, y la cifra es una sola. Los movimientos sí siguen diciendo de qué
// sala salieron.

export type LineaDeStock = {
  productoId: string;
  sku: string;
  producto: string;
  categoria: string;
  unidad: UnidadDeProducto;
  cantidad: number;
  alertaDeStock: number;
  necesitaReposicion: boolean;
  faltanParaElUmbral: number;
  valorACosteCentimos: number;
  costeCentimos: number;
  precioCentimos: number;
};

export type ResumenDeAlmacen = {
  referencias: number;
  porDebajoDelUmbral: number;
  sinExistencias: number;
  valorTotalCentimos: number;
};

export type StockConResumen = {
  resumen: ResumenDeAlmacen;
  lineas: LineaDeStock[];
};

export type TipoDeMovimiento = "COMPRA" | "VENTA" | "MERMA" | "AJUSTE" | "TRANSFERENCIA";

export type LineaDeMovimiento = {
  id: string;
  producto: string;
  sku: string;
  sala: string;
  tipo: TipoDeMovimiento;
  tipoEtiqueta: string;
  /** Con su signo: negativa cuando salió mercancía. */
  cantidad: number;
  /** Sin signo, para enseñar «3» en vez de «−3». */
  unidades: number;
  esEntrada: boolean;
  costeUnitarioCentimos: number;
  importeCentimos: number;
  referencia: string | null;
  cuando: string;
};

export type Proveedor = {
  id: string;
  nombre: string;
  personaDeContacto: string | null;
  email: string | null;
  telefono: string | null;
};

export function verStock(): Promise<StockConResumen> {
  return pedir<StockConResumen>("/api/inventario/stock");
}

/** @param productoId si se indica, solo el histórico de ese producto */
export function verMovimientos(productoId = ""): Promise<LineaDeMovimiento[]> {
  const query = productoId ? `?producto=${encodeURIComponent(productoId)}` : "";
  return pedir<LineaDeMovimiento[]>(`/api/inventario/movimientos${query}`);
}

export function listarProveedores(): Promise<Proveedor[]> {
  return pedir<Proveedor[]>("/api/inventario/proveedores");
}

// ─────────────────────── Pedidos y entradas ───────────────────────

export type EstadoDePedido = "PENDIENTE" | "PAGADO" | "CANCELADO" | "DEVUELTO";
export type EstadoDeEntrada = "VALIDA" | "USADA" | "ANULADA" | "DEVUELTO";

export type PedidoEnLista = {
  /** El que ve el cliente: DSC-000123. No es el id interno. */
  codigo: string;
  cliente: string;
  noche: string;
  nocheSlug: string;
  estado: EstadoDePedido;
  estadoEtiqueta: string;
  metodoDePago: MetodoDePago | null;
  totalCentimos: number;
  creadoEn: string;
  pagadoEn: string | null;
};

export type LineaEnFicha = {
  tipoDeEntrada: string;
  cantidad: number;
  precioUnitarioCentimos: number;
  importeCentimos: number;
};

export type EntradaEnFicha = {
  /**
   * Los primeros caracteres del id, para identificarla al hablar.
   *
   * El código completo **no llega hasta aquí**: incluye la firma del QR, y una
   * lista de códigos completos es una lista de entradas válidas.
   */
  referencia: string;
  tipoDeEntrada: string;
  titular: string | null;
  estado: EstadoDeEntrada;
  estadoEtiqueta: string;
  yaSeUso: boolean;
  escaneadaEn: string | null;
};

export type FichaDePedido = {
  pedido: PedidoEnLista;
  email: string;
  telefono: string | null;
  subtotalCentimos: number;
  comisionCentimos: number;
  lineas: LineaEnFicha[];
  entradas: EntradaEnFicha[];
};

export function listarPedidos(): Promise<PedidoEnLista[]> {
  return pedir<PedidoEnLista[]>("/api/pedidos");
}

export function verPedido(codigo: string): Promise<FichaDePedido> {
  return pedir<FichaDePedido>(`/api/pedidos/${encodeURIComponent(codigo)}`);
}

// ─────────────────────── Caja y arqueos ───────────────────────

export type MetodoDePago = "EFECTIVO" | "TARJETA" | "YAPE" | "PLIN" | "TRANSFERENCIA";

export type ArqueoEnLista = {
  id: string;
  sala: string;
  /** En qué barra se trabajó. Nula en turnos viejos sin barra atribuida. */
  barra: string | null;
  responsable: string;
  aperturaCentimos: number;
  esperadoCentimos: number;
  /** Nulo mientras la caja siga abierta: todavía no se ha contado. */
  contadoCentimos: number | null;
  /** Positivo = sobra dinero. Negativo = falta. Nulo si sigue abierta. */
  diferenciaCentimos: number | null;
  /**
   * Solo el efectivo que entró al cajón durante el turno.
   *
   * **No es lo vendido**: los cobros con tarjeta no llegan al cajón y no cuentan
   * aquí. Para el total facturado hay que sumar todos los métodos de pago, que
   * es lo que trae la ficha del arqueo.
   */
  efectivoCobradoCentimos: number;
  estaAbierta: boolean;
  cuadro: boolean;
  abiertaEn: string;
  cerradaEn: string | null;
};

export type TotalPorMetodo = {
  metodo: MetodoDePago;
  etiqueta: string;
  esEfectivo: boolean;
  totalCentimos: number;
};

export type CobroEnLista = {
  id: string;
  metodo: MetodoDePago;
  metodoEtiqueta: string;
  totalCentimos: number;
  unidades: number;
  cuando: string;
};

export type FichaDeArqueo = {
  arqueo: ArqueoEnLista;
  porMetodoDePago: TotalPorMetodo[];
  /** Lo único que llega al cajón, y por tanto lo único que explica un descuadre. */
  efectivoCentimos: number;
  otrosMediosCentimos: number;
  cobros: number;
  ultimosCobros: CobroEnLista[];
};

export function listarArqueos(): Promise<ArqueoEnLista[]> {
  return pedir<ArqueoEnLista[]>("/api/caja/arqueos");
}

export function verArqueo(id: string): Promise<FichaDeArqueo> {
  return pedir<FichaDeArqueo>(`/api/caja/arqueos/${encodeURIComponent(id)}`);
}

// ─────────────────────────── Eventos ───────────────────────────

export type EstadoDeEvento = "BORRADOR" | "PUBLICADO" | "AGOTADO" | "CANCELADO" | "CERRADO";

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
  maxPorPedido: number;
  consumicionesIncluidas: number;
  activo: boolean;
};

/** Un artista del cartel en la ficha del panel, con su id para poder editarlo. */
export type ArtistaDelCartel = { id: string; nombre: string; genero: string | null; cabezaDeCartel: boolean };

export type EventoDetalle = {
  id: string;
  slug: string;
  titulo: string;
  descripcion: string | null;
  portada: string | null;
  /** Un archivo subido (`/api/publico/videos/...`), un MP4 externo o un enlace de YouTube. */
  video: string | null;
  salaId: string;
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
  /** En el orden en que se lee: el cabeza primero. */
  cartel: ArtistaDelCartel[];
};

export function listarEventos(): Promise<Evento[]> {
  return pedir<Evento[]>("/api/eventos");
}

// ─────────────────────────── Clientes ───────────────────────────
//
// Datos personales de gente real. Solo los sirve el panel, detrás de rol.

export type TipoDeInteraccion =
  | "COMPRA"
  | "VISITA"
  | "RESERVA"
  | "CAMPANIA"
  | "CHAT"
  | "QUEJA"
  | "NOTA";

export type CanalDeInteraccion =
  | "WEB"
  | "WHATSAPP"
  | "CORREO"
  | "TELEFONO"
  | "INSTAGRAM"
  | "EN_PERSONA";

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
  COMPRA: "Compra",
  VISITA: "Visita",
  RESERVA: "Reserva",
  CAMPANIA: "Campaña",
  CHAT: "Chat",
  QUEJA: "Queja",
  NOTA: "Nota",
};

export const NOMBRE_DE_CANAL: Record<CanalDeInteraccion, string> = {
  WEB: "Web",
  WHATSAPP: "WhatsApp",
  CORREO: "Correo",
  TELEFONO: "Teléfono",
  INSTAGRAM: "Instagram",
  EN_PERSONA: "En el local",
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
  /** Hay una lista de entrada gratuita a la venta (p. ej. «lista mujeres»). */
  conListaGratis: boolean;
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
  video: string | null;
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
  BORRADOR: "Borrador",
  PUBLICADO: "A la venta",
  AGOTADO: "Agotado",
  CANCELADO: "Cancelado",
  CERRADO: "Terminado",
};

/**
 * Cómo se enseña el estado de una noche, teniendo en cuenta la fecha.
 *
 * Una noche publicada cuya fecha ya pasó no está «a la venta» aunque nadie la
 * haya cerrado en el panel: decirlo así confunde. Se enseña como «Pasada», con
 * el estilo de las cerradas, sin tocar el estado guardado.
 */
export function estadoVisible(estado: EstadoDeEvento, empiezaA: string): { clase: string; texto: string } {
  const pasada = new Date(empiezaA).getTime() < Date.now();
  if (pasada && (estado === "PUBLICADO" || estado === "AGOTADO")) {
    return { clase: "estado estado--cerrado", texto: "Pasada" };
  }
  return { clase: `estado estado--${estado.toLowerCase()}`, texto: NOMBRE_DE_ESTADO[estado] };
}

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

// ─────────────────────────── Puerta ───────────────────────────
//
// La pantalla del portero. Es la única del sistema que usa alguien de pie, con
// frío y con cola delante, y eso se nota en la forma de la API: un rechazo llega
// como respuesta correcta (`ok: false`) y no como error HTTP, porque una entrada
// de otra noche no es un fallo de la aplicación.

/** Por qué no pasa. La pantalla decide color y sonido con esto, no con el texto. */
export type MotivoDeRechazo = "FALSA" | "NO_EXISTE" | "ANULADA" | "REPETIDA" | "OTRA_FECHA";

export type ResultadoDeEscaneo = {
  ok: boolean;
  /** Nulo cuando pasa. */
  motivo: MotivoDeRechazo | null;
  /** Lo que el portero lee en voz alta. */
  mensaje: string;
  /** Va también en los rechazos que la tienen: es lo primero que se pregunta. */
  titular: string | null;
  tipoDeEntrada: string | null;
  consumicionesIncluidas: number;
  evento: string | null;
  escaneadoEn: string | null;
};

export type RepartoPorPuerta = { puerta: string; personas: number };

export type AccesoReciente = {
  titular: string | null;
  tipoDeEntrada: string;
  /** Nulo si la sala no tiene puertas registradas. */
  puerta: string | null;
  portero: string;
  cuando: string;
};

export type EstadoDeLaNoche = {
  hayNoche: boolean;
  /** En falso, lo que se enseña es la próxima noche y el escáner aún rechazaría. */
  enCurso: boolean;
  slug: string | null;
  titulo: string | null;
  sala: string | null;
  puertasA: string | null;
  empiezaA: string | null;
  terminaA: string | null;
  aforoDeLaSala: number;
  /** Las que existen y podrían presentarse: válidas más usadas. */
  emitidas: number;
  /** Cuántas han pasado ya. Es el aforo en vivo. */
  dentro: number;
  porPuerta: RepartoPorPuerta[];
  ultimos: AccesoReciente[];
};

export function verNocheDePuerta(): Promise<EstadoDeLaNoche> {
  return pedir<EstadoDeLaNoche>("/api/puerta/noche");
}

/**
 * Lee un código de QR.
 *
 * Un rechazo **no lanza**: llega como `ok: false` con su motivo. Solo lanzan los
 * fallos de verdad —sin sesión, sin permiso, backend caído—, que es justo la
 * distinción que la pantalla necesita para no pintar igual «entrada de otra
 * noche» y «se cayó el servidor».
 */
export function escanearEntrada(codigo: string): Promise<ResultadoDeEscaneo> {
  return pedir<ResultadoDeEscaneo>("/api/puerta/escanear", {
    method: "POST",
    body: JSON.stringify({ codigo }),
  });
}

/** Cómo se llama cada rechazo en la pantalla. */
export const NOMBRE_DE_RECHAZO: Record<MotivoDeRechazo, string> = {
  FALSA: "Falsa",
  NO_EXISTE: "No existe",
  ANULADA: "Anulada",
  REPETIDA: "Ya entró",
  OTRA_FECHA: "Otra fecha",
};

// ─────────────────── Comprar entradas (web pública) ───────────────────
//
// Fíjate en lo que la petición NO lleva: ni precios, ni total. Solo qué se
// quiere y cuánto. Los importes los calcula el servidor leyendo la base — un
// total que viaja desde aquí es un total que se puede editar con las
// herramientas del navegador.

export type LineaPedida = { tipoDeEntradaId: string; cantidad: number };

export type SolicitudDeCompra = {
  slug: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  lineas: LineaPedida[];
  /** El código del promotor del enlace (`?promo=`), si se llegó por uno. */
  promo?: string | null;
};

/** Lo que devuelve abrir un pedido: el código con el que se sigue. */
export type Resguardo = {
  codigo: string;
  subtotalCentimos: number;
  comisionCentimos: number;
  totalCentimos: number;
  entradas: number;
  mensaje: string;
};

export type PagoHecho = {
  codigo: string;
  entradas: number;
  yaEstabaPagado: boolean;
  mensaje: string;
};

/**
 * Una entrada con su código completo.
 *
 * Es el único sitio de la aplicación donde llega el código entero, firma
 * incluida: es el QR que se enseña en la puerta, y solo se sirve a quien tiene
 * el enlace de su propio pedido. En el panel llega recortado a propósito.
 */
export type EntradaConQr = {
  codigo: string;
  tipoDeEntrada: string;
  titular: string | null;
  consumicionesIncluidas: number;
  yaSeUso: boolean;
};

export type MisEntradas = {
  codigo: string;
  pagado: boolean;
  noche: string;
  slug: string;
  sala: string;
  puertasA: string;
  empiezaA: string;
  totalCentimos: number;
  entradas: EntradaConQr[];
};

export function comprarEntradas(solicitud: SolicitudDeCompra): Promise<Resguardo> {
  return pedir<Resguardo>("/api/publico/pedidos", {
    method: "POST",
    body: JSON.stringify(solicitud),
  });
}

/**
 * Confirma el pago.
 *
 * **El cobro es simulado**: no hay pasarela conectada, así que esto emite las
 * entradas sin cobrar nada. Está señalado aquí y en el backend porque es lo
 * primero que hay que cambiar antes de que esto mueva dinero de verdad.
 */
export function pagarPedido(codigo: string): Promise<PagoHecho> {
  return pedir<PagoHecho>(`/api/publico/pedidos/${encodeURIComponent(codigo)}/pagar`, {
    method: "POST",
  });
}

export function verMisEntradas(codigo: string): Promise<MisEntradas> {
  return pedir<MisEntradas>(`/api/publico/pedidos/${encodeURIComponent(codigo)}`);
}

// ─────────────────────────── Barra ───────────────────────────
//
// El punto de venta. Como la puerta, va fuera del panel: quien sirve copas no
// tiene permiso sobre ninguna ruta del panel, y el arqueo histórico se mira en
// /panel/caja, que es donde se sienta quien cuadra al cerrar.

export type BotonDeProducto = {
  id: string;
  nombre: string;
  sku: string;
  unidad: UnidadDeProducto;
  precioCentimos: number;
  /** Puede ser negativo. No se oculta: es la señal de que hay que reponer. */
  stock: number;
};

export type GrupoDeCatalogo = { categoria: string; productos: BotonDeProducto[] };

export type TurnoAbierto = {
  id: string;
  sala: string;
  barra: string | null;
  responsable: string;
  fondoCentimos: number;
  /**
   * Lo que debería haber en el cajón: el fondo más lo cobrado **en efectivo**.
   * La tarjeta y el Yape van al banco y no cuentan aquí.
   */
  esperadoCentimos: number;
  abiertaEn: string;
};

export type PantallaDeBarra = {
  /** Nulo si esta persona no tiene caja abierta. */
  turno: TurnoAbierto | null;
  noche: string | null;
  nocheSlug: string | null;
  /** Dónde se puede abrir turno. Con una sola no hay nada que preguntar. */
  barras: { id: string; nombre: string }[];
  catalogo: GrupoDeCatalogo[];
};

export type VentaHecha = {
  id: string;
  totalCentimos: number;
  unidades: number;
  esperadoEnCajon: number;
};

export type TurnoCerrado = {
  id: string;
  fondoCentimos: number;
  esperadoCentimos: number;
  contadoCentimos: number;
  diferenciaCentimos: number;
  cuadro: boolean;
  cerradaEn: string;
};

export function verBarra(): Promise<PantallaDeBarra> {
  return pedir<PantallaDeBarra>("/api/barra");
}

/**
 * Abre el turno, o devuelve el que ya estaba.
 *
 * Volver a entrar es **continuar** el turno, no empezar otro: si no, cerrar la
 * pestaña y volver abriría una segunda caja y las ventas se repartirían entre
 * las dos.
 */
export function abrirTurno(fondoCentimos: number, barraId: string | null = null): Promise<TurnoAbierto> {
  return pedir<TurnoAbierto>("/api/barra/turno", {
    method: "POST",
    body: JSON.stringify({ fondoCentimos, barraId }),
  });
}

export function cobrarEnBarra(
  arqueoId: string,
  metodoDePago: MetodoDePago,
  eventoSlug: string | null,
  lineas: { productoId: string; cantidad: number }[],
): Promise<VentaHecha> {
  return pedir<VentaHecha>("/api/barra/ventas", {
    method: "POST",
    body: JSON.stringify({ arqueoId, metodoDePago, eventoSlug, lineas }),
  });
}

export function cerrarTurno(arqueoId: string, contadoCentimos: number): Promise<TurnoCerrado> {
  return pedir<TurnoCerrado>("/api/barra/cierre", {
    method: "POST",
    body: JSON.stringify({ arqueoId, contadoCentimos }),
  });
}

/** Cómo se llama cada método de pago en la pantalla. */
export const NOMBRE_DE_PAGO: Record<MetodoDePago, string> = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  YAPE: "Yape",
  PLIN: "Plin",
  TRANSFERENCIA: "Transferencia",
};

// ──────────────── Programar noches (panel) ────────────────
//
// Lo que hasta ahora solo se leía. Va bajo el mismo prefijo `/api/eventos` que
// el listado, porque es la misma sección vista por la misma gente: lo que cambia
// es el verbo.

export type SalaParaElegir = { id: string; nombre: string; aforo: number };
export type ArtistaParaElegir = { id: string; nombre: string; genero: string | null };

export type OpcionesDeProgramacion = {
  salas: SalaParaElegir[];
  artistas: ArtistaParaElegir[];
};

/**
 * Lo que se manda al crear o editar una noche.
 *
 * Las fechas van como instante ISO en UTC, no como texto de hora local: la
 * conversión se hace aquí, donde se sabe en qué zona está la sala. Ver
 * `deHoraDeSala`.
 */
export type FormularioDeNoche = {
  titulo: string;
  descripcion: string;
  salaId: string;
  puertasA: string;
  terminaA: string;
  edadMinima: number;
  vestimenta: string;
  estado: EstadoDeEvento;
  portada: string;
  video: string;
  /** En orden. El primero es cabeza de cartel. */
  artistaIds: string[];
};

export type FormularioDeTipo = {
  nombre: string;
  descripcion: string;
  precioCentimos: number;
  cantidad: number;
  maximoPorPedido: number;
  consumicionesIncluidas: number;
  activo: boolean;
};

export type NocheGuardada = { id: string; slug: string; titulo: string };
export type TipoGuardado = { id: string; nombre: string; cantidad: number; activo: boolean };
export type TipoQuitado = { retirado: boolean; mensaje: string };

export function verOpcionesDeProgramacion(): Promise<OpcionesDeProgramacion> {
  return pedir<OpcionesDeProgramacion>("/api/eventos/opciones");
}

export function crearNoche(datos: FormularioDeNoche): Promise<NocheGuardada> {
  return pedir<NocheGuardada>("/api/eventos", {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

/** Edita una noche. La dirección (`slug`) no cambia aunque cambie el título. */
export function editarNoche(slug: string, datos: FormularioDeNoche): Promise<NocheGuardada> {
  return pedir<NocheGuardada>(`/api/eventos/${encodeURIComponent(slug)}`, {
    method: "PUT",
    body: JSON.stringify(datos),
  });
}

export function anadirTipoDeEntrada(slug: string, datos: FormularioDeTipo): Promise<TipoGuardado> {
  return pedir<TipoGuardado>(`/api/eventos/${encodeURIComponent(slug)}/entradas`, {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

export function editarTipoDeEntrada(id: string, datos: FormularioDeTipo): Promise<TipoGuardado> {
  return pedir<TipoGuardado>(`/api/eventos/entradas/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(datos),
  });
}

/**
 * Quita un tipo de entrada.
 *
 * Si tiene ventas **no se borra**: se retira de la venta, y la respuesta lo dice
 * en `retirado`. Hay que enseñarlo, o parecerá que el botón no funcionó.
 */
export function quitarTipoDeEntrada(id: string): Promise<TipoQuitado> {
  return pedir<TipoQuitado>(`/api/eventos/entradas/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

/**
 * Cuántas horas va Lima por detrás de UTC.
 *
 * Perú no tiene horario de verano, así que el desfase es siempre el mismo y se
 * puede escribir como una constante. En un país con cambio de hora esto tendría
 * que salir de `Intl`, y aun así sería una fuente de errores dos veces al año.
 */
const HORAS_DE_DESFASE = 5;

const MS_POR_HORA = 3_600_000;

/**
 * Convierte lo que se teclea en un `datetime-local` a un instante UTC.
 *
 * Un `<input type="datetime-local">` da «2027-04-02T20:00» sin zona, y
 * `new Date()` lo interpretaría en la zona **del navegador**. Un promotor
 * planificando desde otro país programaría la noche a una hora distinta de la
 * que escribió, sin ningún aviso.
 *
 * Por eso se fija a mano: lo tecleado es hora de sala, y la sala está en Lima.
 */
export function deHoraDeSala(local: string): string {
  if (!local) return "";
  // Al leerlo como si fuera UTC y sumarle el desfase se obtiene el instante
  // real: las 20:00 de Lima son las 01:00 UTC del día siguiente.
  const comoSiFueraUtc = Date.parse(`${local}:00Z`);
  if (Number.isNaN(comoSiFueraUtc)) return "";
  return new Date(comoSiFueraUtc + HORAS_DE_DESFASE * MS_POR_HORA).toISOString();
}

/** El camino de vuelta: un instante ISO al texto que espera el campo del formulario. */
export function aHoraDeSala(iso: string): string {
  if (!iso) return "";
  const enLima = new Date(Date.parse(iso) - HORAS_DE_DESFASE * MS_POR_HORA);
  // `toISOString` da «...T20:00:00.000Z»; el campo quiere «...T20:00».
  return enLima.toISOString().slice(0, 16);
}

// ──────────────── Almacén: altas y movimientos ────────────────
//
// Es la otra mitad de la barra. El punto de venta hace bajar el stock solo, pero
// nada lo subía: sin esto, a la tercera noche el inventario está en negativo y
// deja de servir para decidir qué pedir.

export type CategoriaParaElegir = { id: string; nombre: string };
export type SalaParaElegirEnAlmacen = { id: string; nombre: string };

export type OpcionesDeAlmacen = {
  categorias: CategoriaParaElegir[];
  salas: SalaParaElegirEnAlmacen[];
  unidades: UnidadDeProducto[];
  /** Solo los que se registran a mano. La venta no está, y es a propósito. */
  tiposDeMovimiento: TipoDeMovimiento[];
};

/**
 * La ficha de un producto.
 *
 * No lleva SKU: lo genera el servidor. Es un campo único que nadie quiere
 * teclear a las once de la noche, y pedirlo garantizaba que se escribiera mal y
 * que chocara.
 */
export type FormularioDeProducto = {
  nombre: string;
  categoriaId: string;
  unidad: UnidadDeProducto;
  costeCentimos: number;
  precioCentimos: number;
  alertaDeStock: number;
  activo: boolean;
};

/**
 * Un movimiento a mano.
 *
 * `unidades` va sin signo en compra y merma —la persona escribe «12» pensando en
 * doce botellas— y con signo en ajuste. Quien resuelve el sentido es el
 * servidor: que una compra sume y una merma reste es una regla del negocio, no
 * algo que deba recordar quien rellena el formulario.
 */
export type FormularioDeMovimiento = {
  tipo: TipoDeMovimiento;
  salaId: string;
  unidades: number;
  /** Lo pagado por unidad, en céntimos. Solo significa algo en una compra. */
  costeUnitarioCentimos: number | null;
  nota: string;
};

export type ProductoGuardado = {
  id: string;
  sku: string;
  nombre: string;
  precioCentimos: number;
  activo: boolean;
};

export type MovimientoHecho = {
  movimientoId: string;
  producto: string;
  cantidad: number;
  stockResultante: number;
};

export function verOpcionesDeAlmacen(): Promise<OpcionesDeAlmacen> {
  return pedir<OpcionesDeAlmacen>("/api/inventario/opciones");
}

export function crearProducto(datos: FormularioDeProducto): Promise<ProductoGuardado> {
  return pedir<ProductoGuardado>("/api/inventario/productos", {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

export function editarProducto(
  id: string,
  datos: FormularioDeProducto,
): Promise<ProductoGuardado> {
  return pedir<ProductoGuardado>(`/api/inventario/productos/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(datos),
  });
}

export function moverStock(
  productoId: string,
  datos: FormularioDeMovimiento,
): Promise<MovimientoHecho> {
  return pedir<MovimientoHecho>(
    `/api/inventario/productos/${encodeURIComponent(productoId)}/movimientos`,
    { method: "POST", body: JSON.stringify(datos) },
  );
}

/** Cómo se llama cada unidad en la pantalla. */
export const NOMBRE_DE_UNIDAD: Record<UnidadDeProducto, string> = {
  UNIDAD: "Unidad",
  BOTELLA: "Botella",
  CAJA: "Caja",
  LITRO: "Litro",
};

/** Cómo se llama cada tipo de movimiento. */
export const NOMBRE_DE_MOVIMIENTO: Record<TipoDeMovimiento, string> = {
  COMPRA: "Compra",
  VENTA: "Venta",
  MERMA: "Merma",
  AJUSTE: "Ajuste",
  TRANSFERENCIA: "Traspaso",
};

// ──────────────── CRM: segmentos y campañas ────────────────
//
// Un segmento no es una lista de clientes: es una regla que se vuelve a evaluar
// en cada petición. Por eso no hay ningún «actualizar segmentos» — no existe
// nada que actualizar, la lista se deduce de la regla cada vez que se pregunta.

export type SegmentoEnLista = {
  id: string;
  nombre: string;
  descripcion: string | null;
  /** La condición en castellano, generada al vuelo desde la regla guardada. */
  regla: string;
  /** Falso si el JSON guardado tiene un tipo que el sistema no sabe evaluar. */
  reglaReconocida: boolean;
  miembros: number;
  /**
   * Cuántos de ellos dieron permiso para escribirles.
   *
   * No es lo mismo que `miembros`: «VIP» incluye a quien gastó mucho y nunca dio
   * su consentimiento. Enseñar solo el total promete un alcance que no existe.
   */
  contactables: number;
  valorCentimos: number;
  actualizadoEn: string;
};

export type MiembroDeSegmento = {
  id: string;
  nombre: string;
  email: string;
  aceptaMarketing: boolean;
  visitas: number;
  gastadoCentimos: number;
  ultimaVisita: string | null;
};

export type FichaDeSegmento = {
  segmento: SegmentoEnLista;
  miembros: MiembroDeSegmento[];
};

export type CanalDeCampania = "CORREO" | "SMS" | "WHATSAPP" | "PUSH";
export type EstadoDeCampania = "BORRADOR" | "PROGRAMADO" | "ENVIADO" | "CANCELADO";

export type CampaniaEnLista = {
  id: string;
  nombre: string;
  canal: CanalDeCampania;
  canalEtiqueta: string;
  segmento: string;
  segmentoId: string;
  asunto: string | null;
  cuerpo: string;
  estado: EstadoDeCampania;
  estadoEtiqueta: string;
  sePuedeTocar: boolean;
  enviados: number;
  creadoEn: string;
};

export type FormularioDeCampania = {
  nombre: string;
  canal: CanalDeCampania;
  segmentoId: string;
  asunto: string;
  cuerpo: string;
};

export function verSegmentos(): Promise<SegmentoEnLista[]> {
  return pedir<SegmentoEnLista[]>("/api/clientes/segmentos");
}

export function verSegmento(id: string): Promise<FichaDeSegmento> {
  return pedir<FichaDeSegmento>(`/api/clientes/segmentos/${encodeURIComponent(id)}`);
}

export function verCampanias(): Promise<CampaniaEnLista[]> {
  return pedir<CampaniaEnLista[]>("/api/clientes/campanias");
}

/**
 * Redacta una campaña.
 *
 * Queda en **borrador**: el sistema no manda nada, no hay proveedor de correo ni
 * de SMS conectado. Es lo mismo que hacía el sistema anterior.
 */
export function redactarCampania(datos: FormularioDeCampania): Promise<CampaniaEnLista> {
  return pedir<CampaniaEnLista>("/api/clientes/campanias", {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

export function reescribirCampania(
  id: string,
  datos: FormularioDeCampania,
): Promise<CampaniaEnLista> {
  return pedir<CampaniaEnLista>(`/api/clientes/campanias/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(datos),
  });
}

/** La descarta. Se marca como cancelada, no se borra. */
export function cancelarCampania(id: string): Promise<CampaniaEnLista> {
  return pedir<CampaniaEnLista>(`/api/clientes/campanias/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export const NOMBRE_DE_CANAL_DE_CAMPANIA: Record<CanalDeCampania, string> = {
  CORREO: "Correo",
  SMS: "SMS",
  WHATSAPP: "WhatsApp",
  PUSH: "Notificación",
};

// ─────────────────────────── Panel ───────────────────────────
//
// Las dos pantallas que resumen: la portada y la noche en curso. No añaden
// capacidad —los ingresos están en pedidos, el stock bajo en almacén y el aforo
// en la puerta— sino que ahorran sumar a mano a las dos de la mañana, que es
// cuando la suma sale mal.

/**
 * Cómo pintar una cifra.
 *
 * Lo decide el backend y no esta capa: si siete referencias bajo mínimo es malo
 * o normal es una regla de negocio, y repetirla aquí significa que un día las
 * dos copias dejan de decir lo mismo.
 */
export type TonoDeCifra = "acento" | "neutro" | "bien" | "mal";

export type Cifra = {
  etiqueta: string;
  valor: string;
  pie: string;
  tono: TonoDeCifra;
};

export type NocheEnPortada = {
  slug: string;
  titulo: string;
  puertasA: string;
  vendidas: number;
  aforoALaVenta: number;
  porcentajeVendido: number;
  recaudadoCentimos: number;
};

export type ArqueoEnPortada = {
  id: string;
  sala: string;
  responsable: string;
  /** Nulo mientras la caja sigue abierta: nadie ha contado todavía. */
  diferenciaCentimos: number | null;
  estaAbierta: boolean;
  abiertaEn: string;
};

export type ReposicionEnPortada = {
  productoId: string;
  producto: string;
  quedan: number;
  umbral: number;
  faltan: number;
};

export type PedidoEnPortada = {
  codigo: string;
  cliente: string;
  noche: string;
  totalCentimos: number;
  creadoEn: string;
};

export type ResumenDelPanel = {
  cifras: Cifra[];
  /** Nulo si no queda ninguna fecha publicada por delante. */
  proxima: NocheEnPortada | null;
  ultima: NocheEnPortada | null;
  asistenciaDeLaUltima: number;
  ultimoArqueo: ArqueoEnPortada | null;
  hayQueReponer: ReposicionEnPortada[];
  /** Cuántas hay en total: la lista viene recortada para la portada. */
  totalPorReponer: number;
  ultimosPedidos: PedidoEnPortada[];
};

/** Un tramo de cuarto de hora del ritmo de entrada. */
export type TramoDeEntrada = {
  desde: string;
  personas: number;
};

export type EstadoDeReserva = "SOLICITADA" | "CONFIRMADA" | "SENTADA" | "NO_VINO" | "CANCELADO";

export type ReservaEnLaNoche = {
  mesa: string;
  zona: string | null;
  cliente: string;
  personas: number;
  estado: EstadoDeReserva;
};

export type AccesoPorPuerta = {
  puerta: string;
  personas: number;
  /** Cuánta gente admite por minuto. Cero cuando no está registrado. */
  caudalPorMinuto: number;
};

export type TorreDeControl = {
  hayNoche: boolean;
  /** En falso, lo que se enseña es la próxima: los números son de antes de abrir. */
  enCurso: boolean;
  slug: string | null;
  titulo: string | null;
  sala: string | null;
  puertasA: string | null;
  terminaA: string | null;
  aforoDeSala: number;
  vendidas: number;
  dentro: number;
  taquillaCentimos: number;
  barraCentimos: number;
  consumiciones: number;
  /** Lo que deja en barra cada persona que entró, no cada una que compró. */
  gastoPorAsistenteCentimos: number;
  ritmoDeEntrada: TramoDeEntrada[];
  reservados: ReservaEnLaNoche[];
  porPuerta: AccesoPorPuerta[];
};

export function verResumenDelPanel(): Promise<ResumenDelPanel> {
  return pedir<ResumenDelPanel>("/api/panel/resumen");
}

export function verLaNoche(): Promise<TorreDeControl> {
  return pedir<TorreDeControl>("/api/panel/noche");
}

export const NOMBRE_DE_ESTADO_DE_RESERVA: Record<EstadoDeReserva, string> = {
  SOLICITADA: "Solicitada",
  CONFIRMADA: "Confirmada",
  SENTADA: "Sentados",
  NO_VINO: "No vino",
  CANCELADO: "Cancelada",
};

// ─────────────────────── Promotores y listas ───────────────────────
//
// La comisión llega ya calculada en el backend, para que la cifra sea la misma
// en el panel y en la pantalla del promotor: su porcentaje sobre el precio de
// las entradas vendidas con su código (sin gastos de gestión) más, si lo
// tiene, un fijo por cada invitado de sus listas que entra.

export type ListaDeInvitados = {
  id: string;
  nombre: string;
  noche: string;
  nocheSlug: string;
  empiezaA: string;
  promotor: string;
  /** Personas, no filas: «Ana +3» son cuatro. */
  apuntados: number;
  maxInvitados: number;
  entraron: number;
  /** Si la noche ya empezó. Antes, «entraron 0» no significa nada. */
  pasada: boolean;
};

export type Promotor = {
  id: string;
  nombre: string;
  rol: Rol;
  email: string | null;
  codigo: string;
  comisionPorcentaje: number;
  bonoPorInvitadoCentimos: number;
  activo: boolean;
  pedidos: number;
  /** El precio de las entradas vendidas con su código, sin gastos de gestión. */
  vendidoCentimos: number;
  /** Lo que se le debe de noches que ya pasaron. */
  pendienteCentimos: number;
  /** Lo que ganará por lo ya vendido para noches que no han llegado. */
  porCelebrarCentimos: number;
  pagadoCentimos: number;
  ultimoPago: string | null;
  invitados: number;
  entraron: number;
  listas: ListaDeInvitados[];
};

export type ResumenDePromotores = {
  activos: number;
  vendidoCentimos: number;
  pendienteCentimos: number;
  pagadoCentimos: number;
  invitados: number;
  entraron: number;
  promotores: Promotor[];
};

export type EstadoDeNocheDePromotor = "POR_CELEBRAR" | "PENDIENTE" | "LIQUIDADA";

export type NocheDelPromotor = {
  slug: string;
  titulo: string;
  empiezaA: string;
  estado: EstadoDeNocheDePromotor;
  pedidos: number;
  entradas: number;
  ventasCentimos: number;
  comisionCentimos: number;
  listas: number;
  apuntados: number;
  entraron: number;
  bonoCentimos: number;
  totalCentimos: number;
};

export type PendienteDePromotor = {
  pedidos: number;
  entradas: number;
  ventasCentimos: number;
  comisionPct: number;
  comisionCentimos: number;
  listas: number;
  invitadosEntraron: number;
  bonoPorInvitadoCentimos: number;
  bonoCentimos: number;
  totalCentimos: number;
};

export type Liquidacion = {
  id: string;
  pagadaEn: string;
  hasta: string;
  pedidos: number;
  entradas: number;
  ventasCentimos: number;
  comisionPorcentaje: number;
  comisionCentimos: number;
  invitadosEntraron: number;
  bonoPorInvitadoCentimos: number;
  bonoCentimos: number;
  ajusteCentimos: number;
  totalCentimos: number;
  metodoDePago: MetodoDePago;
  referencia: string | null;
  nota: string | null;
  registradaPor: string | null;
};

export type FichaDePromotor = {
  promotor: Promotor;
  /** Lo que entraría en un pago hecho ahora mismo. */
  pendiente: PendienteDePromotor;
  noches: NocheDelPromotor[];
  liquidaciones: Liquidacion[];
};

export type Pago = {
  /** Incluye las noches que empezaron antes. Vacío: hasta ahora. */
  hasta: string | null;
  metodoDePago: MetodoDePago;
  referencia: string;
  nota: string;
  ajusteCentimos: number;
};

export function verPromotor(id: string): Promise<FichaDePromotor> {
  return pedir<FichaDePromotor>(`/api/promotores/${encodeURIComponent(id)}`);
}

export function liquidarPromotor(id: string, pago: Pago): Promise<Liquidacion> {
  return pedir<Liquidacion>(`/api/promotores/${encodeURIComponent(id)}/liquidaciones`, {
    method: "POST",
    body: JSON.stringify(pago),
  });
}

export function anularLiquidacion(id: string): Promise<void> {
  return pedir<void>(`/api/promotores/liquidaciones/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export const NOMBRE_DE_ESTADO_DE_NOCHE_DE_PROMOTOR: Record<EstadoDeNocheDePromotor, string> = {
  POR_CELEBRAR: "Por celebrar",
  PENDIENTE: "Pendiente de pago",
  LIQUIDADA: "Pagada",
};

// ─── La pantalla del propio promotor ───

export type NocheParaLista = { slug: string; titulo: string; empiezaA: string };

export type MiPanelDePromotor = { ficha: FichaDePromotor; noches: NocheParaLista[] };

export function verMiPanelDePromotor(): Promise<MiPanelDePromotor> {
  return pedir<MiPanelDePromotor>("/api/mi-promotor");
}

export function verMiLista(id: string): Promise<FichaDeLista> {
  return pedir<FichaDeLista>(`/api/mi-promotor/listas/${encodeURIComponent(id)}`);
}

export function abrirMiLista(datos: { slug: string; nombre: string; maxInvitados: number }): Promise<FichaDeLista> {
  return pedir<FichaDeLista>("/api/mi-promotor/listas", { method: "POST", body: JSON.stringify(datos) });
}

export function apuntarEnMiLista(listaId: string, nombreCompleto: string, personas: number): Promise<InvitadoEnFicha> {
  return pedir<InvitadoEnFicha>(`/api/mi-promotor/listas/${encodeURIComponent(listaId)}/invitados`, {
    method: "POST",
    body: JSON.stringify({ nombreCompleto, personas }),
  });
}

export function quitarDeMiLista(invitadoId: string): Promise<void> {
  return pedir<void>(`/api/mi-promotor/invitados/${encodeURIComponent(invitadoId)}`, { method: "DELETE" });
}

export function verPromotores(): Promise<ResumenDePromotores> {
  return pedir<ResumenDePromotores>("/api/promotores");
}

export function listasDeLaNoche(slug: string): Promise<ListaDeInvitados[]> {
  return pedir<ListaDeInvitados[]>(`/api/eventos/${encodeURIComponent(slug)}/listas`);
}

// ─────────────────────── Portada de una noche ───────────────────────

export type PortadaGuardada = { portada: string; pesoKb: number };

/** Sube el flyer. El backend lo reescala y le quita los metadatos. */
export function subirPortada(slug: string, archivo: File): Promise<PortadaGuardada> {
  const formulario = new FormData();
  formulario.append("archivo", archivo);
  return pedir<PortadaGuardada>(`/api/eventos/${encodeURIComponent(slug)}/portada`, {
    method: "POST",
    body: formulario,
  });
}

export function quitarPortada(slug: string): Promise<void> {
  return pedir<void>(`/api/eventos/${encodeURIComponent(slug)}/portada`, { method: "DELETE" });
}

// ─────────────────────── El local: plano y salidas ───────────────────────
//
// Las medidas van en metros, con el origen en la esquina del plano. La
// evacuación se calcula en el navegador (`local/evacuacion.ts`): es una
// fórmula sobre estos números, y así responde al instante al mover algo.

export type { ElementoPlano, PuertaPlano, TipoZona, ZonaPlano } from "./local/evacuacion";
import type { ElementoPlano, PuertaPlano, ZonaPlano } from "./local/evacuacion";

export type SalaDelLocal = {
  id: string;
  nombre: string;
  aforo: number;
  planoAncho: number;
  planoFondo: number;
  zonas: ZonaPlano[];
  puertas: PuertaPlano[];
  elementos: ElementoPlano[];
};

export type GeometriaDeSala = {
  salaId: string;
  planoAncho: number;
  planoFondo: number;
  zonas: ZonaPlano[];
  puertas: PuertaPlano[];
  elementos: ElementoPlano[];
};

export function verLocal(): Promise<SalaDelLocal[]> {
  return pedir<SalaDelLocal[]>("/api/local");
}

/** El mismo plano, sin sesión: lo que ve cualquiera en «Seguridad» de la web. */
export function verPlanoPublico(): Promise<SalaDelLocal[]> {
  return pedir<SalaDelLocal[]>("/api/publico/local");
}

/** Guarda medidas, zonas y puertas de una sala, todo o nada. */
export function guardarLocal(geometria: GeometriaDeSala): Promise<void> {
  return pedir<void>("/api/local", { method: "PUT", body: JSON.stringify(geometria) });
}

// ─────────────────────── Capa de IA ───────────────────────
//
// Ningún agente actúa solo: cada ejecución deja una propuesta, y solo al
// aprobarla desde el panel llega a tocar datos.

export type AgenteDeIa = {
  /** Como viaja en la URL: `crm-segmenter`. */
  clave: string;
  nombre: string;
  descripcion: string;
  modelo: string;
};

export type EjecucionLanzada = { ejecucionId: string; propuestaId: string; mensaje: string };

export type EstadoDePropuesta = "PENDIENTE" | "APROBADA" | "RECHAZADA";

export type PropuestaDeIa = {
  id: string;
  tipo: string;
  tipoNombre: string;
  agente: string;
  estado: EstadoDePropuesta;
  /** Tiene forma distinta según el agente: se pinta de forma genérica. */
  datos: unknown;
  creadoEn: string;
  revisadaPor: string | null;
  aplicada: boolean;
  costeCentimos: number;
  tokens: number;
};

export type BandejaDeIa = {
  pendientes: number;
  ejecuciones: number;
  costeCentimos: number;
  tokens: number;
  propuestas: PropuestaDeIa[];
};

/** Algo que se creó al aprobar, con la ruta del panel donde seguir a mano. */
export type EnlaceCreado = { texto: string; ruta: string };

export type Desenlace = {
  estado: EstadoDePropuesta;
  aplicada: boolean;
  mensaje: string;
  avisos: string[];
  enlaces: EnlaceCreado[];
};

export type MetricasDeIa = {
  ejecuciones: number;
  tasaDeAceptacion: number | null;
  aprobadas: number;
  revisadas: number;
  pendientes: number;
  costeCentimos: number;
  tokens: number;
  minutosHastaDecidir: number | null;
  porAgente: { agente: string; veces: number; exitoPorcentaje: number; mediana: string; tokensMedios: string }[];
  bancoDePruebas: { modelo: string; corridas: number; exitoPorcentaje: number; mediana: string; intentosMedios: string }[];
  ultimas: {
    id: string;
    agente: string;
    modelo: string | null;
    lanzadaPor: string;
    cuando: string;
    estado: "EN_COLA" | "EJECUTANDO" | "COMPLETADA" | "FALLIDA";
    propuestas: number;
  }[];
};

export function listarAgentes(): Promise<AgenteDeIa[]> {
  return pedir<AgenteDeIa[]>("/api/ia/agentes");
}

/** @param noche solo para el informe: el slug de la noche a cerrar. Sin él, la última celebrada. */
export function lanzarAgente(clave: string, noche?: string): Promise<EjecucionLanzada> {
  const consulta = noche ? `?noche=${encodeURIComponent(noche)}` : "";
  return pedir<EjecucionLanzada>(`/api/ia/agentes/${encodeURIComponent(clave)}${consulta}`, { method: "POST" });
}

export function verBandejaDeIa(): Promise<BandejaDeIa> {
  return pedir<BandejaDeIa>("/api/ia/propuestas");
}

/**
 * Aprueba o descarta una propuesta.
 *
 * @param datos la propuesta retocada a mano antes de aprobarla. Tiene que
 *     conservar la forma que dio el agente: el backend la valida contra el mismo
 *     esquema que le exigió al modelo.
 */
export function decidirPropuesta(
  id: string,
  decision: "APROBAR" | "DESCARTAR",
  datos?: unknown,
): Promise<Desenlace> {
  return pedir<Desenlace>(`/api/ia/propuestas/${encodeURIComponent(id)}`, {
    method: "POST",
    body: JSON.stringify(datos === undefined ? { decision } : { decision, datos }),
  });
}

/** Lo que propone el programador de noches. */
export type NochePropuesta = {
  titulo: string;
  fecha: string;
  puertas: string;
  cierre: string;
  descripcion: string;
  vestimenta: string;
  edadMinima: number;
  artistas: string[];
  entradas: {
    nombre: string;
    descripcion: string;
    precioCentimos: number;
    cantidad: number;
    maximoPorPedido: number;
  }[];
  motivo: string;
};

export type PropuestaDeNoches = { razonamiento: string; noches: NochePropuesta[] };

export function verMetricasDeIa(): Promise<MetricasDeIa> {
  return pedir<MetricasDeIa>("/api/ia/metricas");
}

// ─────────────────────── Conserje (chat público) ───────────────────────

export type TurnoDeChat = { rol: "usuario" | "asistente"; contenido: string };

export function preguntarAlConserje(
  mensaje: string,
  historial: TurnoDeChat[],
  sesionId: string | null,
): Promise<{ sesionId: string; respuesta: string }> {
  return pedir("/api/publico/chat", {
    method: "POST",
    body: JSON.stringify({ mensaje, historial, sesionId }),
  });
}

// ─────────────────────── Portada pública ───────────────────────

export type ExtrasDePortada = {
  boxes: { zona: string | null; plazas: number; consumoMinimoCentimos: number; cuantos: number }[];
  salas: { nombre: string; aforo: number; descripcion: string | null; zonas: { nombre: string; aforo: number }[] }[];
  artistas: { nombre: string; genero: string; instagram: string | null }[];
  pasadas: { slug: string; titulo: string; empiezaA: string; portada: string | null }[];
};

/** Boxes, el local, artistas y noches pasadas: lo que la portada enseña además de la agenda. */
export function verExtrasDePortada(): Promise<ExtrasDePortada> {
  return pedir<ExtrasDePortada>("/api/publico/portada");
}

// ─────────────────────── Historial de noches (gráficas) ───────────────────────

export type NocheCelebrada = {
  slug: string;
  titulo: string;
  empiezaA: string;
  /** Quien pasó por la puerta, no quien compró. */
  asistentes: number;
  taquillaCentimos: number;
  barraCentimos: number;
};

export function verHistorialDeNoches(noches = 12): Promise<NocheCelebrada[]> {
  return pedir<NocheCelebrada[]>(`/api/panel/historial?noches=${noches}`);
}

// ─────────────────────── Video de una noche y borrar ───────────────────────

export type VideoGuardado = { video: string; pesoKb: number };

/** Sube el video de la noche (MP4 o WebM, hasta 80 MB). */
export function subirVideo(slug: string, archivo: File): Promise<VideoGuardado> {
  const formulario = new FormData();
  formulario.append("archivo", archivo);
  return pedir<VideoGuardado>(`/api/eventos/${encodeURIComponent(slug)}/video`, {
    method: "POST",
    body: formulario,
  });
}

export function quitarVideo(slug: string): Promise<void> {
  return pedir<void>(`/api/eventos/${encodeURIComponent(slug)}/video`, { method: "DELETE" });
}

/** Borra una noche en borrador o cancelada que no dejó rastro. Si lo dejó, el backend dice por qué no. */
export function borrarNoche(slug: string): Promise<void> {
  return pedir<void>(`/api/eventos/${encodeURIComponent(slug)}`, { method: "DELETE" });
}

/**
 * Cómo se reproduce un video según de dónde venga.
 *
 * YouTube no se puede meter en un `<video>`: va en un iframe de
 * youtube-nocookie, que no deja cookies de seguimiento hasta que se pulsa play.
 */
export function comoVideo(url: string): { tipo: "youtube"; id: string } | { tipo: "archivo"; src: string } {
  const youtube = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  if (youtube) return { tipo: "youtube", id: youtube[1] };
  return { tipo: "archivo", src: imagen(url) };
}

// ─────────────────────── Artistas ───────────────────────

export type ArtistaEnCatalogo = {
  id: string;
  nombre: string;
  genero: string | null;
  imagen: string | null;
  instagram: string | null;
  bio: string | null;
  /** En cuántos carteles ha estado. Con más de cero no se puede borrar. */
  noches: number;
  ultimaNoche: string | null;
};

export type FormularioDeArtista = { nombre: string; genero: string; instagram: string; bio: string };

export function verArtistas(): Promise<ArtistaEnCatalogo[]> {
  return pedir<ArtistaEnCatalogo[]>("/api/artistas");
}

export function crearArtista(datos: FormularioDeArtista): Promise<ArtistaEnCatalogo> {
  return pedir<ArtistaEnCatalogo>("/api/artistas", { method: "POST", body: JSON.stringify(datos) });
}

export function editarArtista(id: string, datos: FormularioDeArtista): Promise<ArtistaEnCatalogo> {
  return pedir<ArtistaEnCatalogo>(`/api/artistas/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(datos),
  });
}

export function borrarArtista(id: string): Promise<void> {
  return pedir<void>(`/api/artistas/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function subirFotoDeArtista(id: string, archivo: File): Promise<{ imagen: string; pesoKb: number }> {
  const formulario = new FormData();
  formulario.append("archivo", archivo);
  return pedir(`/api/artistas/${encodeURIComponent(id)}/foto`, { method: "POST", body: formulario });
}

export function quitarFotoDeArtista(id: string): Promise<void> {
  return pedir<void>(`/api/artistas/${encodeURIComponent(id)}/foto`, { method: "DELETE" });
}

// ─────────────────────── Pedidos a proveedor ───────────────────────

export type EstadoDeOrden = "BORRADOR" | "ENVIADO" | "RECIBIDO" | "CANCELADO";

export const NOMBRE_DE_ESTADO_DE_ORDEN: Record<EstadoDeOrden, string> = {
  BORRADOR: "Borrador",
  ENVIADO: "Enviado",
  RECIBIDO: "Recibido",
  CANCELADO: "Cancelado",
};

export type OrdenEnLista = {
  id: string;
  codigo: string;
  proveedor: string;
  estado: EstadoDeOrden;
  totalCentimos: number;
  lineas: number;
  creadoEn: string;
  esperadoEn: string | null;
  recibidoEn: string | null;
};

export type LineaDeOrden = {
  productoId: string;
  sku: string;
  producto: string;
  cantidad: number;
  costeUnitarioCentimos: number;
  importeCentimos: number;
};

export type FichaDeOrden = Omit<OrdenEnLista, "lineas"> & { proveedorId: string; lineas: LineaDeOrden[] };

export type FormularioDeOrden = {
  proveedorId: string;
  esperadoEn: string | null;
  lineas: { productoId: string; cantidad: number; costeUnitarioCentimos: number }[];
};

export function verOrdenes(): Promise<OrdenEnLista[]> {
  return pedir<OrdenEnLista[]>("/api/inventario/ordenes");
}

export function verOrden(id: string): Promise<FichaDeOrden> {
  return pedir<FichaDeOrden>(`/api/inventario/ordenes/${encodeURIComponent(id)}`);
}

export function crearOrden(datos: FormularioDeOrden): Promise<FichaDeOrden> {
  return pedir<FichaDeOrden>("/api/inventario/ordenes", { method: "POST", body: JSON.stringify(datos) });
}

export function editarOrden(id: string, datos: FormularioDeOrden): Promise<FichaDeOrden> {
  return pedir<FichaDeOrden>(`/api/inventario/ordenes/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(datos),
  });
}

export function enviarOrden(id: string): Promise<FichaDeOrden> {
  return pedir<FichaDeOrden>(`/api/inventario/ordenes/${encodeURIComponent(id)}/enviar`, { method: "POST" });
}

/** La mercancía llegó: entra en el almacén, línea a línea, como compras. */
export function recibirOrden(id: string, salaId: string): Promise<FichaDeOrden> {
  return pedir<FichaDeOrden>(`/api/inventario/ordenes/${encodeURIComponent(id)}/recibir`, {
    method: "POST",
    body: JSON.stringify({ salaId }),
  });
}

export function cancelarOrden(id: string): Promise<FichaDeOrden> {
  return pedir<FichaDeOrden>(`/api/inventario/ordenes/${encodeURIComponent(id)}/cancelar`, { method: "POST" });
}

export type FormularioDeProveedor = { nombre: string; personaDeContacto: string; email: string; telefono: string };

export function crearProveedor(datos: FormularioDeProveedor): Promise<Proveedor> {
  return pedir<Proveedor>("/api/inventario/proveedores", { method: "POST", body: JSON.stringify(datos) });
}

export function editarProveedor(id: string, datos: FormularioDeProveedor): Promise<Proveedor> {
  return pedir<Proveedor>(`/api/inventario/proveedores/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(datos),
  });
}

// ─────────────────────── Reservas de box ───────────────────────

export type ReservaEnLista = {
  id: string;
  noche: string;
  nocheSlug: string;
  empiezaA: string;
  mesa: string;
  zona: string | null;
  plazas: number;
  consumoMinimoCentimos: number;
  cliente: string;
  clienteId: string;
  telefono: string | null;
  email: string;
  personas: number;
  depositoCentimos: number;
  estado: EstadoDeReserva;
  notas: string | null;
  creadaEn: string;
};

export type OpcionesDeReserva = {
  noches: { slug: string; titulo: string; empiezaA: string }[];
  boxes: { id: string; nombre: string; zona: string | null; plazas: number; consumoMinimoCentimos: number }[];
};

export type NuevaReserva = {
  slug: string;
  mesaId: string;
  personas: number;
  notas: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  canal: "TELEFONO" | "WHATSAPP" | "INSTAGRAM";
};

/**
 * Los pasos válidos desde cada estado. Es la misma tabla que aplica el backend;
 * aquí solo sirve para no ofrecer botones que van a fallar.
 */
export const PASOS_DE_RESERVA: Record<EstadoDeReserva, EstadoDeReserva[]> = {
  SOLICITADA: ["CONFIRMADA", "CANCELADO"],
  CONFIRMADA: ["SENTADA", "NO_VINO", "CANCELADO"],
  SENTADA: ["NO_VINO"],
  NO_VINO: ["SENTADA"],
  CANCELADO: ["SOLICITADA"],
};

export function verReservas(pasadas = false): Promise<ReservaEnLista[]> {
  return pedir<ReservaEnLista[]>(`/api/reservas?pasadas=${pasadas}`);
}

export function verOpcionesDeReserva(): Promise<OpcionesDeReserva> {
  return pedir<OpcionesDeReserva>("/api/reservas/opciones");
}

export function apuntarReserva(datos: NuevaReserva): Promise<ReservaEnLista> {
  return pedir<ReservaEnLista>("/api/reservas", { method: "POST", body: JSON.stringify(datos) });
}

export function cambiarReserva(
  id: string,
  datos: { estado: EstadoDeReserva; depositoCentimos: number; notas: string },
): Promise<ReservaEnLista> {
  return pedir<ReservaEnLista>(`/api/reservas/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(datos),
  });
}

// ─────────────────────── Gastos ───────────────────────

export type GastoEnLista = {
  id: string;
  fecha: string;
  categoriaId: string;
  categoria: string;
  importeCentimos: number;
  descripcion: string | null;
  noche: string | null;
  nocheSlug: string | null;
  apuntadoPor: string | null;
};

export type GastosDelMes = {
  mes: string;
  totalCentimos: number;
  porCategoria: { categoria: string; totalCentimos: number; gastos: number }[];
  gastos: GastoEnLista[];
};

export type OpcionesDeGasto = {
  categorias: { id: string; nombre: string; activa: boolean }[];
  noches: { slug: string; titulo: string; empiezaA: string }[];
};

export type FormularioDeGasto = {
  categoriaId: string;
  eventoSlug: string | null;
  importeCentimos: number;
  descripcion: string;
  fecha: string | null;
};

export function verGastos(mes?: string): Promise<GastosDelMes> {
  return pedir<GastosDelMes>(`/api/gastos${mes ? `?mes=${encodeURIComponent(mes)}` : ""}`);
}

export function verOpcionesDeGasto(): Promise<OpcionesDeGasto> {
  return pedir<OpcionesDeGasto>("/api/gastos/opciones");
}

export function apuntarGasto(datos: FormularioDeGasto): Promise<GastoEnLista> {
  return pedir<GastoEnLista>("/api/gastos", { method: "POST", body: JSON.stringify(datos) });
}

export function corregirGasto(id: string, datos: FormularioDeGasto): Promise<GastoEnLista> {
  return pedir<GastoEnLista>(`/api/gastos/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(datos) });
}

export function borrarGasto(id: string): Promise<void> {
  return pedir<void>(`/api/gastos/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function crearCategoriaDeGasto(nombre: string): Promise<{ id: string; nombre: string; activa: boolean }> {
  return pedir("/api/gastos/categorias", { method: "POST", body: JSON.stringify({ nombre }) });
}

// ─────────────────────── Listas de invitados ───────────────────────

export type InvitadoEnFicha = {
  id: string;
  nombreCompleto: string;
  personas: number;
  entro: boolean;
  entroEn: string | null;
};

export type FichaDeLista = {
  id: string;
  nombre: string;
  noche: string;
  nocheSlug: string;
  empiezaA: string;
  promotorId: string;
  promotor: string;
  maxInvitados: number;
  apuntados: number;
  entraron: number;
  invitados: InvitadoEnFicha[];
};

export type OpcionesDeLista = {
  noches: { slug: string; titulo: string; empiezaA: string }[];
  promotores: { id: string; nombre: string; codigo: string }[];
};

export function verOpcionesDeLista(): Promise<OpcionesDeLista> {
  return pedir<OpcionesDeLista>("/api/promotores/opciones");
}

export function verLista(id: string): Promise<FichaDeLista> {
  return pedir<FichaDeLista>(`/api/promotores/listas/${encodeURIComponent(id)}`);
}

export function abrirLista(datos: {
  slug: string;
  promotorId: string;
  nombre: string;
  maxInvitados: number;
}): Promise<FichaDeLista> {
  return pedir<FichaDeLista>("/api/promotores/listas", { method: "POST", body: JSON.stringify(datos) });
}

export function cambiarLista(id: string, datos: { nombre: string; maxInvitados: number }): Promise<FichaDeLista> {
  return pedir<FichaDeLista>(`/api/promotores/listas/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(datos),
  });
}

export function cerrarLista(id: string): Promise<void> {
  return pedir<void>(`/api/promotores/listas/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function apuntarInvitado(listaId: string, nombreCompleto: string, personas: number): Promise<InvitadoEnFicha> {
  return pedir<InvitadoEnFicha>(`/api/promotores/listas/${encodeURIComponent(listaId)}/invitados`, {
    method: "POST",
    body: JSON.stringify({ nombreCompleto, personas }),
  });
}

export function quitarInvitado(id: string): Promise<void> {
  return pedir<void>(`/api/promotores/invitados/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function marcarEntradaDeInvitado(id: string, entro: boolean): Promise<InvitadoEnFicha> {
  return pedir<InvitadoEnFicha>(`/api/promotores/invitados/${encodeURIComponent(id)}/entrada`, {
    method: "PUT",
    body: JSON.stringify({ entro }),
  });
}

// ─────────────────────── Personal ───────────────────────

export type PersonaDelEquipo = {
  id: string;
  nombre: string;
  email: string | null;
  rol: Rol;
  activo: boolean;
  /** Si puede iniciar sesión: tiene correo y contraseña y está activa. */
  conAcceso: boolean;
  puestoId: string | null;
  puesto: string | null;
  fechaDeAlta: string | null;
  sueldoPorHoraCentimos: number;
  codigoDePromotor: string | null;
  comisionPorcentaje: number | null;
  bonoPorInvitadoCentimos: number;
};

export type FormularioDePersona = {
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
  puestoId: string | null;
  sueldoPorHoraCentimos: number;
  codigoDePromotor: string;
  comisionPorcentaje: number | null;
  /** Pago por cada invitado de sus listas que entra. */
  bonoPorInvitadoCentimos: number;
  /** Solo al dar de alta. */
  clave?: string;
};

export const NOMBRE_DE_ROL: Record<Rol, string> = {
  DIRECCION: "Dirección",
  GERENCIA: "Gerencia",
  PROMOTOR: "Promotor",
  PUERTA: "Puerta",
  BARRA: "Barra",
  PERSONAL: "Personal",
};

export function verEquipo(): Promise<PersonaDelEquipo[]> {
  return pedir<PersonaDelEquipo[]>("/api/personal");
}

export function verOpcionesDePersonal(): Promise<{ roles: Rol[]; puestos: { id: string; nombre: string }[] }> {
  return pedir("/api/personal/opciones");
}

export function darDeAlta(datos: FormularioDePersona): Promise<PersonaDelEquipo> {
  return pedir<PersonaDelEquipo>("/api/personal", { method: "POST", body: JSON.stringify(datos) });
}

export function editarPersona(id: string, datos: FormularioDePersona): Promise<PersonaDelEquipo> {
  return pedir<PersonaDelEquipo>(`/api/personal/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(datos),
  });
}

export function cambiarClave(id: string, clave: string): Promise<void> {
  return pedir<void>(`/api/personal/${encodeURIComponent(id)}/clave`, {
    method: "PUT",
    body: JSON.stringify({ clave }),
  });
}

// ─────────────────────── El expediente de la noche ───────────────────────
//
// Espejo de ExpedienteDeNoche en el backend: todo lo que pasó en una noche en
// una sola respuesta. Es lo mismo que recibe la IA en texto, así que lo que dice
// el informe y lo que dice esta pantalla no pueden no cuadrar.

export type TonoDeAviso = "bien" | "mal" | "neutro";

export type AvisoDeNoche = { tono: TonoDeAviso; texto: string };

export type TramoHorario = { hora: string; personas: number };

export type PorMetodoDePago = { metodo: string; operaciones: number; centimos: number };

export type ExpedienteDeNoche = {
  generadoEn: string;
  noche: {
    id: string;
    slug: string;
    titulo: string;
    estado: EstadoDeEvento;
    diaDeLaSemana: string;
    puertasA: string;
    empiezaA: string;
    terminaA: string;
    sala: string;
    aforo: number;
    cartel: string[];
    pasada: boolean;
  };
  avisos: AvisoDeNoche[];
  asistencia: {
    entradasEmitidas: number;
    entraronConEntrada: number;
    noVinieron: number;
    noVinieronPct: number | null;
    invitadosApuntados: number;
    invitadosEntraron: number;
    dentro: number;
    ocupacionPct: number | null;
    pico: TramoHorario | null;
    primeraEntrada: string | null;
    ultimaEntrada: string | null;
    porHora: TramoHorario[];
    porPuerta: { puerta: string; personas: number }[];
  };
  taquilla: {
    pedidosPagados: number;
    entradasVendidas: number;
    brutoCentimos: number;
    gestionCentimos: number;
    entradasCentimos: number;
    ticketMedioCentimos: number;
    pendientes: number;
    cancelados: number;
    devueltos: number;
    devueltoCentimos: number;
    porTipo: { tipo: string; precioCentimos: number; cupo: number; vendidas: number; ingresosCentimos: number }[];
    porMetodo: PorMetodoDePago[];
    porCanal: { canal: string; pedidos: number; entradas: number; centimos: number }[];
  };
  barra: {
    totalCentimos: number;
    tickets: number;
    unidades: number;
    ticketMedioCentimos: number;
    gastoPorPersonaCentimos: number | null;
    costeProductoCentimos: number;
    margenCentimos: number;
    porBarra: { barra: string; cajas: number; tickets: number; unidades: number; centimos: number }[];
    cajas: {
      id: string;
      barra: string;
      responsable: string;
      abiertaEn: string;
      cerradaEn: string | null;
      tickets: number;
      vendidoCentimos: number;
      efectivoCentimos: number;
      descuadreCentimos: number | null;
    }[];
    porMetodo: PorMetodoDePago[];
    porHora: { hora: string; tickets: number; centimos: number }[];
    productos: {
      producto: string;
      categoria: string;
      unidades: number;
      ingresosCentimos: number;
      costeCentimos: number;
      margenCentimos: number;
    }[];
  };
  promotores: {
    id: string;
    nombre: string;
    codigo: string;
    pedidos: number;
    entradas: number;
    ventasCentimos: number;
    comisionPct: number;
    comisionCentimos: number;
    listas: number;
    apuntados: number;
    entraron: number;
    bonoCentimos: number;
    aPagarCentimos: number;
    liquidado: boolean;
  }[];
  reservas: {
    total: number;
    confirmadas: number;
    sentadas: number;
    noVinieron: number;
    canceladas: number;
    personas: number;
    depositosCentimos: number;
    lista: {
      box: string;
      cliente: string;
      personas: number;
      estado: EstadoDeReserva;
      depositoCentimos: number;
      consumoMinimoCentimos: number;
    }[];
  };
  costes: {
    gastosCentimos: number;
    gastosPorCategoria: { categoria: string; centimos: number }[];
    personalCentimos: number;
    personalPorPuesto: { puesto: string; personas: number; horas: number; centimos: number }[];
    comisionesCentimos: number;
    costeProductoCentimos: number;
    totalCentimos: number;
  };
  resultado: { ingresosCentimos: number; costesCentimos: number; resultadoCentimos: number; margenPct: number | null };
  publico: {
    compradores: number;
    nuevos: number;
    recurrentes: number;
    edadMedia: number | null;
    aceptanPublicidad: number;
    distritos: { distrito: string; clientes: number }[];
  };
  incidencias: IncidenciaDeNoche[];
  notasDeCierre: string | null;
  comparativa: {
    criterio: string;
    noches: number;
    mediaDentro: number;
    mediaTaquillaCentimos: number;
    mediaBarraCentimos: number;
    dentroVsMediaPct: number | null;
    taquillaVsMediaPct: number | null;
    barraVsMediaPct: number | null;
    referencias: {
      slug: string;
      titulo: string;
      empiezaA: string;
      dentro: number;
      taquillaCentimos: number;
      barraCentimos: number;
    }[];
  };
};

export type TipoDeIncidencia = "SEGURIDAD" | "SALUD" | "OPERACION" | "CLIENTE" | "PERSONAL" | "OTRA";

export const NOMBRE_DE_INCIDENCIA: Record<TipoDeIncidencia, string> = {
  SEGURIDAD: "Seguridad",
  SALUD: "Salud",
  OPERACION: "Operación",
  CLIENTE: "Cliente",
  PERSONAL: "Personal",
  OTRA: "Otra",
};

export type IncidenciaDeNoche = {
  id: string;
  tipo: TipoDeIncidencia;
  descripcion: string;
  ocurrioEn: string;
  registradaPor: string | null;
};

export function verExpediente(slug: string): Promise<ExpedienteDeNoche> {
  return pedir<ExpedienteDeNoche>(`/api/eventos/${encodeURIComponent(slug)}/expediente`);
}

/** El mismo expediente en el texto exacto que recibe la IA. */
export async function verExpedienteComoTexto(slug: string): Promise<string> {
  let r: Response;
  try {
    r = await fetch(`${BASE}/api/eventos/${encodeURIComponent(slug)}/expediente/texto`, { credentials: "include" });
  } catch {
    throw new ErrorDeApi(0, `No se pudo conectar con el backend en ${BASE}.`);
  }
  if (!r.ok) throw new ErrorDeApi(r.status, `El backend respondió ${r.status}.`);
  return r.text();
}

export function apuntarIncidencia(
  slug: string,
  datos: { tipo: TipoDeIncidencia; descripcion: string; ocurrioEn: string | null },
): Promise<IncidenciaDeNoche> {
  return pedir<IncidenciaDeNoche>(`/api/eventos/${encodeURIComponent(slug)}/incidencias`, {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

export function quitarIncidencia(slug: string, id: string): Promise<void> {
  return pedir<void>(`/api/eventos/${encodeURIComponent(slug)}/incidencias/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function guardarNotasDeCierre(slug: string, notas: string): Promise<void> {
  return pedir<void>(`/api/eventos/${encodeURIComponent(slug)}/notas-cierre`, {
    method: "PUT",
    body: JSON.stringify({ notas }),
  });
}

export type NocheEnHistorico = {
  slug: string;
  titulo: string;
  empiezaA: string;
  diaDeLaSemana: string;
  aforo: number;
  dentro: number;
  ocupacionPct: number | null;
  entradasVendidas: number;
  taquillaCentimos: number;
  barraCentimos: number;
  costesCentimos: number;
  resultadoCentimos: number;
  incidencias: number;
};

export function verNochesCelebradas(limite = 60): Promise<NocheEnHistorico[]> {
  return pedir<NocheEnHistorico[]>(`/api/panel/noches?limite=${limite}`);
}

// ─────────────────────── Las barras del local ───────────────────────

export type BarraDelLocal = { id: string; nombre: string; activa: boolean };

export function verBarrasDelLocal(): Promise<BarraDelLocal[]> {
  return pedir<BarraDelLocal[]>("/api/caja/barras");
}

export function crearBarra(nombre: string): Promise<BarraDelLocal> {
  return pedir<BarraDelLocal>("/api/caja/barras", { method: "POST", body: JSON.stringify({ nombre }) });
}

export function cambiarBarra(id: string, activa: boolean): Promise<BarraDelLocal> {
  return pedir<BarraDelLocal>(`/api/caja/barras/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ activa }),
  });
}

// ─────────────────────── El código de promotor del enlace ───────────────────────
//
// Quien llega a la web por el enlace de un promotor (`?promo=PIERO`) puede no
// comprar en esa misma página: mira la agenda, vuelve mañana. El código se
// guarda unos días en este navegador para que la venta le cuente igual. Si no
// se puede guardar (modo privado), se pierde y la venta queda como directa:
// nunca impide comprar.

const CLAVE_PROMO = "ssiomama.promo";
const DIAS_DE_PROMO = 7;

export function recordarPromo(codigo: string): void {
  const limpio = codigo.trim().toUpperCase();
  if (!/^[A-Z0-9]{3,20}$/.test(limpio)) return;
  try {
    localStorage.setItem(CLAVE_PROMO, JSON.stringify({ codigo: limpio, hasta: Date.now() + DIAS_DE_PROMO * 86_400_000 }));
  } catch {
    // Sin almacenamiento: la venta saldrá como directa.
  }
}

export function promoRecordada(): string | null {
  try {
    const crudo = localStorage.getItem(CLAVE_PROMO);
    if (!crudo) return null;
    const { codigo, hasta } = JSON.parse(crudo) as { codigo: string; hasta: number };
    return Date.now() < hasta ? codigo : null;
  } catch {
    return null;
  }
}
