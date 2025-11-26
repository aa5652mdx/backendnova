// --- Dependencies (using ES Module import syntax) ---
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors'; 
import 'dotenv/config'; 

import { Types } from 'mongoose';

const app = express();
const port = process.env.PORT || 3000;

// --- Middleware ---
app.use(express.json());
app.use(cors()); 

// --- Schemas ---
const LessonSchema = new mongoose.Schema({
    subject: String,
    location: String,
    price: Number,
    spaces: Number,
    icon: String,
    description: String
});

const Lesson = mongoose.model('Lesson', LessonSchema);

const OrderItemSchema = new mongoose.Schema({
    lessonId: { type: Types.ObjectId, required: true }, 
    subject: { type: String, required: true },
    price: { type: Number, required: true },
    qty: { type: Number, required: true }
});

const Order = mongoose.model('Order', {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    items: [OrderItemSchema],
    total: { type: Number, required: true },
    date: { type: Date, default: Date.now } 
});


// --- Initial Lesson Data (Seeding Data) ---
const initialLessons = [
    { subject: "Mathematics", location: "London", price: 100, spaces: 5, icon: "fa-calculator", description: "Advanced calculus and algebra." },
    { subject: "Physics", location: "Paris", price: 120, spaces: 3, icon: "fa-atom", description: "Quantum mechanics and thermodynamics." },
    { subject: "Chemistry", location: "New York", price: 90, spaces: 7, icon: "fa-flask", description: "Organic and inorganic chemistry." },
    { subject: "English Literature", location: "Tokyo", price: 80, spaces: 10, icon: "fa-book-open", description: "Shakespeare and modern poetry." },
    { subject: "History", location: "Rome", price: 95, spaces: 6, icon: "fa-landmark", description: "Ancient civilizations and world wars." },
    { subject: "Computer Science", location: "Berlin", price: 150, spaces: 2, icon: "fa-code", description: "Data structures and algorithms." },
    { subject: "Art", location: "Madrid", price: 75, spaces: 8, icon: "fa-palette", description: "Drawing, painting, and digital art." },
    { subject: "Music Theory", location: "Sydney", price: 110, spaces: 4, icon: "fa-music", description: "Harmony, counterpoint, and composition." },
];

/**
 * Function to check if the database is empty and insert initial data.
 */
async function seedDatabase() {
    try {
        const count = await Lesson.countDocuments();
        if (count === 0) {
            await Lesson.insertMany(initialLessons);
            console.log('✨ Database seeded successfully with initial lessons.');
        } else {
            console.log(`✅ Lessons collection already contains ${count} documents. No seeding performed.`);
        }
    } catch (error) {
        console.error('❌ Database seeding failed:', error);
    }
}

// --- MongoDB Connection ---
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error('❌ FATAL ERROR: MONGODB_URI is undefined. Check your environment variables.');
    process.exit(1); 
}

mongoose.connect(MONGODB_URI, {}) 
    .then(() => {
        console.log('✅ Connected to MongoDB: edunovaDB');
        // Execute seeding function after successful connection
        seedDatabase(); 
    })
    .catch(err => console.error('❌ Failed to connect to MongoDB', err));


// --- Routes ---
app.get('/', (req, res) => {
    res.send('EduNova Backend API is running 🚀');
});

// NEW: /status endpoint for debugging connectivity
app.get('/status', async (req, res) => {
    const connectionState = mongoose.connection.readyState;
    const isConnected = connectionState === 1; // 1 means connected

    try {
        let lessonCount = 0;
        if (isConnected) {
            lessonCount = await Lesson.countDocuments();
        }

        res.json({
            status: isConnected ? 'OK' : 'Database Disconnected',
            dbReadyState: connectionState,
            lessonsAvailable: lessonCount,
            message: `API is running. MongoDB connection is ${isConnected ? 'active' : 'inactive'}. ${lessonCount} lessons found.`
        });
    } catch (error) {
        // Handle errors during the countDocuments call (e.g., if connection drops)
        res.status(500).json({ 
            status: 'Error', 
            message: 'Internal server error during status check.',
            details: error.message 
        });
    }
});

// GET /lessons - Fetch all lessons
app.get('/lessons', async (req, res) => {
    try {
        // Fetch all documents from the lessons collection
        const lessons = await Lesson.find({}); 
        // Send the data as JSON
        res.json(lessons);
    } catch (err) {
        console.error("Error fetching lessons:", err);
        // Send a 500 status code with an error message
        res.status(500).json({ error: 'Failed to fetch lessons' });
    }
});

// PUT /lessons/:id - Update lesson spaces 
app.put('/lessons/:id', async (req, res) => {
    // ... (PUT route logic remains the same)
    try {
        const lessonId = req.params.id;
        const { spaces: newSpaces } = req.body; 
        
        if (typeof newSpaces !== 'number' || newSpaces < 0) {
            return res.status(400).json({ error: 'Invalid spaces value' });
        }

        const lesson = await Lesson.findByIdAndUpdate(
            lessonId, 
            { spaces: newSpaces }, 
            { new: true }
        );

        if (!lesson) {
            return res.status(404).json({ error: 'Lesson not found' });
        }

        res.json({ message: 'Spaces updated successfully', lesson });
    } catch (err) {
        console.error("Error updating lesson:", err);
        res.status(500).json({ error: 'Failed to update lesson' });
    }
});

app.post('/orders', async (req, res) => {
    // ... (POST route logic remains the same)
    try {
        const { name, phone, items, total } = req.body;
        
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Order must contain at least one item.' });
        }
        
        // 1. Create the new Order Document
        const orderItems = items.map(item => ({
            lessonId: item.lessonId, 
            subject: item.subject,
            price: item.price,
            qty: item.qty
        }));

        const newOrder = new Order({
            name,
            phone,
            items: orderItems, 
            total,
            date: new Date()
        });
        await newOrder.save();
        
        // 2. Update lesson spaces using bulkWrite
        const bulkOps = items.map(item => ({
            updateOne: {
                filter: { _id: new Types.ObjectId(item.lessonId) }, 
                update: { $inc: { spaces: -item.qty } } 
            }
        }));

        await Lesson.bulkWrite(bulkOps);

        // 3. Respond with success
        res.status(201).json({ 
            message: 'Order created and lesson spaces updated successfully', 
            order: newOrder 
        });

    } catch (err) {
        console.error("Error creating order or updating lessons:", err);
        
        if (err.name === 'ValidationError') {
            return res.status(400).json({ error: `Validation Error: ${err.message}` });
        }
        if (err.name === 'BSONTypeError') {
            return res.status(400).json({ error: 'A lesson ID provided in the order is invalid (BSON format).' });
        }
        res.status(500).json({ error: 'Failed to create order or update lessons' });
    }
});


// --- Server Listener ---
app.listen(port, () => {
    console.log(`📡 EduNova Backend listening at http://localhost:${port}`);
});