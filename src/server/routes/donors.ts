import express from 'express';
import { Donor } from '../models/Donor';
import { User } from '../models/User';

const router = express.Router();

// Middleware to verify token (simplified)
const auth = async (req: any, res: any, next: any) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    // In a real app, you'd verify the JWT token here
    // For now, we'll assume the token is valid and get user ID from request body
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token invalid' });
  }
};

// Get donor profile
router.get('/profile', auth, async (req, res) => {
  try {
    // In real app, get userId from verified token
    const { userId } = req.query;
    
    const donor = await Donor.findOne({ userId }).populate('userId');
    if (!donor) {
      return res.status(404).json({ error: 'Donor profile not found' });
    }

    res.json(donor);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update donor profile
router.post('/profile', auth, async (req, res) => {
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

    // Update donor profile
    const donor = await Donor.findOneAndUpdate(
      { userId },
      {
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
        emergencyContactRelationship,
        updatedAt: new Date()
      },
      { new: true, upsert: true }
    );

    // Mark user profile as completed
    await User.findByIdAndUpdate(userId, { profileCompleted: true });

    res.json({ 
      success: true, 
      message: 'Profile updated successfully',
      donor 
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;