const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateSecret(random=crypto.getRandomValues.bind(crypto)){
 const bytes=random(new Uint8Array(20));
 let bits=0,value=0,secret='';
 for(const byte of bytes){
  value=(value<<8)|byte;
  bits+=8;
  while(bits>=5){secret+=alphabet[(value>>>(bits-5))&31];bits-=5;}
 }
 if(bits)secret+=alphabet[(value<<(5-bits))&31];
 return secret;
}

function decodeBase32(secret){
 let bits=0,value=0;
 const output=[];
 for(const char of secret.replace(/=+$/,'').toUpperCase()){
  const index=alphabet.indexOf(char);
  if(index<0)throw new Error('Invalid authenticator secret');
  value=(value<<5)|index;
  bits+=5;
  if(bits>=8){output.push((value>>>(bits-8))&255);bits-=8;}
 }
 return new Uint8Array(output);
}

function decodeBase64(value){
 let binary;
 try{binary=atob(value);}catch{throw new Error('Authenticator encryption is not configured correctly');}
 return Uint8Array.from(binary,char=>char.charCodeAt(0));
}

function encodeBase64(value){
 let binary='';
 for(const byte of value)binary+=String.fromCharCode(byte);
 return btoa(binary);
}

async function encryptionKey(value){
 if(typeof value!=='string')throw new Error('Authenticator encryption is not configured');
 const bytes=decodeBase64(value);
 if(bytes.length!==32)throw new Error('Authenticator encryption key must decode to 32 bytes');
 return crypto.subtle.importKey('raw',bytes,{name:'AES-GCM'},false,['encrypt','decrypt']);
}

export async function encryptSecret(secret,keyValue){
 const key=await encryptionKey(keyValue);
 const nonce=crypto.getRandomValues(new Uint8Array(12));
 const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},key,new TextEncoder().encode(secret));
 return {secret_ciphertext:encodeBase64(new Uint8Array(ciphertext)),secret_nonce:encodeBase64(nonce)};
}

export async function decryptSecret(ciphertext,nonce,keyValue){
 const key=await encryptionKey(keyValue);
 const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:decodeBase64(nonce)},key,decodeBase64(ciphertext));
 return new TextDecoder().decode(plaintext);
}

async function codeAt(secret,counter){
 const key=await crypto.subtle.importKey('raw',decodeBase32(secret),{name:'HMAC',hash:'SHA-1'},false,['sign']);
 const message=new Uint8Array(8);
 new DataView(message.buffer).setBigUint64(0,BigInt(counter),false);
 const mac=new Uint8Array(await crypto.subtle.sign('HMAC',key,message));
 const offset=mac[mac.length-1]&15;
 const binary=((mac[offset]&127)<<24)|(mac[offset+1]<<16)|(mac[offset+2]<<8)|mac[offset+3];
 return String(binary%1000000).padStart(6,'0');
}

export async function matchingTotpCounter(secret,token,now=Date.now()){
 if(typeof token!=='string'||!/^\d{6}$/.test(token))return null;
 const counter=Math.floor(now/30000);
 for(const shift of [1,0,-1]){
  if(counter+shift<0)continue;
  const expected=await codeAt(secret,counter+shift);
  let mismatch=0;
  for(let i=0;i<6;i++)mismatch|=expected.charCodeAt(i)^token.charCodeAt(i);
  if(mismatch===0)return counter+shift;
 }
 return null;
}

export async function verifyTotp(secret,token,now=Date.now()){
 return (await matchingTotpCounter(secret,token,now))!==null;
}

export function provisioningUri(secret){
 const label=encodeURIComponent('Color Win Superadmin');
 const issuer=encodeURIComponent('Color Win');
 return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

export async function testCode(secret,now=Date.now()){
 return codeAt(secret,Math.floor(now/30000));
}
