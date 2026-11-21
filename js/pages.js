/* ===== ORBIT customer pages: cart, checkout, orders, account, categories, product ===== */
const root = $('#page-content');
const pname = i => esc(i.title || i.id);
let CAT = null;                      // cached catalogue for the current page
const catName = id => (CAT?.cats.find(c => c.id === id) || {}).name || 'ORBIT collection';
async function loadCatalog() { const [items, cats] = await Promise.all([API.list('products'), API.list('categories')]); await attachImages(items); CAT = { items, cats }; return CAT; }
const stepperFor = (id, q, max) => `<span class="step" data-id="${esc(id)}" data-max="${max}"><button type="button" data-d="-1" aria-label="Decrease quantity">−</button><span class="n">${q}</span><button type="button" data-d="1" aria-label="Increase quantity">+</button></span>`;

/* keep the cart consistent with live stock; returns lines + notices */
function cartLines() {
  const cart = Cart.get(), notes = []; let changed = false;
  const lines = [];
  Object.keys(cart).forEach(id => {
    const i = CAT.items.find(x => x.id === id);
    if (!i || i.active === false || i.qty < 1) { notes.push(`${i ? i.title : 'An item'} is no longer available and was removed.`); delete cart[id]; changed = true; return; }
    if (cart[id] > i.qty) { notes.push(`Only ${i.qty} of ${i.title} left — quantity adjusted.`); cart[id] = i.qty; changed = true; }
    lines.push({ item: i, q: cart[id] });
  });
  if (changed) Cart.set(cart);
  return { lines, notes, total: lines.reduce((a, x) => a + x.q * x.item.price, 0) };
}
const noteHtml = n => n.map(t => `<div class="alert">${esc(t)}</div>`).join('');
const title = (t, sub) => $('#page-head').html(`<h1 class="page-title">${t}</h1>${sub ? `<p class="page-sub">${sub}</p>` : ''}`);

/* ---------- bill ---------- */
const billText = o => `Order ${o.id} · ${fdate(o.date)}\n` + o.items.map(l => `${l.title} x${l.qty} = ${money(l.qty * l.price)}`).join('\n') + `\nTotal: ${money(o.total)} (${o.payment})`;
function showBill(o, placed) {
  Modal.open(`<h2>${placed ? 'Order placed — thank you!' : 'Bill'}</h2>${placed ? `<p class="mt muted">A copy of your bill was sent to your ORBIT mailbox.</p>` : ''}
    <div class="bill mt"><b>Order ${esc(o.id)}</b><br><span class="sm muted">${fdate(o.date)} · ${esc(o.custName)} · paid by ${esc(o.payment)}</span>
    <table><tr><th>Item</th><th>Qty</th><th>Amount</th></tr>${o.items.map(l => `<tr><td>${esc(l.title)}</td><td>${l.qty}</td><td>${money(l.qty * l.price)}</td></tr>`).join('')}
    <tr class="tot"><td colspan="2">Total</td><td>${money(o.total)}</td></tr></table></div>
    <div class="row end mt"><button class="btn ghost" onclick="window.print()">Print</button><button class="btn" onclick="Modal.close()">Close</button></div>`);
}

/* ---------- views ---------- */
const View = {};

