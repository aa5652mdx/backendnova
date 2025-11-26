import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import cors from 'cors';
import 'dotenv/config';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// Serve images if available
app.use('/images', express.static('images'));

// 1. Check if the Connection String is loaded
const uri = process.env.MONGODB_URI;
console.log("---------------------------------------------");
console.log("DEBUG: Checking Environment Variables...");
if (!uri) {
    console.error("❌ ERROR: MONGODB_URI is MISSING from .env file!");
    process.exit(1); // Stop server if no URI
} else {
    console.log("✅ MONGODB_URI is loaded. Length:", uri.length);
}
console.log("---------------------------------------------");

const client = new MongoClient(uri);
let db;

async function connectDB() {
    try {
        console.log("⏳ Attempting to connect to MongoDB Atlas...");
        await client.connect();
        db = client.db('edunovaDB');
        console.log("✅ SUCCESS: Connected to MongoDB (Native Driver)");
        console.log("---------------------------------------------");
    } catch (err) {
        console.error("❌ CONNECTION FAILED:", err.message);
        // Common error hint
        if (err.message.includes("econnrefused") || err.message.includes("querySrv")) {
            console.log("💡 HINT: Are you on University WiFi (Eduroam)? It blocks MongoDB. Try a Phone Hotspot.");
        }
    }
}
connectDB();

app.get('/lessons', async (req, res) => {
    if (!db) return res.status(500).json({error: "Database not connected yet"});
    const lessons = await db.collection('lessons').find({}).toArray();
    res.json(lessons);
});

// SEARCH Lessons
app.get('/search', async (req, res) => {
    if (!db) return res.status(500).json({error: "Database not connected yet"});
    const query = req.query.q;
    if (!query) {
        const lessons = await db.collection('lessons').find({}).toArray();
        return res.json(lessons);
    }
    const lessons = await db.collection('lessons').find({
        $or: [
            { subject: { $regex: query, $options: 'i' } },
            { location: { $regex: query, $options: 'i' } }
        ]
    }).toArray();
    res.json(lessons);
});

// POST Order
app.post('/orders', async (req, res) => {
    if (!db) return res.status(500).json({error: "Database not connected yet"});
    try {
        const order = req.body;
        const orderResult = await db.collection('orders').insertOne(order);
        
        for (const item of order.lessonIDs) {
            await db.collection('lessons').updateOne(
                { _id: new ObjectId(item.lessonId) }, 
                { $inc: { spaces: -item.qty } }
            );
        }
        res.status(201).json({ message: "Order placed", orderId: orderResult.insertedId });
    } catch (err) {
        res.status(500).json({ error: "Failed to process order" });
    }
});

// PUT Update
app.put('/lessons/:id', async (req, res) => {
    if (!db) return res.status(500).json({error: "Database not connected yet"});
    const id = req.params.id;
    const updates = req.body;
    await db.collection('lessons').updateOne({ _id: new ObjectId(id) }, { $set: updates });
    res.json({ message: "Updated" });
});

app.listen(port, () => {
    console.log(`🚀 Server started on port ${port}`);
});