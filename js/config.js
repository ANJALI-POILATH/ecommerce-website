// ORBIT public Firebase web configuration. Do not put service-account secrets here.
const CONFIG = {
  PROJECT_ID: 'ecommerce-website-16a79',
  API_KEY: 'AIzaSyDOgss7O3-ZgCiBjusoZWFZJOtARvx57ZQ',
  STORAGE_BUCKET: 'ecommerce-website-16a79.firebasestorage.app',
  // Only verified administrator UIDs belong here. Add the second admin UID
  // after checking it in Firebase Console → Authentication → Users.
  ADMIN_UIDS: ['D1KXTtvfbRcN1YZz4DDT1h2pHYh2'],
  // Reserved addresses cannot be registered as ordinary customer accounts.
  ADMIN_EMAILS: ['admin@orbit.com', 'admin2@orbit.com'],
  DEFAULT_CREDIT: 0,
  MAX_CREDIT: 1000,
  STORE_PAGE_SIZE: 8,
  ADMIN_PAGE_SIZE: 8,
  EMAILJS: { serviceId: '', templateId: '', publicKey: '' }
};
CONFIG.FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${CONFIG.PROJECT_ID}/databases/(default)/documents`;