View.cart = async () => {
  title('Shopping cart');
  await loadCatalog(); renderCartView();
};
function renderCartView() {
  const { lines, notes, total } = cartLines(), n = lines.reduce((a, x) => a + x.q, 0);
  if (!lines.length) return root.html(`${noteHtml(notes)}<div class="empty"><div class="big">Your cart is empty</div><p class="muted">Add something from the collection to get started.</p><a class="btn gold mt" href="index.html">Continue shopping</a></div>`);
  root.html(`${noteHtml(notes)}<div class="layout2"><section class="panel">
    ${lines.map(({ item: i, q }) => `<div class="line" data-id="${esc(i.id)}"><a class="thumb" href="product.html?id=${encodeURIComponent(i.id)}"><img src="${esc(productPhoto(i))}" alt=""></a>
      <div class="info"><b><a href="product.html?id=${encodeURIComponent(i.id)}">${pname(i)}</a></b><span class="sm muted">${esc(catName(i.catId))} · ${money(i.price)} each</span>
        <div class="row">${stepperFor(i.id, q, i.qty)}<button class="linkbtn" data-remove="${esc(i.id)}">Delete</button></div></div>
      <div class="amt">${money(q * i.price)}</div></div>`).join('')}</section>
    <aside class="panel summary"><h3>Order summary</h3><div class="total"><span>Subtotal (${n} item${n === 1 ? '' : 's'})</span><b>${money(total)}</b></div>
      <a class="btn gold wide" href="checkout.html">Proceed to checkout</a><a class="btn ghost wide mt" href="index.html">Continue shopping</a></aside></div>`);
}

View.checkout = async () => {
  const u = requireCustomer(); if (!u) return;
  title('Checkout');
  const [, cust] = await Promise.all([loadCatalog(), API.get('customers/' + u.id)]);
  const { lines, notes, total } = cartLines();
  if (!lines.length) { toast('Your cart is empty', 'err'); return location.href = 'cart.html'; }
  const avail = cust ? (cust.creditLimit || 0) - (cust.creditUsed || 0) : 0, canCredit = avail >= total;
  root.html(`${noteHtml(notes)}<div class="layout2"><div>
    <section class="panel"><h3>1. Payment method</h3>
      <label class="pay-opt"><input type="radio" name="pay" value="cash" checked><span>Cash<small>Pay on delivery</small></span></label>
      <label class="pay-opt ${canCredit ? '' : 'disabled'}"><input type="radio" name="pay" value="credit" ${canCredit ? '' : 'disabled'}><span>Credit limit<small>Available ${money(avail)}${canCredit ? '' : ' — not enough for this order'}</small></span></label></section>
    <section class="panel mt"><h3>2. Review items</h3>${lines.map(({ item: i, q }) => `<div class="line"><span class="thumb"><img src="${esc(productPhoto(i))}" alt=""></span><div class="info"><b>${pname(i)}</b><span class="sm muted">Qty ${q} × ${money(i.price)}</span></div><div class="amt">${money(q * i.price)}</div></div>`).join('')}</section></div>
    <aside class="panel summary"><h3>Order summary</h3><div class="total"><span>Order total</span><b>${money(total)}</b></div>
      <button class="btn gold wide" id="place">Place your order</button><p class="sm muted mt">Delivering to <b>${esc(u.name)}</b> · ${esc(u.email)}</p></aside></div>`);
};

async function placeOrder() {
  const u = requireCustomer(); if (!u) return;
  const method = $('input[name=pay]:checked').val() || 'cash';
  const cart = Cart.get(), ids = Object.keys(cart); if (!ids.length) throw 'Your cart is empty';
  const [fresh, cust] = await Promise.all([API.get('products'), API.get('customers/' + u.id)]);
  const lines = ids.map(id => {
    const it = fresh && fresh[id], q = cart[id];
    if (!it || it.active === false) throw 'An item in your cart is no longer available';
    if (it.qty < q) throw `${it.title}: only ${it.qty} left`;
    return { productId: id, title: it.title, categoryId: it.catId || null, quantity: q, unitPrice: it.price };
  });
  const total = lines.reduce((a, l) => a + l.quantity * l.unitPrice, 0), c = cust || { creditLimit: 0, creditUsed: 0 };
  if (method === 'credit') { const av = (c.creditLimit || 0) - (c.creditUsed || 0); if (total > av) throw `Credit limit exceeded. ${money(av)} available, order is ${money(total)}`; }
  const stamp = Date.now(), id = 'O' + stamp, now = new Date().toISOString();
  const order = { id, customerId: u.id, customerName: c.name || u.name, email: u.email, orderDate: now, items: lines, totalAmount: total, paymentMethod: method, status: 'Completed' };
  const upd = { ['orders/' + id]: order, ['sales/S' + stamp]: { id: 'S' + stamp, orderId: id, customerId: u.id, saleDate: now, items: lines, totalAmount: total, paymentMethod: method } };
  lines.forEach(l => upd[`inventory/${l.productId}/qty`] = fresh[l.productId].qty - l.quantity);
  if (method === 'credit') upd[`customers/${u.id}/creditUsed`] = (c.creditUsed || 0) + total;
  await API.patch('', upd);                         // one atomic commit: order + sale + stock + credit
  try { await sendMail(u.email, `Your ORBIT bill #${id}`, billText(fromDb({ ...order }, 'orders'))); } catch (e) { console.warn('Bill mail skipped', e); }
  Cart.clear(); location.href = 'orders.html?placed=' + id;
}

