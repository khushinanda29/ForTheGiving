import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Schemas
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['donor', 'hospital'], required: true },
  profileCompleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const donorSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Personal Information
  firstName: String,
  lastName: String,
  dateOfBirth: Date,
  gender: String,
  phoneNumber: String,
  address: String,
  
  // Medical Information
  bloodType: String,
  weight: Number,
  height: Number,
  
  // Health History
  hasChronicIllness: String,
  chronicIllnessDetails: String,
  hasTraveled: String,
  travelDetails: String,
  hasTattoo: String,
  tattooDetails: String,
  isOnMedication: String,
  medicationDetails: String,
  
  // Emergency Contact
  emergencyContactName: String,
  emergencyContactPhone: String,
  emergencyContactRelationship: String,
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Donor = mongoose.model('Donor', donorSchema);

// Helper function to safely convert to ObjectId
const safeObjectId = (id) => {
  if (mongoose.Types.ObjectId.isValid(id)) {
    return new mongoose.Types.ObjectId(id);
  }
  // If it's a number, find by a different method
  return null;
};

// Auth routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    console.log('Login attempt:', { email, role });
    
    // Find user
    const user = await User.findOne({ email, role });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isPasswordValid = password === user.password;
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({ 
      token: 'mock-jwt-token-' + user._id,
      user: { 
        id: user._id.toString(), // Convert to string for frontend
        email: user.email, 
        role: user.role,
        profileCompleted: user.profileCompleted
      } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    console.log('Signup attempt:', { email, role });

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create user
    const user = new User({
      email,
      password: password,
      role,
      profileCompleted: false
    });

    await user.save();

    // Create donor profile if role is donor
    if (role === 'donor') {
      const donor = new Donor({
        userId: user._id
      });
      await donor.save();
    }

    res.status(201).json({
      token: 'mock-jwt-token-' + user._id,
      user: { 
        id: user._id.toString(), // Convert to string for frontend
        email: user.email, 
        role: user.role,
        profileCompleted: user.profileCompleted
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Get donor profile - FIXED VERSION
app.get('/api/donors/profile', async (req, res) => {
  try {
    const { userId } = req.query;
    
    console.log('Fetching profile for user ID:', userId, 'Type:', typeof userId);
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    let donor;
    
    // Try to find by ObjectId first
    if (mongoose.Types.ObjectId.isValid(userId)) {
      donor = await Donor.findOne({ userId: new mongoose.Types.ObjectId(userId) });
    } 
    
    // If not found by ObjectId, try to find by any other means
    if (!donor) {
      // If userId is a number, we need to find the user first to get their ObjectId
      const user = await User.findOne({ 
        $or: [
          { _id: mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null },
          { email: userId } // fallback to email if needed
        ]
      });
      
      if (user) {
        donor = await Donor.findOne({ userId: user._id });
      }
    }

    if (!donor) {
      return res.status(404).json({ error: 'Donor profile not found' });
    }

    res.json(donor);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update donor profile - FIXED VERSION
app.post('/api/donors/profile', async (req, res) => {
  try {
    const {
      userId,
      firstName,
      lastName,
      dateOfBirth,
      gender,
      phoneNumber,
      address,
      bloodType,
      weight,
      height,
      hasChronicIllness,
      chronicIllnessDetails,
      hasTraveled,
      travelDetails,
      hasTattoo,
      tattooDetails,
      isOnMedication,
      medicationDetails,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelationship
    } = req.body;

    console.log('Updating donor profile for user:', userId, 'Type:', typeof userId);

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    let userObjectId;

    // Handle different types of userId
    if (mongoose.Types.ObjectId.isValid(userId)) {
      userObjectId = new mongoose.Types.ObjectId(userId);
    } else {
      // If it's a number or other format, find the user to get their ObjectId
      const user = await User.findOne({
        $or: [
          { _id: mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null },
          { email: userId.toString() }
        ]
      });
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      userObjectId = user._id;
    }

    // Update donor profile
    const donor = await Donor.findOneAndUpdate(
      { userId: userObjectId },
      {
        firstName,
        lastName,
        dateOfBirth,
        gender,
        phoneNumber,
        address,
        bloodType,
        weight: Number(weight),
        height: Number(height),
        hasChronicIllness,
        chronicIllnessDetails,
        hasTraveled,
        travelDetails,
        hasTattoo,
        tattooDetails,
        isOnMedication,
        medicationDetails,
        emergencyContactName,
        emergencyContactPhone,
        emergencyContactRelationship,
        updatedAt: new Date()
      },
      { new: true, upsert: true }
    );

    // Mark user profile as completed
    await User.findByIdAndUpdate(userObjectId, { profileCompleted: true });

    res.json({ 
      success: true, 
      message: 'Profile updated successfully',
      donor 
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Debug endpoint to see all users
app.get('/api/debug/users', async (req, res) => {
  try {
    const users = await User.find();
    const donors = await Donor.find();
    
    res.json({
      users: users.map(user => ({
        id: user._id,
        idString: user._id.toString(),
        email: user.email,
        role: user.role,
        profileCompleted: user.profileCompleted
      })),
      donors: donors.map(donor => ({
        userId: donor.userId,
        userIdString: donor.userId.toString(),
        firstName: donor.firstName,
        lastName: donor.lastName
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reset database completely
app.get('/api/reset', async (req, res) => {
  try {
    await User.deleteMany({});
    await Donor.deleteMany({});
    res.json({ message: 'Database completely reset. All data cleared.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Blood Donation API is running',
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    timestamp: new Date().toISOString()
  });
});

// Test route
app.get('/api/test', async (req, res) => {
  try {
    const users = await User.find();
    const donors = await Donor.find();
    res.json({ 
      message: 'API is working!', 
      usersCount: users.length,
      donorsCount: donors.length
    });
  } catch (error) {
    res.json({ message: 'API is working but no database connection' });
  }
});

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/blood-donation')
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
  });

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🐛 Debug users: http://localhost:${PORT}/api/debug/users`);
  console.log(`🔄 Reset database: http://localhost:${PORT}/api/reset`);
  console.log(`🧪 Test endpoint: http://localhost:${PORT}/api/test`);
});