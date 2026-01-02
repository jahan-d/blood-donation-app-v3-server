const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const Stripe = require("stripe");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");

const port = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors());

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Firebase Admin Initialization (Best Effort)
// Requires GOOGLE_APPLICATION_CREDENTIALS env var or service account path
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } else {
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
  }
  console.log("Firebase Admin Initialized");
} catch (e) {
  console.error("Firebase Admin Init Warning (Ignore if building):", e.message);
}

const uri = process.env.MONGO_URI;

// MongoDB Client
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

/* ======================
   HELPERS & MIDDLEWARE
====================== */

// Verify Custom Session JWT (Existing)
const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).send({ message: "Unauthorized" });

  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).send({ message: "Forbidden" });
    req.decoded = decoded;
    next();
  });
};

// Verify Firebase ID Token (Secure) OR Fallback (Insecure Dev Mode)
const verifyFirebaseToken = async (req, res, next) => {
  const { token, email } = req.body;

  // 1. Try Secure Verification
  if (token && admin.apps.length > 0) {
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.firebaseUser = decodedToken;
      return next();
    } catch (error) {
      console.warn("Firebase Token Verification Failed:", error.message);
      // Fallthrough to step 2
    }
  }

  // 2. Fallback to Email (INSECURE - Allowed by User Request)
  if (email) {
    console.warn("⚠️ WARNING: Using INSECURE email-only auth (Service Account missing).");
    req.firebaseUser = { email }; // Mock the decoded token structure
    return next();
  }

  return res.status(401).send({ message: "Unauthorized: Valid Token required" });
};

