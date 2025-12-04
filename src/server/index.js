// src/server/index.js
import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import axios from 'axios';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

console.log('🔄 Starting server...');

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Test database connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL connection error:', err);
});

// Simple auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    // For simple token format: 'jwt-token-{userId}'
    if (token.startsWith('jwt-token-')) {
      const userId = token.replace('jwt-token-', '');
      req.user = { userId: parseInt(userId) };
      return next();
    }

    // For proper JWT tokens
    const user = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ 
      status: 'OK', 
      message: 'Server and database are running',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'ERROR', 
      message: 'Server running but database connection failed',
      error: error.message
    });
  }
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is working!' });
});

// Auth routes
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    console.log('Signup attempt:', { email, role });

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create user
    const userResult = await pool.query(
      'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role, profile_completed',
      [email, password, role]
    );

    const user = userResult.rows[0];

    // Create donor profile if role is donor
    if (role === 'donor') {
      await pool.query(
        'INSERT INTO donors (user_id) VALUES ($1)',
        [user.id]
      );
    } else if (role === 'hospital') {
      await pool.query(
        'INSERT INTO hospitals (user_id, name) VALUES ($1, $2)',
        [user.id, 'New Hospital Center']
      );
    }

    const userResponse = {
      id: user.id,
      email: user.email,
      role: user.role,
      profileCompleted: user.profile_completed
    };

    console.log('Signup successful:', userResponse);

    res.status(201).json({
      token: 'jwt-token-' + user.id,
      user: userResponse
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Registration failed: ' + error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    console.log('Login attempt:', { email, role });
    
    const result = await pool.query(
      'SELECT id, email, role, profile_completed, password, password_hash FROM users WHERE email = $1 AND role = $2',
      [email, role]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    
    // Check password (try both column names)
    const userPassword = user.password || user.password_hash;
    if (password !== userPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const userResponse = {
      id: user.id,
      email: user.email,
      role: user.role,
      profileCompleted: user.profile_completed
    };

    console.log('Login successful:', userResponse);

    res.json({ 
      token: 'jwt-token-' + user.id,
      user: userResponse
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed: ' + error.message });
  }
});

// Donor eligibility status update
app.put('/api/donors/eligibility-status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { eligibilityStatus, ineligibilityReasons } = req.body;

    console.log('Updating eligibility status for user:', userId, 'to:', eligibilityStatus);

    // Check current status - if already 'ineligible', don't allow frontend to change it
    const currentStatus = await pool.query(
      'SELECT eligibility_status FROM donors WHERE user_id = $1',
      [userId]
    );

    if (currentStatus.rows.length > 0 && currentStatus.rows[0].eligibility_status === 'ineligible') {
      return res.status(403).json({ 
        error: 'Eligibility status is permanently set to ineligible. Please contact support to review your eligibility.' 
      });
    }

    // Update donor's eligibility status
    const result = await pool.query(
      `UPDATE donors 
       SET eligibility_status = $1, 
           updated_at = NOW() 
       WHERE user_id = $2 
       RETURNING *`,
      [eligibilityStatus, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Donor profile not found' });
    }

    // Store detailed ineligibility reasons in the audit log
    if (eligibilityStatus === 'ineligible' && ineligibilityReasons) {
      try {
        await pool.query(
          `INSERT INTO eligibility_audit_log 
           (donor_user_id, previous_status, new_status, reasons, created_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [userId, currentStatus.rows[0]?.eligibility_status, eligibilityStatus, JSON.stringify(ineligibilityReasons)]
        );
        console.log('Detailed ineligibility reasons stored for user', userId);
      } catch (auditError) {
        console.error('Failed to log eligibility audit:', auditError);
      }
    }

    res.json({ 
      message: 'Eligibility status updated successfully',
      donor: result.rows[0],
      isPermanent: eligibilityStatus === 'ineligible',
      storedReasons: eligibilityStatus === 'ineligible' ? ineligibilityReasons : null
    });
  } catch (error) {
    console.error('Error updating eligibility status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check donor eligibility before accessing dashboard
app.get('/api/donors/check-eligibility', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT eligibility_status FROM donors WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Donor profile not found' });
    }

    const eligibilityStatus = result.rows[0].eligibility_status;

    res.json({
      isEligible: eligibilityStatus === 'eligible',
      eligibilityStatus: eligibilityStatus
    });
  } catch (error) {
    console.error('Error checking eligibility:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Donor profile routes
app.get('/api/donors/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    console.log('Fetching profile for user ID:', userId);

    const result = await pool.query(
      `SELECT * FROM donors WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Donor profile not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

app.post('/api/donors/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      firstName,
      lastName,
      dateOfBirth,
      gender,
      phoneNumber,
      street,
      city,
      state,
      zipCode,
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

    console.log('Updating donor profile for user:', userId);

    // Convert boolean strings to actual booleans for PostgreSQL
    const hasChronicIllnessBool = hasChronicIllness === 'yes';
    const hasTraveledBool = hasTraveled === 'yes';
    const hasTattooBool = hasTattoo === 'yes';
    const isOnMedicationBool = isOnMedication === 'yes';

    const result = await pool.query(
      `INSERT INTO donors (
        user_id, first_name, last_name, date_of_birth, gender, phone_number,
        street, city, state, zip_code, blood_type, weight, height,
        has_chronic_illness, chronic_illness_details, has_traveled, travel_details,
        has_tattoo, tattoo_details, is_on_medication, medication_details,
        emergency_contact_name, emergency_contact_phone, emergency_contact_relationship
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
      ON CONFLICT (user_id) 
      DO UPDATE SET
        first_name = $2, last_name = $3, date_of_birth = $4, gender = $5, phone_number = $6,
        street = $7, city = $8, state = $9, zip_code = $10, blood_type = $11, weight = $12, height = $13,
        has_chronic_illness = $14, chronic_illness_details = $15, has_traveled = $16, travel_details = $17,
        has_tattoo = $18, tattoo_details = $19, is_on_medication = $20, medication_details = $21,
        emergency_contact_name = $22, emergency_contact_phone = $23, emergency_contact_relationship = $24,
        updated_at = NOW()
      RETURNING *`,
      [
        userId, firstName, lastName, dateOfBirth, gender, phoneNumber,
        street, city, state, zipCode, bloodType, Number(weight), Number(height),
        hasChronicIllnessBool, chronicIllnessDetails, hasTraveledBool, travelDetails,
        hasTattooBool, tattooDetails, isOnMedicationBool, medicationDetails,
        emergencyContactName, emergencyContactPhone, emergencyContactRelationship
      ]
    );

    // Mark user profile as completed
    await pool.query(
      'UPDATE users SET profile_completed = true WHERE id = $1',
      [userId]
    );

    res.json({ 
      success: true, 
      message: 'Profile updated successfully',
      donor: result.rows[0]
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile: ' + error.message });
  }
});

// Hospital profile routes
app.get('/api/hospitals/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT * FROM hospitals WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Hospital profile not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get hospital profile error:', error);
    res.status(500).json({ error: 'Failed to get hospital profile' });
  }
});

app.post('/api/hospitals/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      name,
      address,
      city,
      state,
      zipCode,
      phoneNumber,
      email,
      latitude,
      longitude,
      operatingHours
    } = req.body;

    const result = await pool.query(
      `INSERT INTO hospitals (
        user_id, name, address, city, state, zip_code, phone_number,
        email, latitude, longitude, operating_hours
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (user_id) 
      DO UPDATE SET
        name = $2, address = $3, city = $4, state = $5, zip_code = $6,
        phone_number = $7, email = $8, latitude = $9, longitude = $10,
        operating_hours = $11, updated_at = NOW()
      RETURNING *`,
      [
        userId, name, address, city, state, zipCode, phoneNumber,
        email, latitude, longitude, operatingHours
      ]
    );

    // Mark user profile as completed
    await pool.query(
      'UPDATE users SET profile_completed = true WHERE id = $1',
      [userId]
    );

    res.json({ 
      success: true, 
      message: 'Hospital profile updated successfully',
      hospital: result.rows[0]
    });
  } catch (error) {
    console.error('Update hospital profile error:', error);
    res.status(500).json({ error: 'Failed to update hospital profile: ' + error.message });
  }
});

// Hospital urgency level
app.put('/api/hospitals/urgency', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { urgencyLevel } = req.body;

    if (urgencyLevel < 1 || urgencyLevel > 5) {
      return res.status(400).json({ error: 'Urgency level must be between 1 and 5' });
    }

    const result = await pool.query(
      `UPDATE hospitals SET blood_urgency_level = $1, updated_at = NOW()
       WHERE user_id = $2
       RETURNING *`,
      [urgencyLevel, userId]
    );

    res.json({
      success: true,
      message: 'Urgency level updated successfully',
      hospital: result.rows[0]
    });
  } catch (error) {
    console.error('Update urgency level error:', error);
    res.status(500).json({ error: 'Failed to update urgency level' });
  }
});

