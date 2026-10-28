const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const port=Number(process.env.COLORWIN_PORT||5173),base=`http://127.0.0.1:${port}`;
if(!Number.isInteger(port)||port<1||port>65535)throw Error('COLORWIN_PORT must be between 1 and 65535.');
const expected=fs.readFileSync(path.resolve(__dirname,'../dist/js/supabase-config.js'),'utf8');
function existingServer(){return new Promise((resolve,reject)=>{
 const req=http.get(base+'/js/supabase-config.js',res=>{let text='';res.setEncoding('utf8');res.on('data',chunk=>text+=chunk);res.on('end',()=>{if(res.statusCode===200&&text===expected)resolve(true);else reject(Error(`Port ${port} is used by another server. Stop it or set COLORWIN_PORT to another port.`));});});
 req.setTimeout(2000,()=>req.destroy(Error(`Port ${port} is not responding. Check the process using this port.`)));
 req.on('error',err=>err.code==='ECONNREFUSED'?resolve(false):reject(err));
});}
existingServer().then(running=>{
 if(running){console.log(`Color Win: ${base} — existing project server reused`);setInterval(()=>{},60000);}
 else require('../tests/preview-server.cjs');
}).catch(err=>{console.error(err.message);process.exitCode=1;});
