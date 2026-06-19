const http = require("http");
const { WebSocketServer } = require("ws");
const net = require("net");

const UUID = "d8a3d73a-ea93-486b-8dd3-61c27d360d0e";
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200); res.end("OK");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  let remote = null;
  let headerParsed = false;

  ws.on("message", (data) => {
    const buf = Buffer.from(data);
    if (!headerParsed) {
      headerParsed = true;
      const p = parseHeader(buf);
      if (!p) { ws.close(); return; }
      ws.send(Buffer.from([p.ver, 0]));
      remote = net.createConnection({ host: p.host, port: p.port }, () => {
        if (p.payload.length > 0) remote.write(p.payload);
      });
      remote.on("data", (chunk) => { if (ws.readyState === 1) ws.send(chunk); });
      remote.on("end", () => ws.close());
      remote.on("error", () => ws.close());
    } else if (remote) {
      remote.write(buf);
    }
  });
  ws.on("close", () => { remote?.destroy(); });
  ws.on("error", () => { remote?.destroy(); });
});

function parseHeader(buf) {
  const ver = buf[0];
  const id = buf.slice(1, 17).toString("hex");
  const uuid = `${id.slice(0,8)}-${id.slice(8,12)}-${id.slice(12,16)}-${id.slice(16,20)}-${id.slice(20)}`;
  if (uuid !== UUID) return null;
  let o = 18 + buf[17];
  o++;
  const port = buf.readUInt16BE(o); o += 2;
  const atype = buf[o++];
  let host = "";
  if (atype === 1) { host = buf.slice(o, o+4).join("."); o += 4; }
  else if (atype === 2) { const l = buf[o++]; host = buf.slice(o, o+l).toString(); o += l; }
  else if (atype === 3) { const s=[]; for(let i=0;i<8;i++){s.push(buf.readUInt16BE(o).toString(16));o+=2;} host=s.join(":"); }
  return { ver, host, port, payload: buf.slice(o) };
}

server.listen(PORT, () => console.log(`VLESS proxy on port ${PORT}`));
