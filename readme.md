# Blood Donation Backend API

**Production-ready REST API for the Blood Donation Management System** — built with Node.js, Express, MongoDB, JWT authentication, and Stripe payments.

This API supports the full functionality of a blood donation platform including user management, donation requests, role-based access, and secure payment handling.

---

## 🚀 Live Demo (Frontend)
https://blooddonationapp.vercel.app

---

## 🛠️ Tech Stack

- **Node.js** – Backend runtime  
- **Express.js** – Fast web framework  
- **MongoDB** – Database for data storage  
- **JWT** – Secure role-based authentication  
- **Stripe** – Payment processing  
- **dotenv** – Environment configuration  
- **CORS** – Cross-origin handling

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

### 👤 Users
- **POST /users** – Register a new user
- **GET /users** – List all users (Admin only)
- **GET /users/profile** – Get profile info (Authenticated)
- **PUT /users/profile** – Update user profile
- **PATCH /users/role/:id** – Change user role (Admin)
- **PATCH /users/status/:id** – Block/Unblock user (Admin)

### 🩹 Donation Requests
- **POST /donation-requests** – Create a donation request
- **GET /donation-requests/public** – Get all public pending requests
- **GET /donation-requests** – Get all requests (Admin/Volunteer)
- **GET /donation-requests/my** – Get my requests
- **GET /donation-requests/:id** – Single request
- **PUT /donation-requests/:id** – Update request
- **PATCH /donation-requests/status/:id** – Update request status
- **DELETE /donation-requests/:id** – Delete request

### 💳 Funding & Stripe
- **POST /create-payment-intent** – Create a Stripe payment intent
- **POST /funds** – Save successful fund
- **GET /funds** – List all funds (Admin / Volunteer)
- **GET /funds/total** – Total funded amount

---

## 📁 Environment Variables

Before running locally, create a `.env` file:

PORT=5000
MONGO_URI=your_mongo_database_uri
JWT_SECRET=your_jwt_secret
STRIPE_SECRET_KEY=your_stripe_secret
CLIENT_URL=https://your-frontend-url

yaml
Copy code

---

## 🛠 Running Locally

1. Clone the repo
git clone https://github.com/jahan-d/blood-donation-app-v3-server

markdown
Copy code

2. Install dependencies
npm install

markdown
Copy code

3. Run the server
npm start

markdown
Copy code

4. API runs at:
http://localhost:5000

yaml
Copy code

---

## 📌 What This API Powers

This backend serves as the core of a full-stack Blood Donation platform where:
- Users can **search donors**
- Donors can **submit requests**
- Admins can **manage users and requests**
- Volunteers can **assist with operations**
- Donations are processed via **Stripe**

---

## 🧠 Key Highlights

- Secure JWT-based access control  
- Role hierarchy (Donor / Volunteer / Admin)  
- Complete donation request lifecycle  
- Stripe integration for real donations  
- Designed for production deployment

---

## 🔗 Related Frontend Repo

Frontend: https://github.com/jahan-d/blood-donation-app-v3-client

---

## 📝 Author

**Jahan Ebna Delower**  
MERN Stack Developer  
Portfolio: https://jahan-d.web.app  
GitHub: https://github.com/jahan-d
