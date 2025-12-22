const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const Stripe = require("stripe");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const port = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors());

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

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
   HELPERS
====================== */
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

async function run() {
  try {
    // Connect to MongoDB
    await client.connect();

    const db = client.db("bloodDonationDB");
    const usersCollection = db.collection("users");
    const donationRequestsCollection = db.collection("donationRequests");
    const fundsCollection = db.collection("funds");
    const blogsCollection = db.collection("blogs");

    // Role Guard Middleware (Must be inside run to access usersCollection)
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

    // AUTH
    app.post("/jwt", async (req, res) => {
      const user = await usersCollection.findOne({ email: req.body.email });
      if (!user) return res.status(401).send({ message: "Unauthorized" });
      const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, { expiresIn: "7d" });
      res.send({ token });
    });

    // USERS
    app.post("/users", async (req, res) => {
      const exists = await usersCollection.findOne({ email: req.body.email });
      if (exists) return res.send({ message: "User already exists" });
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

    app.patch("/donation-requests/status/:id", verifyJWT, requireRole("admin", "volunteer"), async (req, res) => {
      res.send(await donationRequestsCollection.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { status: req.body.status } }));
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
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { amount } = req.body;
      if (!amount) return res.status(400).send({ message: "Invalid amount" });
      const pi = await stripe.paymentIntents.create({ amount: amount * 100, currency: "bdt", payment_method_types: ["card"] });
      res.send({ clientSecret: pi.client_secret });
    });

    app.post("/funds", verifyJWT, async (req, res) => {
      const fund = { ...req.body, email: req.decoded.email, amount: Number(req.body.amount), createdAt: new Date() };
      res.send(await fundsCollection.insertOne(fund));
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

app.get("/", (req, res) => {
  res.send("Blood Donation API Running");
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});

module.exports = app;
