/**
 * Datos de la discoteca. Cambia esto y cambia toda la web: no hay nombres
 * repartidos por el código.
 *
 * Lo que va entre «comillas angulares» es un dato real de Ssiomama que todavía
 * no tenemos. Hay que pedírselo al dueño y sustituirlo aquí — en este archivo y
 * en ningún otro sitio. Mientras siga así, se ve el marcador en pantalla, que
 * es justo lo que queremos: que no se nos olvide.
 *
 * Regla para lo que NO está aquí: el aforo, las zonas y las salas salen de la
 * base de datos (`Venue`, `Zone`), no de este archivo. Un dato que el panel deja
 * editar no puede estar además escrito en el código, porque entonces hay dos
 * verdades y una de las dos miente.
 */
export const CLUB = {
  name: "Ssiomama",
  tagline: "Cuatro noches por semana en Av. Dolores, hasta las dos de la mañana.",
  city: "Arequipa",
  address: "Av. Dolores 119, José Luis Bustamante y Rivero, Arequipa",
  phone: "+51 986 678 040",
  email: "«correo de contacto»",
  /**
   * Usuario de Instagram, sin la arroba. Vacío = en el pie se enseña la palabra
   * «Instagram» sin enlazar, que es mejor que un enlace a un perfil inventado.
   */
  instagram: "ssiomama",
  hours: "Jueves, viernes, sábado y domingo, de 9:00 p. m. a 2:00 a. m.",
  /** Perú: el ingreso a discotecas es para mayores de edad. */
  minAge: 18,

  /**
   * La promo de cumpleaños. Es de las pocas cosas que el local ya anuncia por su
   * cuenta, así que la web no se la puede inventar ni suavizar.
   *
   * `activa: false` la quita de la página entera. Una promo caducada visible es
   * peor que ninguna: la gente llega pidiéndola.
   */
  cumple: {
    activa: true,
    titulo: "¿Cumples años este mes?",
    texto: "Pide tu box y tu sellada gratis.",
    letraPequena: "Escríbenos antes de venir con tu nombre y la fecha para coordinarlo.",
  },

  /**
   * Cómo llegar. Son tres datos distintos y no uno: quien viene en taxi necesita
   * la dirección, quien viene andando necesita la referencia, y quien viene en
   * coche necesita saber dónde deja el coche antes de salir de casa.
   */
  reference: "«referencia: a qué está cerca, para el taxi»",
  parking: "«dónde aparcar y si se paga aparte»",
  transport: "«transporte público más cercano»",
  /** Enlace del mapa. Vacío = no se pinta el botón, mejor que un mapa a ninguna parte. */
  mapsUrl: "https://maps.app.goo.gl/pWHcwj4WLsPM2Js76",
  /** Para el mapa incrustado de «Cómo llegar». Sin coordenadas no se pinta. */
  coords: { lat: -16.4188215, lng: -71.5260979 },

  /**
   * WhatsApp en formato internacional y SIN signos: así lo quiere wa.me.
   * Vacío = los botones de WhatsApp no se pintan.
   *
   * Es el mismo número que `phone`, escrito de la otra manera. Se guardan los
   * dos a propósito: uno es para leer y el otro para que funcione el enlace, y
   * derivar uno del otro con un `replace` se rompe el día que alguien escriba
   * el teléfono con un prefijo distinto.
   */
  whatsapp: "51986678040",

  /**
   * Lo que se sirve en barra, en una frase. Vacío = no se pinta la línea.
   *
   * Frase y no lista de marcas: el local sirve de todo, y una lista de seis
   * etiquetas sugiere que solo hay esas seis.
   */
  barra: "Todas las marcas",

  /**
   * El acordeón de «antes de venir». Es el sitio donde acaban las preguntas que
   * hoy se responden veinte veces por WhatsApp cada viernes.
   */
  vestimenta:
    "Como en cualquier discoteca: no se entra en short, ni con sandalias ni con ropa deportiva. Si tienes dudas con lo que llevas, escríbenos antes de venir.",
  reembolso: "«política de devolución: qué pasa si no puedes ir»",

  /**
   * Imagen fija de la portada, para cuando la próxima noche no tenga la suya.
   *
   * Hoy es una foto DE ARCHIVO. Ver `public/fotos/CREDITOS.md`: hay que
   * cambiarla por una del local en cuanto la haya.
   */
  portada: "/fotos/portada.webp",
} as const;

/**
 * ¿Este dato sigue siendo un marcador?
 *
 * Los pendientes van entre «comillas angulares», así que reconocerlos es mirar
 * el primer carácter. Sirve para que la página los ENSEÑE como texto —que es lo
 * que obliga a acordarse de pedirlos— sin llegar a construir con ellos un
 * enlace roto: un `wa.me/«teléfono»` da error 404 y encima parece que la web
 * está mal hecha, no que falte un dato.
 */
export function pendiente(valor: string): boolean {
  return valor.startsWith("«");
}
