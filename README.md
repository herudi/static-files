## Static Files

[![License](https://img.shields.io/:license-mit-blue.svg)](http://badges.mit-license.org)

Serve Static for Deno inspired by [serve-static](https://github.com/expressjs/serve-static) and [sirv](https://github.com/lukeed/sirv)

## Installation
```ts
// deno.land
import staticFiles from "https://deno.land/x/static_files@1.1.5/mod.ts";

// nest.land
import staticFiles from "https://x.nest.land/static_files@1.1.5/mod.ts";
```
## Usage
```ts
import { serve } from "https://deno.land/std@0.116.0/http/server.ts";
import staticFiles from "https://deno.land/x/static_files@1.1.5/mod.ts";

const serveFiles = (req: Request) => staticFiles('public')({ 
    request: req, 
    respondWith: (r: Response) => r 
})

serve((req) => serveFiles(req), { addr: ':3000' });
```
## Usage with NHttp
```ts
import { NHttp } from "https://deno.land/x/nhttp/mod.ts";
import staticFiles from "https://deno.land/x/static_files@1.1.5/mod.ts";

const app = new NHttp();

app.use(staticFiles("public"));

app.listen(3000);

```
## Usage with Oak
```ts
import { Application } from "https://deno.land/x/oak/mod.ts";
import staticFiles from "https://deno.land/x/static_files@1.1.5/mod.ts";

const app = new Application();

app.use(staticFiles("public"));

await app.listen({ port: 3000 });
```
## Usage with Opine
```ts
import { opine } from "https://deno.land/x/opine/mod.ts";
import staticFiles from "https://deno.land/x/static_files@1.1.5/mod.ts";

const app = opine();

app.use(staticFiles("public"));

app.listen(3000);
```

## staticFiles(root, opts)
root is the base folder to static file (required). opts is a more config (optional).

## Opts (options)
### acceptRanges (boolean)
Default: true;<br>
Enable or disable accepting ranged requests, defaults to true. Disabling this will not send Accept-Ranges and ignore the contents of the Range request header.
### cacheControl (boolean)
Default: false;<br>
Enable or disable setting Cache-Control response header, defaults to false. Disabling this will ignore the immutable and maxAge options.
### dotfiles (boolean)
Default: false;<br>
Enable or disable setting for file or directory with dot like (.env or .foldername). by default false and give response status 404 not found.
### etag (boolean)
Default: true;<br>
Enable or disable setting for generate ETag. if true and if-none-match header matches the etag, the response status give 304 Not Modified.
### extensions (string[] | undefined)
Default: undefined;<br>
Set file extension fallbacks. When set, if a file is not found, the given extensions will be added to the file name and search for. The first that exists will be served. Example: ['html', 'htm']. example: url /foo will force to file foo.html or foo.htm.
### fallthrough (boolean)
Default: true;<br>
Set the middleware to have client errors fall-through as just unhandled requests, otherwise forward a client error. The difference is that client errors like a bad request or a request to a non-existent file will cause this middleware to simply next() to your next middleware when this value is true. When this value is false, these errors (even 404s), will invoke next(err).
### immutable (boolean)
Default: false;<br>
Enable or disable the immutable directive in the Cache-Control response header, defaults to false. If set to true, the maxAge option should also be specified to enable caching. The immutable directive will prevent supported clients from making conditional requests during the life of the maxAge option to check if the file has changed.
### index (string)
Default: index.html;<br>
By default this module will send "index.html" files in response to a request on a directory. To disable this set false redirect options.
### redirect (boolean)
Default: true;<br>
Redirect to trailing "/" when the pathname is a dir. if true redirect read index file.
### setHeaders (Function | undefined)
Default: undefined;<br>
Function to set custom headers. Alterations to the headers need to occur synchronously. The function is called as fn(headers, path, stat).
### lastModified (boolean)
Default: true;<br>
Enable or disable Last-Modified header, defaults to true. Uses the file system's last modified value.
### maxAge (number)
Default: 0;<br>
Provide a max-age in milliseconds for http caching, defaults to 0.
### gzip (boolean)
Default: false;<br>
Enable or disable setting gzip. if true the headers send Vary to Accept-Encoding. gzip .gz relation to opts.extensions.
### brotli (boolean)
Default: false;<br>
Enable or disable setting brotli. if true the headers send Vary to Accept-Encoding. brotli .br relation to opts.extensions.
### fetch (boolean)
Default: false;<br>
If true, idealy for deno deploy only.
### prefix (string)
Default: undefined;<br>
Give string prefix url. if prefix = "/assets", then /assets/yourfile.ext.

## Example force download
```ts
import { serve } from "https://deno.land/std@0.116.0/http/server.ts";
import staticFiles from "https://deno.land/x/static_files@1.1.5/mod.ts";

function setHeaders(headers: Headers, path: string, stats?: Deno.FileInfo) {
    headers.set("Content-disposition", "attachment; filename=" + path);
}

const serveFiles = (req: Request) => staticFiles('public', { setHeaders })({ 
    request: req, 
    respondWith: (r: Response) => r 
})

serve((req) => serveFiles(req), { addr: ':3000' });
```

## License

[MIT](LICENSE)



