# ORBIT — Online Shopping

**Everything revolving around your needs.** ORBIT is a responsive customer storefront and admin console with a galaxy-inspired visual theme. It follows the assignment client requirements (HTML, CSS, JavaScript, jQuery for UI and Axios for HTTP/API requests) and connects to Firebase through REST APIs only. No Firebase SDK is used.

## Technology used
- HTML5, CSS3, JavaScript
- jQuery: DOM/events and UI interactions (not used for HTTP calls)
- **Axios: all HTTP requests** (Firestore REST, Firebase Authentication REST, Firebase Storage REST, optional EmailJS)
- Firebase Authentication REST API
- Cloud Firestore REST API
- Firebase Storage REST API for uploaded product images
- Node.js: **not used to run the app or as a backend**. This is a static browser application; Live Server serves the files. Axios is loaded as a browser library from CDN.

## Features
- Customer sign up/sign in/password reset
- Search, category filtering, sorting and pagination
- Product images from the Firestore product document only (no stock/demo photos fetched from image websites)
- Image URL, Firebase Storage path, upload image, or no image (null)
- Cart, Cash/Credit checkout, order history, bill, credit overview
- Admin product CRUD, categories, customer credit limit management, orders and reports
- Amazon-style sign-in / create-account / password-assistance flow (`auth.html`)
- Unified galaxy theme (dark + light) in one stylesheet, `css/orbit.css`

## Setup Firebase
Project ID already configured: `ecommerce-website-16a79`.

1. Firebase Console → Project settings → General → Web app. Copy the Web API key into `js/config.js` as `API_KEY`. This key is a public client identifier, not a server secret; configure Firebase API-key restrictions where appropriate. Do not add service-account credentials or private keys to this frontend.
2. Authentication → Sign-in method → enable Email/Password.
3. Create the two real admin accounts in Firebase Authentication. Admin access is routed only using `ADMIN_UIDS` in `js/config.js`. Add the second administrator UID only after verifying it in Firebase Console. The email allow-list is used only to reserve those addresses from customer signup; it does not grant administrator permissions. No role field is required in customer documents.
4. Firestore: the app expects the `(default)` database and collections `categories`, `products`, `customers`, `carts`, `orders`, `sales`, `mails`, `settings`. Publish the included `firestore.rules` (admin emails are already set to the two in `js/config.js`). Review rules before publishing; they are part of security enforcement.
5. Firebase Storage: create/enable Storage and copy the bucket name into `STORAGE_BUCKET` in `js/config.js`. Review and publish `storage.rules`. Product image reads are public; create/update/delete operations are restricted to the administrator UID allow-list. The included rules currently contain the one confirmed UID supplied in the project handover. Verify the second administrator UID in Firebase Console → Authentication → Users, then add it to `ADMIN_UIDS` in `js/config.js` and to both rules files before expecting that second account to have admin permissions.

Make sure `API_KEY` and `STORAGE_BUCKET` in `js/config.js` match your Firebase project, and that Email/Password sign-in is enabled and the rules are published; otherwise sign-in and checkout will be refused.

## Run
1. Extract the ZIP and open the `ORBIT` folder in VS Code.
2. Use VS Code Live Server on `index.html` (or serve the folder with any static HTTP server). Do not open `file://` directly.
3. Internet access is required for the Axios and jQuery CDN scripts and Firebase REST endpoints.

No `npm install`, `npm run`, or Node.js runtime is required.

## Test accounts
There is **no** local/demo login: every sign-in is a real Firebase Authentication account. Create them in Firebase Console → Authentication → Users:
- Admin: `admin@orbit.com` and `admin2@orbit.com` (any password you choose). These emails are the admin allow-list in `js/config.js`, `firestore.rules` and `storage.rules` — keep the three lists identical.
- Customer: register from `auth.html` → **Create your ORBIT account**; the customer record is created in Firestore automatically.

