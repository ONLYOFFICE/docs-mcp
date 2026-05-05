import { CONFIG } from "../../config.js";

export type DocFormatType = "word" | "cell" | "slide" | "pdf" | "diagram" | "";

export interface DocFormat {
  name: string;
  type: DocFormatType;
  actions: string[];
  convert: string[];
  mime: string[];
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type FetchLike = typeof fetch;

export class FormatsProvider {
  private cache: { data: Array<DocFormat>; fetchedAt: number } | null = null;

  constructor(
    private readonly documentServerBaseUrl = CONFIG.DOCUMENT_SERVER_BASE_URL,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  async getDocFormats(): Promise<DocFormat[]> {
    const now = this.now();
    if (this.cache && now - this.cache.fetchedAt < CACHE_TTL_MS) {
      return this.cache.data;
    }

    const url = new URL("/meta/formats", this.documentServerBaseUrl);
    const response = await this.fetchImpl(url.toString());
    if (!response.ok) {
      throw new Error(
        `Failed to fetch formats from Document Server: ${response.status} ${response.statusText}`
      );
    }

    const data: DocFormat[] = (await response.json()) as DocFormat[];

    this.cache = { data, fetchedAt: now };
    
    return data;
  }

  async getDocFormatByExtension(extension: string): Promise<DocFormat | undefined> {
    const formats = await this.getDocFormats();

    return formats.find((f) => extension === f.name);
  }

  async getListViewableExtensions(): Promise<string[]> {
    const formats = await this.getDocFormats();

    return formats
      .filter((f) => f.type)
      .map((f) => f.name);
  }
}

export const formatsProvider = new FormatsProvider();
