import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors'; 
import 'dotenv/config'; 
import { ObjectId } from 'mongodb'; // Import ObjectId for BSON checks

const app = express();
// Render sets the PORT environment variable automatically
const port = process.env.PORT || 3000; 
const MONGODB_URI = process.env.MONGODB_URI;

// Flag to track database connection status globally
let dbConnectionError = false;

// --- Middleware ---
app.use(express.json());
// Allow requests from all origins (CORS is essential for GitHub Pages to talk to Render)
app.use(cors()); 

// --- MongoDB Connection & Seeding ---
if (!MONGODB_URI) {
    console.error('❌ FATAL ERROR: MONGODB_URI is not defined.');
    // Exit if the critical environment variable is missing
    process.exit(1); 
}

// Attempt the connection, logging the result
const dbConnectionPromise = mongoose.connect(MONGODB_URI, { 
    ssl: true,
    // Give Render more time to establish the connection
    serverSelectionTimeoutMS: 10000 
}) 
    .then(() => console.log('✅ Connected to MongoDB: edunovaDB'))
    .catch(err => {
        // This log MUST appear in Render's logs if the connection fails
        console.error('❌ FAILED TO CONNECT TO MONGODB. CHECK MONGODB_URI AND NETWORK ACCESS:', err.message);
        dbConnectionError = true; 
        // DO NOT EXIT: allow the server to start, but block API access
    });


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

// --- Database Seeding Function ---
const seedDatabase = async () => {
    try {
        await dbConnectionPromise; // Wait for the connection attempt to resolve
        if (dbConnectionError) return; // Stop seeding if connection failed

        const lessonCount = await Lesson.countDocuments();
        if (lessonCount === 0) {
            console.log('⏳ Database is empty. Seeding 8 lessons...');
            const initialLessons = [
                { subject: "Mathematics", location: "London", price: 100, spaces: 5, icon: "fa-calculator", description: "Advanced calculus and algebra." },
                { subject: "Physics", location: "Manchester", price: 120, spaces: 5, icon: "fa-atom", description: "Quantum mechanics and thermodynamics." },
                { subject: "Chemistry", location: "Birmingham", price: 90, spaces: 5, icon: "fa-flask", description: "Organic and inorganic chemistry." },
                { subject: "Biology", location: "London", price: 80, spaces: 5, icon: "fa-dna", description: "Cellular structure and genetics." },
                { subject: "History", location: "Liverpool", price: 70, spaces: 5, icon: "fa-scroll", description: "World history from ancient to modern times." },
                { subject: "English Literature", location: "Leeds", price: 75, spaces: 5, icon: "fa-book-open", description: "Classic novels and poetry analysis." },
                { subject: "Computer Science", location: "London", price: 150, spaces: 5, icon: "fa-code", description: "Data structures and algorithms." },
                { subject: "Art History", location: "Bristol", price: 65, spaces: 5, icon: "fa-palette", description: "Survey of major art movements." }
            ];
            await Lesson.insertMany(initialLessons);
            console.log('✅ Database seeded successfully with 8 lessons.');
        } else {
            console.log(`ℹ️ Database already contains ${lessonCount} lessons. No seeding required.`);
        }
    } catch (error) {
        console.error('❌ Error during database seeding/check:', error.message);
    }
};

// Start the seeding process
seedDatabase();


// --- Routes ---

// Health Check Route (Crucial for verifying database connection status)
app.get('/status', async (req, res) => {
    // Return 503 if the connection failed
    if (dbConnectionError) {
        return res.status(503).json({ 
            status: "ERROR", 
            dbReadyState: mongoose.connection.readyState, 
            message: "Database connection failed. Check MONGODB_URI (password!) and Network Access (0.0.0.0/0)." 
        });
    }

    try {
        const lessons = await Lesson.countDocuments();
        res.json({
            status: "OK",
            dbReadyState: mongoose.connection.readyState,
            lessonsAvailable: lessons,
            message: `API is running. MongoDB connection is active. ${lessons} lessons found.`
        });
    } catch (e) {
         res.status(500).json({ 
            status: "ERROR", 
            dbReadyState: mongoose.connection.readyState, 
            message: "Failed to read data from database during status check." 
        });
    }
});

