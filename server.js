import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import cors from 'cors';
import 'dotenv/config';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// Logger Middleware (Requirement A)
app.use((req, res, next) => {
    console.log(`[Request] ${req.method} ${req.originalUrl} - ${new Date().toISOString()}`);
    next();
});

// Static Middleware (Requirement B)
app.use('/images', express.static('images'));

// Check Connection String
const uri = process.env.MONGODB_URI;
if (!uri) {
    console.error("ERROR: MONGODB_URI is MISSING from .env file!");
    process.exit(1);
}

const client = new MongoClient(uri);
let db;

async function connectDB() {
    try {
        await client.connect();
        db = client.db('edunovaDB');
        console.log("SUCCESS: Connected to MongoDB");
    } catch (err) {
        console.error("CONNECTION FAILED:", err.message);
    }
}
connectDB();

// 1. GET /lessons
app.get('/lessons', async (req, res) => {
    if (!db) return res.status(500).json({error: "Database not connected yet"});
    try {
        const lessons = await db.collection('lessons').find({}).toArray();
        res.json(lessons);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch lessons" });
    }
});

// 2. GET /search (Requirement: Search Functionality)
app.get('/search', async (req, res) => {
    if (!db) return res.status(500).json({error: "Database not connected"});
    try {
        const query = req.query.q;
        if (!query) {
            const lessons = await db.collection('lessons').find({}).toArray();
            return res.json(lessons);
        }
        // Case insensitive regex search
        const lessons = await db.collection('lessons').find({
            $or: [
                { subject: { $regex: query, $options: 'i' } },
                { location: { $regex: query, $options: 'i' } }
            ]
        }).toArray();
        res.json(lessons);
    } catch (err) {
        res.status(500).json({ error: "Search failed" });
    }
});

// 3. POST /orders (Requirement: Save order & Update spaces)
app.post('/orders', async (req, res) => {
    if (!db) return res.status(500).json({error: "Database not connected"});
    
    try {
        const order = req.body;
        
        // Save order
        const orderResult = await db.collection('orders').insertOne(order);
        
        // Update spaces for each lesson in the order
        if (order.lessonIDs && Array.isArray(order.lessonIDs)) {
            for (const item of order.lessonIDs) {
                if (ObjectId.isValid(item.lessonId)) {
                    await db.collection('lessons').updateOne(
                        { _id: new ObjectId(item.lessonId) }, 
                        { $inc: { spaces: -Number(item.qty) } } 
                    );
                }
            }
        }
        
        res.status(201).json({ message: "Order placed", orderId: orderResult.insertedId });
        
    } catch (err) {
        console.error("Order error:", err);
        res.status(500).json({ error: "Failed to process order" });
    }
});

// 4. PUT /lessons/:id (Requirement: Update Attribute)
app.put('/lessons/:id', async (req, res) => {
    if (!db) return res.status(500).json({error: "Database not connected"});
    try {
        const id = req.params.id;
        const updates = req.body;
        await db.collection('lessons').updateOne({ _id: new ObjectId(id) }, { $set: updates });
        res.json({ message: "Lesson Updated" });
    } catch (err) {
        res.status(500).json({ error: "Update failed" });
    }
});

app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});