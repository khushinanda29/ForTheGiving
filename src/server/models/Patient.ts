import mongoose from 'mongoose';

export interface IPatient extends mongoose.Document {
  hospitalId: mongoose.Types.ObjectId;
  patientInfo: {
    name: string;
    bloodType: string;
    condition: string;
    urgency: number;
    admissionDate: Date;
  };
  bloodRequest: {
    bloodType: string;
    unitsNeeded: number;
    isFulfilled: boolean;
    fulfilledDate?: Date;
  };
}

const patientSchema = new mongoose.Schema({
  hospitalId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Hospital', 
    required: true 
  },
  patientInfo: {
    name: { type: String, required: true },
    bloodType: { 
      type: String, 
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      required: true 
    },
    condition: String,
    urgency: { type: Number, min: 1, max: 5, default: 1 },
    admissionDate: { type: Date, default: Date.now }
  },
  bloodRequest: {
    bloodType: { 
      type: String, 
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      required: true 
    },
    unitsNeeded: { type: Number, required: true },
    isFulfilled: { type: Boolean, default: false },
    fulfilledDate: Date
  }
}, { timestamps: true });

export default mongoose.model<IPatient>('Patient', patientSchema);