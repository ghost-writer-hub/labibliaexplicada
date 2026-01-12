import { createDirectus, rest, readItems, readItem } from '@directus/sdk';

// Types based on Directus schema
export interface Autor {
  id: string;
  name: string;
  slug: string;
  bio?: string;
  image?: string;
}

export interface Categoria {
  id: string;
  name: string;
  slug: string;
}

export interface Libro {
  id: string;
  book_id: number;
  title: string;
  name: string;
  slug: string;
  testament: 'antiguo' | 'nuevo';
  details?: string;
  explanation?: string;
  faqs?: string;
  image?: string;
  image_alt?: string;
  capitulos?: Capitulo[];
}

export interface Capitulo {
  id: string;
  libro: string | Libro;
  chapter_id: number;
  chapter_global_id?: number;
  chapter_title: string;
  chapter_title_list?: string;
  name: string;
  slug: string;
  content?: string;
  explanation?: string;
  chapter_summary?: string;
  chapter_day?: number;
  image?: string;
  image_alt?: string;
  json_ld?: object;
}

export interface Articulo {
  id: string;
  title: string;
  name: string;
  slug: string;
  intro_text?: string;
  content?: string;
  thumbnail?: string;
  header_image?: string;
  author?: string | Autor;
  category?: string | Categoria;
  date_created?: string;
  date_updated?: string;
}

export interface Concepto {
  id: string;
  title: string;
  name: string;
  slug: string;
  intro_text?: string;
  content?: string;
  image?: string;
}

export interface Personaje {
  id: string;
  name: string;
  slug: string;
  description?: string;
  content?: string;
  image?: string;
}

// Schema type for Directus SDK
interface Schema {
  autores: Autor[];
  categorias: Categoria[];
  libros: Libro[];
  capitulos: Capitulo[];
  articulos: Articulo[];
  conceptos: Concepto[];
  personajes: Personaje[];
}

// Initialize Directus client
const directusUrl = import.meta.env.DIRECTUS_URL || 'http://localhost:8055';

export const directus = createDirectus<Schema>(directusUrl).with(rest());

// Helper functions
export async function getLibros() {
  return directus.request(
    readItems('libros', {
      sort: ['book_id'],
    })
  );
}

export async function getLibro(slug: string) {
  const items = await directus.request(
    readItems('libros', {
      filter: { slug: { _eq: slug } },
      limit: 1,
    })
  );
  return items[0];
}

export async function getCapitulosByLibro(libroId: string) {
  return directus.request(
    readItems('capitulos', {
      filter: { libro: { _eq: libroId } },
      sort: ['chapter_id'],
    })
  );
}

export async function getCapitulo(slug: string) {
  const items = await directus.request(
    readItems('capitulos', {
      filter: { slug: { _eq: slug } },
      fields: ['*', { libro: ['*'] }],
      limit: 1,
    })
  );
  return items[0];
}

export async function getArticulos() {
  return directus.request(
    readItems('articulos', {
      sort: ['-date_created'],
      fields: ['*', { author: ['*'], category: ['*'] }],
    })
  );
}

export async function getArticulo(slug: string) {
  const items = await directus.request(
    readItems('articulos', {
      filter: { slug: { _eq: slug } },
      fields: ['*', { author: ['*'], category: ['*'] }],
      limit: 1,
    })
  );
  return items[0];
}

export async function getCategorias() {
  return directus.request(readItems('categorias'));
}

export async function getArticulosByCategoria(categoriaId: string) {
  return directus.request(
    readItems('articulos', {
      filter: { category: { _eq: categoriaId } },
      sort: ['-date_created'],
      fields: ['*', { author: ['*'] }],
    })
  );
}

export async function getConceptos() {
  return directus.request(readItems('conceptos'));
}

export async function getConcepto(slug: string) {
  const items = await directus.request(
    readItems('conceptos', {
      filter: { slug: { _eq: slug } },
      limit: 1,
    })
  );
  return items[0];
}

export function getAssetUrl(fileId: string | null | undefined): string | null {
  if (!fileId) return null;
  return `${directusUrl}/assets/${fileId}`;
}
