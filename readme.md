🩸 Blood Donation Backend API

Production-ready REST API for a Blood Donation Management System built with Node.js, Express, MongoDB, JWT, and Stripe.

🚀 Tech Stack

Node.js + Express

MongoDB (Native Driver)

JWT Authentication

Stripe Payment Intent

dotenv, CORS

⚙️ Environment Variables
PORT=5000
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
STRIPE_SECRET_KEY=your_stripe_secret
CLIENT_URL=https://your-frontend-url

▶️ Run Locally
npm install
npm start


Server runs at:

http://localhost:5000

🔐 Authentication

All protected routes require:

Authorization: Bearer <JWT>

📌 API Endpoints
Auth

POST /jwt → Generate JWT

Users

POST /users → Register user

GET /users → All users (Admin)

GET /users/profile → Logged-in user

PUT /users/profile → Update profile

PATCH /users/role/:id → Change role (Admin)

PATCH /users/status/:id → Block / Unblock (Admin)

Donation Requests

POST /donation-requests → Create request

GET /donation-requests/public → Public pending requests

GET /donation-requests → All requests (Admin / Volunteer)

GET /donation-requests/my → My requests

GET /donation-requests/:id → Single request

PUT /donation-requests/:id → Update request

PATCH /donation-requests/status/:id → Update status

DELETE /donation-requests/:id → Delete request

Funding (Stripe)

POST /create-payment-intent → Stripe payment intent

POST /funds → Save successful fund

GET /funds → All funds (Admin / Volunteer)

GET /funds/total → Total fund amount

👥 Roles

Donor → Manage own requests

Volunteer → Manage requests & funds

Admin → Full access

✅ Status

✔ Secure JWT
✔ Role-based access
✔ Stripe integrated
✔ Production ready

Author: Jahan Ebna Delower
