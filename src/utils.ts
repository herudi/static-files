import { contentType } from "./deps.ts";
import { AnyReq, NextFunction, TOptions } from "./types.ts";

const date = new Date();

export function _next(req: AnyReq, _: any, err?: any) {
  let body = err
    ? (err.message || "Something went wrong")
    : `File or directory ${req.url} not found`;
  let status = err ? (err.status || err.code || err.statusCode || 500) : 404;
  if (typeof status !== "number") status = 500;
  return req.__respond({ status, body });
}

export async function existStat(filename: string) {
  try {
    let stats: Deno.FileInfo = await Deno.stat(filename);
    return stats;
  } catch (error) {
    return null;
  }
}

export function headersEncoding(
  headers: Headers,
  name: string,
  pathFile: string,
  num: number,
) {
  headers.set("Content-Encoding", name);
  headers.set("Content-Type", contentType(pathFile.substring(0, num)) || "");
}

export async function withSendFile(
  pathFile: string,
  opts: TOptions = {},
  req: AnyReq,
  _: any,
  next: NextFunction,
) {
  let isDirectory =
    pathFile.slice((pathFile.lastIndexOf(".") - 1 >>> 0) + 2) === "";
  let stats;
  if (opts.dotfiles === false) {
    let idx = req.url.indexOf("/.");
    if (idx !== -1) {
      if (!opts.fallthrough) {
        return next(new Error(`File or directory ${req.url} not found`));
      }
      return next();
    }
  } else {
    let exist = await existStat(pathFile);
    if (exist) {
      isDirectory = exist.isDirectory;
      if (exist.isFile) stats = exist;
    } else {
      isDirectory = false;
    }
  }
  if (isDirectory) {
    if (opts.redirect === true) {
      if (pathFile.lastIndexOf("/") === -1) pathFile += "/";
      pathFile += opts.index;
    }
  }
  if (stats === void 0) {
    stats = await Deno.stat(pathFile);
  }
  let status = 200;
  const headers = new Headers();
  if (opts.setHeaders !== void 0) {
    opts.setHeaders(headers, pathFile, stats);
  }
  headers.set(
    "Content-Type",
    headers.get("Content-Type") ||
      (contentType(pathFile.substring(pathFile.lastIndexOf(".") + 1)) ||
        "application/octet-stream"),
  );
  if (opts.gzip || opts.brotli) {
    headers.set("Vary", "Accept-Encoding");
    let xgz = pathFile.lastIndexOf(".gz");
    let xbr = pathFile.lastIndexOf(".br");
    if (xgz !== -1) headersEncoding(headers, "gzip", pathFile, xgz);
    if (xbr !== -1) headersEncoding(headers, "br", pathFile, xbr);
  }
  if (opts.lastModified === true) {
    headers.set("Last-Modified", (stats.mtime || date).toUTCString());
  }
  if (opts.acceptRanges === true) {
    headers.set("Accept-Ranges", headers.get("Accept-Ranges") || "bytes");
  }
  if (req.headers.get("range")) {
    status = 206;
    let start = opts.start || 0;
    let end = opts.end || stats.size - 1;
    if (start >= stats.size || end >= stats.size) {
      headers.set("Content-Range", `bytes */${stats.size}`);
      return req.__respond({ status: 416, body: "", headers });
    }
    headers.set("Content-Range", `bytes ${start}-${end}/${stats.size}`);
    headers.set("Content-Length", (end - start + 1).toString());
    // force accept-ranges
    headers.set("Accept-Ranges", headers.get("Accept-Ranges") || "bytes");
  }
  if (opts.cacheControl === true) {
    let _cache = `public, max-age=${opts.maxAge}`;
    if (opts.immutable === true) _cache += ", immutable";
    headers.set("Cache-Control", _cache);
  }
  if (opts.etag === true) {
    headers.set("ETag", `W/"${stats.size}-${(stats.mtime || date).getTime()}"`);
    if (req.headers.get("if-none-match") === headers.get("ETag")) {
      return req.__respond({ status: 304 });
    }
  }
  const body = await Deno.readFile(pathFile);
  return req.__respond({ status, body, headers });
}

export function fromExtensions(req: AnyReq, opts: TOptions) {
  if (opts.extensions === void 0) return null;
  let exts = opts.extensions;
  let gzips = opts.gzip && exts.map((x) => `${x}.gz`).concat("gz");
  let brots = opts.brotli && exts.map((x) => `${x}.br`).concat("br");
  let newExts = [""];
  let enc = req.headers.get("accept-encoding") || "";
  if (gzips && enc.includes("gzip")) newExts.unshift(...gzips);
  if (brots && /(br|brotli)/i.test(enc)) newExts.unshift(...brots);
  newExts.push(...exts);
  return newExts;
}

export function modRequest(req: AnyReq) {
  req.__respond = req.respond;
  // for requestEvent
  if (req.request && req.respondWith) {
    req.method = req.request.method;
    req.headers = req.request.headers;
    req.url = req.url || new URL(req.request.url).pathname;
    req.__respond = ({ body, headers, status }: any) =>
      req.respondWith(new Response(body, { status, headers }));
  } else if (req.response) {
    if (
      req.response.headers instanceof Headers ||
      typeof req.response.status === "number"
    ) {
      req.__respond = ({ body, headers, status }: any) => {
        req.response.status = status || 200;
        req.response.headers = headers || new Headers();
        req.response.body = body;
      };
      req.method = req.method || req.request.method;
      req.headers = req.headers || req.request.headers;
      let url = req.url || req.request.url;
      if (url instanceof URL) {
        req.url = url.pathname;
      } else if (url.startsWith("http")) {
        req.url = new URL(url).pathname;
      } else {
        req.url = url;
      }
    }
  }
}
