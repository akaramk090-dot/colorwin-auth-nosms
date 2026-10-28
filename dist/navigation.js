(() => {
  const arrow='<svg class="cw-back-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none"><path d="m15 5-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function bind(root){
    root.querySelectorAll('header a[aria-label="Go back"],header button[aria-label="Go back"],header [aria-label^="Back"],header .back,header .privacy-back,header [data-catalog-back]').forEach(button=>{
      button.innerHTML=arrow;
      button.classList.add('cw-back-button');
      button.dataset.cwBack='';
      if(!button.hasAttribute('aria-label'))button.setAttribute('aria-label','Go back');
    });
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-cw-back]');
    if(!button||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
    // Preserve each page's fallback destination when there is no previous entry.
    if(history.length>1){event.preventDefault();event.stopImmediatePropagation();history.back();}
  },true);
  window.ColorWinNavigation={bind};
})();
