import mongoose from 'mongoose';

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

export const Donor = mongoose.model('Donor', donorSchema);