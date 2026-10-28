export function validAmountPaise(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<=0||n>100000000)throw Error('Invalid payment amount');return n;}
export function verifyPayment(event,payment){
 if(event.event!=='SUCCESS'||event.method!=='UPI'||event.currency!=='INR')throw Error('Only verified INR UPI payments can credit a wallet');
 if(payment.status!=='SUCCESS'||payment.method!=='UPI'||payment.currency!=='INR'||(!Number.isInteger(Number(payment.verificationLevel))||Number(payment.verificationLevel)<1))throw Error('Payment not bank verified');
 if(!/^[0-9a-f-]{36}$/i.test(event.orderId)||event.orderId!==payment.orderId||event.paymentId!==payment.paymentId||validAmountPaise(event.amountPaise)!==validAmountPaise(payment.amountPaise))throw Error('Payment details do not match');
 return{deposit_id:event.orderId,payment_id:event.paymentId,amount_paise:validAmountPaise(event.amountPaise)};
}
export async function validSignature(raw,signature,secret){
 if(!secret||!/^sha256=[a-f0-9]{64}$/i.test(signature))return false;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 const bytes=Uint8Array.from(signature.slice(7).match(/../g),h=>parseInt(h,16));return crypto.subtle.verify('HMAC',key,bytes,raw);
}
export function checkoutUrl(value,origin){const url=new URL(value);if(url.origin!==new URL(origin).origin||!/^\/checkout\/[a-f0-9-]{36}$/i.test(url.pathname))throw Error('Invalid checkout URL');return url.href;}
