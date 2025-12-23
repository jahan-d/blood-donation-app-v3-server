const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB setup
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

// JWT verification middleware
const verifyJWT = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).send({ message: "Unauthorized" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.decoded = decoded;
    next();
  } catch (err) {
    res.status(403).send({ message: "Forbidden" });
  }
};

// Role verification middleware
const verifyRole = (usersCollection, ...roles) => async (req, res, next) => {
  try {
    const user = await usersCollection.findOne({ email: req.decoded.email });
    if (!user || !roles.includes(user.role)) return res.status(403).send({ message: "Access denied" });
    next();
  } catch (err) {
    res.status(500).send({ message: "Server error" });
  }
};

async function run() {
  try {
    await client.connect();
    const db = client.db("bloodDonationDB");
    const usersCollection = db.collection("users");
    const requestsCollection = db.collection("donationRequests");
    const fundsCollection = db.collection("funds");
    const blogsCollection = db.collection("blogs");

    app.get("/", (req, res) => res.send("Blood Donation API Running"));

    // AUTH: generate JWT
    app.post("/jwt", async (req, res) => {
      try {
        const user = await usersCollection.findOne({ email: req.body.email });
        if (!user) return res.status(401).send({ message: "Unauthorized" });
        const token = jwt.sign({ email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
        res.send({ token });
      } catch (err) {
        res.status(500).send({ message: "Server error" });
      }
    });

    // USERS
    app.post("/users", async (req, res) => {
      try {
        const exists = await usersCollection.findOne({ email: req.body.email });
        if (exists) return res.send({ message: "User already exists" });
        const user = { ...req.body, role: "donor", status: "active", createdAt: new Date() };
        const result = await usersCollection.insertOne(user);
        res.status(201).send({ ...user, _id: result.insertedId });
      } catch (err) {
        res.status(500).send({ message: "Server error" });
      }
    });

    app.get("/users", verifyJWT, verifyRole(usersCollection, "admin"), async (req, res) => {
      try {
        const { status, page = 1, limit = 10 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const query = status ? { status } : {};
        const total = await usersCollection.countDocuments(query);
        const users = await usersCollection.find(query).skip(skip).limit(parseInt(limit)).toArray();
        res.send({ users, total });
      } catch (err) {
        res.status(500).send({ message: "Server error" });
      }
    });

    // DONATION REQUESTS
    app.post("/donation-requests", verifyJWT, async (req, res) => {
      try {
        const user = await usersCollection.findOne({ email: req.decoded.email });
        if (user.status === "blocked") return res.status(403).send({ message: "User blocked" });
        const request = { ...req.body, requesterEmail: req.decoded.email, status: "pending", createdAt: new Date() };
        const result = await requestsCollection.insertOne(request);
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: "Server error" });
      }
    });

    app.get("/donation-requests/public", async (req, res) => {
      try {
        const requests = await requestsCollection.find({ status: "pending" }).toArray();
        res.send(requests);
      } catch (err) {
        res.status(500).send({ message: "Server error" });
      }
    });

    // FUNDING
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      try {
        const { amount } = req.body;
        if (!amount) return res.status(400).send({ message: "Invalid amount" });
        const pi = await stripe.paymentIntents.create({
          amount: amount * 100,
          currency: "bdt",
          payment_method_types: ["card"],
        });
        res.send({ clientSecret: pi.client_secret });
      } catch (err) {
        res.status(500).send({ message: "Stripe error" });
      }
    });

    app.post("/funds", verifyJWT, async (req, res) => {
      try {
        const fund = { ...req.body, email: req.decoded.email, amount: Number(req.body.amount), createdAt: new Date() };
        const result = await fundsCollection.insertOne(fund);
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: "Server error" });
      }
    });

    app.get("/funds", verifyJWT, verifyRole(usersCollection, "admin", "volunteer"), async (req, res) => {
      try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await fundsCollection.countDocuments();
        const funds = await fundsCollection.find().sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).toArray();
        res.send({ funds, total });
      } catch (err) {
        res.status(500).send({ message: "Server error" });
      }
    });

    // BLOGS
    app.post("/blogs", verifyJWT, verifyRole(usersCollection, "admin", "volunteer"), async (req, res) => {
      try {
        const blog = { ...req.body, author: req.decoded.email, status: "published", createdAt: new Date() };
        const result = await blogsCollection.insertOne(blog);
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: "Server error" });
      }
    });

    app.get("/blogs", async (req, res) => {
      try {
        const blogs = await blogsCollection.find({ status: "published" }).sort({ createdAt: -1 }).toArray();
        res.send(blogs);
      } catch (err) {
        res.status(500).send({ message: "Server error" });
      }
    });

    app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
  } finally {
    // client.close(); // optional
  }
}

run().catch(console.dir);
