import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import Hospital from '../models/Hospital';
import Donor from '../models/Donor';

const router = express.Router();

// Get hospital profile
router.get('/profile', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const hospital = await Hospital.findOne({ userId: req.user.userId });
    
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital profile not found' });
    }

    res.json(hospital);
  } catch (error) {
    console.error('Get hospital profile error:', error);
    res.status(500).json({ error: 'Failed to fetch hospital profile' });
  }
});

// Get nearby donors
router.get('/nearby-donors', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { bloodType } = req.query;
    
    let query = { 'medicalHistory.isEligible': true };
    if (bloodType) {
      query = { ...query, 'personalInfo.bloodType': bloodType };
    }

    const donors = await Donor.find(query)
      .select('personalInfo location medicalHistory.isEligible')
      .limit(50);

    res.json(donors);
  } catch (error) {
    console.error('Get nearby donors error:', error);
    res.status(500).json({ error: 'Failed to fetch nearby donors' });
  }
});

// Update urgency level
router.put('/urgency', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { urgencyLevel, bloodType } = req.body;
    
    const hospital = await Hospital.findOneAndUpdate(
      { userId: req.user.userId },
      { 
        urgencyLevel,
        $push: {
          inventory: {
            bloodType,
            units: 0, // This would be calculated based on actual needs
            lastUpdated: new Date()
          }
        }
      },
      { new: true }
    );

    res.json({ 
      message: 'Urgency level updated',
      urgencyLevel: hospital?.urgencyLevel 
    });
  } catch (error) {
    console.error('Update urgency error:', error);
    res.status(500).json({ error: 'Failed to update urgency level' });
  }
});

export default router;