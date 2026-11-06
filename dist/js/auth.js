(() => {
  const config = window.COLORWIN_SUPABASE_CONFIG;
  const configured = !!config && /^https:\/\//.test(config.url) && !config.key.startsWith('YOUR_') && !config.key.startsWith('sb_secret_');
  // Only SDK session tokens enter storage; form passwords are never persisted.
  let persistent = localStorage.getItem('cw_remember_login') !== 'false';
  const storage = {
    getItem: key => (persistent ? localStorage : sessionStorage).getItem(key),
    setItem: (key,value) => (persistent ? localStorage : sessionStorage).setItem(key,value),
    removeItem: key => { localStorage.removeItem(key); sessionStorage.removeItem(key); }
  };
  let client = null;
  let session = null;
  let profile = null;
  let ready = false;
  let busy = false;
  let profileError = false;
  const subscribers=new Set();
  let initialization;
  let logoutPending=false;
  let notify = () => {if(!logoutPending)for(const fn of subscribers){try{fn();}catch{}}};
  function replacedSession(){
    if(logoutPending)return;
    logoutPending=true;session=null;profile=null;
    window.dispatchEvent?.(new CustomEvent('colorwin:session-replaced'));
    setTimeout(()=>{
      logoutPending=false;notify();
      // Redirect must not wait on a network sign-out request.
      client.auth.signOut({scope:'local'}).catch(()=>{});
    },5000);
  }
  let sessionCheckBusy=false;
  async function enforceSession(claim=false) {
    const current=session;
    if(!current)return true;
    const {data,error}=await client.rpc('colorwin_player_session',{p_claim:claim});
    if(session!==current)return false;
    if(error){
      if(claim){session=null;profile=null;await client.auth.signOut({scope:'local'}).catch(()=>{});}
      throw new Error('Session check unavailable. Please retry.');
    }
    if(data===true)return true;
    // Local scope must not sign out the winning device.
    replacedSession();
    return false;
  }
  async function checkSession(){
    if(!session||busy||sessionCheckBusy)return;
    sessionCheckBusy=true;
    try{await enforceSession(false);}catch{/* Temporary network failures are retried; server gates remain authoritative. */}
    finally{sessionCheckBusy=false;}
  }
  // The UI remains phone-only. Supabase Auth uses a deterministic, non-routable
  // email identifier internally so no SMS provider is required. The real phone
  // number is stored in user metadata and copied to public.profiles by SQL.
  const authEmailForPhone = phone => `phone_${String(phone || '').replace(/\D/g,'')}@auth.colorwin.invalid`;
  const message = (error, fallback) => {
    const code=error?.code;
    if(code==='invalid_credentials') return 'Incorrect phone or password.';
    if(['user_already_exists','phone_exists'].includes(code)) return 'Account already exists. Please log in.';
    if(code==='weak_password') return 'Password must be at least 8 characters.';
    if(code==='phone_not_confirmed') return 'Please verify your phone number before logging in.';
    if(error?.status===429 || code?.includes('rate_limit')) return 'Too many attempts. Please try again later.';
    if(error instanceof TypeError || /fetch|network/i.test(error?.message || '')) return 'Network error. Please try again.';
    return fallback;
  };
  async function fetchProfile() {
    profile=null;profileError=false;
    if(!session) return;
    const {data,error}=await client.from('profiles').select('id,phone,public_uid,display_name,created_at,last_login_at,is_blocked').eq('id',session.user.id).single();
    if(error){profileError=true;return;}
    profile=data;
  }
  async function init(onChange) {
    subscribers.add(onChange);
    if(!initialization)initialization=initialize();
    else if(ready)onChange();
    return initialization;
  }
  async function initialize() {
    if(!configured || !window.supabase){ready=true;notify();return;}
    try {
      if(config.key.startsWith('eyJ')) {
        const claims=JSON.parse(atob(config.key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
        if(claims.role!=='anon') throw new Error('Only a public anon key is permitted.');
      }
      client=window.supabase.createClient(config.url,config.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storage}});
      const {data,error}=await client.auth.getSession();
      if(error) throw error;
      session=data.session;
      if(session){const result=await client.auth.getUser();if(result.error)session=null;}
      if(session)await enforceSession(true);
      await fetchProfile();
      client.auth.onAuthStateChange((event,next)=>{
        if(logoutPending)return;
        session=next;
        if(!next)profile=null;
        // Do not await Supabase queries inside its auth-state lock.
        if(!busy && event!=='INITIAL_SESSION') setTimeout(async()=>{try{if(session)await enforceSession(event==='SIGNED_IN');await fetchProfile();}catch{profileError=true;}notify();},0);
      });
      if(typeof setInterval==='function')setInterval(checkSession,1000);
      window.addEventListener?.('focus',checkSession);
      if(typeof document!=='undefined')document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkSession();});
    } catch { session=null; profile=null; }
    ready=true;notify();
  }
  function requireClient(){if(!client)throw new Error('Authentication is not configured. Add the Supabase URL and public key.');}
  function remember(value){persistent=value;localStorage.setItem('cw_remember_login',String(value));}
  async function authenticate(kind,phone,password,keep=true,invitationCode='') {
    if(logoutPending)throw new Error('Logging out. Please wait 5 seconds.');
    requireClient(); if(busy) return null;busy=true;remember(keep);
    try {
      const email=authEmailForPhone(phone);
      let result=kind==='register'
        ? await client.auth.signUp({email,password,options:{data:{phone,invitation_code:invitationCode || null}}})
        : await client.auth.signInWithPassword({email,password});
      // Verified mailbox changes replace the internal alias. Resolve it only on
      // the server, which authenticates the password before returning a session.
      if(kind==='login'&&result.error?.code==='invalid_credentials'){
        const response=await fetch(config.url+'/functions/v1/account-phone-login',{method:'POST',headers:{'Content-Type':'application/json',apikey:config.key},body:JSON.stringify({phone,password})});
        const payload=await response.json();
        if(!response.ok)throw new Error(payload.error||'Login unavailable. Please retry.');
        if(!payload.session?.access_token||!payload.session?.refresh_token)throw new Error('Login unavailable. Please retry.');
        result=await client.auth.setSession({access_token:payload.session.access_token,refresh_token:payload.session.refresh_token});
      }
      if(result.error)throw new Error(message(result.error,kind==='register'?'Registration failed. Please try again.':'Login failed. Please try again.'));
      if(!result.data.session) {
        if(kind==='register') throw new Error('Supabase email confirmation is enabled. Turn off Confirm email in Authentication settings, then register again.');
        return {confirmationRequired:true};
      }
      session=result.data.session;
      if(!await enforceSession(true))throw new Error('Account signed in on another device. Please log in again.');
      await fetchProfile();
      return {confirmationRequired:false,profileError};
    } catch(error) { throw new Error(message(error,error.message || 'Network error. Please try again.')); }
    finally{busy=false;}
  }
  async function authenticateEmail(kind,email,password,keep=true) {
    if(logoutPending)throw new Error('Logging out. Please wait 5 seconds.');
    requireClient(); if(busy) return null; busy=true; remember(keep);
    try {
      const result=kind==='register'
        ? await client.auth.signUp({email,password})
        : await client.auth.signInWithPassword({email,password});
      if(result.error) throw new Error(message(result.error,kind==='register'?'Registration failed. Please try again.':'Login failed. Please try again.'));
      if(!result.data.session) {
        if(kind==='register') throw new Error('Supabase email confirmation is enabled. Turn off Confirm email in Authentication settings, then register again.');
        return {confirmationRequired:true};
      }
      session=result.data.session;
      if(!await enforceSession(true))throw new Error('Account signed in on another device. Please log in again.');
      await fetchProfile();
      return {confirmationRequired:false,profileError};
    } catch(error) { throw new Error(message(error,error.message || 'Network error. Please try again.')); }
    finally { busy=false; }
  }

  async function verify(phone,token) {
    requireClient();busy=true;
    try{const {data,error}=await client.auth.verifyOtp({phone,token,type:'sms'});if(error)throw new Error(message(error,'Invalid or expired verification code.'));session=data.session;await fetchProfile();return !!session;}finally{busy=false;}
  }
  async function logout(){requireClient();busy=true;try{const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;session=null;profile=null;}finally{busy=false;}notify();}
  async function promotion(){requireClient();const {data,error}=await client.rpc("colorwin_promotion");if(error)throw new Error("Promotion unavailable. Check database setup or retry.");return data;}
  async function promotionReport({date,tier=0,uid='',page=1}={}){requireClient();const {data,error}=await client.rpc('colorwin_promotion_report',{p_day:date,p_tier:tier,p_uid:uid,p_page:page});if(error)throw new Error('Subordinate data could not be loaded. Please retry.');return data;}
  async function depositNotices(){requireClient();if(!session)return [];const {data,error}=await client.from('account_notifications').select('id,title,message,created_at').eq('user_id',session.user.id).eq('kind','deposit').eq('title','Deposit successful').order('created_at',{ascending:false}).limit(20);if(error)throw new Error(error.message);return data||[];}
  async function accountRpc(name,args={}){requireClient();const {data,error}=await client.rpc(name,args);if(error)throw new Error(error.message);return data;}
  async function setNickname(name){const result=await accountRpc('colorwin_set_nickname',{p_name:name});await fetchProfile();return result;}
  async function changePassword(oldPassword,newPassword){
    requireClient();if(!session)throw new Error('Sign in to continue.');busy=true;
    const verifier=window.supabase.createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    try{
      const {data,error}=await verifier.auth.signInWithPassword({email:session.user.email,password:oldPassword});
      if(error||data.user?.id!==session.user.id)throw new Error('Current password is incorrect.');
      const result=await client.auth.updateUser({password:newPassword});
      if(result.error)throw new Error(message(result.error,'Password could not be updated.'));
    }finally{await verifier.auth.signOut({scope:'local'}).catch(()=>{});busy=false;}
  }
  async function sendEmailChange(email){requireClient();const {error}=await client.auth.updateUser({email});if(error)throw new Error(error.message);}
  async function confirmEmailChange(email,token){requireClient();busy=true;try{const {data,error}=await client.auth.verifyOtp({email,token,type:'email_change'});if(error)throw new Error('Invalid or expired verification code.');if(data.session)session=data.session;return data.user;}finally{busy=false;}}
  async function refreshUser(){requireClient();const {data,error}=await client.auth.getUser();if(error)throw new Error('Account could not be refreshed.');if(session)session.user=data.user;return data.user;}
  async function supportUpload(path,file){requireClient();const {error}=await client.storage.from('cw_support_files').upload(path,file,{upsert:false,contentType:file.type});if(error)throw new Error(error.message);}
  async function supportRemove(paths){requireClient();const {error}=await client.storage.from('cw_support_files').remove(paths);if(error)throw new Error(error.message);}
  async function supportUrl(path){requireClient();const {data,error}=await client.storage.from('cw_support_files').createSignedUrl(path,120);if(error)throw new Error(error.message);return data.signedUrl;}
  window.ColorWinAuth={depositNotices,supportUpload,supportRemove,supportUrl,refreshUser,accountRpc,setNickname,changePassword,sendEmailChange,confirmEmailChange,promotion,promotionReport,init,authenticate,authenticateEmail,verify,logout,get ready(){return ready;},get session(){return session;},get profile(){return profile;},get profileError(){return profileError;},get configured(){return configured&&!!client;}};
})();

