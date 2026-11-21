/* ORBIT shared utilities + Firebase REST clients (no Firebase SDK). */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => '₹' + Number(n || 0).toLocaleString('en-IN');
const fdate = d => { const x = d?.toDate ? d.toDate() : new Date(d || Date.now()); return isNaN(x) ? '—' : x.toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); };
const hueOf = id => (parseInt(String(id).replace(/\D/g,'') || 1) * 47) % 360;
const PLACEHOLDER_IMAGE = 'assets/product-placeholder.svg';
const categoryPhoto = () => PLACEHOLDER_IMAGE;
function productPhoto(item){ return item?.imageUrl || item?.resolvedImageUrl || PLACEHOLDER_IMAGE; }
const resolveStorageImage = async (item) => {
  if (item?.imageUrl) return item.imageUrl;
  if (!item?.imagePath || !CONFIG.STORAGE_BUCKET) return PLACEHOLDER_IMAGE;
  try {
    // Product image reads are public by Storage rules; no auth header is needed.
    const meta = await axios.get(
      `https://firebasestorage.googleapis.com/v0/b/${CONFIG.STORAGE_BUCKET}/o/${encodeURIComponent(item.imagePath)}`
    );
    const token = meta.data?.downloadTokens;
    return token
      ? `https://firebasestorage.googleapis.com/v0/b/${CONFIG.STORAGE_BUCKET}/o/${encodeURIComponent(item.imagePath)}?alt=media&token=${encodeURIComponent(token)}`
      : PLACEHOLDER_IMAGE;
  } catch (error) {
    console.warn('Could not resolve Firebase Storage image:', error.response?.data || error.message);
    return PLACEHOLDER_IMAGE;
  }
};
const nextId = (p,list) => p + (Math.max(0,...list.map(x=>parseInt(String(x.id).replace(/\D/g,''))||0))+1);

