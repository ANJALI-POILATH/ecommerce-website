/* ===== ORBIT storefront: catalogue, search, filters, add to cart ===== */
const S = { items: [], cats: [], cat: new URLSearchParams(location.search).get('cat') || 'all', q: '', page: 1, sort: 'new' };
const catOf = id => S.cats.find(c => c.id === id) || { name: 'Misc' };

$(async function () {
  await Auth.restore(); paintAcct(); Cart.paint();
  $('#grid').html('<div class="sk"></div>'.repeat(4));
  bind();
  try { await load(); }
  catch (e) { $('#grid').html(`<div class="empty"><div class="big">Connection issue</div><h3>Can't reach the database</h3><p class="muted mt">${esc(errMsg(e))}</p></div>`); }
});

async function load() {
  const [cats, items] = await Promise.all([API.list('categories'), API.list('products')]);
  S.cats = cats.filter(c => c.active !== false); S.items = items;
  if (S.cat !== 'all' && !S.cats.some(c => c.id === S.cat)) S.cat = 'all';
  await attachImages(S.items);
  renderHomeSections();
  initHeroSlider();
  // drop cart lines whose product vanished, went inactive or sold out
  const cart = Cart.get(); let changed = false;
  Object.keys(cart).forEach(id => { const i = items.find(x => x.id === id);
    if (!i || i.active === false || i.qty < 1) { delete cart[id]; changed = true; }
    else if (cart[id] > i.qty) { cart[id] = i.qty; changed = true; } });
  if (changed) Cart.set(cart);
  render();
}

function filtered() {
  const q = S.q.trim().toLowerCase();
  const r = S.items.filter(i => i.active !== false && (S.cat === 'all' || i.catId === S.cat) &&
    (!q || [i.title, i.des, i.id, catOf(i.catId).name].join(' ').toLowerCase().includes(q)));
  const n = i => parseInt(String(i.id).replace(/\D/g, '')) || 0;
  const sorts = { new: (a, b) => n(b) - n(a), low: (a, b) => a.price - b.price, high: (a, b) => b.price - a.price, az: (a, b) => String(a.title).localeCompare(String(b.title)) };
  return r.sort(sorts[S.sort]);
}
const HERO_SLIDES = [
  {tag:'A curated shopping experience', title:'Discover products for <mark>everyday life.</mark>', desc:'Find practical picks, compare products, and enjoy a simple, secure shopping experience.', cta:'Explore the collection', href:'#shop'},
  {tag:'Thoughtful finds, lovely details', title:'A little beauty in the <mark>everyday.</mark>', desc:'Explore pieces for your home, your wardrobe, and the moments that matter.', cta:'Discover categories', href:'categories.html'},
  {tag:'Shopping made simple', title:'Find your next <mark>favourite.</mark>', desc:'Browse featured picks, add what you love, and keep your orders close at hand.', cta:'View your orders', href:'orders.html'}
];
let heroIndex=0, heroTimer=null;
function initHeroSlider(){
  const show=(n)=>{heroIndex=(n+HERO_SLIDES.length)%HERO_SLIDES.length;const d=HERO_SLIDES[heroIndex];$('#heroCopy').addClass('changing');setTimeout(()=>{$('#heroTag').text(d.tag);$('#heroTitle').html(d.title);$('#heroDescription').text(d.desc);$('#heroAction').text(d.cta+' →').attr('href',d.href);$('#heroCopy').removeClass('changing');},160);$('#heroDots').html(HERO_SLIDES.map((_,i)=>`<button type="button" class="${i===heroIndex?'active':''}" data-slide="${i}" aria-label="Show highlight ${i+1}"></button>`).join(''));};
  show(0);$('#heroPrev').off('click').on('click',()=>show(heroIndex-1));$('#heroNext').off('click').on('click',()=>show(heroIndex+1));$('#heroDots').off('click').on('click','button',function(){show(+this.dataset.slide)});
  const resume=()=>{clearInterval(heroTimer);heroTimer=setInterval(()=>show(heroIndex+1),6500)};const pause=()=>clearInterval(heroTimer);resume();$('.hero-slider').on('mouseenter focusin',pause).on('mouseleave focusout',resume);
}
function renderHomeSections(){
  const featured=S.items.filter(i=>i.active!==false&&i.qty>0).slice().sort((a,b)=>Number(b.featured||0)-Number(a.featured||0)).slice(0,8);
  $('#featuredRail').html(featured.length?featured.map(railCard).join(''):`<div class="empty">Featured products will appear here as your catalogue grows.</div>`);
  $('#discoverTiles').html(S.cats.slice(0,6).map((c,i)=>`<a class="discover-tile" href="categories.html?cat=${encodeURIComponent(c.id)}"><span class="tile-mark">${['✦','◇','♡','✧','◈','✺'][i%6]}</span><b>${esc(c.name)}</b><small>Explore collection</small><span class="tile-arrow">↗</span></a>`).join(''));
}
function railCard(i){const c=catOf(i.catId),href=`product.html?id=${encodeURIComponent(i.id)}`;return `<article class="rail-card" data-id="${esc(i.id)}"><a class="rail-image" href="${href}"><img src="${esc(productPhoto(i))}" alt="${esc(i.title)}" loading="lazy"></a><div class="rail-body"><small>${esc(c.name)}</small><a class="rail-title" href="${href}">${esc(i.title)}</a><b class="price">${money(i.price)}</b><button class="btn add" type="button">Add to cart</button></div></article>`}
function addFromCard(el){const w=$(el).closest('[data-id]'),id=String(w.data('id')),it=S.items.find(x=>x.id===id);if(!it)return;if(!Cart.add(id,1,it.qty))return toast(`Only ${it.qty} in stock — cart updated`,'err');toast(`${it.title} added to cart`);}

