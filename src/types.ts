export interface AnyReq {
  [key: string]: any;
}
export type TOptions = {
  maxAge?: number;
  index?: string;
  prefix?: string;
  fallthrough?: boolean;
  etag?: boolean;
  extensions?: string[];
  acceptRanges?: boolean;
  cacheControl?: boolean;
  lastModified?: boolean;
  setHeaders?: (headers: Headers, path: string, stats?: Deno.FileInfo) => void;
  start?: number;
  end?: number;
  immutable?: boolean;
  dotfiles?: boolean;
  brotli?: boolean;
  gzip?: boolean;
  redirect?: boolean;
  fetch?: boolean;
};
export type NextFunction = (err?: any) => void;
