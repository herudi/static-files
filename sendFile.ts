import { AnyReq, NextFunction, TOptions } from "./src/types.ts";
import { modRequest, withSendFile } from "./src/utils.ts";

export default async function sendFile(
  pathFile: string,
  opts: TOptions = {},
  req: AnyReq,
  next: NextFunction,
) {
  modRequest(req);
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
  return await withSendFile(pathFile, opts, req, void 0, next);
}
