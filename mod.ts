import { fromFileUrl, join } from "./src/deps.ts";
import { AnyReq, TOptions } from "./src/types.ts";
import {
  _next,
  existStat,
  fromExtensions,
  modRequest,
  withSendFile as sendFile,
} from "./src/utils.ts";

export default function staticFiles(root: string = "", opts: TOptions = {}) {
  if (typeof root !== "string") {
    throw new TypeError("root path must be a string");
  }
  if (root[0] === "/") {
    root = root.substring(1);
  }
  opts.index = opts.index || "index.html";
  opts.maxAge = opts.maxAge || 0;
  // true default
  opts.fallthrough = opts.fallthrough !== false;
  opts.etag = opts.etag !== false;
  opts.acceptRanges = opts.acceptRanges !== false;
  opts.lastModified = opts.lastModified !== false;
  opts.redirect = opts.redirect !== false;
  // false default
  opts.dotfiles = !!opts.dotfiles;
  opts.immutable = !!opts.immutable;
  opts.brotli = !!opts.brotli;
  opts.gzip = !!opts.gzip;
  opts.cacheControl = !!opts.cacheControl;
  if (opts.setHeaders && typeof opts.setHeaders !== "function") {
    throw new TypeError("option setHeaders must be function");
  }
  const rootPath = root.startsWith("file:") ? fromFileUrl(root) : root;
  return async function (req: AnyReq, ...args: any) {
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
    if (req.method && req.method !== "GET" && req.method !== "HEAD") {
      if (opts.fallthrough) return next();
      const headers = new Headers();
      headers.set("Allow", "GET, HEAD");
      headers.set("Content-Length", "0");
      return req.__respond({ status: 405, body: "", headers });
    }
    let path = req.path || (req.url || "").split("?")[0];
    if (path === "/") path = "";
    let pathFile: string = decodeURIComponent(join(rootPath, path));
    try {
      const _body = await sendFile(pathFile, opts, req, res, next);
      return _body;
    } catch (err) {
      let exts = fromExtensions(req, opts);
      if (exts) {
        let stats: any, i = 0, len = exts.length;
        for (; i < len; i++) {
          const ext = exts[i];
          const newPathFile = pathFile + "." + ext;
          stats = await existStat(newPathFile);
          if (stats !== null) {
            stats.pathFile = newPathFile;
            break;
          }
        }
        if (stats && stats.pathFile) {
          try {
            const _body = await sendFile(stats.pathFile, opts, req, res, next);
            return _body;
          } catch (_err) {
            if (!opts.fallthrough) return next(_err);
            return next();
          }
        }
      }
      if (!opts.fallthrough) return next(err);
      return next();
    }
  };
}
