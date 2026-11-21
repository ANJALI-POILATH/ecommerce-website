/* ===== Admin console ===== */
const D = { cats: [], items: [], custs: [], orders: [] };
const cname = id => (D.cats.find(c => c.id === id) || { name: '—' }).name;
const cicon = () => '';
async function loadAll() {
  const [cats, items, custs, orders] = await Promise.all(['categories', 'products', 'customers', 'orders'].map(p => API.list(p)));
  Object.assign(D, { cats, items, custs, orders: orders.sort((a, b) => String(b.date||'').localeCompare(String(a.date||''))) }); await Promise.all(D.items.map(async item => { item.resolvedImageUrl = await resolveStorageImage(item); }));
}
const $v = $('#view');
const table = (head, rows, cls = '') => `<div class="tbl"><table class="t ${cls}"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.join('') : `<tr><td colspan="${head.length}" style="text-align:center;padding:30px">Nothing to show yet</td></tr>`}</tbody></table></div>`;
const pager = (page, pages) => pages < 2 ? '' : `<div class="pager">${Array.from({ length: pages }, (_, i) => `<button class="${i + 1 === page ? 'on' : ''}" data-act="page" data-p="${i + 1}">${i + 1}</button>`).join('')}</div>`;
const fld = (l, n, v = '', extra = '') => `<div><label>${l}</label><input name="${n}" value="${esc(v)}" ${extra}></div>`;
const frm = () => Object.fromEntries($('#modal form').serializeArray().map(x => [x.name, x.value.trim()]));

/* ---------- gate ---------- */
function guard() {
  const u = Auth.user();
  const ok = !!(u && u.role === 'admin'); $('#gate').toggleClass('show', !ok); $('body').toggleClass('locked', !ok); if (ok) go(location.hash.slice(1) || 'dashboard');
}
$('#gateLogo,#sideLogo').html(`${LOGO_SVG}<span>ORBIT</span>`);
$('#gateForm').on('submit', function (e) { e.preventDefault(); $('#gmsg').html(''); run('#alogin', async () => { try { const u = await Auth.signin($('#ae').val(), $('#ap').val()); if (u.role !== 'admin') { Auth.out(); throw 'This is not an administrator account.'; } guard(); } catch (err) { $('#gmsg').html(`<div class="alert" role="alert">${esc(errMsg(err))}</div>`); } }); });
$('#logout').on('click', () => { Auth.out(); location.reload(); });
$('.side').on('click', 'a[data-v]', function (e) { e.preventDefault(); go($(this).data('v')); });
function go(v) {
  if (!Views[v]) v = 'dashboard'; location.hash = v;
  $('.side a').removeClass('on').filter(`[data-v=${v}]`).addClass('on');
  $v.html('<div class="sk"></div>');
  loadAll().then(() => Views[v]()).catch(e => $v.html(`<div class="empty"><div class="big">Connection issue</div><h3>Couldn't load data</h3><p>${esc(errMsg(e))}</p></div>`));
}
const Views = {};

/* ---------- dashboard ---------- */
Views.dashboard = () => {
  const rev = D.orders.reduce((a, o) => a + o.total, 0), low = D.items.filter(i => i.qty < 15);
  const byCat = {}; D.orders.forEach(o => o.items.forEach(l => byCat[l.catId] = (byCat[l.catId] || 0) + l.qty * l.price));
  const max = Math.max(1, ...Object.values(byCat));
  $v.html(`<h2>Welcome to ORBIT</h2>
  <div class="kpis"><div class="kpi">Revenue<b>${money(rev)}</b></div><div class="kpi">Orders<b>${D.orders.length}</b></div><div class="kpi">Customers<b>${D.custs.length}</b></div><div class="kpi">Low stock<b>${low.length}</b></div></div>
  <div class="two"><div class="panel"><h3>Sales by category</h3>${D.cats.map(c => `<div class="bar"><span>${cicon(c.id)} ${esc(c.name)}</span><i style="width:${(byCat[c.id] || 0) / max * 100}%"></i><b>${money(byCat[c.id] || 0)}</b></div>`).join('')}</div>
  <div class="panel"><h3>Running low (&lt; 15)</h3>${low.length ? low.map(i => `<div class="row between mt"><span>${cicon(i.catId)} ${esc(i.title)}</span><span class="badge red">${i.qty} left</span></div>`).join('') : '<p class="mt">All stocked up</p>'}</div></div>
  <h3 class="mt" style="margin-top:26px">Latest orders</h3><div class="mt">${table(['Order', 'Customer', 'Date', 'Pay', 'Total'], D.orders.slice(0, 5).map(o => `<tr><td>${o.id}</td><td>${esc(o.custName)}</td><td>${fdate(o.date)}</td><td><span class="badge ${o.payment === 'credit' ? 'yel' : ''}">${o.payment}</span></td><td>${money(o.total)}</td></tr>`))}</div>`);
};

