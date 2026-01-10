# Blood Donation App v3 — Backend API

**Production-ready REST API for the Blood Donation Management System** — built with Node.js, Express, MongoDB, JWT authentication, and Stripe payments.

This API supports the full functionality of the platform including user management, donation requests, role-based access, and secure payment handling.

---

## 🚀 Live Demo
**Base URL:** [https://blooddonationapp.vercel.app](https://blooddonationapp.vercel.app)

---

## 🛠️ Tech Stack

- **Node.js** – Backend runtime
- **Express.js** – Fast web framework
- **MongoDB** – Database for data storage
- **JWT** – Secure role-based authentication
- **Stripe** – Payment processing
- **Firebase Admin SDK** – Server-side verification

---

## 📌 Key Features

- **Role-Based Authentication** – Secure login with JWT tokens
- **User Profiles** – Register, update profiles, and retrieve logged-in user data
- **Donation Requests** – Create, view, update, and manage donation requests
- **Funding Module** – Stripe payment intent endpoints for donations
- **Role Permissions** – Separate access levels for Donor, Volunteer, and Admin

---

## 📦 API Endpoints

### 🔐 Authentication
- **POST /jwt** – Generate JWT for authenticated users
- **POST /logout** – Clear session cookie

### 👤 Users
- **POST /users** – Register a new user
- **GET /users** – List all users (Admin only)
- **GET /users/profile** – Get profile info (Authenticated)
- **PATCH /users/role/:id** – Change user role (Admin)
- **PATCH /users/status/:id** – Block/Unblock user (Admin)

### 🩹 Donation Requests
- **POST /donation-requests** – Create a donation request
- **GET /donation-requests/public** – Get all public pending requests
- **GET /donation-requests** – Get all requests (Admin/Volunteer)
- **GET /donation-requests/:id** – Single request details
- **DELETE /donation-requests/:id** – Delete request

### 💳 Funding & Stripe
- **POST /create-payment-intent** – Create a Stripe payment intent
- **POST /funds** – Save transaction details

---

## 📁 Environment Variables

Create a `.env` file in the root directory:

```env
PORT=5000
MONGO_URI=<YOUR_MONGO_URI>
JWT_SECRET=<YOUR_JWT_SECRET>
STRIPE_SECRET_KEY=<YOUR_STRIPE_SECRET_KEY>
NODE_ENV=development
```

---

## 🛠 Running Locally

1. **Clone the repo**
   ```bash
   git clone https://github.com/jahan-d/blood-donation-app-v3-server.git
   cd blood-donation-app-v3-server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the server**
   ```bash
   npm run dev
   ```

4. **API runs at:** `http://localhost:5000`

---

## 📝 Author

**Jahan**
- Portfolio: [jahan-d.web.app](https://jahan-d.web.app)
- GitHub: [@jahan-d](https://github.com/jahan-d)