// Get all hospitals for map
app.get('/api/hospitals/map', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, address, city, state, zip_code, 
              latitude, longitude, blood_urgency_level
       FROM hospitals 
       WHERE latitude IS NOT NULL AND longitude IS NOT NULL`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get hospitals for map error:', error);
    res.status(500).json({ error: 'Failed to fetch hospitals' });
  }
});

// FIXED: Hospital urgency responses endpoint
app.get('/api/hospitals/urgency-responses', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get hospital ID
    const hospitalResult = await pool.query(
      'SELECT id FROM hospitals WHERE user_id = $1',
      [userId]
    );

    if (hospitalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    const hospitalId = hospitalResult.rows[0].id;

    // Get all urgency responses for this hospital's ACTIVE requests
    const responsesResult = await pool.query(
      `SELECT 
         urr.id,
         urr.urgency_request_id,
         urr.donor_id,
         urr.responded_at,
         urr.response_type,
         urr.rejection_reason,
         urr.scheduled_appointment_id,
         ur.urgency_level,
         ur.message,
         ur.blood_type as blood_type_needed,
         ur.is_active as request_active,  // Add this field
         d.first_name,
         d.last_name,
         d.phone_number,
         u.email,
         d.blood_type,
         a.appointment_date,
         a.status as appointment_status
       FROM urgency_responses urr
       JOIN urgency_requests ur ON urr.urgency_request_id = ur.id
       JOIN donors d ON urr.donor_id = d.id
       JOIN users u ON d.user_id = u.id
       LEFT JOIN appointments a ON urr.scheduled_appointment_id = a.id
       WHERE ur.hospital_id = $1
         AND ur.is_active = true  // Only show responses for active requests
       ORDER BY urr.responded_at DESC`,
      [hospitalId]
    );

    res.json({
      responses: responsesResult.rows,
      totalCount: responsesResult.rows.length
    });

  } catch (error) {
    console.error('Error fetching urgency responses:', error);
    res.status(500).json({ 
      error: 'Internal server error: ' + error.message,
      details: 'Urgency responses may not be available yet'
    });
  }
});

// Simple appointment completion endpoint
app.put('/api/hospitals/appointments/:appointmentId/complete', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { appointmentId } = req.params;

    // Verify hospital owns the appointment and mark as completed
    const appointmentResult = await pool.query(
      `UPDATE appointments a
       SET 
         donor_arrived = true,
         donation_completed = true,
         status = 'completed',
         updated_at = NOW()
       FROM hospitals h
       WHERE a.id = $1 
         AND a.hospital_id = h.id 
         AND h.user_id = $2
       RETURNING a.*`,
      [appointmentId, userId]
    );

    if (appointmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found or access denied' });
    }

    res.json({
      success: true,
      message: 'Appointment marked as completed successfully',
      appointment: appointmentResult.rows[0]
    });

  } catch (error) {
    console.error('Error completing appointment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark urgency request as fulfilled
app.put('/api/hospitals/urgency-requests/:id/fulfill', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const urgencyRequestId = req.params.id;

    // Verify hospital owns the urgency request and mark as fulfilled
    const urgencyRequestResult = await pool.query(
      `UPDATE urgency_requests ur
       SET is_active = false, updated_at = NOW()
       FROM hospitals h
       WHERE ur.id = $1 
         AND ur.hospital_id = h.id 
         AND h.user_id = $2
       RETURNING ur.*`,
      [urgencyRequestId, userId]
    );

    if (urgencyRequestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Urgency request not found or access denied' });
    }

    res.json({
      success: true,
      message: 'Urgency request marked as fulfilled',
      urgencyRequest: urgencyRequestResult.rows[0]
    });

  } catch (error) {
    console.error('Error fulfilling urgency request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Quick status update endpoint for checkboxes
app.put('/api/hospitals/appointments/:appointmentId/quick-status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { appointmentId } = req.params;
    const { donorArrived, donationCompleted } = req.body;

    // Verify hospital owns the appointment
    const appointmentResult = await pool.query(
      `UPDATE appointments a
       SET 
         donor_arrived = COALESCE($1, a.donor_arrived),
         donation_completed = COALESCE($2, a.donation_completed),
         status = CASE 
           WHEN $2 = true THEN 'completed'
           ELSE a.status
         END,
         updated_at = NOW()
       FROM hospitals h
       WHERE a.id = $3 
         AND a.hospital_id = h.id 
         AND h.user_id = $4
       RETURNING a.*`,
      [donorArrived, donationCompleted, appointmentId, userId]
    );

    if (appointmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found or access denied' });
    }

    res.json({
      success: true,
      message: 'Appointment status updated successfully',
      appointment: appointmentResult.rows[0]
    });

  } catch (error) {
    console.error('Error updating appointment status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// FIXED: Hospital appointments endpoint
app.get('/api/hospitals/appointments', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get hospital ID
    const hospitalResult = await pool.query(
      'SELECT id FROM hospitals WHERE user_id = $1',
      [userId]
    );

    if (hospitalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    const hospitalId = hospitalResult.rows[0].id;

    const result = await pool.query(
      `SELECT 
         a.*,
         d.first_name,
         d.last_name,
         d.blood_type,
         d.phone_number,
         u.email,
         ur.blood_type as requested_blood_type,
         ur.urgency_level,
         ur.id as urgency_request_id
       FROM appointments a
       JOIN donors d ON a.donor_id = d.id
       JOIN users u ON d.user_id = u.id
       LEFT JOIN urgency_requests ur ON a.urgency_request_id = ur.id
       WHERE a.hospital_id = $1
       ORDER BY 
         CASE WHEN a.status = 'scheduled' THEN 1
              WHEN a.status = 'completed' THEN 2
              ELSE 3 END,
         a.appointment_date ASC`,
      [hospitalId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching hospital appointments:', error);
    res.status(500).json({ 
      error: 'Internal server error: ' + error.message,
      details: 'Appointments data may not be available yet'
    });
  }
});

// Update appointment status (for hospital to mark donor arrival/completion)
app.put('/api/hospitals/appointments/:appointmentId/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { appointmentId } = req.params;
    const { donorArrived, donationCompleted, hospitalNotes } = req.body;

    // Verify hospital owns the appointment
    const appointmentResult = await pool.query(
      `UPDATE appointments a
       SET 
         donor_arrived = COALESCE($1, a.donor_arrived),
         donation_completed = COALESCE($2, a.donation_completed),
         hospital_notes = COALESCE($3, a.hospital_notes),
         status = CASE 
           WHEN $2 = true THEN 'completed'
           ELSE a.status
         END,
         updated_at = NOW()
       FROM hospitals h
       WHERE a.id = $4 
         AND a.hospital_id = h.id 
         AND h.user_id = $5
       RETURNING a.*`,
      [donorArrived, donationCompleted, hospitalNotes, appointmentId, userId]
    );

    if (appointmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found or access denied' });
    }

    res.json({
      success: true,
      message: 'Appointment status updated successfully',
      appointment: appointmentResult.rows[0]
    });

  } catch (error) {
    console.error('Error updating appointment status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete appointment (when donation completed)
app.delete('/api/hospitals/appointments/:appointmentId', authenticateToken, async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const userId = req.user.userId;

    // Verify hospital owns the appointment
    const appointmentResult = await pool.query(
      `DELETE FROM appointments a
       USING hospitals h
       WHERE a.id = $1 
         AND a.hospital_id = h.id 
         AND h.user_id = $2
       RETURNING a.*`,
      [appointmentId, userId]
    );

    if (appointmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found or access denied' });
    }

    res.json({
      success: true,
      message: 'Appointment deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting appointment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Deactivate urgency request
app.put('/api/hospitals/urgency-requests/:id/deactivate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const urgencyRequestId = req.params.id;

    // Verify hospital owns the urgency request
    const urgencyRequestResult = await pool.query(
      `UPDATE urgency_requests ur
       SET is_active = false, updated_at = NOW()
       FROM hospitals h
       WHERE ur.id = $1 
         AND ur.hospital_id = h.id 
         AND h.user_id = $2
       RETURNING ur.*`,
      [urgencyRequestId, userId]
    );

    if (urgencyRequestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Urgency request not found or access denied' });
    }

    res.json({
      success: true,
      message: 'Urgency request deactivated successfully',
      urgencyRequest: urgencyRequestResult.rows[0]
    });

  } catch (error) {
    console.error('Error deactivating urgency request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Hospital inventory routes
app.get('/api/hospitals/inventory', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get hospital ID from user ID
    const hospitalResult = await pool.query(
      'SELECT id FROM hospitals WHERE user_id = $1',
      [userId]
    );

    if (hospitalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    const hospitalId = hospitalResult.rows[0].id;

    // Get real inventory from blood_inventory table
    const inventoryResult = await pool.query(
      'SELECT blood_type, quantity FROM blood_inventory WHERE hospital_id = $1',
      [hospitalId]
    );

    // Convert array format to object format for frontend compatibility
    const inventory = {};
    inventoryResult.rows.forEach(item => {
      // Convert blood_type from "A+" to "A_plus" format for frontend
      const frontendKey = item.blood_type.replace('+', '_plus').replace('-', '_negative');
      inventory[frontendKey] = item.quantity;
    });

    // Ensure all blood types are present with default 0
    const bloodTypes = ['A_plus', 'A_negative', 'B_plus', 'B_negative', 'AB_plus', 'AB_negative', 'O_plus', 'O_negative'];
    bloodTypes.forEach(type => {
      if (inventory[type] === undefined) {
        inventory[type] = 0;
      }
    });

    res.json(inventory);
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

app.post('/api/hospitals/inventory', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const inventoryData = req.body;

    // Get hospital ID from user ID
    const hospitalResult = await pool.query(
      'SELECT id FROM hospitals WHERE user_id = $1',
      [userId]
    );

    if (hospitalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    const hospitalId = hospitalResult.rows[0].id;

    // Update each blood type in the inventory
    const updates = Object.entries(inventoryData).map(async ([bloodType, quantity]) => {
      // Convert frontend key "A_plus" back to database format "A+"
      const dbBloodType = bloodType.replace('_plus', '+').replace('_negative', '-');
      
      await pool.query(
        `INSERT INTO blood_inventory (hospital_id, blood_type, quantity) 
         VALUES ($1, $2, $3)
         ON CONFLICT (hospital_id, blood_type) 
         DO UPDATE SET quantity = $3, updated_at = NOW()`,
        [hospitalId, dbBloodType, quantity]
      );
    });

    await Promise.all(updates);

    // Return updated inventory
    const updatedInventoryResult = await pool.query(
      'SELECT blood_type, quantity FROM blood_inventory WHERE hospital_id = $1',
      [hospitalId]
    );

    const updatedInventory = {};
    updatedInventoryResult.rows.forEach(item => {
      const frontendKey = item.blood_type.replace('+', '_plus').replace('-', '_negative');
      updatedInventory[frontendKey] = item.quantity;
    });

    // Ensure all blood types are present
    const bloodTypes = ['A_plus', 'A_negative', 'B_plus', 'B_negative', 'AB_plus', 'AB_negative', 'O_plus', 'O_negative'];
    bloodTypes.forEach(type => {
      if (updatedInventory[type] === undefined) {
        updatedInventory[type] = 0;
      }
    });

    res.json(updatedInventory);
  } catch (error) {
    console.error('Update inventory error:', error);
    res.status(500).json({ error: 'Failed to update inventory' });
  }
});

// Create urgency request
app.post('/api/hospitals/urgency-request', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { bloodType, urgencyLevel, message, radiusMiles = 5 } = req.body;

    // Get hospital info
    const hospitalResult = await pool.query(
      `SELECT id, name FROM hospitals WHERE user_id = $1`,
      [userId]
    );

    if (hospitalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    const hospital = hospitalResult.rows[0];

    // Create urgency request
    const requestResult = await pool.query(
      `INSERT INTO urgency_requests 
       (hospital_id, blood_type, urgency_level, message, radius_miles, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING *`,
      [hospital.id, bloodType, urgencyLevel, message, radiusMiles]
    );

    const urgencyRequest = requestResult.rows[0];

    res.json({
      success: true,
      urgencyRequest,
      message: 'Urgency request created successfully'
    });

  } catch (error) {
    console.error('Error creating urgency request:', error);
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
});

// Donor urgency requests
app.get('/api/donors/urgency-requests', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get donor location and blood type
    const donorResult = await pool.query(
      `SELECT d.id as donor_id, d.blood_type, d.latitude, d.longitude 
       FROM donors d WHERE d.user_id = $1`,
      [userId]
    );

    if (donorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Donor not found' });
    }

    const donor = donorResult.rows[0];

    // Get active urgency requests for donor's blood type
    const requestsResult = await pool.query(
      `SELECT 
         ur.*,
         h.id as hospital_id,
         h.name as hospital_name, 
         h.address as hospital_address,
         h.city as hospital_city,
         h.state as hospital_state,
         h.zip_code as hospital_zip_code,
         h.phone_number as hospital_phone,
         h.latitude as hospital_latitude,
         h.longitude as hospital_longitude,
         urr.response_type,
         urr.scheduled_appointment_id
       FROM urgency_requests ur
       JOIN hospitals h ON ur.hospital_id = h.id
       LEFT JOIN urgency_responses urr ON ur.id = urr.urgency_request_id AND urr.donor_id = $1
       WHERE ur.blood_type = $2 
         AND ur.is_active = true
         AND ur.created_at > NOW() - INTERVAL '7 days'
       ORDER BY ur.urgency_level DESC, ur.created_at DESC`,
      [donor.donor_id, donor.blood_type]
    );

    // Calculate distances
    const requestsWithDistance = requestsResult.rows
      .map(request => {
        let distance = 0;
        if (donor.latitude && donor.longitude && request.hospital_latitude && request.hospital_longitude) {
          distance = calculateDistance(
            donor.latitude, donor.longitude,
            request.hospital_latitude, request.hospital_longitude
          );
        }

        const hospitalAddress = `${request.hospital_address}, ${request.hospital_city}, ${request.hospital_state} ${request.hospital_zip_code}`;

        return { 
          ...request, 
          distance: Math.round(distance * 10) / 10,
          hospital_address: hospitalAddress,
          user_response: request.response_type ? {
            response_type: request.response_type,
            scheduled_appointment_id: request.scheduled_appointment_id
          } : null
        };
      })
      .filter(request => request.distance <= request.radius_miles);

    res.json(requestsWithDistance);
  } catch (error) {
    console.error('Error fetching urgency requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get urgency requests count for donor
app.get('/api/donors/urgency-requests-count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get donor blood type
    const donorResult = await pool.query(
      `SELECT blood_type FROM donors WHERE user_id = $1`,
      [userId]
    );

    if (donorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Donor not found' });
    }

    const donor = donorResult.rows[0];

    // Count active urgency requests for donor's blood type
    const countResult = await pool.query(
      `SELECT COUNT(*) 
       FROM urgency_requests 
       WHERE blood_type = $1 
         AND is_active = true
         AND created_at > NOW() - INTERVAL '7 days'`,
      [donor.blood_type]
    );

    res.json({
      count: parseInt(countResult.rows[0].count)
    });
  } catch (error) {
    console.error('Error counting urgency requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Schedule appointment from urgency request
app.post('/api/donors/schedule-appointment', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { urgencyRequestId, hospitalId, appointmentDate, bloodType } = req.body;

    // Get donor ID and info
    const donorResult = await pool.query(
      'SELECT id, first_name, last_name FROM donors WHERE user_id = $1',
      [userId]
    );

    if (donorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Donor not found' });
    }

    const donorId = donorResult.rows[0].id;

    // Verify the urgency request exists and is active
    const urgencyRequestResult = await pool.query(
      `SELECT ur.*, h.name as hospital_name 
       FROM urgency_requests ur
       JOIN hospitals h ON ur.hospital_id = h.id
       WHERE ur.id = $1 AND ur.hospital_id = $2 AND ur.is_active = true`,
      [urgencyRequestId, hospitalId]
    );

    if (urgencyRequestResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Urgency request not found or no longer active' 
      });
    }

    const urgencyRequest = urgencyRequestResult.rows[0];

    // Check if donor already responded to this request
    const existingResponse = await pool.query(
      `SELECT * FROM urgency_responses 
       WHERE urgency_request_id = $1 AND donor_id = $2`,
      [urgencyRequestId, donorId]
    );

    if (existingResponse.rows.length > 0) {
      return res.status(400).json({ 
        error: 'You have already responded to this urgency request' 
      });
    }

    // Create appointment
    const appointmentResult = await pool.query(
      `INSERT INTO appointments 
       (donor_id, hospital_id, appointment_date, blood_type, status, urgency_request_id)
       VALUES ($1, $2, $3, $4, 'scheduled', $5)
       RETURNING *`,
      [donorId, hospitalId, appointmentDate, bloodType, urgencyRequestId]
    );

    const appointment = appointmentResult.rows[0];

    // Create urgency response
    await pool.query(
      `INSERT INTO urgency_responses 
       (urgency_request_id, donor_id, response_type, scheduled_appointment_id, responded_at)
       VALUES ($1, $2, 'accepted', $3, NOW())`,
      [urgencyRequestId, donorId, appointment.id]
    );

    console.log(`✅ Donor scheduled appointment for urgency request from ${urgencyRequest.hospital_name}`);

    res.json({
      success: true,
      appointment: appointment,
      hospitalName: urgencyRequest.hospital_name,
      message: `Appointment scheduled successfully at ${urgencyRequest.hospital_name}`
    });

  } catch (error) {
    console.error('Error scheduling appointment:', error);
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
});

// Reject urgency request
app.post('/api/donors/reject-urgency-request', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { urgencyRequestId, rejectionReason } = req.body;

    // Get donor ID
    const donorResult = await pool.query(
      'SELECT id FROM donors WHERE user_id = $1',
      [userId]
    );

    if (donorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Donor not found' });
    }

    const donorId = donorResult.rows[0].id;

    // Verify the urgency request exists and is active
    const urgencyRequestResult = await pool.query(
      'SELECT * FROM urgency_requests WHERE id = $1 AND is_active = true',
      [urgencyRequestId]
    );

    if (urgencyRequestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Urgency request not found or no longer active' });
    }

    // Create urgency response
    const responseResult = await pool.query(
      `INSERT INTO urgency_responses 
       (urgency_request_id, donor_id, response_type, rejection_reason, responded_at)
       VALUES ($1, $2, 'rejected', $3, NOW())
       ON CONFLICT (urgency_request_id, donor_id) 
       DO UPDATE SET response_type = 'rejected', rejection_reason = $3, responded_at = NOW()
       RETURNING *`,
      [urgencyRequestId, donorId, rejectionReason]
    );

    res.json({
      success: true,
      message: 'Request rejected successfully',
      response: responseResult.rows[0]
    });

  } catch (error) {
    console.error('Error rejecting urgency request:', error);
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
});

// Appointment routes
app.get('/api/appointments/donor', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT a.*, h.name as hospital_name, h.address as hospital_address
       FROM appointments a
       JOIN hospitals h ON a.hospital_id = h.id
       JOIN donors d ON a.donor_id = d.id
       WHERE d.user_id = $1
       ORDER BY a.appointment_date DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get donor appointments error:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

app.post('/api/appointments', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { hospitalId, appointmentDate, bloodType } = req.body;

    // Get donor ID from user ID
    const donorResult = await pool.query(
      'SELECT id FROM donors WHERE user_id = $1',
      [userId]
    );

    if (donorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Donor profile not found' });
    }

    const donorId = donorResult.rows[0].id;

    const result = await pool.query(
      `INSERT INTO appointments (donor_id, hospital_id, appointment_date, blood_type)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [donorId, hospitalId, appointmentDate, bloodType]
    );

    res.status(201).json({
      success: true,
      message: 'Appointment scheduled successfully',
      appointment: result.rows[0]
    });

  } catch (error) {
    console.error('Create appointment error:', error);
    res.status(500).json({ error: 'Failed to schedule appointment' });
  }
});

