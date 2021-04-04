import { fromFileUrl, join } from "https://deno.land/std/path/mod.ts";
import { contentType } from "https://deno.land/x/media_types/mod.ts";

interface Request {
    [key: string]: any;
}
interface Response {
    [key: string]: any;
}
type TOptions = {
    maxAge?: number;
    index?: string;
    fallthrough?: boolean;
    etag?: boolean;
    extensions?: string[];
    acceptRanges?: boolean;
    cacheControl?: boolean;
    lastModified?: boolean;
    setHeaders?: (headers: Headers, path: string, stats: Deno.FileInfo) => void;
    start?: number;
    end?: number;
    immutable?: boolean;
    dotfiles?: boolean;
    brotli?: boolean;
    gzip?: boolean;
    redirect?: boolean;
}
type NextFunction = (err?: any) => void;

function parseurl(req: Request, isOriginal = false): any {
    let str: any = req.url,
        url = req._parsedUrl;
    if (isOriginal) {
        str = req.originalUrl;
        if (typeof str !== "string") return parseurl(req);
        url = req._parsedOriginalUrl;
    }
    if (url && url._raw === str) return url;
    let pathname = str, query = null, search = null, i = 0, len = str.length;
    while (i < len) {
        if (str.charCodeAt(i) === 0x3f) {
            pathname = str.substring(0, i);
            query = str.substring(i + 1);
            search = str.substring(i);
            break;
        }
        i++;
    }
    url = {};
    url.path = url._raw = url.href = str;
    url.pathname = pathname;
    url.query = query;
    url.search = search;
    return isOriginal ? (req._parsedOriginalUrl = url) : (req._parsedUrl = url);
}

function _next(req: Request, err?: any) {
    let body = err ? (err.stack || "Something went wrong") : `File or directory ${req.url} not found`;
    let status = err ? (err.status || err.code || err.statusCode || 500) : 404;
    if (typeof status !== "number") status = 500;
    req.respond({ status, body });
}

async function existStat(filename: string) {
    try {
        let stats: Deno.FileInfo = await Deno.stat(filename);
        return stats;
    } catch (error) {
        return null;
    }
};

function headersEncoding(headers: Headers, name: string, pathFile: string, num: number) {
    headers.set("Content-Encoding", name);
    headers.set("Content-Type", contentType(pathFile.substring(0, num)) || "");
}

async function sendFile(pathFile: string, opts: TOptions, req: Request, next: NextFunction) {
    let isDirectory = pathFile.slice((pathFile.lastIndexOf(".") - 1 >>> 0) + 2) === "";
    let stats;
    if (opts.dotfiles === false) {
        let idx = req.url.indexOf('/.');
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
            if (pathFile.lastIndexOf('/') === -1) pathFile += '\\';
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
    headers.set("Content-Type", headers.get("Content-Type") || (contentType(pathFile) || "application/octet-stream"));
    if (opts.gzip || opts.brotli) {
        headers.set('Vary', 'Accept-Encoding');
        let xgz = pathFile.lastIndexOf('.gz');
        let xbr = pathFile.lastIndexOf('.br');
        if (xgz !== -1) headersEncoding(headers, "gzip", pathFile, xgz);
        if (xbr !== -1) headersEncoding(headers, "br", pathFile, xbr);
    }
    if (opts.lastModified === true && stats.mtime) {
        headers.set("Last-Modified", stats.mtime.toUTCString());
    }
    if (opts.acceptRanges === true) {
        headers.set("Accept-Ranges", "bytes");
    }
    if (req.headers.get("range")) {
        status = 206;
        let start = opts.start || 0;
        let end = opts.end || stats.size - 1;
        if (start >= stats.size || end >= stats.size) {
            headers.set("Content-Range", `bytes */${stats.size}`);
            return req.respond({ status: 416, body: "", headers });
        }
        headers.set("Content-Range", `bytes ${start}-${end}/${stats.size}`);
        headers.set("Content-Length", (end - start + 1).toString());
        // force accept-ranges
        headers.set("Accept-Ranges", headers.get("Accept-Ranges") || "bytes");
    }
    if (opts.cacheControl === true) {
        let _cache = `public, max-age=${opts.maxAge}`;
        if (opts.immutable === true) _cache += ', immutable';
        headers.set("Cache-Control", _cache);
    }
    if (opts.etag === true) {
        headers.set("ETag", `W/"${stats.size}-${stats.mtime?.getTime()}"`);
        if (req.headers.get("if-none-match") === headers.get("ETag")) return req.respond({ status: 304 });
    }
    const body = await Deno.readFile(pathFile);
    return req.respond({ status, body, headers });
}

function fromExtensions(req: Request, opts: TOptions) {
    if (opts.extensions === void 0) return null;
    let exts = opts.extensions;
    let gzips = opts.gzip && exts.map(x => `${x}.gz`).concat('gz');
    let brots = opts.brotli && exts.map(x => `${x}.br`).concat('br');
    let newExts = [''];
    let enc = req.headers.get("accept-encoding") || '';
    if (gzips && enc.includes('gzip')) newExts.unshift(...gzips);
    if (brots && /(br|brotli)/i.test(enc)) newExts.unshift(...brots);
    newExts.push(...exts);
    return newExts;
}

export default function staticFiles(
    root: string,
    opts: TOptions = {}
) {
    if (!root) throw new TypeError("root path required");
    if (typeof root !== "string") throw new TypeError("root path must be a string");
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
    if (opts.setHeaders && typeof opts.setHeaders !== 'function') {
        throw new TypeError('option setHeaders must be function');
    }
    const rootPath = root.startsWith("file:") ? fromFileUrl(root) : root;
    return async function (
        req: Request,
        res: Response = {},
        next?: NextFunction
    ) {
        if (next === void 0) next = (err?: any) => _next(req, err);
        if (req.method !== "GET" && req.method !== "HEAD") {
            if (opts.fallthrough) return next();
            const headers = new Headers();
            headers.set("Allow", "GET, HEAD");
            headers.set("Content-Length", "0");
            return req.respond({ status: 405, body: "", headers });
        }
        const originalUrl = parseurl(req, true);
        let path = parseurl(req).pathname;
        if (path === "/" && originalUrl.pathname.substr(-1) !== "/") path = "";
        let pathFile: string = decodeURIComponent(join(rootPath, path));
        try {
            await sendFile(pathFile, opts, req, next);
        } catch (err) {
            let exts = fromExtensions(req, opts);
            if (exts) {
                let stats: any, i = 0, len = exts.length;
                for (; i < len; i++) {
                    const ext = exts[i];
                    const newPathFile = pathFile + '.' + ext;
                    stats = await existStat(newPathFile);
                    if (stats !== null) {
                        stats.pathFile = newPathFile;
                        break;
                    };
                }
                if (stats && stats.pathFile) {
                    try {
                        await sendFile(stats.pathFile, opts, req, next);
                        return;
                    } catch (_err) {
                        if (!opts.fallthrough) return next(_err);
                        return next();
                    }
                }
            }
            if (!opts.fallthrough) return next(err);
            return next();
        }
    }
}