/* Firestore REST wire-format helpers */
const encValue = v => { if(v===null)return {nullValue:null}; if(typeof v==='boolean')return {booleanValue:v}; if(typeof v==='number')return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v}; if(Array.isArray(v))return {arrayValue:{values:v.map(encValue)}}; if(typeof v==='object'){if(v instanceof Date)return {timestampValue:v.toISOString()};return {mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,encValue(x)]))}};} return {stringValue:String(v)}; };
const decValue = v => { if(!v)return null; if('nullValue'in v)return null; if('stringValue'in v)return v.stringValue; if('integerValue'in v)return Number(v.integerValue); if('doubleValue'in v)return Number(v.doubleValue); if('booleanValue'in v)return v.booleanValue; if('timestampValue'in v)return v.timestampValue; if('arrayValue'in v)return (v.arrayValue.values||[]).map(decValue); if('mapValue'in v)return decFields(v.mapValue.fields||{}); return null; };
const decFields = f => Object.fromEntries(Object.entries(f||{}).map(([k,v])=>[k,decValue(v)]));
const encodeFields = o => Object.fromEntries(Object.entries(o||{}).filter(([,v])=>v!==undefined).map(([k,v])=>[k,encValue(v)]));
const COLLECTIONS = {inventory:'products'};
function dbPath(path){const bits=String(path||'').split('/').filter(Boolean);if(bits.length)bits[0]=COLLECTIONS[bits[0]]||bits[0];return bits.join('/');}
function fromDb(o,path=''){if(!o)return o;const p=path.split('/')[0];if(p==='products'||p==='inventory'){o.catId=o.categoryId??o.catId;o.des=o.description??o.des;o.qty=o.quantity??o.qty;o.imageUrl=o.imageUrl??o.imageURL??null;o.imagePath=o.imagePath??o.image_path??null;}if(p==='orders'){o.custId=o.customerId??o.custId;o.custName=o.customerName??o.custName;o.total=o.totalAmount??o.total;o.payment=(o.paymentMethod||o.payment||'cash').toLowerCase();o.date=o.orderDate||o.date||o.createdAt||'';o.items=Array.isArray(o.items)?o.items:[];o.items=o.items.map(l=>({...l,title:l.title??l.productName??l.name,catId:l.categoryId??l.catId,itemId:l.productId??l.itemId,qty:l.quantity??l.qty,price:l.unitPrice??l.price}));}if(p==='customers'){o.mob=o.mobile??o.mob;}return o;}
function toDb(o,path=''){const x={...(o||{})},p=path.split('/')[0];if(p==='products'||p==='inventory'){if(x.catId!==undefined){x.categoryId=x.catId;delete x.catId;}if(x.des!==undefined){x.description=x.des;delete x.des;}if(x.qty!==undefined){x.quantity=x.qty;delete x.qty;}}if(p==='orders'){if(x.custId!==undefined){x.customerId=x.custId;delete x.custId;}if(x.custName!==undefined){x.customerName=x.custName;delete x.custName;}if(x.total!==undefined){x.totalAmount=x.total;delete x.total;}if(x.payment!==undefined){x.paymentMethod=x.payment;delete x.payment;}if(x.date!==undefined){x.orderDate=x.date;delete x.date;}}if(p==='customers'&&x.mob!==undefined){x.mobile=x.mob;delete x.mob;}return x;}
function authHeaders(){const t=Auth?.token?.();return t?{Authorization:`Bearer ${t}`}:{ };}
const API = {
  url(path=''){return `${CONFIG.FIRESTORE_URL}/${dbPath(path)}`;},
  async req(method,path,data){return (await axios({url:this.url(path),method,headers:{...authHeaders(),...(data===undefined?{}:{'Content-Type':'application/json'})},data})).data;},
  async get(path){const p=dbPath(path);if(!p)return null;const bits=p.split('/');if(bits.length%2===1){const r=(await axios.get(this.url(p)+'?pageSize=1000',{headers:authHeaders()})).data;const out={};(r.documents||[]).forEach(d=>{const id=d.name.split('/').pop();out[id]=fromDb({id,...decFields(d.fields)},path);});return out;}try{const r=await this.req('GET',p);return fromDb({id:r.name.split('/').pop(),...decFields(r.fields)},path);}catch(e){if(e.response?.status===404)return null;throw e;}},
  async list(path){const o=await this.get(path);return o?Object.values(o):[];},
  async where(collection,field,value){const payload={structuredQuery:{from:[{collectionId:dbPath(collection)}],where:{fieldFilter:{field:{fieldPath:field},op:'EQUAL',value:encValue(value)}}}};const r=(await axios.post(`${CONFIG.FIRESTORE_URL}:runQuery`,payload,{headers:{...authHeaders(),'Content-Type':'application/json'}})).data;return (r||[]).filter(x=>x.document).map(x=>{const d=x.document;return fromDb({id:d.name.split('/').pop(),...decFields(d.fields)},collection);});},
  async put(path,data){const p=dbPath(path),body=toDb(data,path);const name=`projects/${CONFIG.PROJECT_ID}/databases/(default)/documents/${p}`;return this.req('PATCH',p,{fields:encodeFields(body)});},
  async post(path,data){const p=dbPath(path);return (await axios.post(`${this.url(p)}?documentId=${encodeURIComponent(data.id||('doc_'+Date.now()))}`,{fields:encodeFields(toDb(data,path))},{headers:{...authHeaders(),'Content-Type':'application/json'}})).data;},
  async del(path){return this.req('DELETE',dbPath(path));},
  /* Field-level update (updateMask): only the named fields are written, so security rules that allow customers to change just `quantity` / `creditUsed` keep working. */
  async update(path,data){const p=dbPath(path),body=toDb(data,path),keys=Object.keys(body).filter(k=>body[k]!==undefined);if(!keys.length)return null;const q=keys.map(k=>'updateMask.fieldPaths='+encodeURIComponent(k)).join('&');return (await axios.patch(`${this.url(p)}?${q}`,{fields:encodeFields(body)},{headers:{...authHeaders(),'Content-Type':'application/json'}})).data;},
  async patch(path,data){
    if(path)return this.update(path,data);
    /* keys: 'collection/id' => write whole new document; 'collection/id/field' => update that single field */
    const whole={},partial={};
    for(const [full,val] of Object.entries(data||{})){const parts=full.split('/'),doc=parts.slice(0,2).join('/');if(parts.length===2)whole[doc]=val;else{(partial[doc]=partial[doc]||{})[parts.slice(2).join('.')]=val;}}
    const base=`projects/${CONFIG.PROJECT_ID}/databases/(default)/documents/`,writes=[];
    for(const [doc,val] of Object.entries(whole))writes.push({update:{name:base+dbPath(doc),fields:encodeFields(toDb(val,doc))},currentDocument:{exists:false}});
    for(const [doc,val] of Object.entries(partial)){const body=toDb(val,doc);writes.push({update:{name:base+dbPath(doc),fields:encodeFields(body)},updateMask:{fieldPaths:Object.keys(body)},currentDocument:{exists:true}});}
    return axios.post(`https://firestore.googleapis.com/v1/projects/${CONFIG.PROJECT_ID}/databases/(default)/documents:commit`,{writes},{headers:{...authHeaders(),'Content-Type':'application/json'}});
  }
};

