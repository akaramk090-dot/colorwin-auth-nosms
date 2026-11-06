(() => {
 const providers={'CQ9':'cq9','Microgaming':'microgaming','JDB':'jdb','Evolution':'evolution','JILI':'jili','Choice Gaming':'choice'};
 const plus='/assets/web%20images/headerDepositPlus-BYMjCOAj.svg';
 function apply(){if(!document.documentElement.classList.contains('cw-native-home'))return;const customer=document.querySelector('#customerId>img');if(customer&&customer.getAttribute('src')!=='/assets/colorwin-home/customer-service.png')customer.setAttribute('src','/assets/colorwin-home/customer-service.png');const image=document.querySelector('.pc-header .balance img.add');if(image&&image.getAttribute('src')!==plus)image.setAttribute('src',plus);
  const winners=document.querySelector('.winners');if(winners){const head=winners.querySelector('.winners__head');if(head&&head.textContent.trim()!=='Sample winnings'){head.textContent='Sample winnings';}const empty=winners.querySelector('.cw-winning-empty'),hasItems=!!winners.querySelector('.winners__item');if(hasItems){empty?.remove();}else{const message=empty||document.createElement('p');message.className='cw-winning-empty';message.setAttribute('role','status');const text=window.ColorWinWinningState==='error'?'Recent winnings could not be loaded.':window.ColorWinWinningState==='empty'?'No recent winnings yet.':'Loading recent winnings…';if(message.textContent!==text)message.textContent=text;if(!empty)winners.append(message);}}
  document.querySelectorAll('.partner-logos__grid-item img').forEach(img=>{const name=providers[img.alt];if(!name)return;const src='/assets/colorwin-home/providers/'+name+'.png';if(img.getAttribute('src')!==src)img.setAttribute('src',src);});
  // Keep the discovery sections in the requested order: Mini Games first,
  // then Popular. The upstream home view can re-render these sections, so
  // this runs with the existing mutation-safe branding pass.
  const sectionName=section=>section?.querySelector('.game-section__head .t')?.textContent.trim().toLowerCase();
  const home=document.querySelector('.pchome');
  if(home){const sections=[...home.querySelectorAll(':scope > .game-section')];const popular=sections.find(section=>sectionName(section)==='popular');const mini=sections.find(section=>sectionName(section)==='mini games');if(mini&&popular&&mini.nextElementSibling!==popular)home.insertBefore(mini,popular);}
 }
 let scheduled=false;const schedule=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;apply();});};
 new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
 new MutationObserver(schedule).observe(document.documentElement,{attributes:true,attributeFilter:['class']});
 document.addEventListener('cw-winning-state',schedule);
 apply();
})();
