import mongoose from 'mongoose';

export interface IHospital extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  hospitalInfo: {
    name: string;
    address: string;
    phone: string;
    email: string;
  };
  location: {
    latitude: number;
    longitude: number;
  };
  inventory: Array<{
    bloodType: string;
    units: number;
    lastUpdated: Date;
  }>;
  urgencyLevel: number;
}

const hospitalSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    unique: true
  },
  hospitalInfo: {
    name: { type: String, required: true },
    address: { type: String, required: true },
    phone: String,
    email: String
  },
  location: {
    latitude: Number,
    longitude: Number
  },
  inventory: [{
    bloodType: { 
      type: String, 
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      required: true 
    },
    units: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
  }],
  urgencyLevel: { type: Number, min: 1, max: 5, default: 1 }
}, { timestamps: true });

export default mongoose.model<IHospital>('Hospital', hospitalSchema);