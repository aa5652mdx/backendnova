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
    process.exit(1); 
}

// ----------------------------------------------------
// Robust Connection Logging
// ----------------------------------------------------
mongoose.connect(MONGODB_URI, { 
    ssl: true,
    serverSelectionTimeoutMS: 10000 
});

const db = mongoose.connection;

db.on('error', (err) => {
    console.error('❌ FAILED TO CONNECT TO MONGODB (ERROR EVENT). CHECK MONGODB_URI AND NETWORK ACCESS:', err.message);
    dbConnectionError = true;
});

db.once('connected', () => {
    console.log('✅ Connected to MongoDB: edunovaDB');
    dbConnectionError = false;
});

const dbConnectionPromise = new Promise((resolve, reject) => {
    db.once('connected', resolve);
    db.once('error', reject);
    setTimeout(() => {
        if (db.readyState !== 1) { 
            reject(new Error("MongoDB connection timeout reached. Check network access."));
        }
    }, 15000);
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

// *** FIX: Ensure the schema uses 'lessonIDs' to match the frontend payload (main.js) ***
const Order = mongoose.model('Order', {
    name: String,
    phone: String,
    // The lessonIDs array now holds objects like: { lessonId: <ID>, qty: <Number> }
    lessonIDs: Array, 
    total: Number,
    date: Date
});

// --- Database Seeding Function ---
const seedDatabase = async () => {
    try {
        await dbConnectionPromise;
        if (dbConnectionError) return;

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
        dbConnectionError = true;
    }
};

seedDatabase();


// --- Routes ---

// Health Check Route
app.get('/status', async (req, res) => {
    if (dbConnectionError) {
        return res.status(503).json({ 
            status: "ERROR", 
            dbReadyState: mongoose.connection.readyState, 
            message: "Database connection failed. Check MONGODB_URI and Network Access (0.0.0.0/0)." 
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
        const lessons = await Lesson.find({});
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
        const { spaces: newSpaces } = req.body;
        
        if (typeof newSpaces !== 'number' || newSpaces < 0) {
            return res.status(400).json({ error: 'Invalid spaces value' });
        }
        
        // Check if ID is a valid BSON object ID format
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
    
    // Log the incoming request body for structure debugging
    console.log("--- Received Order Request Body ---", JSON.stringify(req.body, null, 2));

    try {
        // *** CRITICAL FIX 1: Use 'lessonIDs' to match frontend payload ***
        const { name, phone, lessonIDs, total } = req.body;
        
        if (!name || !phone || !lessonIDs || lessonIDs.length === 0) {
            console.error("*** ORDER FAILED: Missing essential fields (name, phone, or lessonIDs).");
             return res.status(400).json({ error: 'Missing required fields: name, phone, or lessons.' });
        }
        
        // 1. Create the new order document
        const newOrder = new Order({
            name,
            phone,
            lessonIDs: lessonIDs,
            total,
            date: new Date()
        });
        await newOrder.save(); 
        
        // 2. Update lesson spaces using bulkWrite
        const bulkOps = lessonIDs.map(item => {
            return ({
                updateOne: {
                    // *** CRITICAL FIX 2: Ensure BSON compatibility for the ID ***
                    filter: { _id: new mongoose.Types.ObjectId(item.lessonId) }, 
                    // Decrement the spaces count
                    update: { $inc: { spaces: -item.qty } } 
                }
            });
        });

        await Lesson.bulkWrite(bulkOps);

        // 3. Respond with success
        res.status(201).json({ 
            message: 'Your order has been successfully placed. We will contact you soon!', 
            order: newOrder 
        });

    } catch (err) {
        console.error(`*** ORDER FAILED:`, err.message);
        console.error(`*** FULL ERROR OBJECT:`, err);
        
        if (err.name === 'BSONTypeError') {
            return res.status(400).json({ error: 'A lesson ID provided in the order is invalid (BSON format). Check your item IDs.' });
        }
        res.status(500).json({ error: 'Failed to create order or update lessons. Check server logs for details.' });
    }
});

// GET /orders - Fetch all orders (for administrative/debugging purposes)
app.get('/orders', async (req, res) => {
    if (dbConnectionError) {
        return res.status(503).json({ error: 'Database connection is unavailable.' });
    }
    try {
        // Fetch all orders
        const orders = await Order.find({});
        res.json(orders);
    } catch (err) {
        console.error("Error fetching orders:", err);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});


// Commit Tracker #16
// Commit Tracker #17
// Commit Tracker #18
// Commit Tracker #19
// Commit Tracker #20

// --- Server Listener ---
app.listen(port, () => {
    console.log(`EduNova Backend listening on port ${port} 🚀`);
});