View.orders = async () => {
  const u = requireCustomer(); if (!u) return;
  title('Your orders', 'Track your purchases and view bills.');
  const os = (await API.where('orders', 'customerId', u.id)).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  window._orders = os;
  root.html(os.length ? os.map(o => `<article class="panel order"><div class="row between"><b>Order ${esc(o.id)}</b><span class="sm muted">${fdate(o.date)}</span></div>
    <p class="items">${o.items.map(x => `${esc(x.title)} × ${x.qty}`).join(' · ')}</p>
    <div class="row between"><span><span class="badge ${o.payment === 'credit' ? 'yel' : ''}">${esc(o.payment)}</span> <span class="badge green">${esc(o.status || 'Completed')}</span></span>
      <span class="row"><b>${money(o.total)}</b><button class="btn small" data-bill="${esc(o.id)}">View bill</button></span></div></article>`).join('') :
    '<div class="empty"><div class="big">No orders yet</div><p class="muted">When you place an order it will show up here.</p><a class="btn gold mt" href="index.html">Start shopping</a></div>');
  const placed = new URLSearchParams(location.search).get('placed'), o = os.find(x => x.id === placed);
  if (o) { showBill(o, true); history.replaceState(null, '', 'orders.html'); }
};

View.account = async () => {
  const u = requireCustomer(); if (!u) return;
  title('Your account');
  const [c, mails] = await Promise.all([API.get('customers/' + u.id), API.where('mails', 'to', u.email).catch(() => [])]);
  const lim = c?.creditLimit || 0, used = c?.creditUsed || 0, pct = lim ? Math.min(100, used / lim * 100) : 0;
  const ms = mails.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  root.html(`<div class="two"><section class="panel"><h3>Profile</h3><p class="mt"><b>${esc(c?.name || u.name)}</b></p><p class="muted">${esc(u.email)}</p><p class="muted">Mobile: ${esc(c?.mob || c?.mobile || 'Not added')}</p>
      <div class="row mt"><a class="btn ghost" href="orders.html">Your orders</a><button class="btn ghost" id="signout">Sign out</button></div></section>
    <section class="panel"><h3>Credit overview</h3><div class="meter"><i style="width:${pct}%"></i></div>
      <div class="row between sm"><span>Used ${money(used)}</span><span>Limit ${money(lim)}</span></div><p class="mt"><b>${money(lim - used)}</b> <span class="muted">available</span></p>
      <p class="sm muted mt">Need a higher limit? Ask an ORBIT administrator.</p></section></div>
    <section class="panel mt"><h3>Mailbox</h3>${ms.length ? ms.map(m => `<div class="mail"><b>${esc(m.subject)}</b><br><span class="sm muted">${fdate(m.date)}</span><p class="sm mt" style="white-space:pre-line">${esc(m.body)}</p></div>`).join('') : '<p class="muted">No messages yet.</p>'}</section>`);
};