function toast(msg,type='ok'){if(!$('#toasts').length)$('body').append('<div id="toasts" role="status"></div>');const t=$(`<div class="toast ${type}"><span>${esc(msg)}</span></div>`).appendTo('#toasts');setTimeout(()=>t.addClass('out'),3200);setTimeout(()=>t.remove(),3600);}
const errMsg=e=>{if(typeof e==='string')return e;let m=e?.response?.data?.error?.message||e?.response?.data?.error||e?.message||e?.statusText||'Something went wrong';if(typeof m==='object')m=JSON.stringify(m);if(String(m).includes('PERMISSION_DENIED'))return 'Firebase denied this request. Check Firestore rules and sign-in status.';if(/INVALID_LOGIN_CREDENTIALS|INVALID_PASSWORD|EMAIL_NOT_FOUND/.test(String(m)))return 'Your email or password is incorrect.';if(String(m).includes('EMAIL_EXISTS'))return 'An account with this email already exists.';if(String(m).includes('WEAK_PASSWORD'))return 'Password must be at least 6 characters.';if(String(m).includes('TOO_MANY_ATTEMPTS'))return 'Too many attempts. Please try again later.';if(String(m).includes('API key not valid'))return 'Add the Firebase Web API Key in js/config.js.';return String(m);};
async function run(btn,fn){const $b=$(btn);$b.prop('disabled',true).addClass('busy');try{await fn();}catch(e){toast(errMsg(e),'err');console.error(e);}finally{$b.prop('disabled',false).removeClass('busy');}}
const Modal={open(html,cls=''){Modal.close();$('body').append(`<div class="ov" id="modal"><div class="modal ${cls}"><button class="x" aria-label="Close" onclick="Modal.close()">✕</button>${html}</div></div>`);$('#modal').on('mousedown',e=>{if(e.target.id==='modal')Modal.close();});},close(){$('#modal').remove();},confirm(msg,yes){Modal.open(`<h3>Are you sure?</h3><p class="mt">${msg}</p><div class="row end mt"><button class="btn ghost" onclick="Modal.close()">No</button><button class="btn danger" id="yes">Yes, continue</button></div>`,'sm');$('#yes').on('click',()=>run('#yes',async()=>{await yes();Modal.close();}));}};
$(document).on('keydown',e=>{if(e.key==='Escape')Modal.close();});
const normalizeMobile = m => { let digits=String(m??'').trim().replace(/\D/g,''); if(digits.startsWith('91')&&digits.length===12)digits=digits.slice(2); if(digits.startsWith('0')&&digits.length===11)digits=digits.slice(1); return digits; };
const V={email:e=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e),mob:m=>/^[6-9]\d{9}$/.test(normalizeMobile(m)),pass:p=>p.length>=6,name:n=>n.trim().length>=3};

