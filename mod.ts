import { extname, fromFileUrl, join } from "https://deno.land/std/path/mod.ts";
import { Sha1 } from "https://deno.land/std/hash/sha1.ts";
import { encoder } from "https://deno.land/std@0.85.0/encoding/utf8.ts";
import { contentType } from "https://deno.land/x/media_types@v2.5.0/mod.ts";

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

function simpleEtager(data: any) {
    const sha1 = new Sha1();
    sha1.update(data);
    sha1.digest();
    const hash = sha1.toString().substring(0, 27);
    const blen = typeof data === "string"
        ? encoder.encode(data).byteLength
        : data.byteLength;
    return `W/"${blen.toString(16)}-${hash}"`;
}

function _next(req: Request, err?: any) {
    let body = err ? (err.stack || "Something went wrong") : `File or directory ${req.url} not found`;
    let status = err ? (err.status || err.code || err.statusCode || 500) : 404;
    if (typeof status !== "number") status = 500;
    req.respond({ status, body });
}

function existFile(filename: string) {
    try {
        let stats = Deno.statSync(filename);
        return { status: true, stats };
    } catch (error) {
        return { status: false, stats: null };
    }
};

function sendFile(pathFile: string, stats: Deno.FileInfo, opts: TOptions, req: Request, next: NextFunction) {
    if (opts.dotfiles === false) {
        let idx = req.url.indexOf('/.');
        if (idx !== -1) {
            if (!opts.fallthrough) {
                return next(new Error("the file or directory not found on the server"));
            }
            return next();
        }
    }
    if (stats.isDirectory) {
        if (opts.redirect === true) {
            if (pathFile.lastIndexOf('/') === -1) pathFile += '\\';
            pathFile += opts.index;
        }
    }
    const body = Deno.readFileSync(pathFile);
    let status = 200;
    const headers = new Headers();
    headers.set("Content-Type", contentType(extname(pathFile)) || "application/octet-stream");
    if (opts.setHeaders !== void 0) {
        opts.setHeaders(headers, pathFile, stats);
    }
    if (opts.lastModified === true && stats.mtime) {
        headers.set("Last-Modified", stats.mtime.toUTCString());
    }
    if (opts.acceptRanges === true) {
        headers.set("Accept-Ranges", "bytes");
    }
    if (opts.gzip || opts.brotli) {
        headers.set('Vary', 'Accept-Encoding');
    }
    if (req.headers.get("range")) {
        status = 206;
        let start = opts.start || 0;
        let end = opts.end || stats.size - 1;
        if (start >= stats.size || end >= stats.size) {
            headers.set("Content-Range", `bytes */${stats.size}`);
            req.respond({ status: 416, body: null, headers });
            return;
        }
        headers.set("Content-Range", `bytes ${start}-${end}/${stats.size}`);
        headers.set("Content-Length", (end - start + 1).toString());
        // force accept-ranges
        headers.set("Accept-Ranges", headers.get("Accept-Ranges") || "bytes");
    }
    if (opts.etag === true) {
        headers.set("ETag", simpleEtager(pathFile));
        if (opts.cacheControl === true) {
            let _cache = `public, max-age=${opts.maxAge}`;
            if (opts.immutable === true) _cache += ', immutable';
            headers.set("Cache-Control", _cache);
        }
        if (fresh(req.headers, {
            "etag": headers.get("ETag"),
            "last-modified": headers.get("Last-Modified"),
        })) {
            req.respond({ status: 304, body: null });
            return;
        }
    }
    req.respond({ status, body, headers });
}

