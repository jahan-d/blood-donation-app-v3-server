# 🩸 Blood Donation Application — Server

Backend REST API for the **Blood Donation Platform**, built with Node.js, Express, and MongoDB.

## 🚀 Overview

This is the **backend (server-side)** of the Blood Donation Application.
It provides secure RESTful APIs for authentication, donor search, donation requests, payments, and administrative operations.

The server is designed with scalability, security, and clean separation of concerns in mind.

## ✨ Features

- 🔐 **Secure Authentication**: Firebase ID Token verification with JWT session management.
- 🛡️ **Role-Based Authorization**: Middleware guards for Admin, Volunteer, and Donor roles.
- 📍 **Donor Search**: Filter donors by Blood Group, District, and Upazila.
- 🩸 **Management APIs**: CRUD operations for Donation Requests and Blogs.
- 💳 **Stripe Payments**: Secure Checkout Sessions with Idempotency and Webhook-style verification.
- 🧩 **RESTful Architecture**: Clean endpoint structure.

## 🛠 Tech Stack

- **Node.js**
- **Express.js**
- **MongoDB** (Native Driver)
- **Firebase Admin SDK**
- **Stripe SDK**
- **JWT** (JSON Web Tokens)

## 📂 Project Structure

```
server/
├── index.js (or server.js)  # Main entry point
├── .env                     # Configuration
└── README.md
```

## 🔐 Environment Variables

Create a `.env` file in the server directory:

```env
PORT=5000
MONGO_URI=mongodb+srv://...
STRIPE_SECRET_KEY=sk_test_...
JWT_SECRET=your_jwt_secret_key
# Optional: For secure firebase-admin (Recommended for Production)
FIREBASE_SERVICE_ACCOUNT={"type": "service_account", ...}
```

## ▶️ Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Run Development Server**
   ```bash
   npm start
   ```

## 🔄 API Responsibilities

- Handle authentication & authorization.
- Validate incoming requests.
- Perform database operations.
- Process payments securely.
- Serve data to the frontend.

## 👨‍💻 Author

**Jahan Ebna Delower**
*Frontend / Full Stack Web Developer*

- 🌐 [Portfolio](https://jahan-d.web.app)
- 💻 [GitHub](https://github.com/jahan-d)