// Cancel appointment
app.put('/api/donors/cancel-appointment/:appointmentId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { appointmentId } = req.params;

    // Verify donor owns the appointment and cancel it
    const appointmentResult = await pool.query(
      `UPDATE appointments a
       SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = 'donor'
       FROM donors d
       WHERE a.id = $1 
         AND a.donor_id = d.id 
         AND d.user_id = $2
         AND a.status = 'scheduled'
       RETURNING a.*`,
      [appointmentId, userId]
    );

    if (appointmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found or cannot be cancelled' });
    }

    // Update urgency response to reflect cancellation
    await pool.query(
      `UPDATE urgency_responses 
       SET response_type = 'cancelled'
       WHERE scheduled_appointment_id = $1`,
      [appointmentId]
    );

    res.json({
      success: true,
      message: 'Appointment cancelled successfully',
      appointment: appointmentResult.rows[0]
    });

  } catch (error) {
    console.error('Error cancelling appointment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reschedule appointment
app.put('/api/donors/reschedule-appointment', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { appointmentId, newAppointmentDate } = req.body;

    // Verify donor owns the appointment and get hospital info
    const appointmentResult = await pool.query(
      `UPDATE appointments a
       SET appointment_date = $1, updated_at = NOW()
       FROM donors d, hospitals h
       WHERE a.id = $2 
         AND a.donor_id = d.id 
         AND a.hospital_id = h.id
         AND d.user_id = $3
         AND a.status = 'scheduled'
       RETURNING a.*, h.name as hospital_name`,
      [newAppointmentDate, appointmentId, userId]
    );

    if (appointmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found or cannot be rescheduled' });
    }

    const appointment = appointmentResult.rows[0];

    res.json({
      success: true,
      message: `Appointment rescheduled successfully at ${appointment.hospital_name}`,
      appointment: appointment
    });

  } catch (error) {
    console.error('Error rescheduling appointment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to calculate distance
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3958.8; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Debug endpoints
app.get('/api/debug/users', async (req, res) => {
  try {
    const usersResult = await pool.query('SELECT * FROM users');
    const donorsResult = await pool.query('SELECT * FROM donors');
    const hospitalsResult = await pool.query('SELECT * FROM hospitals');
    const appointmentsResult = await pool.query('SELECT * FROM appointments');
    const urgencyRequestsResult = await pool.query('SELECT * FROM urgency_requests');
    const urgencyResponsesResult = await pool.query('SELECT * FROM urgency_responses');
    
    res.json({
      users: usersResult.rows,
      donors: donorsResult.rows,
      hospitals: hospitalsResult.rows,
      appointments: appointmentsResult.rows,
      urgency_requests: urgencyRequestsResult.rows,
      urgency_responses: urgencyResponsesResult.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Basic nearby donors endpoint
app.get('/api/hospitals/nearby-donors', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    let { bloodType, maxDistance = 15 } = req.query; // Increased default to 15 miles

    console.log('🔍 Basic nearby donors request:', { bloodType, maxDistance });

    // FIX: Same robust blood type handling
    if (bloodType && bloodType !== 'all') {
      if (bloodType.includes(' ')) {
        bloodType = bloodType.replace(' ', '+');
        console.log('🩸 Fixed blood type (space to plus):', bloodType);
      } else if (bloodType.includes('%2B')) {
        bloodType = bloodType.replace('%2B', '+');
        console.log('🩸 Fixed blood type (URL decoded):', bloodType);
      }
    }

    // Get hospital with coordinates
    const hospitalResult = await pool.query(
      `SELECT id, name, latitude, longitude 
       FROM hospitals 
       WHERE user_id = $1 AND latitude IS NOT NULL AND longitude IS NOT NULL`,
      [userId]
    );

    if (hospitalResult.rows.length === 0) {
      return res.status(400).json({ 
        error: "Hospital location not set. Please update your address in profile." 
      });
    }

    const hospital = hospitalResult.rows[0];

    // Build donor query
    let query = `
      SELECT 
        id, first_name, last_name, blood_type,
        latitude, longitude, eligibility_status,
        street, city, state, zip_code,
        phone_number, email
      FROM donors 
      WHERE latitude IS NOT NULL 
        AND longitude IS NOT NULL
    `;
    const params = [];

    if (bloodType && bloodType !== 'all') {
      query += ` AND blood_type = $${params.length + 1}`;
      params.push(bloodType);
    }

    const donorsResult = await pool.query(query, params);

    // Calculate distances
    const nearbyDonors = donorsResult.rows
      .map(donor => {
        const distance = calculateDistance(
          parseFloat(hospital.latitude),
          parseFloat(hospital.longitude),
          parseFloat(donor.latitude),
          parseFloat(donor.longitude)
        );
        return { ...donor, distance };
      })
      .filter(d => d.distance <= maxDistance)
      .map(({ distance, ...donor }) => ({
        ...donor,
        distance: Math.round(distance * 10) / 10
      }))
      .sort((a, b) => a.distance - b.distance);

    res.json({
      hospital: {
        id: hospital.id,
        name: hospital.name,
        latitude: hospital.latitude,
        longitude: hospital.longitude
      },
      donors: nearbyDonors,
      totalCount: nearbyDonors.length,
      bloodType: bloodType || 'all',
      maxDistance: parseInt(maxDistance)
    });

  } catch (error) {
    console.error('Nearby donors error:', error);
    res.status(500).json({ error: 'Failed to load nearby donors' });
  }
});

// Enhanced nearby donors with responses endpoint
app.get('/api/hospitals/nearby-donors-with-responses', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    let { bloodType, maxDistance = 5 } = req.query;

    console.log('🔍 Nearby donors request:', { bloodType, maxDistance });

    // FIX: Properly handle blood type parameter
    if (bloodType) {
      // Handle both space and encoded plus sign
      if (bloodType.includes(' ')) {
        bloodType = bloodType.replace(' ', '+');
        console.log('🩸 Fixed blood type (space to plus):', bloodType);
      } else if (bloodType.includes('%2B')) {
        bloodType = bloodType.replace('%2B', '+');
        console.log('🩸 Fixed blood type (URL decoded):', bloodType);
      }
      
      // Also handle negative blood types
      if (bloodType.endsWith('-')) {
        // Negative types are usually fine, but let's log it
        console.log('🩸 Negative blood type:', bloodType);
      }
    }

    // Get hospital with coordinates
    const hospitalResult = await pool.query(
      `SELECT id, name, latitude, longitude 
       FROM hospitals 
       WHERE user_id = $1 AND latitude IS NOT NULL AND longitude IS NOT NULL`,
      [userId]
    );

    if (hospitalResult.rows.length === 0) {
      return res.status(400).json({ 
        error: "Hospital location not set. Please update your address in profile." 
      });
    }

    const hospital = hospitalResult.rows[0];
    console.log('🏥 Hospital found:', hospital.name, hospital.latitude, hospital.longitude);

    // Get donors with response status - FIXED query
    const donorsResult = await pool.query(
      `SELECT 
         d.id, d.first_name, d.last_name, d.blood_type,
         d.latitude, d.longitude, d.eligibility_status,
         d.street, d.city, d.state, d.zip_code,
         d.phone_number, u.email,
         urr.responded_at IS NOT NULL as has_responded,
         a.appointment_date,
         a.id as appointment_id
       FROM donors d
       JOIN users u ON d.user_id = u.id
       LEFT JOIN urgency_responses urr ON d.id = urr.donor_id 
         AND urr.urgency_request_id IN (
           SELECT id FROM urgency_requests WHERE hospital_id = $1
         )
       LEFT JOIN appointments a ON urr.scheduled_appointment_id = a.id
       WHERE d.latitude IS NOT NULL 
         AND d.longitude IS NOT NULL
         AND d.blood_type = $2`,
      [hospital.id, bloodType]
    );

    console.log('📊 Database query found donors:', donorsResult.rows.length);

    // Calculate distances
    const nearbyDonors = donorsResult.rows
      .map(donor => {
        const distance = calculateDistance(
          parseFloat(hospital.latitude),
          parseFloat(hospital.longitude),
          parseFloat(donor.latitude),
          parseFloat(donor.longitude)
        );
        return { ...donor, distance };
      })
      .filter(d => d.distance <= maxDistance)
      .map(({ distance, ...donor }) => ({
        ...donor,
        distance: Math.round(distance * 10) / 10
      }))
      .sort((a, b) => a.distance - b.distance);

    console.log('📍 Nearby donors after distance filter:', nearbyDonors.length);

    res.json({
      hospital: {
        id: hospital.id,
        name: hospital.name,
        latitude: hospital.latitude,
        longitude: hospital.longitude
      },
      donors: nearbyDonors,
      totalCount: nearbyDonors.length,
      bloodType: bloodType,
      maxDistance: parseInt(maxDistance)
    });

  } catch (error) {
    console.error('Nearby donors with responses error:', error);
    res.status(500).json({ error: 'Failed to load nearby donors with responses' });
  }
});

// Initialize sample data
app.post('/api/admin/init-sample-data', authenticateToken, async (req, res) => {
  try {
    // Create sample urgency requests
    const hospitalResult = await pool.query('SELECT id FROM hospitals WHERE user_id = $1', [req.user.userId]);
    
    if (hospitalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    const hospitalId = hospitalResult.rows[0].id;

    // Create sample urgency requests
    await pool.query(
      `INSERT INTO urgency_requests (hospital_id, blood_type, urgency_level, message, radius_miles, is_active)
       VALUES 
         ($1, 'O+', 4, 'Urgent need for O+ blood for emergency surgeries', 10, true),
         ($1, 'A-', 3, 'Running low on A- blood supply', 10, true)`,
      [hospitalId]
    );

    res.json({ success: true, message: 'Sample data initialized' });
  } catch (error) {
    console.error('Error initializing sample data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Geocode existing donors and hospitals that don't have coordinates
app.post('/api/admin/geocode-existing', async (req, res) => {
  try {
    console.log('Geocoding existing records with missing coordinates...');

    // Geocode hospitals with missing coordinates
    const hospitalsMissingCoords = await pool.query(
      `SELECT id, name, address, city, state, zip_code 
       FROM hospitals 
       WHERE latitude IS NULL OR longitude IS NULL`
    );

    for (const hospital of hospitalsMissingCoords.rows) {
      const fullAddress = `${hospital.address}, ${hospital.city}, ${hospital.state} ${hospital.zip_code}`;
      const coordinates = await geocodeAddress(fullAddress);
      
      await pool.query(
        'UPDATE hospitals SET latitude = $1, longitude = $2 WHERE id = $3',
        [coordinates.latitude, coordinates.longitude, hospital.id]
      );
      
      console.log(`Geocoded hospital: ${hospital.name} -> ${coordinates.latitude}, ${coordinates.longitude}`);
    }

    // Geocode donors with missing coordinates
    const donorsMissingCoords = await pool.query(
      `SELECT id, first_name, last_name, street, city, state, zip_code 
       FROM donors 
       WHERE latitude IS NULL OR longitude IS NULL`
    );

    for (const donor of donorsMissingCoords.rows) {
      const fullAddress = `${donor.street}, ${donor.city}, ${donor.state} ${donor.zip_code}`;
      const coordinates = await geocodeAddress(fullAddress);
      
      await pool.query(
        'UPDATE donors SET latitude = $1, longitude = $2 WHERE id = $3',
        [coordinates.latitude, coordinates.longitude, donor.id]
      );
      
      console.log(`Geocoded donor: ${donor.first_name} ${donor.last_name} -> ${coordinates.latitude}, ${coordinates.longitude}`);
    }

    res.json({
      success: true,
      message: `Geocoded ${hospitalsMissingCoords.rows.length} hospitals and ${donorsMissingCoords.rows.length} donors`
    });

  } catch (error) {
    console.error('Geocoding migration error:', error);
    res.status(500).json({ error: 'Migration failed: ' + error.message });
  }
});

// Public endpoint to fix coordinates (for development only)
app.post('/api/admin/fix-coordinates-public', async (req, res) => {
  try {
    console.log('Fixing coordinates for all donors and hospitals...');

    // Fix donors with invalid coordinates
    const donorsResult = await pool.query(`
      UPDATE donors 
      SET 
        latitude = CASE 
          WHEN latitude IS NULL OR latitude = 0 OR latitude::text ~ '[^0-9.-]' THEN 33.7490 + (RANDOM() * 0.1 - 0.05)
          ELSE latitude 
        END,
        longitude = CASE 
          WHEN longitude IS NULL OR longitude = 0 OR longitude::text ~ '[^0-9.-]' THEN -84.3880 + (RANDOM() * 0.1 - 0.05)
          ELSE longitude 
        END
      WHERE latitude IS NULL OR longitude IS NULL OR latitude = 0 OR longitude = 0 
         OR latitude::text ~ '[^0-9.-]' OR longitude::text ~ '[^0-9.-]'
      RETURNING id
    `);

    // Fix hospitals with invalid coordinates
    const hospitalsResult = await pool.query(`
      UPDATE hospitals 
      SET 
        latitude = CASE 
          WHEN latitude IS NULL OR latitude = 0 OR latitude::text ~ '[^0-9.-]' THEN 33.7490 + (RANDOM() * 0.05 - 0.025)
          ELSE latitude 
        END,
        longitude = CASE 
          WHEN longitude IS NULL OR longitude = 0 OR longitude::text ~ '[^0-9.-]' THEN -84.3880 + (RANDOM() * 0.05 - 0.025)
          ELSE longitude 
        END
      WHERE latitude IS NULL OR longitude IS NULL OR latitude = 0 OR longitude = 0
         OR latitude::text ~ '[^0-9.-]' OR longitude::text ~ '[^0-9.-]'
      RETURNING id
    `);

    // Check current status
    const statusResult = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM donors WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND latitude != 0 AND longitude != 0) as donors_with_coords,
        (SELECT COUNT(*) FROM hospitals WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND latitude != 0 AND longitude != 0) as hospitals_with_coords,
        (SELECT COUNT(*) FROM donors) as total_donors,
        (SELECT COUNT(*) FROM hospitals) as total_hospitals
    `);

    const status = statusResult.rows[0];

    res.json({
      success: true,
      message: 'Coordinates fixed successfully',
      donors_updated: donorsResult.rowCount,
      hospitals_updated: hospitalsResult.rowCount,
      summary: {
        total_donors: status.total_donors,
        donors_with_valid_coords: status.donors_with_coords,
        total_hospitals: status.total_hospitals,
        hospitals_with_valid_coords: status.hospitals_with_coords
      }
    });

  } catch (error) {
    console.error('Error fixing coordinates:', error);
    res.status(500).json({ 
      error: 'Failed to fix coordinates: ' + error.message 
    });
  }
});

// Public endpoint to check coordinate status
app.get('/api/admin/coordinate-status-public', async (req, res) => {
  try {
    const statusResult = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM donors) as total_donors,
        (SELECT COUNT(*) FROM donors WHERE latitude IS NULL OR longitude IS NULL OR latitude = 0 OR longitude = 0 OR latitude::text ~ '[^0-9.-]' OR longitude::text ~ '[^0-9.-]') as donors_invalid_coords,
        (SELECT COUNT(*) FROM donors WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND latitude != 0 AND longitude != 0) as donors_valid_coords,
        (SELECT COUNT(*) FROM hospitals) as total_hospitals,
        (SELECT COUNT(*) FROM hospitals WHERE latitude IS NULL OR longitude IS NULL OR latitude = 0 OR longitude = 0 OR latitude::text ~ '[^0-9.-]' OR longitude::text ~ '[^0-9.-]') as hospitals_invalid_coords,
        (SELECT COUNT(*) FROM hospitals WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND latitude != 0 AND longitude != 0) as hospitals_valid_coords
    `);

    res.json(statusResult.rows[0]);
  } catch (error) {
    console.error('Coordinate status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint to check specific donor distances
app.get('/api/admin/debug-distance', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get hospital coordinates
    const hospitalResult = await pool.query(
      `SELECT id, name, latitude, longitude 
       FROM hospitals WHERE user_id = $1`,
      [userId]
    );
    
    const hospital = hospitalResult.rows[0];
    console.log('🏥 Hospital:', hospital.name, hospital.latitude, hospital.longitude);
    
    // Get all O+ donors
    const donorsResult = await pool.query(
      `SELECT id, first_name, last_name, blood_type, latitude, longitude 
       FROM donors WHERE blood_type = 'O+'`
    );
    
    console.log('🩸 O+ donors found:', donorsResult.rows.length);
    
    const donorsWithDistance = donorsResult.rows.map(donor => {
      const distance = calculateDistance(
        parseFloat(hospital.latitude),
        parseFloat(hospital.longitude),
        parseFloat(donor.latitude),
        parseFloat(donor.longitude)
      );
      
      return {
        name: `${donor.first_name} ${donor.last_name}`,
        blood_type: donor.blood_type,
        donor_lat: donor.latitude,
        donor_lng: donor.longitude,
        hospital_lat: hospital.latitude,
        hospital_lng: hospital.longitude,
        distance: distance,
        within_5_miles: distance <= 5
      };
    });
    
    res.json({
      hospital: {
        name: hospital.name,
        latitude: hospital.latitude,
        longitude: hospital.longitude
      },
      donors: donorsWithDistance
    });
    
  } catch (error) {
    console.error('Distance debug error:', error);
    res.status(500).json({ error: error.message });
  }
});


// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🐛 Debug: http://localhost:${PORT}/api/debug/users`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use!`);
  } else {
    console.error('❌ Server failed to start:', err);
  }
  process.exit(1);
});