/* Firebase Authentication REST */
const Auth={
  token(){return this.session()?.idToken||'';},session(){try{const s=JSON.parse(localStorage.getItem('orbit_session')||'null');if(s&&s.expiresAt>Date.now())return s;return null;}catch{return null;}},user(){const s=this.session();return s?.user||null;},
  save(data,role){const u={id:data.localId,name:data.displayName||data.email.split('@')[0],email:data.email,role};localStorage.setItem('orbit_session',JSON.stringify({idToken:data.idToken,refreshToken:data.refreshToken,expiresAt:Date.now()+(Number(data.expiresIn||3600)-60)*1000,user:u}));return u;},out(){localStorage.removeItem('orbit_session');},
  async call(method,payload){if(!CONFIG.API_KEY)throw 'Add your Firebase Web API Key to js/config.js before using sign-in or image uploads.';return (await axios.post(`https://identitytoolkit.googleapis.com/v1/${method}?key=${encodeURIComponent(CONFIG.API_KEY)}`,payload)).data;},
  async signin(email,password){email=email.trim().toLowerCase();const d=await this.call('accounts:signInWithPassword',{email,password,returnSecureToken:true});const isAdmin=(CONFIG.ADMIN_UIDS||[]).includes(d.localId);const role=isAdmin?'admin':'customer';const u=this.save(d,role);if(role==='customer'){let c=await API.get('customers/'+d.localId);if(!c){c={id:d.localId,name:d.displayName||d.email.split('@')[0],email:d.email,mob:'',creditLimit:CONFIG.DEFAULT_CREDIT,creditUsed:0,createdAt:new Date().toISOString()};await API.put('customers/'+d.localId,c);}}return u;},
  async signup({name,email,mob,pass}){email=email.trim().toLowerCase();mob=normalizeMobile(mob);if(!V.name(name))throw 'Name must contain at least 3 characters';if(!V.email(email))throw 'Enter a valid e-mail';if(!V.mob(mob))throw 'Enter a valid 10-digit Indian mobile number (starting with 6, 7, 8 or 9).';if(!V.pass(pass))throw 'Password must contain at least 6 characters';if((CONFIG.ADMIN_EMAILS||[]).map(x=>x.toLowerCase()).includes(email))throw 'This email is reserved for an ORBIT administrator.';const d=await this.call('accounts:signUp',{email,password:pass,returnSecureToken:true});await this.call('accounts:update',{idToken:d.idToken,displayName:name.trim(),returnSecureToken:true});const u=this.save({...d,displayName:name.trim()},'customer');await API.put('customers/'+d.localId,{id:d.localId,name:name.trim(),email,mob,creditLimit:CONFIG.DEFAULT_CREDIT,creditUsed:0,createdAt:new Date().toISOString()});await sendMail(email,'Welcome to ORBIT',`Hi ${name.trim()}, your ORBIT account is ready. Happy shopping!`);return u;},
  async requestReset(email){if(!V.email(email))throw 'Enter a valid e-mail';await this.call('accounts:sendOobCode',{requestType:'PASSWORD_RESET',email:email.trim().toLowerCase()});},
  async reset(email,code,password){if(!code.trim())throw 'Enter the password reset code from your email';if(!V.pass(password))throw 'Password must contain at least 6 characters';await this.call('accounts:resetPassword',{oobCode:code.trim(),newPassword:password});},
  async restore(){
    let s;
    try { s = JSON.parse(localStorage.getItem('orbit_session') || 'null'); } catch { return null; }
    if (!s) return null;
    const safeUser = user => {
      if (!user) return null;
      user.role = (CONFIG.ADMIN_UIDS || []).includes(user.id) ? 'admin' : 'customer';
      return user;
    };
    if (s.expiresAt > Date.now()) {
      s.user = safeUser(s.user);
      localStorage.setItem('orbit_session', JSON.stringify(s));
      return s.user;
    }
    if (!s.refreshToken) { this.out(); return null; }
    try {
      const d = (await axios.post(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(CONFIG.API_KEY)}`,
        new URLSearchParams({ grant_type: 'refresh_token', refresh_token: s.refreshToken }))).data;
      const user = safeUser(s.user);
      localStorage.setItem('orbit_session', JSON.stringify({
        idToken: d.id_token, refreshToken: d.refresh_token,
        expiresAt: Date.now() + (Number(d.expires_in) - 60) * 1000, user
      }));
      return user;
    } catch (e) { this.out(); return null; }
  }
};

async function sendMail(to,subject,body){const u=Auth.user();const id='mail_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);await API.put('mails/'+id,{id,to,from:u?.email||'ORBIT',subject,body,date:new Date().toISOString(),read:false});const m=CONFIG.EMAILJS||{};if(m.serviceId&&m.templateId&&m.publicKey){axios.post('https://api.emailjs.com/api/v1.0/email/send',{service_id:m.serviceId,template_id:m.templateId,user_id:m.publicKey,template_params:{to_email:to,subject,message:body}}).catch(e=>console.warn('Email delivery failed',e));}}
function assertAdminForStorage() {
  const user = Auth.user();
  if (!user || !(CONFIG.ADMIN_UIDS || []).includes(user.id)) {
    throw new Error('Only an authorised ORBIT administrator can manage product images.');
  }
  if (!Auth.token()) throw new Error('Your session has expired. Sign in again.');
}

async function uploadProductImage(file, productId) {
  assertAdminForStorage();
  if (!file) return null;
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) throw new Error('Choose a JPG, PNG, WebP or GIF image.');
  if (file.size <= 0 || file.size > 5 * 1024 * 1024) throw new Error('Image must be larger than 0 bytes and no bigger than 5 MB.');
  if (!CONFIG.STORAGE_BUCKET) throw new Error('Configure the Firebase Storage bucket in js/config.js.');

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || 'product-image';
  const path = `products/${encodeURIComponent(String(productId))}/${Date.now()}_${safeName}`;
  const url = `https://firebasestorage.googleapis.com/v0/b/${CONFIG.STORAGE_BUCKET}/o?uploadType=media&name=${encodeURIComponent(path)}`;
  const response = await axios.post(url, file, {
    headers: { Authorization: `Firebase ${Auth.token()}`, 'Content-Type': file.type }
  });
  const downloadToken = response.data?.downloadTokens;
  if (!downloadToken) throw new Error('Firebase uploaded the file but did not return a download token.');
  return {
    imagePath: path,
    imageUrl: `https://firebasestorage.googleapis.com/v0/b/${CONFIG.STORAGE_BUCKET}/o/${encodeURIComponent(path)}?alt=media&token=${encodeURIComponent(downloadToken)}`
  };
}

async function deleteProductImage(imagePath) {
  if (!imagePath) return;
  assertAdminForStorage();
  const url = `https://firebasestorage.googleapis.com/v0/b/${CONFIG.STORAGE_BUCKET}/o/${encodeURIComponent(imagePath)}`;
  await axios.delete(url, { headers: { Authorization: `Firebase ${Auth.token()}` } });
}


/* ---------- cart shared by every page ---------- */
const Cart={
  KEY:'orbit_cart',
  get(){try{return JSON.parse(localStorage.getItem(this.KEY)||'{}')||{};}catch{return {};}},
  set(c){localStorage.setItem(this.KEY,JSON.stringify(c));this.paint();const u=Auth.user();if(u&&u.role==='customer')API.put('carts/'+u.id,{customerId:u.id,items:c,status:'active',updatedAt:new Date().toISOString()}).catch(()=>{});},
  count(){return Object.values(this.get()).reduce((a,b)=>a+(+b||0),0);},
  paint(){const n=this.count();$('#badge').text(n).toggleClass('zero',!n);},
  bump(){const b=$('#cartbtn');b.removeClass('bump');if(b[0]){void b[0].offsetWidth;b.addClass('bump');}},
  add(id,q,max){const c=this.get(),have=c[id]||0;if(have+q>max){c[id]=max;this.set(c);return false;}c[id]=have+q;this.set(c);this.bump();return true;},
  clear(){this.set({});}
};
async function attachImages(items){await Promise.all(items.map(async i=>{i.resolvedImageUrl=await resolveStorageImage(i);}));return items;}
document.addEventListener('error',e=>{const t=e.target;if(t&&t.tagName==='IMG'&&!t.dataset.fb){t.dataset.fb='1';t.src=PLACEHOLDER_IMAGE;}},true);

/* ---------- shared header ---------- */
const LOGO_SVG='<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="15" fill="none" stroke="#f3b9c9" stroke-width="1.5"/><path d="M11 20c3-7 7-7 9 0-2 7-6 7-9 0Zm9 0c3-7 7-7 9 0-2 7-6 7-9 0Z" fill="#f3b9c9" opacity=".95"/><circle cx="20" cy="20" r="2" fill="#fff"/></svg>';
function renderHeader(){
  const h=$('#siteHeader');if(!h.length)return;
  const search=h.is('[data-search]');
  h.html(`<a class="logo" href="index.html" aria-label="ORBIT home">${LOGO_SVG}<span>ORBIT</span></a>
  ${search?'<form class="search" role="search" onsubmit="return false"><input id="q" placeholder="Search products, categories or item ID" aria-label="Search products" autocomplete="off"><button type="button" aria-label="Search" tabindex="-1">⌕</button></form>':''}
  <nav class="nav">
    <a class="navlink hide-sm" href="categories.html"><small>Browse</small><b>Categories</b></a>
    <div class="acct-wrap"><button class="navlink" id="acct" aria-haspopup="true"><small id="acctHello">Hello, sign in</small><b>Account &amp; Orders</b></button><div class="menu" id="menu"></div></div>
    <button class="navlink icon" id="themeToggle" aria-label="Toggle light or dark theme" title="Toggle theme">☀</button>
    <a class="navlink cartbtn" href="cart.html" id="cartbtn" aria-label="Cart"><span class="cart-ico">🛒</span><b>Cart</b><span id="badge">0</span></a>
  </nav>`);
  Cart.paint();paintAcct();
}
function paintAcct(){
  const u=Auth.user();
  $('#acctHello').text(u?'Hello, '+u.name.split(' ')[0]:'Hello, sign in');
  $('#menu').html(u?`<div class="who">${esc(u.email)}</div>`+(u.role==='admin'?'<a href="admin.html">Admin console</a>':'<a href="orders.html">Your orders</a><a href="account.html">Your account &amp; credit</a>')+'<button data-m="out">Sign out</button>':'');
}
$(document).on('click','#acct',function(e){e.stopPropagation();if(!Auth.user())return location.href='auth.html';$('#menu').toggleClass('on');});
$(document).on('click',()=>$('#menu').removeClass('on'));
$(document).on('click','#menu [data-m=out]',()=>{Auth.out();location.href='index.html';});
function requireCustomer(){const u=Auth.user();if(!u){location.href='auth.html?next='+encodeURIComponent(location.pathname.split('/').pop()+location.search);return null;}if(u.role==='admin'){location.href='admin.html';return null;}return u;}

/* ---------- atmosphere: star field + persisted theme ---------- */
function initOrbitAtmosphere(){
  if(!document.querySelector('.starfield')){const f=document.createElement('div');f.className='starfield';f.setAttribute('aria-hidden','true');for(let i=0;i<70;i++){const s=document.createElement('i');s.className='star';s.style.left=Math.random()*100+'%';s.style.top=Math.random()*100+'%';s.style.setProperty('--twinkle',(1+Math.random()*3.5)+'s');s.style.setProperty('--delay',(-Math.random()*5)+'s');s.style.setProperty('--size',(1+Math.random()*1.8)+'px');f.appendChild(s);}document.body.prepend(f);}
  paintTheme();
}
function paintTheme(){const light=document.documentElement.dataset.theme==='light';$('#themeToggle').each(function(){if(this.classList.contains('navlink'))this.textContent=light?'☾':'☀';else this.textContent=light?'☾ Dark mode':'☀ Light mode';this.title=light?'Switch to galaxy dark mode':'Switch to light mode';});}
document.documentElement.dataset.theme=localStorage.getItem('orbit_theme')||'dark';
$(document).on('click','#themeToggle',()=>{const next=document.documentElement.dataset.theme==='light'?'dark':'light';document.documentElement.dataset.theme=next;localStorage.setItem('orbit_theme',next);paintTheme();});
$(renderHeader);
$(initOrbitAtmosphere);
