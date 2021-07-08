import { contentType, readAll, readerFromStreamReader } from "./deps.ts";
import { AnyReq, TOptions } from "./types.ts";

function _next(req: AnyReq, res: any, err?: any) {
  let body = err
    ? (err.stack || "Something went wrong")
    : `File or directory ${req.url} not found`;
  let status = err ? (err.status || err.code || err.statusCode || 500) : 404;
  if (typeof status !== "number") status = 500;
  req.respond({ status, body });
}

export function staticFetch(root: string = "", opts: TOptions = {}) {
  return async (req: AnyReq, ...args: any) => {
    let res = args[0];
    let next = args[1] || args[0] || ((err?: any) => _next(req, res, err));
    if (req.request) {
      if (req.request.serverRequest) {
        req = req.request?.serverRequest;
      } else if (req.respondWith) {
        req.method = req.request.method;
        req.headers = req.request.headers;
        req.respond = ({ body, headers, status }: any) =>
          req.respondWith(new Response(body, { status, headers }));
      }
    }
    if (req.respondWith === void 0) {
      throw new TypeError("req.respondWith is not a function");
    }
    const url = new URL(req.request.url).pathname;
    try {
      let isDirectory = url.slice((url.lastIndexOf(".") - 1 >>> 0) + 2) === "";
      let pathFile = root + url;
      if (isDirectory && opts.redirect) {
        if (pathFile[pathFile.length - 1] !== "/") pathFile += "/";
        pathFile += opts.index;
      }
      const res = await fetch(pathFile);
      if (!res.ok) return next();
      const headers = new Headers();
      if (opts.setHeaders !== void 0) {
        opts.setHeaders(headers, pathFile);
      }
      if (opts.cacheControl) {
        let _cache = `public, max-age=${opts.maxAge}`;
        if (opts.immutable) _cache += ", immutable";
        headers.set("Cache-Control", _cache);
      }
      if (opts.etag) {
        if (res.headers.get("ETag")) {
          headers.set("ETag", res.headers.get("ETag") || "");
        } else if (res.headers.get("last-modified")) {
          const lm = btoa(res.headers.get("last-modified") || "");
          if (opts.lastModified) {
            headers.set(
              "last-modified",
              res.headers.get("last-modified") || "",
            );
          }
          headers.set("ETag", `W/"${lm}"`);
        }
        if (req.headers.get("if-none-match") === headers.get("ETag")) {
          return req.respond({ status: 304 });
        }
      }
      if (req.headers.get("range")) {
        headers.set("Accept-Ranges", "bytes");
      }
      const ext = pathFile.substring(pathFile.lastIndexOf("."));
      headers.set(
        "Content-Type",
        headers.get("Content-Type") ||
          (contentType(ext) || "application/octet-stream"),
      );
      if (res.body) {
        const reader = readerFromStreamReader(res.body.getReader());
        const body = await readAll(reader);
        req.respond({ body, headers });
      } else next();
    } catch (error) {
      next(error);
    }
  };
}
