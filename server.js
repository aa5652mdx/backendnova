// ===========================
// EduNova1git push --force origin main School Backend API
// ===========================

import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

// ===== Middleware =====
app.use(cors());
app.use(express.json());

// Logger middleware (4%)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Static file middleware for images (4%)
const imageDir = path.join(process.cwd(), "images");
app.use("/images", express.static(imageDir));
app.use("/images", (req, res) => {
  res.status(404).json({ error: "Image not found" });
});

// ===== MongoDB Connection =====
const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const client = new MongoClient(uri);
const dbName = "edunovaDB";
let lessonsCollection, ordersCollection;

async function connectDB() {
  await client.connect();
  const db = client.db(dbName);
  lessonsCollection = db.collection("lessons");
  ordersCollection = db.collection("orders");
  console.log("✅ Connected to MongoDB:", dbName);
}
connectDB().catch(console.error);

// ===== Routes =====

// GET /lessons — returns all lessons (3%)
app.get("/lessons", async (req, res) => {
  try {
    const lessons = await lessonsCollection.find().toArray();
    res.json(lessons);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /search?q=term — full-text search (7%)
app.get("/search", async (req, res) => {
  const query = req.query.q?.toLowerCase() || "";
  try {
    const lessons = await lessonsCollection
      .find({
        $or: [
          { subject: { $regex: query, $options: "i" } },
          { location: { $regex: query, $options: "i" } },
          { price: { $regex: query, $options: "i" } },
          { spaces: { $regex: query, $options: "i" } },
        ],
      })
      .toArray();
    res.json(lessons);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /orders — save a new order (4%)
app.post("/orders", async (req, res) => {
  try {
    const order = req.body;
    if (!order.name || !order.phone || !order.lessonIDs) {
      return res.status(400).json({ error: "Invalid order data" });
    }
    const result = await ordersCollection.insertOne(order);
    res.status(201).json({ message: "Order saved", id: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /lessons/:id — update lesson availability (5%)
app.put("/lessons/:id", async (req, res) => {
  try {
    const id = new ObjectId(req.params.id);
    const update = req.body;
    const result = await lessonsCollection.updateOne({ _id: id }, { $set: update });
    if (result.modifiedCount === 0) {
      return res.status(404).json({ error: "Lesson not found" });
    }
    res.json({ message: "Lesson updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Root check
app.get("/", (req, res) => {
  res.send("EduNova Backend API is running 🚀");
});

// ===== Start Server =====
app.listen(port, () => console.log(`✅ Server running on port ${port}`));
