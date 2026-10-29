// Minimal WebSocket server (RFC 6455) on top of node:http, text frames only.
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX = 64 * 1024;

class Socket extends EventEmitter {
  constructor(sock) {
    super(); this.sock = sock; this.buf = Buffer.alloc(0); this.open = true; this.alive = true;
    sock.setNoDelay(true);
    sock.on('data', d => this._data(d));
    sock.on('close', () => this._close());
    sock.on('error', () => this._close());
  }
  _data(d) {
    this.buf = Buffer.concat([this.buf, d]);
    while (this.buf.length >= 2) {
      const b0 = this.buf[0], b1 = this.buf[1], op = b0 & 0x0f, masked = b1 & 0x80; let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; const hi = this.buf.readUInt32BE(2); len = this.buf.readUInt32BE(6); off = 10; if (hi) return this.close(1009); }
      if (len > MAX) return this.close(1009);
      if (!masked) return this.close(1002);
      if (this.buf.length < off + 4 + len) return;
      const mask = this.buf.subarray(off, off + 4); const payload = Buffer.from(this.buf.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      this.buf = this.buf.subarray(off + 4 + len);
      if (op === 0x1) { let msg; try { msg = JSON.parse(payload.toString('utf8')); } catch (e) { continue; } this.emit('message', msg); }
      else if (op === 0x8) { this.close(1000); return; }
      else if (op === 0x9) this._frame(0xA, payload);
      else if (op === 0xA) this.alive = true;
    }
  }
  _frame(op, payload) {
    if (!this.open) return; const len = payload.length; let head;
    if (len < 126) head = Buffer.from([0x80 | op, len]);
    else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | op; head[1] = 126; head.writeUInt16BE(len, 2); }
    else { head = Buffer.alloc(10); head[0] = 0x80 | op; head[1] = 127; head.writeUInt32BE(0, 2); head.writeUInt32BE(len, 6); }
    try { this.sock.write(Buffer.concat([head, payload])); } catch (e) { this._close(); }
  }
  send(obj) { this._frame(0x1, Buffer.from(JSON.stringify(obj), 'utf8')); }
  ping() { this._frame(0x9, Buffer.alloc(0)); }
  close(code) { if (!this.open) return; const p = Buffer.alloc(2); p.writeUInt16BE(code || 1000); this._frame(0x8, p); this.open = false; try { this.sock.end(); } catch (e) {} this._close(); }
  _close() { if (this._closed) return; this._closed = true; this.open = false; try { this.sock.destroy(); } catch (e) {} this.emit('close'); }
}

// Attaches to an http server; `auth(req)` returns a user id or null; `onConnect(socket, userId)`.
function attach(server, pathName, auth, onConnect) {
  server.on('upgrade', (req, sock) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname !== pathName || (req.headers.upgrade || '').toLowerCase() !== 'websocket') { sock.destroy(); return; }
    const uid = auth(req); const key = req.headers['sec-websocket-key'];
    if (!uid || !key) { sock.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); sock.destroy(); return; }
    const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
    sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
    const ws = new Socket(sock); onConnect(ws, uid);
  });
}
module.exports = { attach, Socket };
