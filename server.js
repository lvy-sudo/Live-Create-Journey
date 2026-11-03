const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { exec } = require("node:child_process");

const ROOT = __dirname;
const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 4173);
const OPEN_BROWSER = process.env.LCJ_NO_OPEN !== "1";
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

const server = http.createServer((request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host || `${HOST}:${PORT}`}`);
    let pathname = decodeURIComponent(requestUrl.pathname);
    if (pathname === "/") pathname = "/index.html";
    const target = path.resolve(ROOT, `.${pathname}`);
    if (target !== ROOT && !target.startsWith(`${ROOT}${path.sep}`)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    fs.stat(target, (statError, stat) => {
      if (statError) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }
      const filePath = stat.isDirectory() ? path.join(target, "index.html") : target;
      const relative = path.relative(ROOT, filePath).replaceAll(path.sep, "/");
      const extension = path.extname(filePath).toLowerCase();
      const isFreshContent = [".html", ".css", ".js", ".webmanifest"].includes(extension);
      response.writeHead(200, {
        "Content-Type": MIME[extension] || "application/octet-stream",
        "Cache-Control": isFreshContent ? "no-cache" : "public, max-age=86400",
        "Service-Worker-Allowed": "/",
        "X-Content-Type-Options": "nosniff"
      });
      fs.createReadStream(filePath).on("error", () => response.destroy()).pipe(response);
      if (relative === "index.html") console.log("Serving index.html");
    });
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Server error");
  }
});

server.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}/`;
  console.log("");
  console.log("Live · Create · Journey");
  console.log(`请打开：${url}`);
  console.log("关闭此窗口即可停止本地服务器。");
  console.log("");
  if (OPEN_BROWSER) {
    const command = process.platform === "win32"
      ? `start "" "${url}"`
      : process.platform === "darwin"
        ? `open "${url}"`
        : `xdg-open "${url}"`;
    exec(command, () => {});
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`端口 ${PORT} 已被占用，请关闭占用该端口的程序后重试。`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