Admin routing in the browser is only a convenience. Real protection comes from the Firestore/Storage rules.

## Product image fields in Firestore
Product records use these fields:
- `imageUrl` (string or null): URL used by the storefront for an externally hosted image or Firebase Storage download URL.
- `imagePath` (string or null): Firebase Storage object path, e.g. `products/prod001/mouse.jpg`.

Examples:

**External URL**
```json
{ "imageUrl": "https://your-site/image.jpg", "imagePath": null }
```

**Uploaded file** (both values stored)
```json
{ "imageUrl": "https://firebasestorage.googleapis.com/...", "imagePath": "products/prod001/mouse.jpg" }
```

**Storage path only**
```json
{ "imageUrl": null, "imagePath": "products/prod001/mouse.jpg" }
```

**No image**
```json
{ "imageUrl": null, "imagePath": null }
```

In the Admin item form, choose an image from your computer and preview it before saving. The browser uploads it to `products/<product-id>/...` in Firebase Storage using the signed-in Firebase ID token. The returned download URL and object path are saved in the matching Firestore `products` document. JPG, PNG, WebP and GIF are accepted up to 5 MB. When editing, leaving the file input unchanged keeps the current image; selecting a replacement uploads the new file, saves its URL/path to Firestore, and then attempts to delete the old object. Deleting a product also attempts to delete its Storage image. If cleanup fails, the product/database change remains saved and the orphaned file must be cleaned up separately. Product cards/details/cart thumbnails use the stored database image fields; when no valid image exists, they display the local ORBIT placeholder asset.

## Field mapping
| Collection | Fields used |
|---|---|
| `categories` | `name`, `active` |
| `products` | `categoryId` (or legacy `catId`), `title`, `description` (or legacy `des`), `quantity` (or legacy `qty`), `price`, `active`, `imageUrl`, `imagePath` |
| `customers` | `name`, `email`, `mobile`, `creditLimit`, `creditUsed` |
| `orders` | `customerId`, `customerName`, `email`, `orderDate`, `items`, `totalAmount`, `paymentMethod` |
| `sales` | `orderId`, `customerId`, `saleDate`, `items`, `totalAmount`, `paymentMethod` |
| `mails` | `to`, `from`, `subject`, `body`, `date`, `read` |

## Email
Password reset uses Firebase Auth. In-app messages are written to Firestore `mails`. Optional real email delivery can be configured via EmailJS values in `js/config.js`.

## Security / production note
This is a browser REST-client assignment/demo. Client-side demo accounts are inspectable, and a browser cannot keep secrets. Do not put service-account credentials, private keys or privileged secrets here. For production, enforce permissions with security rules and move sensitive checkout/credit/stock operations to a trusted backend.

## Pages
- `index.html` — storefront and product discovery
- `auth.html` — customer sign-in, sign-up and forgot password
- `categories.html` — category discovery
- `product.html?id=PRODUCT_ID` — product detail
- `cart.html` — shopping bag
- `checkout.html` — cash/credit checkout
- `orders.html` — customer order history
- `account.html` — customer account and credit overview
- `admin.html` — administrator dashboard, inventory, customers, orders and reports

## Folder structure
```
ORBIT/
├── index.html
├── admin.html
├── auth.html
├── cart.html
├── checkout.html
├── orders.html
├── account.html
├── categories.html
├── product.html
├── css/orbit.css
├── js/config.js
├── js/common.js
├── js/store.js
├── js/admin.js
├── js/auth-page.js
├── js/pages.js
├── assets/orbit-hero.svg
├── assets/product-placeholder.svg
├── firestore.rules
├── storage.rules
└── README.md
```

## Checkout write model
Checkout commits one atomic Firestore batch: the order, the sale, each product's new `quantity`, and (for credit) the customer's `creditUsed`. Product and customer updates use **field masks**, so only `quantity` / `creditUsed` are sent — this is what lets the rules allow customers to change nothing else.
