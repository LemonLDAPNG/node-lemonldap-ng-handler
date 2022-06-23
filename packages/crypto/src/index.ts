import rnd from 'random-bytes'
import sha from 'sha.js'
import aesjs from 'aes-js'

class Crypto {
  rk: Buffer

  constructor (key: string) {
    this.rk = sha('sha256')
      .update(key)
      .digest()
  }

  newIv () {
    return Buffer.from(Array.prototype.slice.call(rnd.sync(16), 0))
  }

  encrypt (s: string) {
    let buf = aesjs.utils.utf8.toBytes(s)
    //let buf = Buffer.from(s);
    const pad = 16 - (buf.length % 16)
    buf = Buffer.concat([buf, Buffer.allocUnsafe(pad).fill('\0')])
    const hmac = sha('sha256')
      .update(buf)
      .digest()
    buf = Buffer.concat([hmac, buf])
    const iv = this.newIv()
    const aesCbc = new aesjs.ModeOfOperation.cbc(this.rk, iv)
    return Buffer.concat([iv, aesCbc.encrypt(buf)]).toString('base64')
  }

  decrypt (s: string) {
    const decodedString = s
      .replace(/%2B/g, '+')
      .replace(/%2F/g, '/')
      .replace(/%3D/g, '=')
      .replace(/%0A/g, '\n')
    let buf = Buffer.from(decodedString, 'base64')
    const iv = buf.slice(0, 16)
    buf = buf.slice(16)
    const aesCbc = new aesjs.ModeOfOperation.cbc(this.rk, iv)
    let bufRes = Buffer.from(aesCbc.decrypt(buf))
    const hmac = bufRes.slice(0, 32)
    bufRes = bufRes.slice(32)
    const newhmac = sha('sha256')
      .update(bufRes)
      .digest()
    // istanbul ignore next
    if (!hmac.equals(newhmac)) throw new Error('Bad hmac')
    const z = bufRes.indexOf('\0')
    if (z > 0) bufRes = bufRes.slice(0, z + 1)
    const res = bufRes.toString()
    // Remove \0 at end
    return res.substring(0, res.length - 1)
  }
}

export default Crypto
