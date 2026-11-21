/* ORBIT sign-in / create account / password assistance — Amazon-style flow */
const $form = $('#auth-form'), $alt = $('#auth-alt-wrap');
$('#authLogo').html(`${LOGO_SVG}<span>ORBIT</span>`);
const nextUrl = (() => { const n = new URLSearchParams(location.search).get('next') || ''; return /^[a-z]+\.html(\?[\w=&%.-]*)?$/i.test(n) ? n : ''; })();
const home = u => u.role === 'admin' ? 'admin.html' : (nextUrl || 'index.html');
const altBlock = (text, label, tab) => `<div class="auth-divider"><span>${text}</span></div><button class="btn ghost auth-alt" data-tab="${tab}">${label}</button><div class="auth-spacer"></div>`;

function authView(tab) {
  document.title = ({ signin: 'Sign in', signup: 'Create account', forgot: 'Password assistance' })[tab] + ' · ORBIT';
  if (tab === 'signin') {
    $form.html(`<h1>Sign in</h1><p class="lead">Welcome back to ORBIT.</p><div id="msg"></div>
      <form id="signin-form" novalidate><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="username" required>
      <div class="lab-row"><label for="password">Password</label><a href="#" data-tab="forgot">Forgot password?</a></div>
      <input id="password" name="password" type="password" autocomplete="current-password" required>
      <button class="btn gold auth-submit">Sign in</button></form>
      <p class="auth-legal">By continuing, you agree to ORBIT’s terms of use. Secure account access powered by Firebase.</p>`);
    $alt.html(altBlock('New to ORBIT?', 'Create your ORBIT account', 'signup'));
  }
  if (tab === 'signup') {
    $form.html(`<h1>Create account</h1><div id="msg"></div>
      <form id="signup-form" novalidate><label for="name">Your name</label><input id="name" name="name" autocomplete="name" placeholder="First and last name" required>
      <label for="mob">Mobile number</label><input id="mob" name="mob" inputmode="numeric" maxlength="14" autocomplete="tel-national" placeholder="10-digit mobile number" required>
      <label for="email">Email</label><input id="email" name="email" type="email" autocomplete="username" required>
      <label for="pass">Password</label><input id="pass" name="pass" type="password" autocomplete="new-password" placeholder="At least 6 characters" required>
      <div class="hint">Passwords must be at least 6 characters.</div>
      <label for="pass2">Re-enter password</label><input id="pass2" name="pass2" type="password" autocomplete="new-password" required>
      <button class="btn gold auth-submit">Create your ORBIT account</button></form>
      <p class="auth-legal">By creating an account, you agree to ORBIT’s terms of use.</p>`);
    $alt.html(altBlock('Already have an account?', 'Sign in', 'signin'));
  }
  if (tab === 'forgot') {
    $form.html(`<h1>Password assistance</h1><p class="lead">Enter the email address associated with your ORBIT account.</p><div id="msg"></div>
      <form id="forgot-form" novalidate><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="username" required>
      <button class="btn gold auth-submit">Continue</button></form>`);
    $alt.html(altBlock('Remembered it?', 'Back to sign in', 'signin'));
  }
  $form.find('input:first').trigger('focus');
}
const showMsg = m => $('#msg').html(m ? `<div class="alert" role="alert">${esc(m)}</div>` : '');
const submitWith = (form, fn) => run('.auth-submit', async () => { showMsg(''); try { await fn(Object.fromEntries(new FormData(form))); } catch (e) { showMsg(errMsg(e)); } });

$(document).on('click', '[data-tab]', function (e) { e.preventDefault(); authView($(this).data('tab')); });
$(document).on('submit', '#signin-form', function (e) { e.preventDefault(); submitWith(this, async f => {
  if (!V.email(f.email.trim())) throw 'Enter a valid email address.'; if (!f.password) throw 'Enter your password.';
  location.href = home(await Auth.signin(f.email, f.password)); }); });
$(document).on('input', '#mob', function () { this.value = this.value.replace(/[^0-9+\s-]/g, '').slice(0, 14); });
$(document).on('submit', '#signup-form', function (e) { e.preventDefault(); submitWith(this, async f => {
  if (f.pass !== f.pass2) throw 'Passwords do not match.';
  f.mob = String(f.mob || '').trim().replace(/\D/g, ''); if (f.mob.startsWith('91') && f.mob.length === 12) f.mob = f.mob.slice(2); if (f.mob.startsWith('0') && f.mob.length === 11) f.mob = f.mob.slice(1);
  await Auth.signup({ name: f.name, email: f.email, mob: f.mob, pass: f.pass }); location.href = nextUrl || 'index.html'; }); });
$(document).on('submit', '#forgot-form', function (e) { e.preventDefault(); submitWith(this, async f => {
  await Auth.requestReset(f.email);
  $form.html(`<h1>Check your email</h1><p class="lead mt">If an account exists for <b>${esc(f.email)}</b>, we’ve sent a link to reset your password.</p>`); $alt.html(altBlock('Done?', 'Back to sign in', 'signin')); }); });

Auth.restore().then(u => { if (u) location.href = home(u); }).catch(() => {});
authView(location.hash === '#signup' ? 'signup' : 'signin');