/* ---------- inventory CRUD ---------- */
const INV = { cat: 'all', q: '', st: 'all', page: 1 };
Views.inventory = () => {
  const q = INV.q.toLowerCase(), PS = CONFIG.ADMIN_PAGE_SIZE;
  const r = D.items.filter(i => (INV.cat === 'all' || i.catId === INV.cat) && (INV.st === 'all' || (INV.st === 'on') === (i.active !== false)) && (!q || (i.id + ' ' + i.title).toLowerCase().includes(q)));
  const pages = Math.max(1, Math.ceil(r.length / PS)); INV.page = Math.min(INV.page, pages);
  const keep = $('#fq').is(':focus');
  $v.html(`<div class="row between"><h2>Inventory</h2><button class="btn pink" data-act="new-item">＋ New item</button></div>
  <div class="filters"><input id="fq" data-f="q" placeholder="Find by ID or title…" value="${esc(INV.q)}">
  <select data-f="cat"><option value="all">All categories</option>${D.cats.map(c => `<option value="${c.id}" ${INV.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
  <select data-f="st">${[['all', 'Active + inactive'], ['on', 'Active only'], ['off', 'Inactive only']].map(([v, l]) => `<option value="${v}" ${INV.st === v ? 'selected' : ''}>${l}</option>`).join('')}</select><span class="muted">${r.length} items</span></div>
  ${table(['ID', 'Item', 'Category', 'Qty', 'Price', 'Status', 'Actions'], r.slice((INV.page - 1) * PS, INV.page * PS).map(i => `<tr class="${i.active === false ? 'off' : ''}" data-id="${i.id}">
    <td><b>${i.id}</b></td><td><b>${esc(i.title)}</b><br><span class="sm muted">${esc(i.des)}</span></td><td>${cicon(i.catId)} ${esc(cname(i.catId))}</td>
    <td><span class="badge ${i.qty < 15 ? 'red' : i.qty > 100 ? 'grey' : ''}">${i.qty}</span></td><td style="white-space:nowrap">${money(i.price)}</td><td>${i.active === false ? '<span class="badge grey">Inactive</span>' : '<span class="badge">Active</span>'}</td>
    <td><div class="acts"><button class="btn small cyan" data-act="edit-item">Edit</button><button class="btn small ghost" data-act="toggle-item">${i.active === false ? 'Activate' : 'Deactivate'}</button><button class="btn small danger" data-act="del-item">Delete</button></div></td></tr>`))}
  ${pager(INV.page, pages)}`);
  if (keep) { const e = $('#fq')[0]; e.focus(); e.setSelectionRange(e.value.length, e.value.length); }
};
function itemForm(i) {
  const n = !i;
  i = i || { id: nextId('i', D.items), catId: D.cats[0]?.id, title: '', des: '', qty: 0, price: 0, imageUrl: null, imagePath: null };
  const currentImage = i.resolvedImageUrl || i.imageUrl || (i.imagePath ? 'assets/product-placeholder.svg' : '');
  Modal.open(`<h2>${n ? 'New item' : 'Edit ' + i.id}</h2><form autocomplete="off">
    <div class="grid2">${fld('Item ID', 'id', i.id, 'disabled')}<div><label>Category</label><select name="catId">${D.cats.map(c => `<option value="${c.id}" ${c.id === i.catId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div></div>
    ${fld('Title', 'title', i.title)}<label>Description</label><textarea name="des" rows="2">${esc(i.des)}</textarea>
    <div class="grid2">${fld('Quantity', 'qty', i.qty, 'type="number" min="0"')}${fld('Price (₹)', 'price', i.price, 'type="number" min="1" step="0.01"')}</div>
    <label class="mt" for="productImage">Product image</label>
    <input id="productImage" type="file" accept="image/jpeg,image/png,image/webp,image/gif">
    <p class="sm muted">Select a JPG, PNG, WebP or GIF image (maximum 5 MB). The file is uploaded to the private-write Firebase Storage area. Leave it unchanged to keep the current image.</p>
    <div id="productImagePreviewWrap" class="mt" ${currentImage ? '' : 'hidden'}>
      <img id="productImagePreview" src="${esc(currentImage || 'assets/product-placeholder.svg')}" alt="Product image preview" style="width:100%;max-height:190px;object-fit:contain;border-radius:12px">
      <p id="productImagePreviewLabel" class="sm muted mt">${currentImage ? 'Current product image' : 'Selected image preview'}</p>
    </div>
  </form>
  <div class="row end mt"><button type="button" class="btn ghost" id="cancelItem">Cancel</button><button type="button" class="btn pink" id="save">${n ? 'Create item' : 'Save changes'}</button></div>`);
  $('#cancelItem').on('click', () => Modal.close());
  $('#productImage').on('change', function () {
    const file = this.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type) || file.size > 5 * 1024 * 1024 || file.size === 0) {
      this.value = '';
      toast('Choose a JPG, PNG, WebP or GIF image up to 5 MB.', 'err');
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    $('#productImagePreview').attr('src', previewUrl);
    $('#productImagePreviewLabel').text('New image selected — it will upload when you save.');
    $('#productImagePreviewWrap').prop('hidden', false);
  });
  $('#save').on('click', function () { run(this, async () => {
    const f = frm();
    const o = {
      id: i.id, catId: f.catId, title: f.title, des: f.des,
      qty: parseInt(f.qty, 10), price: parseFloat(f.price),
      active: i.active !== false,
      imageUrl: i.imageUrl || null,
      imagePath: i.imagePath || null
    };
    if (o.title.length < 2) throw 'Title is required';
    if (!(o.qty >= 0) || !(o.price > 0)) throw 'Quantity must be 0 or more and price above 0';

    const imageFile = $('#productImage')[0]?.files?.[0];
    let uploaded = null;
    if (imageFile) {
      uploaded = await uploadProductImage(imageFile, o.id);
      o.imageUrl = uploaded.imageUrl;
      o.imagePath = uploaded.imagePath;
    }

    // Save the product record first. Only after Firestore succeeds do we remove
    // the previous Storage object, so a failed database save never loses its image.
    try {
      await API.put('inventory/' + o.id, o);
    } catch (saveError) {
      // Avoid leaving an unreferenced new upload if the Firestore write fails.
      if (uploaded?.imagePath) {
        try { await deleteProductImage(uploaded.imagePath); }
        catch (cleanupError) { console.warn('Could not clean up image after Firestore save failed:', cleanupError); }
      }
      throw saveError;
    }
    if (uploaded && i.imagePath && i.imagePath !== uploaded.imagePath) {
      try { await deleteProductImage(i.imagePath); }
      catch (error) { console.warn('New image saved, but old image cleanup failed:', error); toast('Product saved. The previous image could not be removed from Storage.', 'err'); }
    }
    Modal.close();
    toast(n ? 'Item created' : 'Item updated');
    go('inventory');
  }); });
}

/* ---------- categories CRUD ---------- */
Views.categories = () => {
  $v.html(`<div class="row between"><h2>Categories</h2><button class="btn pink" data-act="new-cat">＋ New category</button></div>
  ${table(['ID', 'Name', 'Items', 'Actions'], D.cats.map(c => `<tr data-id="${c.id}"><td><b>${c.id}</b></td><td>${esc(c.name)}</td><td>${D.items.filter(i => i.catId === c.id).length}</td>
  <td><div class="acts"><button class="btn small cyan" data-act="edit-cat">Edit</button><button class="btn small danger" data-act="del-cat">Delete</button></div></td></tr>`))}`);
};
function catForm(c) {
  const n = !c; c = c || { id: nextId('c', D.cats), name: '' };
  Modal.open(`<h2>${n ? 'New category' : 'Edit ' + c.id}</h2><form autocomplete="off">${fld('ID', 'id', c.id, 'disabled')}${fld('Name', 'name', c.name)}</form>
  <div class="row end mt"><button class="btn ghost" onclick="Modal.close()">Cancel</button><button class="btn pink" id="save">Save</button></div>`, 'sm');
  $('#save').on('click', function () { run(this, async () => { const f = frm(); if (f.name.length < 2) throw 'Name is required';
    await API.put('categories/' + c.id, { id: c.id, name: f.name }); Modal.close(); toast('Category saved'); go('categories'); }); });
}

/* ---------- customers + credit limit CRUD ---------- */
Views.customers = () => {
  $v.html(`<div class="row between"><h2>Customers &amp; credit limits</h2><span class="sm muted">Customers register from the storefront; manage their credit limits here.</span></div>
  ${table(['ID', 'Name', 'E-mail', 'Mobile', 'Credit limit', 'Used', 'Available', 'Actions'], D.custs.map(c => `<tr data-id="${c.id}"><td><b>${c.id}</b></td><td>${esc(c.name)}</td><td>${esc(c.email)}</td><td>${esc(c.mob)}</td>
  <td><b>${money(c.creditLimit)}</b></td><td>${money(c.creditUsed)}</td><td>${money((c.creditLimit || 0) - (c.creditUsed || 0))}</td>
  <td><button class="btn small cyan" data-act="edit-cust">Update credit</button></td></tr>`))}`);
};
function custForm(c) {
  Modal.open(`<h2>Update customer credit</h2><p class="sm muted">${esc(c.name)} · ${esc(c.email)}</p><form autocomplete="off">${fld('Credit limit (₹)', 'creditLimit', c.creditLimit, `type="number" min="0" max="${CONFIG.MAX_CREDIT}"`)}</form>
  <div class="row end mt"><button class="btn ghost" onclick="Modal.close()">Cancel</button><button class="btn pink" id="save">Save credit limit</button></div>`, 'sm');
  $('#save').on('click', function () { run(this, async () => { const lim = parseFloat(frm().creditLimit); if (!(lim >= 0) || lim > CONFIG.MAX_CREDIT) throw `Credit limit must be between ₹0 and ${money(CONFIG.MAX_CREDIT)}`;
    await API.patch('customers/' + c.id, { creditLimit: lim }); Modal.close(); toast('Credit limit updated'); go('customers'); }); });
}

/* ---------- orders (history) ---------- */
Views.orders = () => {
  $v.html(`<h2>Order history</h2>${table(['Order', 'Date', 'Customer', 'Items', 'Pay', 'Total'], D.orders.map(o => `<tr><td><b>${o.id}</b></td><td>${fdate(o.date)}</td><td>${esc(o.custName)}</td>
  <td class="sm">${o.items.map(l => `${esc(l.title)} ×${l.qty}`).join('<br>')}</td><td><span class="badge ${o.payment === 'credit' ? 'yel' : ''}">${o.payment}</span></td><td><b>${money(o.total)}</b></td></tr>`))}`);
};

/* ---------- reports ---------- */
const day = d => d.toISOString().slice(0, 10);
const R = { key: 'cust-all', from: day(new Date(Date.now() - 90 * 864e5)), to: day(new Date()), out: null };
const inR = o => String(o.date||'').slice(0, 10) >= R.from && String(o.date||'').slice(0, 10) <= R.to;
const lines = os => os.flatMap(o => o.items.map(l => ({ ...l, o })));
const orderRows = os => ({ head: ['Order', 'Date', 'Customer', 'Payment', 'Total'], rows: os.map(o => [o.id, fdate(o.date), o.custName, o.payment, money(o.total)]), foot: `${os.length} orders · ${money(os.reduce((a, o) => a + o.total, 0))}` });
const itemSales = () => { const m = {}; D.items.forEach(i => m[i.id] = { id: i.id, title: i.title, cat: cname(i.catId), qty: 0, amt: 0 });
  lines(D.orders.filter(inR)).forEach(l => { if (m[l.itemId]) { m[l.itemId].qty += l.qty; m[l.itemId].amt += l.qty * l.price; } }); return Object.values(m); };
const REPORTS = {
  'Customer reports': {
    'cust-all': ['All customers (all columns)', 0, () => ({ head: ['ID', 'Name', 'E-mail', 'Mobile', 'Credit limit', 'Credit used', 'Orders', 'Total spent'],
      rows: D.custs.map(c => { const os = D.orders.filter(o => o.custId === c.id); return [c.id, c.name, c.email, c.mob, money(c.creditLimit), money(c.creditUsed), os.length, money(os.reduce((a, o) => a + o.total, 0))]; }) })],
    'cust-top': ['Top 10 customers', 1, () => { const m = {}; D.orders.filter(inR).forEach(o => { m[o.custId] = m[o.custId] || { n: o.custName, c: 0, t: 0 }; m[o.custId].c++; m[o.custId].t += o.total; });
      return { head: ['Rank', 'Customer', 'Orders', 'Total spent'], rows: Object.values(m).sort((a, b) => b.t - a.t).slice(0, 10).map((x, i) => [i + 1, x.n, x.c, money(x.t)]) }; }],
    'cust-cash': ['Cash purchases', 1, () => orderRows(D.orders.filter(o => inR(o) && o.payment === 'cash'))],
    'cust-credit': ['Credit purchases', 1, () => orderRows(D.orders.filter(o => inR(o) && o.payment === 'credit'))]
  },
  'Inventory reports': {
    'inv-all': ['Current stock (all)', 0, () => ({ head: ['ID', 'Item', 'Category', 'Qty', 'Price', 'Stock value'], rows: D.items.map(i => [i.id, i.title, cname(i.catId), i.qty, money(i.price), money(i.qty * i.price)]) })],
    'inv-cat': ['Stock by category', 0, () => ({ head: ['Category', 'Items', 'Units', 'Stock value'], rows: D.cats.map(c => { const l = D.items.filter(i => i.catId === c.id); return [c.name, l.length, l.reduce((a, i) => a + i.qty, 0), money(l.reduce((a, i) => a + i.qty * i.price, 0))]; }) })],
    'inv-hl': ['High stock (> 100) / Low stock (< 15)', 0, () => ({ head: ['ID', 'Item', 'Category', 'Qty', 'Level'],
      rows: D.items.filter(i => i.qty > 100 || i.qty < 15).sort((a, b) => a.qty - b.qty).map(i => [i.id, i.title, cname(i.catId), i.qty, i.qty < 15 ? '🔻 Low' : '🔺 High']) })]
  },
  'Sales reports': {
    'sales-all': ['All sales', 1, () => orderRows(D.orders.filter(inR))],
    'sales-cat': ['Category-wise sales', 1, () => { const m = {}; lines(D.orders.filter(inR)).forEach(l => { const k = cname(l.catId); m[k] = m[k] || [0, 0]; m[k][0] += l.qty; m[k][1] += l.qty * l.price; });
      return { head: ['Category', 'Units sold', 'Revenue'], rows: Object.entries(m).sort((a, b) => b[1][1] - a[1][1]).map(([k, v]) => [k, v[0], money(v[1])]) }; }],
    'sales-cash': ['Cash sales', 1, () => orderRows(D.orders.filter(o => inR(o) && o.payment === 'cash'))],
    'sales-credit': ['Credit sales', 1, () => orderRows(D.orders.filter(o => inR(o) && o.payment === 'credit'))],
    'sales-top': ['Top 10 selling items', 1, () => ({ head: ['Rank', 'Item', 'Category', 'Units', 'Revenue'], rows: itemSales().sort((a, b) => b.qty - a.qty).slice(0, 10).map((x, i) => [i + 1, x.title, x.cat, x.qty, money(x.amt)]) })],
    'sales-bottom': ['Bottom 10 selling items', 1, () => ({ head: ['Rank', 'Item', 'Category', 'Units', 'Revenue'], rows: itemSales().sort((a, b) => a.qty - b.qty).slice(0, 10).map((x, i) => [i + 1, x.title, x.cat, x.qty, money(x.amt)]) })]
  }
};
const repDef = k => Object.values(REPORTS).map(g => g[k]).find(Boolean);
Views.reports = () => {
  $v.html(`<h2>Reports</h2><div class="filters"><select id="rk">${Object.entries(REPORTS).map(([g, r]) => `<optgroup label="${g}">${Object.entries(r).map(([k, d]) => `<option value="${k}" ${R.key === k ? 'selected' : ''}>${d[0]}</option>`).join('')}</optgroup>`).join('')}</select>
  <span id="dates" class="row">From <input type="date" id="rf" value="${R.from}"> to <input type="date" id="rt" value="${R.to}"></span>
  <button class="btn pink" data-act="run-report">Run report</button><button class="btn ghost" data-act="csv">⬇ CSV</button></div><div id="rout"></div>`);
  $('#dates').toggle(!!repDef(R.key)[1]); runReport();
};
function runReport() {
  R.key = $('#rk').val(); R.from = $('#rf').val(); R.to = $('#rt').val(); $('#dates').toggle(!!repDef(R.key)[1]);
  const d = repDef(R.key); R.out = d[2]();
  $('#rout').html(`<h3 class="mt">${d[0]}</h3><p class="sm muted">${d[1] ? `${R.from} to ${R.to}` : 'Live snapshot'}</p><div class="mt">${table(R.out.head, R.out.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`))}</div>${R.out.foot ? `<p class="mt"><b>${R.out.foot}</b></p>` : ''}`);
}
function exportCsv() {
  const rows = [R.out.head, ...R.out.rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + rows], { type: 'text/csv' })); a.download = R.key + '.csv'; a.click();
}

/* ---------- delegated actions ---------- */
$v.on('click', '[data-act]', function () {
  const a = $(this).data('act'), id = $(this).closest('[data-id]').data('id');
  const item = D.items.find(x => x.id === id), cat = D.cats.find(x => x.id === id), cu = D.custs.find(x => x.id === id);
  if (a === 'page') { INV.page = +$(this).data('p'); Views.inventory(); }
  else if (a === 'new-item') itemForm(); else if (a === 'edit-item') itemForm(item);
  else if (a === 'toggle-item') run(this, async () => { await API.patch('inventory/' + id, { active: item.active === false }); toast(item.active === false ? 'Item activated' : 'Item deactivated'); go('inventory'); });
  else if (a === 'del-item') Modal.confirm(`“${esc(item.title)}” will be removed permanently. Its stored product image will also be deleted.`, async () => {
    await API.del('inventory/' + id);
    if (item.imagePath) {
      try { await deleteProductImage(item.imagePath); }
      catch (error) { console.warn('Product deleted, but its Storage image could not be removed:', error); toast('Product deleted. Its image could not be removed from Storage.', 'err'); }
    }
    toast('Item deleted'); go('inventory');
  });
  else if (a === 'new-cat') catForm(); else if (a === 'edit-cat') catForm(cat);
  else if (a === 'del-cat') { if (D.items.some(i => i.catId === id)) return toast('Move or delete this category’s items first', 'err');
    Modal.confirm(`Category “${esc(cat.name)}” will be deleted.`, async () => { await API.del('categories/' + id); toast('Category deleted'); go('categories'); }); }
  else if (a === 'edit-cust') custForm(cu);
  else if (a === 'run-report') runReport(); else if (a === 'csv') exportCsv();
});
$v.on('input change', '[data-f]', function () { INV[$(this).data('f')] = this.value; INV.page = 1; Views.inventory(); });
$v.on('change', '#rk', runReport);
Auth.restore().then(guard).catch(guard);
