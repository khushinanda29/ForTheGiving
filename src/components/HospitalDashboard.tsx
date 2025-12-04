// src/components/HospitalDashboard.tsx
import { useState, useEffect } from "react";
import { Navbar } from "./Navbar";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { UrgencyControl } from "./UrgencyControl";
import { GoogleMapsInterface } from "./GoogleMapsInterface";
import { HospitalAppointments } from "./HospitalAppointments";
import { HospitalUrgencyResponses } from "./HospitalUrgencyResponses";
import { Droplet, Users, Clock, Plus, Phone, MapPin, Loader2 } from "lucide-react";

interface HospitalDashboardProps {
  onLogout: () => void;
}

interface HospitalProfile {
  id: number;
  name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  phone_number: string;
  blood_urgency_level: number;
  operating_hours: string;
  latitude: number;
  longitude: number;
}

interface BloodInventory {
  A_plus: number;
  A_negative: number;
  B_plus: number;
  B_negative: number;
  AB_plus: number;
  AB_negative: number;
  O_plus: number;
  O_negative: number;
}

// Define static order for blood types to prevent shifting
const BLOOD_TYPE_ORDER = [
  'A_plus',
  'A_negative', 
  'B_plus',
  'B_negative',
  'AB_plus',
  'AB_negative',
  'O_plus',
  'O_negative'
] as const;

// Proper blood type label mapping (database format to display format)
const BLOOD_TYPE_LABELS: Record<string, string> = {
  'A_plus': 'A+',
  'A_negative': 'A-',
  'B_plus': 'B+',
  'B_negative': 'B-',
  'AB_plus': 'AB+',
  'AB_negative': 'AB-',
  'O_plus': 'O+',
  'O_negative': 'O-'
};

export function HospitalDashboard({ onLogout }: HospitalDashboardProps) {
  const [bloodTypeNeeded, setBloodTypeNeeded] = useState<string>("");
  const [hospitalProfile, setHospitalProfile] = useState<HospitalProfile | null>(null);
  const [inventory, setInventory] = useState<BloodInventory | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHospitalData = async () => {
      try {
        const token = localStorage.getItem('token');
        
        // Fetch hospital profile
        const profileResponse = await fetch('http://localhost:3001/api/hospitals/profile', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          console.log('Hospital profile loaded:', profileData);
          setHospitalProfile(profileData);
        }

        // Fetch inventory
        const inventoryResponse = await fetch('http://localhost:3001/api/hospitals/inventory', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (inventoryResponse.ok) {
          const inventoryData = await inventoryResponse.json();
          console.log('Inventory loaded:', inventoryData);
          setInventory(inventoryData);
        }
      } catch (error) {
        console.error('Error fetching hospital data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHospitalData();
  }, []);

  const handleUrgencyChange = (level: number, enabled: boolean, message: string, bloodType: string) => {
    console.log('Urgency change:', { level, enabled, message, bloodType });
    // Convert blood type from display format (A+) to display format that GoogleMapsInterface expects
    setBloodTypeNeeded(bloodType); // Should be in format like "A+", "B-", etc.
    updateUrgencyLevel(level);
  };

  const updateUrgencyLevel = async (level: number) => {
    try {
      const token = localStorage.getItem('token');
      await fetch('http://localhost:3001/api/hospitals/urgency', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ urgencyLevel: level })
      });
    } catch (error) {
      console.error('Error updating urgency level:', error);
    }
  };

  const updateInventory = async (bloodType: string, newValue: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/hospitals/inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          [bloodType]: newValue
        })
      });

      if (response.ok) {
        const updatedInventory = await response.json();
        setInventory(updatedInventory);
      }
    } catch (error) {
      console.error('Error updating inventory:', error);
    }
  };

  const calculateTotalUnits = () => {
    if (!inventory) return 0;
    return Object.values(inventory).reduce((sum, units) => sum + units, 0);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-[#D72638] animate-spin" />
          <p className="text-[#333333]">Loading hospital dashboard...</p>
        </div>
      </div>
    );
  }

return (
  <div className="min-h-screen bg-[#F3F4F6]">
    <Navbar title="Hospital Dashboard" onLogout={onLogout} />

    <div className="max-w-7xl mx-auto p-8">
      {/* Hospital Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#333333] mb-2">
          {hospitalProfile?.name || "Hospital Dashboard"}
        </h1>
        <div className="flex flex-wrap gap-4 text-sm text-[#333333] opacity-70">
          <div className="flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            <span>{hospitalProfile?.address}, {hospitalProfile?.city}, {hospitalProfile?.state} {hospitalProfile?.zip_code}</span>
          </div>
          <div className="flex items-center gap-1">
            <Phone className="w-4 h-4" />
            <span>{hospitalProfile?.phone_number}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span>{hospitalProfile?.operating_hours}</span>
          </div>
        </div>
      </div>

      {/* Urgency Control and Map */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <UrgencyControl onUrgencyChange={handleUrgencyChange} />
        <GoogleMapsInterface 
          hospitalName={hospitalProfile?.name || "Hospital"}
          address={`${hospitalProfile?.address || ''}, ${hospitalProfile?.city || ''}, ${hospitalProfile?.state || ''} ${hospitalProfile?.zip_code || ''}`}
          bloodTypeNeeded={bloodTypeNeeded}
        />
      </div>

      {/* Combined Appointments & Responses Section */}
      <div className="mb-8">
        <HospitalAppointments />
      </div>

      {/* Rest of your dashboard remains the same... */}
      {/* Summary Stats Cards */}
      <div className="mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#333333] opacity-60 mb-1">Available Blood Units</p>
                <CardTitle>{calculateTotalUnits().toLocaleString()}</CardTitle>
              </div>
              <Droplet className="w-10 h-10 text-[#D72638] opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Blood Inventory Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Blood Inventory</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            {inventory && BLOOD_TYPE_ORDER.map((bloodType) => {
              const units = inventory[bloodType];
              const typeLabel = BLOOD_TYPE_LABELS[bloodType];
              const isLow = units < 50;
              const isCritical = units < 20;
              
              return (
                <div
                  key={bloodType}
                  className={`flex flex-col items-center p-4 border rounded-lg transition-all ${
                    isCritical 
                      ? 'border-red-300 bg-red-50' 
                      : isLow 
                      ? 'border-orange-300 bg-orange-50'
                      : 'border-[#F3F4F6] hover:border-[#D72638]'
                  }`}
                >
                  <Droplet className={`w-6 h-6 mb-2 ${
                    isCritical ? 'text-red-600' : isLow ? 'text-orange-500' : 'text-[#D72638]'
                  }`} />
                  <p className="text-[#333333] mb-1 font-medium">{typeLabel}</p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      value={units}
                      onChange={(e) => updateInventory(bloodType, parseInt(e.target.value) || 0)}
                      className={`w-16 text-center ${
                        isCritical ? 'border-red-300' : isLow ? 'border-orange-300' : ''
                      }`}
                    />
                    <span className="text-xs text-[#333333] opacity-60">units</span>
                  </div>
                  {(isLow || isCritical) && (
                    <Badge variant="outline" className={`mt-2 text-xs ${
                      isCritical 
                        ? 'border-red-300 text-red-700' 
                        : 'border-orange-300 text-orange-700'
                    }`}>
                      {isCritical ? 'CRITICAL' : 'LOW'}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
);
}