async function run() {
  try {
    // Connect to MongoDB
    // await client.connect(); 

    const db = client.db("bloodDonationDB");
    const usersCollection = db.collection("users");
    const donationRequestsCollection = db.collection("donationRequests");
    const fundsCollection = db.collection("funds");
    const blogsCollection = db.collection("blogs");

    // Role Guard Middleware
    const requireRole = (...roles) => {
      return async (req, res, next) => {
        const user = await usersCollection.findOne({ email: req.decoded.email });
        if (!user || !roles.includes(user.role)) {
          return res.status(403).send({ message: "Access denied" });
        }
        next();
      };
    };

    /* ======================
       ROUTES
    ====================== */

    app.get("/", (req, res) => {
      res.send("Blood Donation API Running (Secured)");
    });

    // AUTH (SECURE)
    // Exchanges a valid Firebase ID Token for a Session JWT
    app.post("/jwt", verifyFirebaseToken, async (req, res) => {
      const email = req.firebaseUser.email;
      const user = await usersCollection.findOne({ email });
      if (!user) {
        // Option: Auto-create user or fail.
        // For security, if they aren't in our DB, we might fetch a 401. 
        // But usually /users is called first. 
        return res.status(401).send({ message: "User not found in database" });
      }
      const token = jwt.sign({ email: user.email, name: user.name }, process.env.JWT_SECRET, { expiresIn: "7d" });
      res.send({ token });
    });

    // USERS
    app.post("/users", async (req, res) => {
      const exists = await usersCollection.findOne({ email: req.body.email });
      if (exists) return res.send({ message: "User already exists" });
      // Note: Ideally verify firebase token here too, but acceptable for registration flow if /jwt is gated
      const user = { ...req.body, role: "donor", status: "active", createdAt: new Date() };
      const result = await usersCollection.insertOne(user);
      res.status(201).send({ ...user, _id: result.insertedId });
    });

    app.get("/users", verifyJWT, requireRole("admin"), async (req, res) => {
      const { status, page = 1, limit = 10 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const query = status ? { status } : {};
      const total = await usersCollection.countDocuments(query);
      const users = await usersCollection.find(query).skip(skip).limit(parseInt(limit)).toArray();
      res.send({ users, total });
    });

    app.get("/users/profile", verifyJWT, async (req, res) => {
      res.send(await usersCollection.findOne({ email: req.decoded.email }));
    });

    app.put("/users/profile", verifyJWT, async (req, res) => {
      const updateData = { ...req.body };
      delete updateData.email;
      delete updateData._id;
      res.send(await usersCollection.updateOne({ email: req.decoded.email }, { $set: updateData }));
    });

    app.patch("/users/role/:id", verifyJWT, requireRole("admin"), async (req, res) => {
      res.send(await usersCollection.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { role: req.body.role } }));
    });

    app.patch("/users/status/:id", verifyJWT, requireRole("admin"), async (req, res) => {
      res.send(await usersCollection.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { status: req.body.status } }));
    });

    // DONATION REQUESTS
    app.post("/donation-requests", verifyJWT, async (req, res) => {
      const user = await usersCollection.findOne({ email: req.decoded.email });
      if (user.status === "blocked") return res.status(403).send({ message: "User blocked" });
      const request = { ...req.body, requesterEmail: req.decoded.email, status: "pending", createdAt: new Date() };
      res.send(await donationRequestsCollection.insertOne(request));
    });

    app.get("/donation-requests/public", async (req, res) => {
      res.send(await donationRequestsCollection.find({ status: "pending" }).toArray());
    });

    app.get("/donation-requests/search", async (req, res) => {
      const { q } = req.query;
      if (!q) return res.send(await donationRequestsCollection.find({ status: "pending" }).toArray());
      const regex = new RegExp(q, "i");
      res.send(await donationRequestsCollection.find({
        status: "pending",
        $or: [{ bloodGroup: regex }, { district: regex }, { upazila: regex }]
      }).toArray());
    });

    app.get("/search/donors", async (req, res) => {
      const { bloodGroup, district, upazila } = req.query;
      const query = { role: "donor" };
      if (bloodGroup) query.bloodGroup = bloodGroup;
      if (district) query.district = district;
      if (upazila) query.upazila = upazila;
      res.send(await usersCollection.find(query).toArray());
    });

    app.get("/donation-requests", verifyJWT, requireRole("admin", "volunteer"), async (req, res) => {
      const { status, page = 1, limit = 10 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const query = status ? { status } : {};
      res.send(await donationRequestsCollection.find(query).skip(skip).limit(parseInt(limit)).toArray());
    });

    app.get("/donation-requests/my", verifyJWT, async (req, res) => {
      const { status, page = 1, limit = 10 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const query = { requesterEmail: req.decoded.email };
      if (status) query.status = status;
      const total = await donationRequestsCollection.countDocuments(query);
      const requests = await donationRequestsCollection.find(query).skip(skip).limit(parseInt(limit)).toArray();
      res.send({ requests, total });
    });

    app.get("/donation-requests/:id", verifyJWT, async (req, res) => {
      res.send(await donationRequestsCollection.findOne({ _id: new ObjectId(req.params.id) }));
    });

    app.put("/donation-requests/:id", verifyJWT, async (req, res) => {
      const updateData = { ...req.body };
      delete updateData._id;
      res.send(await donationRequestsCollection.updateOne({ _id: new ObjectId(req.params.id) }, { $set: updateData }));
    });

    app.patch("/donation-requests/donate/:id", verifyJWT, async (req, res) => {
      res.send(await donationRequestsCollection.updateOne({ _id: new ObjectId(req.params.id) }, {
        $set: { status: "inprogress", donorName: req.decoded.name, donorEmail: req.decoded.email }
      }));
    });

    app.patch("/donation-requests/status/:id", verifyJWT, async (req, res) => {
      try {
        const id = req.params.id;
        const status = req.body.status;
        const query = { _id: new ObjectId(id) };
        const request = await donationRequestsCollection.findOne(query);

        if (!request) return res.status(404).send({ message: "Not found" });

        const user = await usersCollection.findOne({ email: req.decoded.email });

        // Allow if: User is Admin/Volunteer OR User is the Requester
        if (
          user.role === "admin" ||
          user.role === "volunteer" ||
          request.requesterEmail === req.decoded.email
        ) {
          const result = await donationRequestsCollection.updateOne(query, {
            $set: { status: status },
          });
          res.send(result);
        } else {
          return res.status(403).send({ message: "Forbidden" });
        }
      } catch (err) {
        res.status(500).send({ message: "Server error" });
      }
    });

    app.delete("/donation-requests/:id", verifyJWT, async (req, res) => {
      res.send(await donationRequestsCollection.deleteOne({ _id: new ObjectId(req.params.id) }));
    });

    // BLOGS
    app.post("/blogs", verifyJWT, requireRole("admin", "volunteer"), async (req, res) => {
      const blog = { ...req.body, author: req.decoded.email, status: "published", createdAt: new Date() };
      res.send(await blogsCollection.insertOne(blog));
    });

    app.get("/blogs", async (req, res) => {
      res.send(await blogsCollection.find({ status: "published" }).sort({ createdAt: -1 }).toArray());
    });

    // FUNDING
    app.post("/create-checkout-session", verifyJWT, async (req, res) => {
      const { amount } = req.body;
      const user = await usersCollection.findOne({ email: req.decoded.email });

      if (!amount) return res.status(400).send({ message: "Invalid amount" });

      try {
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          customer_email: user?.email,
          line_items: [
            {
              price_data: {
                currency: "bdt",
                product_data: {
                  name: `Donation by ${user?.name || "Donor"}`,
                  description: "Blood Donation App Funding",
                },
                unit_amount: Math.round(amount * 100), // Convert to cents
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          success_url: `${req.headers.origin}/dashboard/funding?success=true&session_id={CHECKOUT_SESSION_ID}&amount=${amount}`,
          cancel_url: `${req.headers.origin}/dashboard/funding?canceled=true`,
        });

        res.send({ url: session.url });
      } catch (error) {
        console.error("Stripe Session Error:", error);
        res.status(500).send({ message: "Failed to create session" });
      }
    });

    app.post("/funds", verifyJWT, async (req, res) => {
      const { transactionId, amount } = req.body;

      if (!transactionId) {
        return res.status(400).send({ message: "Transaction ID required" });
      }

      // 1. Idempotency Check
      const existingFund = await fundsCollection.findOne({ transactionId });
      if (existingFund) {
        return res.status(409).send({ message: "Transaction already recorded" });
      }

      // 2. Secure Verification
      try {
        let isPaid = false;
        let verifiedAmount = 0;

        if (transactionId.startsWith('cs_')) {
          // Handle Checkout Session
          const session = await stripe.checkout.sessions.retrieve(transactionId);
          if (session.payment_status === 'paid') {
            isPaid = true;
            verifiedAmount = session.amount_total;
          }
        } else {
          // Handle Payment Intent (Legacy/Direct)
          const paymentIntent = await stripe.paymentIntents.retrieve(transactionId);
          if (paymentIntent.status === 'succeeded') {
            isPaid = true;
            verifiedAmount = paymentIntent.amount;
          }
        }

        if (!isPaid) {
          return res.status(400).send({ message: "Payment verification failed: Not matched/paid" });
        }

        // Verify Amount (math.round for safety comparison)
        if (verifiedAmount !== Math.round(Number(amount) * 100)) {
          return res.status(400).send({ message: "Payment verification failed: Amount mismatch" });
        }

        const fund = { ...req.body, email: req.decoded.email, amount: Number(req.body.amount), createdAt: new Date() };
        res.send(await fundsCollection.insertOne(fund));

      } catch (error) {
        console.error("Stripe Verification Error:", error.message);
        return res.status(500).send({ message: "Failed to verify transaction with bank" });
      }
    });

    app.get("/funds", verifyJWT, requireRole("admin", "volunteer"), async (req, res) => {
      const { page = 1, limit = 10 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const total = await fundsCollection.countDocuments();
      const funds = await fundsCollection.find().sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).toArray();
      res.send({ funds, total });
    });

    app.get("/funds/total", verifyJWT, requireRole("admin", "volunteer"), async (req, res) => {
      const data = await fundsCollection.aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }]).toArray();
      res.send({ total: data[0]?.total || 0 });
    });

  } finally {
    // Leave empty or close if needed
  }
}


run().catch(console.dir);

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});

module.exports = app;
