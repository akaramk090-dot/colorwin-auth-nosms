import http from 'node:http';
const android=new Set(['/api/v1/pollers/android/pair','/api/v1/observers/sms/pair','/api/v1/pollers/android/events','/api/v1/observers/sms','/api/v1/pollers/android/heartbeat','/api/v1/pollers/heartbeat','/api/v1/observers/heartbeat']);
http.createServer((req,res)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
 const api=pathname.startsWith('/api/');
 const permitted=!api||pathname==='/api/v1/colorwin/payment'||android.has(pathname)||pathname==='/api/v1/payments'||/^\/api\/v1\/payments\/[a-f0-9-]{36}$/i.test(pathname)||pathname.startsWith('/api/v1/customer')||pathname.startsWith('/api/v1/auth/')||pathname.startsWith('/api/v1/devices/')||pathname.startsWith('/api/v1/checkout/');
 if(!permitted||pathname.includes('simulate')||pathname.startsWith('/api/v1/admin')||pathname.startsWith('/admin')){res.writeHead(404).end('Not found');return;}
 const port=api||pathname==='/youpi-sms-gateway.apk'?6100:7000;
 const upstream=http.request({host:'127.0.0.1',port,path:req.url,method:req.method,headers:{...req.headers,host:'127.0.0.1:'+port}},response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res);});
 upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end('Gateway service unavailable');});req.pipe(upstream);req.on('aborted',()=>upstream.destroy());
}).listen(7100,'127.0.0.1',()=>console.log('Filtered checkout/Android proxy ready on 127.0.0.1:7100. Admin endpoints are excluded.'));