function render() {
  const active = S.items.filter(i => i.active !== false);
  $('#chips').html(`<button class="chip ${S.cat === 'all' ? 'on' : ''}" data-cat="all">All (${active.length})</button>` +
    S.cats.map(c => `<button class="chip ${S.cat === c.id ? 'on' : ''}" data-cat="${esc(c.id)}">${esc(c.name)} (${active.filter(i => i.catId === c.id).length})</button>`).join(''));
  const list = filtered(), PS = CONFIG.STORE_PAGE_SIZE, pages = Math.max(1, Math.ceil(list.length / PS));
  S.page = Math.min(S.page, pages);
  $('#count').text(`${list.length} item${list.length === 1 ? '' : 's'}`);
  $('#grid').html(list.length ? list.slice((S.page - 1) * PS, S.page * PS).map(card).join('') :
    `<div class="empty"><div class="big">No results</div><h3>${S.q ? `Nothing matches “${esc(S.q)}”` : 'Nothing here yet'}</h3><p class="muted mt">Try another word or pick a different category.</p></div>`);
  let p = '';
  if (pages > 1) { p = `<button data-p="${S.page - 1}" ${S.page === 1 ? 'disabled' : ''} aria-label="Previous">‹</button>`;
    for (let i = 1; i <= pages; i++) p += `<button class="${i === S.page ? 'on' : ''}" data-p="${i}">${i}</button>`;
    p += `<button data-p="${S.page + 1}" ${S.page === pages ? 'disabled' : ''} aria-label="Next">›</button>`; }
  $('#pager').html(p);
  $('#grid .card').each(function(i){this.style.setProperty('--card-delay',Math.min(i*45,270)+'ms');this.classList.add('card-enter');});
}
const stepper = max => `<span class="step" data-max="${max}"><button type="button" data-d="-1" aria-label="Less">−</button><span class="n">1</span><button type="button" data-d="1" aria-label="More">+</button></span>`;
function card(i) {
  const c = catOf(i.catId), out = i.qty < 1, low = i.qty > 0 && i.qty < 15, href = `product.html?id=${encodeURIComponent(i.id)}`;
  return `<article class="card" data-id="${esc(i.id)}">
    <a class="art" href="${href}" aria-label="${esc(i.title)}"><img src="${esc(productPhoto(i))}" alt="${esc(i.title)}" loading="lazy">
      ${out ? '<span class="badge red">Sold out</span>' : low ? `<span class="badge yel">Only ${i.qty} left</span>` : ''}</a>
    <div class="body"><small>${esc(c.name)}</small><h3><a href="${href}">${esc(i.title)}</a></h3><p>${esc(i.des)}</p>
      <span class="price">${money(i.price)}</span>
      <div class="buy">${out ? '<button class="btn ghost" disabled>Out of stock</button>' : `${stepper(i.qty)}<button class="btn add" type="button">Add to cart</button>`}</div></div></article>`;
}

function bind() {
  $(document).on('input', '#q', function () { S.q = this.value; S.page = 1; render(); });
  $('#sort').on('change', function () { S.sort = this.value; render(); });
  $('#chips').on('click', '.chip', function () { S.cat = String($(this).data('cat')); S.page = 1; render(); });
  $('#pager').on('click', 'button', function () { S.page = +$(this).data('p'); render(); $('#shop')[0].scrollIntoView(); });
  $('#grid').on('click', '.step button', function () {
    const st = $(this).parent(), n = st.find('.n'), max = +st.data('max');
    n.text(Math.max(1, Math.min(max, +n.text() + +$(this).data('d'))));
  });
  $('#grid').on('click', '.add', function () {
    const w = $(this).closest('[data-id]'), id = String(w.data('id')), it = S.items.find(x => x.id === id), q = +w.find('.n').text();
    if (!Cart.add(id, q, it.qty)) return toast(`Only ${it.qty} in stock — cart updated`, 'err');
    toast(`${it.title} added to cart`);
  });
  $('#featuredRail').on('click','.add',function(){addFromCard(this);});
  $(document).on('click','[data-scroll]',function(){const rail=document.getElementById(this.dataset.scroll);if(rail)rail.scrollBy({left:+this.dataset.dir*rail.clientWidth*.82,behavior:'smooth'});});
}
