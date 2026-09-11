import { KeyPair } from '@nimiq/core'
import { createHash } from 'node:crypto'
const BASE = process.env.BASE ?? 'http://127.0.0.1:4321'
const ORIGIN = 'http://localhost:5173'
function hash(msg){const b=new TextEncoder().encode(msg);const p=new TextEncoder().encode('\x16Nimiq Signed Message:\n'+b.length);const c=new Uint8Array(p.length+b.length);c.set(p);c.set(b,p.length);return new Uint8Array(createHash('sha256').update(c).digest())}
async function jpost(path, body, headers={}) {
  const r = await fetch(BASE+path, { method:'POST', headers:{'Content-Type':'application/json',Origin:ORIGIN,...headers}, body: JSON.stringify(body) })
  return { status: r.status, headers: Object.fromEntries(r.headers), body: await r.json().catch(()=>null) }
}
const kp = KeyPair.generate()
const addr = kp.publicKey.toAddress().toUserFriendlyAddress()
console.log('wallet1:', addr)
async function signIn(kp, addr, label){
  const ch = await jpost('/api/v1/auth/challenge', { address: addr })
  const sig = kp.sign(hash(ch.body.data.message))
  const v = await jpost('/api/v1/auth/verify', { challengeId: ch.body.data.challengeId, address: addr, publicKey: kp.publicKey.toHex(), signature: sig.toHex() })
  console.log(label, 'status', v.status, 'user', v.body.data.user)
  return v.headers['set-cookie'].split(';')[0]
}
const c1 = await signIn(kp, addr, 'wallet1 first')
await signIn(kp, addr, 'wallet1 second')
const kp2 = KeyPair.generate()
const addr2 = kp2.publicKey.toAddress().toUserFriendlyAddress()
await signIn(kp2, addr2, 'wallet2 first')
const me = await fetch(BASE+'/api/v1/me', { headers: { Cookie: c1 } }).then(r=>r.json())
console.log('me(wallet1):', me)
const evil = await fetch(BASE+'/api/v1/auth/logout', { method:'POST', headers:{Cookie:c1,Origin:'http://evil.example'} })
console.log('cross-origin logout blocked?', evil.status)