export default function staticFiles(
    root: string,
    opts: TOptions = {}
) {
    if (!root) throw new TypeError("root path required");
    if (typeof root !== "string") throw new TypeError("root path must be a string");
    opts.index = opts.index || "index.html";
    opts.fallthrough = opts.fallthrough !== false;
    opts.etag = opts.etag !== false;
    opts.maxAge = opts.maxAge || 0;
    opts.cacheControl = opts.cacheControl === void 0 ? false : opts.cacheControl;
    opts.acceptRanges = opts.acceptRanges !== false;
    opts.lastModified = opts.lastModified !== false;
    opts.redirect = opts.redirect !== false;
    opts.dotfiles = opts.dotfiles === void 0 ? false : opts.dotfiles;
    opts.immutable = opts.immutable === void 0 ? false : opts.immutable;
    opts.brotli = opts.brotli === void 0 ? false : opts.brotli;
    opts.gzip = opts.gzip === void 0 ? false : opts.gzip;

    if (opts.setHeaders && typeof opts.setHeaders !== 'function') {
        throw new TypeError('option setHeaders must be function');
    }
    const rootPath = root.startsWith("file:") ? fromFileUrl(root) : root;
    return function (
        req: Request,
        _: Response = {},
        next?: NextFunction
    ) {
        if (next === void 0) next = (err?: any) => _next(req, err);
        if (req.method !== "GET" && req.method !== "HEAD") {
            if (opts.fallthrough) return next();
            const headers = new Headers();
            headers.set("Allow", "GET, HEAD");
            headers.set("Content-Length", "0");
            return req.respond({ status: 405, body: null, headers });
        }
        const originalUrl = parseurl(req, true);
        let path = parseurl(req).pathname;
        if (path === "/" && originalUrl.pathname.substr(-1) !== "/") path = "";
        let pathFile: string = decodeURIComponent(join(rootPath, path));
        try {
            const stats: Deno.FileInfo = Deno.statSync(pathFile);
            sendFile(pathFile, stats, opts, req, next);
        } catch (err) {
            let exts = opts.extensions || [];
            let gzips = opts.gzip && exts.map(x => `${x}.gz`).concat('gz');
            let brots = opts.brotli && exts.map(x => `${x}.br`).concat('br');
            let newExts = [''];
            let enc = req.headers.get("accept-encoding") || '';
            if (gzips && enc.includes('gzip')) newExts.unshift(...gzips);
            if (brots && /(br|brotli)/i.test(enc)) newExts.unshift(...brots);
            newExts.push(...exts);
            if (newExts.length > 0) {
                let obj: any;
                for (let i = 0; i < newExts.length; i++) {
                    const el = newExts[i];
                    const newPathFile = pathFile + '.' + el;
                    obj = existFile(newPathFile);
                    if (obj.status === true) {
                        obj.pathFile = newPathFile;
                        break;
                    };
                }
                if (obj.pathFile) {
                    try {
                        const stats: Deno.FileInfo = Deno.statSync(obj.pathFile);
                        sendFile(obj.pathFile, stats, opts, req, next);
                        return;
                    } catch (error) {
                        if (!opts.fallthrough) return next(err);
                        return next();
                    }
                }
            }
            if (!opts.fallthrough) return next(err);
            next();
        }
    }
}

// this function from https://github.com/jshttp/fresh/blob/master/index.js
/*!
 * fresh
 * Copyright(c) 2012 TJ Holowaychuk
 * Copyright(c) 2016-2017 Douglas Christopher Wilson
 * MIT Licensed
 */

function isEtags(etag: string, val: string) {
    return val === etag || val === `W/${etag}` || `W/${val}` === etag;
}

function checkNoMatch(etag: string, noneMatch: string) {
    let start = 0, end = 0, i = 0, len = noneMatch.length;
    for (; i < len; i++) {
        switch (noneMatch.charCodeAt(i)) {
            case 0x20 /*   */:
                if (start === end) start = end = i + 1;
                break;
            case 0x2c /* , */:
                if (isEtags(etag, noneMatch.substring(start, end))) return false;
                start = end = i + 1;
                break;
            default:
                end = i + 1;
                break;
        }
    }
    if (isEtags(etag, noneMatch.substring(start, end))) return false;
    return true;
}

function fresh(reqHeaders: any, resHeaders: any) {
    const modifiedSince = reqHeaders.get("if-modified-since");
    const noneMatch = reqHeaders.get("if-none-match");
    if (!modifiedSince && !noneMatch) return false;
    const cacheControl = reqHeaders.get("cache-control");
    if (!cacheControl) return false;
    if (/(?:^|,)\s*?no-cache\s*?(?:,|$)/.test(cacheControl)) return false;
    if (noneMatch && noneMatch !== "*") {
        let etag = resHeaders["etag"];
        if (!etag || checkNoMatch(etag, noneMatch)) return false;
    }
    if (modifiedSince) {
        const lastModified = resHeaders["last-modified"];
        if (!lastModified || !(Date.parse(lastModified) <= Date.parse(modifiedSince))) return false;
    }
    return true;
}