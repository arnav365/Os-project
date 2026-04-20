# Secure Authentication Framework Architecture

A robust, full-stack Secure Authentication Framework built for a college-level Operating Systems / Security project. It demonstrates how to establish secure session management, implement Multi-Factor Authentication (MFA), and defend against common network and injection attacks.

## Architecture Diagram

```text
+---------------------+
|   Client Device     |
| (Web Browser/CLI)   |
|                     |
|  - HTML/CSS/JS UI   |
|  - Base64 JWTs      |
|  - Auto-Logoff      |
+----------+----------+
           | 
           | HTTPS/HTTP (Port 5000)
           v 
+---------------------------------------+
|          Node.js / Express Server     |
|                                       |
|  [Security Middlewares Layer]         |
|   - express-rate-limit  (Brute Force) |
|   - helmet              (XSS/Headers) |
|   - express-mongo-sanitize (NoSQL)    |
|   - xss-clean           (XSS payload) |
|                                       |
|  [Router & Controllers Layer]         |
|   - authRoutes.js   -> MFA/Logins     |
|   - systemRoutes.js -> Admin Data     |
|                                       |
|  [Business Logic Layer]               |
|   - JWT Token Generation              |
|   - Bcrypt Password Hashing           |
|   - OTP (Crypto) / TOTP (Speakeasy)   |
+-------------------+-------------------+
                    |
                    | (Mongoose ORM)
                    v
+---------------------------------------+
|           MongoDB Database            |
|                                       |
|  - Users Collection                   |
|    * password (hashed/salted)         |
|    * mfaSecret / mfaOtp / expire      |
|    * role (admin/user)                |
+---------------------------------------+
```

## Security Features Matrix

This system has been constructed with extensive, real-world defensive methodologies to mitigate Top OWASP vulnerabilities.

| Attack Vector | Defensive Mechanism Implemented | Verification / How it Works |
|---------------|--------------------------------|-----------------------------|
| **Brute Force / Credential Stuffing** | `express-rate-limit` | The server limits authentication attempts to 10 requests per 10 minutes per IP. Any further attempts return a `429 Too Many Requests` error. |
| **NoSQL / SQL Injection** | `express-mongo-sanitize` | Strips out operators like `$gt`, `$set` from requests, preventing attackers from bypassing auth queries (e.g., `{"email": {"$gt": ""}}`). |
| **Cross-Site Scripting (XSS)** | `xss-clean` & `helmet` | HTTP headers are hardened, and request payloads (body/query variables) are sanitized to prevent script injection strings triggering on the frontend UI. |
| **Session Hijacking / Replay** | JWT Expiration & Auto-Logout | Short-lived JSON Web Tokens limit damage if intercepted. Additionally, the dashboard strictly monitors inactivity (Idle for 5 minutes) and forcefully terminates the session in the client device. |
| **Credential Theft / Data Breach** | `bcrypt` Hashing & Salt | Even if the database is exposed, passwords cannot be recovered because they are uniquely salted and stretched. |
| **Phishing / Compromised Password** | Multi-Factor Authentication (OTP) | Mandatory MFA enforces a second layer of security via Email OTP or Google Authenticator TOTP before a JWT is issued. |

## Steps to Run Locally

### 1. Prerequisites
- **Node.js**: v16+
- **Database**: A locally running MongoDB instance OR a MongoDB Atlas cluster URI.

### 2. Installation
Clone the repository and install all required Node modules.

```bash
git clone <repository_url>
cd os-auth-framework
npm install
```

### 3. Environment Variables
Create a `.env` file in the root directory (you can copy `.env.example` if it exists).
Provide the following configurations:

```env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/os_auth_db
JWT_SECRET=super_secret_jwt_key_that_is_very_long
JWT_EXPIRE=30d
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_EMAIL=your_smtp_username
SMTP_PASSWORD=your_smtp_password
FROM_EMAIL=noreply@antigravityos.local
FROM_NAME="AntigravityOS Security Node"
```

### 4. Running the Server
```bash
# Standard execution
npm start

# Development mode (with nodemon)
npm run dev
```

### 5. Accessing the Application
Open a web browser and navigate to:
```
http://localhost:5000
```
- Create an account utilizing the Register form.
- The system will ask for a One-Time Password during your first login attempt. Check your command-line logs or Mailtrap inbox (based on your `.env` settings) to retrieve the OTP.
- Enter it in the UI to access the main OS Dashboard.

## Steps to Deploy (Production)

To deploy this application to a cloud provider like **Render**, **Heroku**, or **DigitalOcean App Platform**:

1. **Database Setup**: Create a persistent MongoDB Database using **MongoDB Atlas**. Whitelist the IP address `0.0.0.0/0` so your cloud provider can access it.
2. **Environment Variables**: In your cloud provider's Dashboard, insert all the keys from your `.env` file into the Environment Variables section. **CRITICAL:** Use a complex, randomly generated 64-character string for `JWT_SECRET`.
3. **Deployment Command**: Ensure your provider uses `npm install` for the build step, and `npm start` (or `node server.js`) for the start command.
4. **Proxy Trust**: If you deploy behind a proxy (like NGINX or Heroku's routers), you must add `app.set('trust proxy', 1);` to `server.js` for the `express-rate-limit` to accurately track client IP addresses instead of the load balancer's IP. 
5. **HTTPS**: Ensure your cloud provider provisions an SSL/TLS certificate to encrypt traffic in transit. Our frontend relies on Authorization Headers which should never be transmitted over plain HTTP.
