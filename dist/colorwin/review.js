fetch('/colorwin/routes.json').then(r=>r.json()).then(routes=>{
 const list=document.querySelector('#screens'),input=document.querySelector('#search');
 document.querySelector('#count').textContent=`${routes.length} routes`;
 function render(){list.replaceChildren();for(const r of routes.filter(r=>(r.path+' '+r.name).toLowerCase().includes(input.value.toLowerCase()))){const a=document.createElement('a');a.href='/?demo=1#'+r.path;a.textContent=r.name||'Home';const s=document.createElement('small');s.textContent=r.path;a.append(s);list.append(a)}}input.addEventListener('input',render);render();
});
