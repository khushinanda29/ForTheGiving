// src/components/DonorDashboard.tsx
import { UrgencyResponse } from "./UrgencyResponse";
import { useState, useEffect } from "react";
import { Navbar } from "./Navbar";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Calendar, MapPin, History, Droplet, Clock, Loader2, AlertCircle, Plus, X } from "lucide-react";

interface DonorDashboardProps {
  onLogout: () => void;
}

interface DonorProfile {
  id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  blood_type: string;
  date_of_birth: string;
  gender: string;
  phone_number: string;
  street: string;
  city: string;
  state: string;
  zip_code: string;
  weight: number;
  height: number;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  eligibility_status: string;
}

interface Hospital {
  id: number;
  name: string;
  address: string;
  city: string;
  state: string;
  phone_number: string;
  operating_hours: string;
}

interface Appointment {
  id: number;
  hospital_id: number;
  appointment_date: string;
  status: string;
  blood_type: string;
  hospital_name: string;
  hospital_address: string;
}

export function DonorDashboard({ onLogout }: DonorDashboardProps) {
  const [donorProfile, setDonorProfile] = useState<DonorProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeUrgencyRequests, setActiveUrgencyRequests] = useState(0);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<number | null>(null);
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [donorAppointments, setDonorAppointments] = useState<Appointment[]>([]);
  const [activeAppointmentTab, setActiveAppointmentTab] = useState<'upcoming' | 'past'>('upcoming');

  useEffect(() => {
    fetchDonorProfile();
    fetchHospitals();
    fetchDonorAppointments();
  }, []);

  const fetchDonorProfile = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch('http://localhost:3001/api/donors/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch donor profile');
      }

      const profileData = await response.json();
      console.log('Fetched donor profile:', profileData);
      setDonorProfile(profileData);

      // Fetch active urgency requests count
      const urgencyResponse = await fetch('http://localhost:3001/api/donors/urgency-requests-count', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (urgencyResponse.ok) {
        const urgencyData = await urgencyResponse.json();
        setActiveUrgencyRequests(urgencyData.count);
      }
    } catch (err) {
      console.error('Error fetching donor profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHospitals = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/hospitals/map', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const hospitalsData = await response.json();
        setHospitals(hospitalsData);
      }
    } catch (error) {
      console.error('Error fetching hospitals:', error);
    }
  };

  const fetchDonorAppointments = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/appointments/donor', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const appointments = await response.json();
        setDonorAppointments(appointments);
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
    }
  };

  const handleScheduleAppointment = async () => {
    if (!selectedHospital || !appointmentDate || !appointmentTime) {
      alert('Please fill in all fields');
      return;
    }

    const appointmentDateTime = `${appointmentDate}T${appointmentTime}`;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          hospitalId: selectedHospital,
          appointmentDate: appointmentDateTime,
          bloodType: donorProfile?.blood_type
        })
      });

      if (response.ok) {
        alert('Appointment scheduled successfully!');
        setShowAppointmentModal(false);
        setSelectedHospital(null);
        setAppointmentDate('');
        setAppointmentTime('');
        fetchDonorAppointments(); // Refresh appointments
      } else {
        const errorData = await response.json();
        alert(`Failed to schedule appointment: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error scheduling appointment:', error);
      alert('Failed to schedule appointment');
    }
  };

  const handleCancelAppointment = async (appointmentId: number) => {
    if (!confirm('Are you sure you want to cancel this appointment?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/donors/cancel-appointment/${appointmentId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        alert('Appointment cancelled successfully!');
        fetchDonorAppointments(); // Refresh appointments
      }
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      alert('Failed to cancel appointment');
    }
  };

  const handleRescheduleAppointment = async (appointmentId: number, newDateTime: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/donors/reschedule-appointment', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          appointmentId,
          newAppointmentDate: newDateTime
        })
      });

      if (response.ok) {
        alert('Appointment rescheduled successfully!');
        fetchDonorAppointments();
      }
    } catch (error) {
      console.error('Error rescheduling appointment:', error);
      alert('Failed to reschedule appointment');
    }
  };

  // Format address from separate fields
  const formatAddress = (profile: DonorProfile) => {
    const parts = [profile.street, profile.city, profile.state, profile.zip_code]
      .filter(part => part && part.trim() !== '');
    return parts.join(', ');
  };

  // Calculate next eligible date (56 days from now)
  const nextEligibleDate = new Date();
  nextEligibleDate.setDate(nextEligibleDate.getDate() + 56);

  // Get eligibility badge color and text
  const getEligibilityBadge = () => {
    if (!donorProfile) return null;
    
    switch (donorProfile.eligibility_status) {
      case 'eligible':
        return <Badge className="bg-green-600 text-white">Eligible</Badge>;
      case 'ineligible':
        return <Badge className="bg-red-600 text-white">Ineligible</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-600 text-white">Pending Review</Badge>;
      default:
        return <Badge className="bg-gray-600 text-white">Unknown</Badge>;
    }
  };

  // Filter appointments
  const upcomingAppointments = donorAppointments.filter(apt => 
    apt.status === 'scheduled' && new Date(apt.appointment_date) > new Date()
  );
  
  const pastAppointments = donorAppointments.filter(apt => 
    apt.status === 'completed' || apt.status === 'cancelled' || new Date(apt.appointment_date) <= new Date()
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-[#D72638] animate-spin" />
          <p className="text-[#333333]">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F3F4F6]">
        <Navbar title="Donor Dashboard" onLogout={onLogout} />
        <div className="max-w-7xl mx-auto p-8">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <p className="text-red-500 mb-4">Error: {error}</p>
              <Button 
                onClick={() => window.location.reload()}
                className="bg-[#D72638] hover:bg-[#A61B2B] text-white"
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3F4F6]">
      <Navbar title="Donor Dashboard" onLogout={onLogout} />

      <div className="max-w-7xl mx-auto p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Summary Card */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>
                      {donorProfile ? `${donorProfile.first_name} ${donorProfile.last_name}` : 'No Profile Data'}
                    </CardTitle>
                    <CardDescription>Donor Profile</CardDescription>
                  </div>
                  {getEligibilityBadge()}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-[#333333] opacity-60">Blood Type</p>
                    <div className="flex items-center gap-2">
                      <Droplet className="w-4 h-4 text-[#D72638]" />
                      <span className="text-[#333333]">
                        {donorProfile?.blood_type || 'Not specified'}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-[#333333] opacity-60">Last Donation</p>
                    <p className="text-[#333333]">Never donated</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-[#333333] opacity-60">Active Requests</p>
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600" />
                      <span className="text-[#333333]">
                        {activeUrgencyRequests} urgent needs
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Additional Profile Info */}
                {donorProfile && (
                  <div className="mt-6 grid grid-cols-2 gap-4 pt-6 border-t border-[#F3F4F6]">
                    <div className="space-y-1">
                      <p className="text-sm text-[#333333] opacity-60">Phone</p>
                      <p className="text-[#333333]">{donorProfile.phone_number || 'Not provided'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-[#333333] opacity-60">Address</p>
                      <p className="text-[#333333] text-sm">
                        {formatAddress(donorProfile) || 'Not provided'}
                      </p>
                    </div>
                    {donorProfile.date_of_birth && (
                      <div className="space-y-1">
                        <p className="text-sm text-[#333333] opacity-60">Date of Birth</p>
                        <p className="text-[#333333]">
                          {new Date(donorProfile.date_of_birth).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                    {donorProfile.gender && (
                      <div className="space-y-1">
                        <p className="text-sm text-[#333333] opacity-60">Gender</p>
                        <p className="text-[#333333] capitalize">{donorProfile.gender}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* My Appointments Section */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>My Appointments</CardTitle>
                <CardDescription>
                  Manage your blood donation appointments
                </CardDescription>
                
                {/* Appointment Tabs */}
                <div className="flex border-b border-gray-200 mt-4">
                  <button
                    className={`px-4 py-2 font-medium text-sm ${
                      activeAppointmentTab === 'upcoming'
                        ? 'border-b-2 border-blue-500 text-blue-700'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => setActiveAppointmentTab('upcoming')}
                  >
                    Upcoming ({upcomingAppointments.length})
                  </button>
                  <button
                    className={`px-4 py-2 font-medium text-sm ${
                      activeAppointmentTab === 'past'
                        ? 'border-b-2 border-green-500 text-green-700'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => setActiveAppointmentTab('past')}
                  >
                    Past ({pastAppointments.length})
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                {activeAppointmentTab === 'upcoming' ? (
                  upcomingAppointments.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No upcoming appointments</p>
                      <p className="text-sm mt-2">Schedule your first appointment to get started!</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {upcomingAppointments.map((appointment) => (
                        <div key={appointment.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-semibold text-lg">{appointment.hospital_name}</h3>
                              <p className="text-sm text-gray-600">{appointment.hospital_address}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <Calendar className="w-4 h-4 text-gray-500" />
                                <span className="text-sm">
                                  {new Date(appointment.appointment_date).toLocaleString()}
                                </span>
                                <Badge className={
                                  appointment.status === 'scheduled' 
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }>
                                  {appointment.status}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const newDate = prompt(
                                    'Enter new date and time:',
                                    appointment.appointment_date.slice(0, 16)
                                  );
                                  if (newDate) {
                                    handleRescheduleAppointment(appointment.id, newDate);
                                  }
                                }}
                              >
                                Reschedule
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 border-red-300 hover:bg-red-50"
                                onClick={() => handleCancelAppointment(appointment.id)}
                              >
                                <X className="w-4 h-4 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  pastAppointments.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No past appointments</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {pastAppointments.map((appointment) => (
                        <div key={appointment.id} className="border rounded-lg p-4 bg-gray-50">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-semibold text-lg">{appointment.hospital_name}</h3>
                              <p className="text-sm text-gray-600">{appointment.hospital_address}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <Calendar className="w-4 h-4 text-gray-500" />
                                <span className="text-sm">
                                  {new Date(appointment.appointment_date).toLocaleString()}
                                </span>
                                <Badge className={
                                  appointment.status === 'completed' 
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-red-100 text-red-800'
                                }>
                                  {appointment.status}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </CardContent>
            </Card>

            {/* Urgent Blood Requests Section */}
            {donorProfile?.eligibility_status === 'eligible' && (
              <div className="mt-6">
                <Card className="border-red-200 border-2">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-red-700">
                          <AlertCircle className="w-5 h-5" />
                          Urgent Blood Requests
                          {activeUrgencyRequests > 0 && (
                            <Badge className="bg-red-600 text-white ml-2">
                              {activeUrgencyRequests} Active
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="text-red-600">
                          Hospitals in your area urgently need {donorProfile.blood_type} blood
                        </CardDescription>
                      </div>
                      <Button 
                        onClick={() => setShowAppointmentModal(true)}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Schedule Appointment
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <UrgencyResponse />
                  </CardContent>
                </Card>
              </div>
            )}

          </div>

          {/* Side Panel - Quick Stats */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[#333333] opacity-60">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">Next eligible date</span>
                  </div>
                  <p className="text-[#333333]">
                    {nextEligibleDate.toLocaleDateString('en-US', { 
                      month: 'long', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[#333333] opacity-60">
                    <Droplet className="w-4 h-4" />
                    <span className="text-sm">Total donations</span>
                  </div>
                  <p className="text-[#333333]">
                    {pastAppointments.filter(apt => apt.status === 'completed').length} donations
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[#333333] opacity-60">
                    <Droplet className="w-4 h-4" />
                    <span className="text-sm">Lives impacted</span>
                  </div>
                  <p className="text-[#D72638]">
                    {pastAppointments.filter(apt => apt.status === 'completed').length * 3} lives saved
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[#333333] opacity-60">
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm">Upcoming appointments</span>
                  </div>
                  <p className="text-[#333333]">
                    {upcomingAppointments.length} scheduled
                  </p>
                </div>

                {/* Emergency Contact Info */}
                {donorProfile?.emergency_contact_name && (
                  <div className="space-y-2 pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-2 text-[#333333] opacity-60">
                      <Droplet className="w-4 h-4" />
                      <span className="text-sm">Emergency Contact</span>
                    </div>
                    <p className="text-[#333333] text-sm">{donorProfile.emergency_contact_name}</p>
                    <p className="text-[#333333] text-xs opacity-60">{donorProfile.emergency_contact_phone}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Eligibility Status Card */}
            {donorProfile && (
              <Card className={
                donorProfile.eligibility_status === 'eligible' 
                  ? 'border-green-200 bg-green-50' 
                  : donorProfile.eligibility_status === 'ineligible'
                  ? 'border-red-200 bg-red-50'
                  : 'border-yellow-200 bg-yellow-50'
              }>
                <CardHeader>
                  <CardTitle className="text-sm">Eligibility Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Current Status:</span>
                      {getEligibilityBadge()}
                    </div>
                    {donorProfile.eligibility_status === 'ineligible' && (
                      <p className="text-xs text-red-600 mt-2">
                        Your eligibility status is currently set to ineligible. 
                        Please contact support if you believe this is an error.
                      </p>
                    )}
                    {donorProfile.eligibility_status === 'eligible' && (
                      <p className="text-xs text-green-600 mt-2">
                        You are eligible to donate blood. Thank you for being a donor!
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Appointment Scheduling Modal */}
      {showAppointmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Schedule New Appointment</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAppointmentModal(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <CardDescription>
                Choose a hospital and schedule your blood donation appointment
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Hospital Selection */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Select Hospital *
                </label>
                <select
                  value={selectedHospital || ''}
                  onChange={(e) => setSelectedHospital(Number(e.target.value))}
                  className="w-full p-2 border rounded"
                  required
                >
                  <option value="">Choose a hospital</option>
                  {hospitals.map((hospital) => (
                    <option key={hospital.id} value={hospital.id}>
                      {hospital.name} - {hospital.city}, {hospital.state}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Selection */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Appointment Date *
                </label>
                <input
                  type="date"
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>

              {/* Time Selection */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Appointment Time *
                </label>
                <input
                  type="time"
                  value={appointmentTime}
                  onChange={(e) => setAppointmentTime(e.target.value)}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>

              {/* Selected Hospital Info */}
              {selectedHospital && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                  <h4 className="font-medium text-blue-800">
                    {hospitals.find(h => h.id === selectedHospital)?.name}
                  </h4>
                  <p className="text-sm text-blue-700">
                    {hospitals.find(h => h.id === selectedHospital)?.address}
                  </p>
                  <p className="text-sm text-blue-600">
                    Operating Hours: {hospitals.find(h => h.id === selectedHospital)?.operating_hours}
                  </p>
                  <p className="text-sm text-blue-600">
                    Phone: {hospitals.find(h => h.id === selectedHospital)?.phone_number}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={() => setShowAppointmentModal(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleScheduleAppointment}
                  disabled={!selectedHospital || !appointmentDate || !appointmentTime}
                  className="flex-1 bg-[#D72638] hover:bg-[#A61B2B] text-white"
                >
                  Schedule Appointment
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}