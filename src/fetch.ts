import { contentType, readAll, readerFromStreamReader } from "./deps.ts";
import { AnyReq, TOptions } from "./types.ts";
import { _next, modRequest } from "./utils.ts";

export function staticFetch(root: string = "", opts: TOptions = {}) {
  return async (req: AnyReq, ...args: any) => {
    modRequest(req);
    const res = args[0];
    const next = args[1] || args[0] || ((err?: any) => _next(req, res, err));
    if (opts.prefix) {
      if (req.url.includes(opts.prefix)) {
        req.url = req.url.substring(opts.prefix.length);
      } else {
        return next();
      }
    }
    try {
      if (opts.dotfiles === false) {
        let idx = req.url.indexOf("/.");
        if (idx !== -1) {
          if (!opts.fallthrough) {
            return next(new Error(`File or directory ${req.url} not found`));
          }
          return next();
        }
      }
      let isDirectory =
        req.url.slice((req.url.lastIndexOf(".") - 1 >>> 0) + 2) === "";
      let pathFile = root + req.url;
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
      if (opts.cacheControl === true) {
        let _cache = `public, max-age=${opts.maxAge}`;
        if (opts.immutable) _cache += ", immutable";
        headers.set("Cache-Control", _cache);
      }
      if (opts.etag === true) {
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
          return req.__respond({ status: 304 });
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
        req.__respond({ body, headers });
      } else next();
    } catch (error) {
      next(error);
    }
  };
}
