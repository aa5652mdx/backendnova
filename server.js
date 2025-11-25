import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors'; // <-- Critical for allowing local frontend connection
import 'dotenv/config'; 

const app = express();
const port = process.env.PORT || 3000;

// --- Middleware ---
app.use(express.json());

// Apply CORS middleware to allow requests from all origins (including local file:/// path)
app.use(cors()); 

// --- MongoDB Connection ---
mongoose.connect(process.env.MONGODB_URI, { ssl: true }) 
    .then(() => console.log('✅ Connected to MongoDB: edunovaDB'))
    .catch(err => console.error('❌ Failed to connect to MongoDB', err));

// --- Schemas ---
const Lesson = mongoose.model('Lesson', {
    subject: String,
    location: String,
    price: Number,
    spaces: Number,
    icon: String,
    description: String
});

const Order = mongoose.model('Order', {
    name: String,
    phone: String,
    lessonIDs: Array,
    total: Number,
    date: Date
});

// --- Routes ---

// GET / - Root route check
app.get('/', (req, res) => {
    res.send('EduNova Backend API is running 🚀');
});

// GET /lessons - Fetch all lessons
app.get('/lessons', async (req, res) => {
    try {
        // Fetch lessons, which should exist in the 'lessons' collection you showed me
        const lessons = await Lesson.find({});
        res.json(lessons);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch lessons' });
    }
});

// PUT /lessons/:id - Update lesson spaces
app.put('/lessons/:id', async (req, res) => {
    try {
        const lessonId = req.params.id;
        const newSpaces = req.body.spaces;
        
        const updatedLesson = await Lesson.findByIdAndUpdate(
            lessonId,
            { spaces: newSpaces },
            { new: true }
        );
        
        if (!updatedLesson) {
            return res.status(404).json({ error: 'Lesson not found' });
        }
        
        res.status(200).json(updatedLesson);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update lesson spaces' });
    }
});


// POST /orders - Create a new order
app.post('/orders', async (req, res) => {
    try {
        const newOrder = new Order(req.body);
        await newOrder.save();
        res.status(201).json(newOrder);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create order' });
    }
});


// --- Start Server ---
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});git add server.js