// Root Route
app.get('/', (req, res) => {
    res.send('EduNova Backend API is running 🚀');
});


// GET /lessons - Fetch all lessons
app.get('/lessons', async (req, res) => {
    if (dbConnectionError) {
        return res.status(503).json({ error: 'Database connection is unavailable.' });
    }
    try {
        // Find all lessons in the collection
        const lessons = await Lesson.find({});
        // Send the JSON array back to the client
        res.json(lessons);
    } catch (err) {
        console.error("Error fetching lessons:", err);
        res.status(500).json({ error: 'Failed to fetch lessons' });
    }
});


// GET /search - Search lessons by subject or location
app.get('/search', async (req, res) => {
    if (dbConnectionError) {
        return res.status(503).json({ error: 'Database connection is unavailable.' });
    }
    try {
        const { query } = req.query; 
        
        if (!query) {
            const lessons = await Lesson.find({});
            return res.json(lessons);
        }

        const searchRegex = new RegExp(query, 'i'); 
        
        const lessons = await Lesson.find({
            $or: [
                { subject: searchRegex },
                { location: searchRegex }
            ]
        });

        res.json(lessons);
    } catch (err) {
        console.error("Error during search:", err);
        res.status(500).json({ error: 'Failed to perform search' });
    }
});


// PUT /lessons/:id - Update lesson spaces
app.put('/lessons/:id', async (req, res) => {
    if (dbConnectionError) {
        return res.status(503).json({ error: 'Database connection is unavailable.' });
    }
    try {
        const lessonId = req.params.id;
        const { spaces: newSpaces } = req.body; // Destructure the expected 'spaces' field
        
        if (typeof newSpaces !== 'number' || newSpaces < 0) {
            return res.status(400).json({ error: 'Invalid spaces value' });
        }
        
        // Use ObjectId to validate ID format
        new ObjectId(lessonId); 

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
        if (err.name === 'BSONTypeError') {
            return res.status(400).json({ error: 'Invalid Lesson ID format.' });
        }
        console.error("Error updating lesson:", err);
        res.status(500).json({ error: 'Failed to update lesson' });
    }
});

// POST /orders - Create a new order and update lesson spaces
app.post('/orders', async (req, res) => {
    if (dbConnectionError) {
        return res.status(503).json({ error: 'Database connection is unavailable.' });
    }
    try {
        const { name, phone, lessonIDs, total } = req.body;
        
        if (!name || !phone || !lessonIDs || lessonIDs.length === 0) {
             return res.status(400).json({ error: 'Missing required fields: name, phone, or lessons.' });
        }

        // 1. Create the new order document
        const newOrder = new Order({
            name,
            phone,
            lessonIDs, // Array of {lessonId, qty} objects
            total,
            date: new Date()
        });
        await newOrder.save();
        
        // 2. Update lesson spaces using bulkWrite
        const bulkOps = lessonIDs.map(item => ({
            updateOne: {
                // Filter by lesson ID (Use mongoose.Types.ObjectId to ensure compatibility)
                filter: { _id: new mongoose.Types.ObjectId(item.lessonId) }, 
                // Decrement the spaces count
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
        
        if (err.name === 'BSONTypeError') {
            return res.status(400).json({ error: 'A lesson ID provided in the order is invalid (BSON format).' });
        }
        res.status(500).json({ error: 'Failed to create order or update lessons' });
    }
});

// GET /orders - Fetch all orders (for administrative/debugging purposes)
app.get('/orders', async (req, res) => {
    if (dbConnectionError) {
        return res.status(503).json({ error: 'Database connection is unavailable.' });
    }
    try {
        const orders = await Order.find({});
        res.json(orders);
    } catch (err) {
        console.error("Error fetching orders:", err);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});


// --- Server Listener ---
app.listen(port, () => {
    console.log(`EduNova Backend listening on port ${port} 🚀`);
});