View.categories = async () => {
  title('Shop by category', 'Pick a category to browse the collection.');
  const { items, cats } = await loadCatalog(), act = cats.filter(c => c.active !== false);
  root.html(act.length ? `<div class="grid">${act.map(c => { const n = items.filter(i => i.active !== false && i.catId === c.id).length;
    return `<a class="cat-card" href="index.html?cat=${encodeURIComponent(c.id)}"><h2>${esc(c.name)}</h2><span class="muted">${n} item${n === 1 ? '' : 's'}</span><span>Explore →</span></a>`; }).join('')}</div>` : '<div class="empty"><div class="big">No categories yet</div></div>');
};

View.product = async () => {
  const id = new URLSearchParams(location.search).get('id');
  const [i, cats] = await Promise.all([id ? API.get('products/' + id) : null, API.list('categories')]);
  if (!i || i.active === false) { title('Product not found'); return root.html('<div class="empty"><div class="big">We couldn’t find that product</div><a class="btn gold mt" href="index.html">Back to the shop</a></div>'); }
  i.resolvedImageUrl = await resolveStorageImage(i); document.title = `${i.title} · ORBIT`;
  const cname = (cats.find(c => c.id === i.catId) || {}).name || 'ORBIT collection', out = i.qty < 1;
  $('#page-head').html(`<div class="crumbs"><a href="index.html">Shop</a> › <a href="index.html?cat=${encodeURIComponent(i.catId || '')}">${esc(cname)}</a></div>`);
  root.html(`<div class="product"><div class="pic"><img src="${esc(productPhoto(i))}" alt="${pname(i)}"></div>
    <div><span class="badge">${esc(cname)}</span><h1>${pname(i)}</h1><div class="price">${money(i.price)}</div>
      <div class="stock ${out ? 'out' : i.qty < 15 ? 'low' : 'ok'}">${out ? 'Out of stock' : i.qty < 15 ? `Only ${i.qty} left in stock` : 'In stock'}</div>
      <p class="muted">${esc(i.des || '')}</p><p class="sm muted mt">Item ${esc(i.id)}</p>
      ${out ? '' : `<div class="buy mt" data-id="${esc(i.id)}">${stepperFor(i.id, 1, i.qty)}<button class="btn add" id="add-product">Add to cart</button><button class="btn orange" id="buy-now">Buy now</button></div>`}</div></div>`);
  window._product = i;
};

/* ---------- events ---------- */
$(document).on('click', '.step button', function () {
  const st = $(this).parent(), id = String(st.data('id')), max = +st.data('max'), v = Math.max(1, Math.min(max, +st.find('.n').text() + +$(this).data('d')));
  if (st.closest('.line').length) { const c = Cart.get(); c[id] = v; Cart.set(c); renderCartView(); } else st.find('.n').text(v);
});
$(document).on('click', '[data-remove]', function () { const c = Cart.get(); delete c[$(this).data('remove')]; Cart.set(c); renderCartView(); });
$(document).on('click', '#add-product', function () { const i = window._product, q = +$('.step .n').text(); if (!Cart.add(i.id, q, i.qty)) return toast(`Only ${i.qty} in stock — cart updated`, 'err'); toast('Added to cart'); });
$(document).on('click', '#buy-now', function () { const i = window._product, q = +$('.step .n').text(), c = Cart.get(); c[i.id] = Math.min(i.qty, (c[i.id] || 0) + q); Cart.set(c); location.href = 'checkout.html'; });
$(document).on('click', '#place', function () { run(this, placeOrder); });
$(document).on('click', '#signout', () => { Auth.out(); location.href = 'index.html'; });
$(document).on('click', '[data-bill]', function () { showBill(window._orders.find(o => o.id === $(this).data('bill'))); });

(async function () {
  await Auth.restore(); paintAcct(); Cart.paint();
  root.html('<div class="sk"></div>');
  try { await View[window.ORBIT_PAGE](); } catch (e) { console.error(e); root.html(`<div class="empty"><div class="big">Unable to load this page</div><p class="muted mt">${esc(errMsg(e))}</p></div>`); }
})();
