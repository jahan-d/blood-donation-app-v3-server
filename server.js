require("dotenv").config();

const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const Stripe = require("stripe");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const port = process.env.PORT || 5000;

/* ======================
   ENV CHECK
====================== */
if (!process.env.MONGO_URI || !process.env.JWT_SECRET || !process.env.STRIPE_SECRET_KEY) {
  console.error("❌ Missing environment variables");
  process.exit(1);
}

/* ======================
   MIDDLEWARE
====================== */
app.use(
  cors({
    origin: [process.env.CLIENT_URL, "http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());

/* ======================
   STRIPE
====================== */
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

/* ======================
   MONGODB
====================== */
const client = new MongoClient(process.env.MONGO_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let usersCollection;
let donationRequestsCollection;
let fundsCollection;

/* ======================
   JWT VERIFY
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

/* ======================
   ROLE GUARD
====================== */
const requireRole = (...roles) => {
  return async (req, res, next) => {
    const user = await usersCollection.findOne({ email: req.decoded.email });
    if (!user || !roles.includes(user.role)) {
      return res.status(403).send({ message: "Access denied" });
    }
    req.currentUser = user;
    next();
  };
};

async function run() {
  try {
    const db = client.db("bloodDonationDB");
    usersCollection = db.collection("users");
    donationRequestsCollection = db.collection("donationRequests");
    fundsCollection = db.collection("funds");

    /* ======================
       AUTH
    ====================== */
    app.post("/jwt", async (req, res) => {
      const { email } = req.body;
      const user = await usersCollection.findOne({ email });

      if (!user) return res.status(401).send({ message: "Unauthorized" });

      const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "7d" });
      res.send({ token });
    });

    /* ======================
       USERS
    ====================== */
    app.post("/users", async (req, res) => {
      const exists = await usersCollection.findOne({ email: req.body.email });
      if (exists) return res.send({ message: "User already exists" });

      const user = {
        email: req.body.email,
        name: req.body.name,
        avatar: req.body.avatar,
        bloodGroup: req.body.bloodGroup,
        district: req.body.district,
        upazila: req.body.upazila,
        role: "donor",
        status: "active",
        createdAt: new Date(),
      };

      const result = await usersCollection.insertOne(user);
      res.status(201).send({ ...user, _id: result.insertedId });
    });

    app.get("/users", verifyJWT, requireRole("admin"), async (req, res) => {
      const status = req.query.status;
      const query = status ? { status } : {};
      res.send(await usersCollection.find(query).toArray());
    });

    app.get("/users/profile", verifyJWT, async (req, res) => {
      const user = await usersCollection.findOne({ email: req.decoded.email });
      res.send(user);
    });

    app.put("/users/profile", verifyJWT, async (req, res) => {
      const updateData = { ...req.body };
      delete updateData.email;
      delete updateData._id;

      const result = await usersCollection.updateOne(
        { email: req.decoded.email },
        { $set: updateData }
      );
      res.send(result);
    });

    app.patch("/users/role/:id", verifyJWT, requireRole("admin"), async (req, res) => {
      const updateData = { ...req.body };
      delete updateData._id;

      res.send(
        await usersCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: updateData }
        )
      );
    });

    app.patch("/users/status/:id", verifyJWT, requireRole("admin"), async (req, res) => {
      const updateData = { ...req.body };
      delete updateData._id;

      res.send(
        await usersCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: updateData }
        )
      );
    });

    /* ======================
       DONATION REQUESTS
    ====================== */
    app.post("/donation-requests", verifyJWT, async (req, res) => {
      const user = await usersCollection.findOne({ email: req.decoded.email });
      if (user.status === "blocked") return res.status(403).send({ message: "User blocked" });

      const request = {
        ...req.body,
        requesterEmail: req.decoded.email,
        status: "pending",
        createdAt: new Date(),
      };

      const result = await donationRequestsCollection.insertOne(request);
      res.status(201).send(result);
    });

    app.get("/donation-requests/public", async (req, res) => {
      res.send(await donationRequestsCollection.find({ status: "pending" }).toArray());
    });

    // Server-side search endpoint
    app.get("/donation-requests/search", async (req, res) => {
      try {
        const { q } = req.query;
        if (!q) {
          const allRequests = await donationRequestsCollection
            .find({ status: "pending" })
            .toArray();
          return res.send(allRequests);
        }

        const searchRegex = new RegExp(q, "i");
        const filteredRequests = await donationRequestsCollection
          .find({
            status: "pending",
            $or: [
              { bloodGroup: searchRegex },
              { district: searchRegex },
              { upazila: searchRegex },
            ],
          })
          .toArray();

        res.send(filteredRequests);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });

    app.get("/donation-requests", verifyJWT, requireRole("admin", "volunteer"), async (req, res) => {
      const { status, page = 1, limit = 10 } = req.query;
      const query = status ? { status } : {};

      res.send(
        await donationRequestsCollection
          .find(query)
          .skip((page - 1) * limit)
          .limit(Number(limit))
          .toArray()
      );
    });

    app.get("/donation-requests/my", verifyJWT, async (req, res) => {
      res.send(
        await donationRequestsCollection.find({ requesterEmail: req.decoded.email }).toArray()
      );
    });

    app.get("/donation-requests/:id", verifyJWT, async (req, res) => {
      res.send(await donationRequestsCollection.findOne({ _id: new ObjectId(req.params.id) }));
    });

    app.put("/donation-requests/:id", verifyJWT, async (req, res) => {
      const request = await donationRequestsCollection.findOne({ _id: new ObjectId(req.params.id) });
      const currentUser = await usersCollection.findOne({ email: req.decoded.email });

      if (request.requesterEmail !== req.decoded.email && currentUser.role !== "admin") {
        return res.status(403).send({ message: "Forbidden" });
      }

      const updateData = { ...req.body };
      delete updateData._id;

      res.send(
        await donationRequestsCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: updateData }
        )
      );
    });

    app.patch("/donation-requests/status/:id", verifyJWT, requireRole("admin", "volunteer"), async (req, res) => {
      const updateData = { ...req.body };
      delete updateData._id;

      res.send(
        await donationRequestsCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: updateData }
        )
      );
    });

    app.delete("/donation-requests/:id", verifyJWT, async (req, res) => {
      res.send(
        await donationRequestsCollection.deleteOne({ _id: new ObjectId(req.params.id) })
      );
    });

    /* ======================
       FUNDING
    ====================== */
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { amount } = req.body;
      if (!amount || amount <= 0) return res.status(400).send({ message: "Invalid amount" });

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount * 100,
        currency: "bdt",
        payment_method_types: ["card"],
      });

      res.send({ clientSecret: paymentIntent.client_secret });
    });

    app.post("/funds", verifyJWT, async (req, res) => {
      const fund = {
        userName: req.body.userName,
        email: req.decoded.email,
        amount: Number(req.body.amount),
        transactionId: req.body.transactionId,
        createdAt: new Date(),
      };

      const result = await fundsCollection.insertOne(fund);
      res.status(201).send(result);
    });

    app.get("/funds", verifyJWT, requireRole("admin", "volunteer"), async (req, res) => {
      res.send(await fundsCollection.find().sort({ createdAt: -1 }).toArray());
    });

    app.get("/funds/total", verifyJWT, requireRole("admin", "volunteer"), async (req, res) => {
      const data = await fundsCollection.aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }]).toArray();
      res.send({ total: data[0]?.total || 0 });
    });

    console.log("✅ Backend fully upgraded & production ready");
  } catch (err) {
    console.error("❌ Server error:", err);
  }
}

run();

/* ======================
   ROOT
====================== */
app.get("/", (req, res) => {
  res.send("Blood Donation API Running");
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
