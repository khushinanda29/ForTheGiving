// src/components/UrgencyResponse.tsx
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { MapPin, Navigation, Calendar, Clock, Phone, X, CheckCircle, Edit, AlertCircle } from "lucide-react";
import { Textarea } from "./ui/textarea";
import { UrgencyMeter } from "./UrgencyMeter";

interface UrgencyRequest {
  id: number;
  hospital_id: number;
  hospital_name: string;
  hospital_address: string;
  hospital_phone: string;
  blood_type: string;
  urgency_level: number;
  message: string;
  distance: number;
  created_at: string;
  user_response?: {
    response_type: string;
    scheduled_appointment_id?: number;
    appointment?: Appointment;
  };
}

interface Appointment {
  id: number;
  appointment_date: string;
  status: string;
  donor_arrived: boolean;
  donation_completed: boolean;
  cancelled_at?: string;
}

export function UrgencyResponse() {
  const [urgencyRequests, setUrgencyRequests] = useState<UrgencyRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<UrgencyRequest | null>(null);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [selectedDateTime, setSelectedDateTime] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchUrgencyRequests();
  }, []);

  const fetchUrgencyRequests = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/donors/urgency-requests', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const requests = await response.json();
        // Filter out requests that have been rejected
        const filteredRequests = requests.filter((request: UrgencyRequest) => 
          request.user_response?.response_type !== 'rejected'
        );
        setUrgencyRequests(filteredRequests);
      } else {
        console.error('Failed to fetch urgency requests');
      }
    } catch (error) {
      console.error('Error fetching urgency requests:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRespond = (request: UrgencyRequest) => {
    setSelectedRequest(request);
    setSelectedDateTime(''); // Reset date time
    setShowAppointmentModal(true);
  };

  const handleReject = (request: UrgencyRequest) => {
    setSelectedRequest(request);
    setRejectionReason(''); // Reset rejection reason
    setShowRejectionModal(true);
  };

  const handleReschedule = (request: UrgencyRequest) => {
    setSelectedRequest(request);
    if (request.user_response?.appointment?.appointment_date) {
      // Format the date for datetime-local input
      const date = new Date(request.user_response.appointment.appointment_date);
      const formattedDate = date.toISOString().slice(0, 16);
      setSelectedDateTime(formattedDate);
    }
    setShowRescheduleModal(true);
  };

  const handleScheduleAppointment = async () => {
    if (!selectedRequest || !selectedDateTime) {
      alert('Please select a date and time');
      return;
    }

    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/donors/schedule-appointment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          urgencyRequestId: selectedRequest.id,
          hospitalId: selectedRequest.hospital_id,
          appointmentDate: selectedDateTime,
          bloodType: selectedRequest.blood_type
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Appointment scheduled successfully at ${result.hospitalName}!`);
        setShowAppointmentModal(false);
        setSelectedRequest(null);
        setSelectedDateTime('');
        fetchUrgencyRequests();
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to schedule appointment');
      }
    } catch (error) {
      console.error('Error scheduling appointment:', error);
      alert('Failed to schedule appointment. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRejectRequest = async () => {
    if (!selectedRequest) return;

    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/donors/reject-urgency-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          urgencyRequestId: selectedRequest.id,
          rejectionReason: rejectionReason
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert('Request rejected successfully!');
        setShowRejectionModal(false);
        setSelectedRequest(null);
        setRejectionReason('');
        fetchUrgencyRequests(); // Refresh to remove the rejected request
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to reject request');
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      alert('Failed to reject request. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRescheduleAppointment = async () => {
    if (!selectedRequest || !selectedDateTime) return;

    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/donors/reschedule-appointment', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          appointmentId: selectedRequest.user_response?.scheduled_appointment_id,
          newAppointmentDate: selectedDateTime
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Appointment rescheduled successfully at ${result.appointment.hospital_name}!`);
        setShowRescheduleModal(false);
        setSelectedRequest(null);
        setSelectedDateTime('');
        fetchUrgencyRequests();
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to reschedule appointment');
      }
    } catch (error) {
      console.error('Error rescheduling appointment:', error);
      alert('Failed to reschedule appointment. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelAppointment = async (appointmentId: number) => {
    if (!confirm('Are you sure you want to cancel this appointment?')) return;

    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/donors/cancel-appointment/${appointmentId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        alert('Appointment cancelled successfully!');
        fetchUrgencyRequests();
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to cancel appointment');
      }
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      alert('Failed to cancel appointment. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const openGoogleMaps = (address: string) => {
    const encodedAddress = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`, '_blank');
  };

  const getUrgencyColor = (level: number) => {
    switch (level) {
      case 1: return 'bg-green-100 text-green-800';
      case 2: return 'bg-yellow-100 text-yellow-800';
      case 3: return 'bg-orange-100 text-orange-800';
      case 4: return 'bg-red-100 text-red-800';
      case 5: return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getUrgencyText = (level: number) => {
    switch (level) {
      case 1: return 'Low';
      case 2: return 'Moderate';
      case 3: return 'High';
      case 4: return 'Severe';
      case 5: return 'Critical';
      default: return 'Unknown';
    }
  };

  const getResponseBadge = (request: UrgencyRequest) => {
    if (!request.user_response) return null;
    
    switch (request.user_response.response_type) {
      case 'accepted':
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Appointment Scheduled
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-100 text-red-800">
            <X className="w-3 h-3 mr-1" />
            Request Rejected
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge className="bg-gray-100 text-gray-800">
            <X className="w-3 h-3 mr-1" />
            Appointment Cancelled
          </Badge>
        );
      default:
        return null;
    }
  };

  if (isLoading && urgencyRequests.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mb-4"></div>
          <CardDescription>Loading urgent requests...</CardDescription>
        </CardContent>
      </Card>
    );
  }

  if (urgencyRequests.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Clock className="w-12 h-12 text-gray-300 mb-4" />
          <CardDescription>No urgent blood requests at this time</CardDescription>
          <Button 
            onClick={fetchUrgencyRequests} 
            variant="outline" 
            className="mt-4"
            disabled={isLoading}
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {urgencyRequests.map((request) => (
        <Card key={request.id} className="border-l-4 border-l-red-500 bg-red-50">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <CardTitle className="flex items-center gap-2 text-red-700">
                    <AlertCircle className="w-5 h-5" />
                    {request.hospital_name}
                  </CardTitle>
                  <Badge className={getUrgencyColor(request.urgency_level)}>
                    {getUrgencyText(request.urgency_level)} Urgency
                  </Badge>
                  {getResponseBadge(request)}
                </div>
                <div className="flex items-center gap-4">
                  <UrgencyMeter level={request.urgency_level} size="sm" />
                  <CardDescription className="text-red-600">{request.message}</CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="border-red-300 text-red-700">
                {request.blood_type} Needed
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-gray-500" />
                  <span>{request.hospital_address}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Navigation className="w-4 h-4 text-gray-500" />
                  <span>{request.distance.toFixed(1)} miles away</span>
                </div>
                {request.hospital_phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-gray-500" />
                    <span>{request.hospital_phone}</span>
                  </div>
                )}
                {request.user_response?.appointment && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <Calendar className="w-4 h-4" />
                    <span>
                      Appointment: {new Date(request.user_response.appointment.appointment_date).toLocaleString()}
                    </span>
                    {request.user_response.appointment.donor_arrived && (
                      <Badge className="bg-green-100 text-green-800 text-xs">
                        Arrived
                      </Badge>
                    )}
                    {request.user_response.appointment.donation_completed && (
                      <Badge className="bg-blue-100 text-blue-800 text-xs">
                        Donation Complete
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Button
                  onClick={() => openGoogleMaps(request.hospital_address)}
                  variant="outline"
                  className="w-full"
                >
                  <Navigation className="w-4 h-4 mr-2" />
                  Get Directions
                </Button>
                
                {!request.user_response ? (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleRespond(request)}
                      className="flex-1 bg-red-100 text-black hover:!bg-red-600 hover:!text-white"
                      disabled={isLoading}
                      variant="outline"
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      {isLoading ? 'Scheduling...' : 'Schedule Donation'}
                    </Button>
                    <Button
                      onClick={() => handleReject(request)}
                      variant="outline"
                      className="flex-1 border-red-300 text-red-600"
                      disabled={isLoading}
                    >
                      <X className="w-4 h-4 mr-2" />
                      {isLoading ? 'Processing...' : 'Reject'}
                    </Button>
                  </div>
                ) : request.user_response.response_type === 'accepted' && 
                  request.user_response.appointment?.status === 'scheduled' ? (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleReschedule(request)}
                      variant="outline"
                      className="flex-1"
                      disabled={isLoading}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Reschedule
                    </Button>
                    <Button
                      onClick={() => handleCancelAppointment(request.user_response!.scheduled_appointment_id!)}
                      variant="outline"
                      className="flex-1 text-red-600 border-red-300 hover:bg-red-50"
                      disabled={isLoading}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="text-xs text-gray-500">
              Requested {new Date(request.created_at).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Appointment Scheduling Modal */}
      {showAppointmentModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Schedule Donation</CardTitle>
              <CardDescription>
                Schedule your blood donation at <strong>{selectedRequest.hospital_name}</strong>
                <br />
                <span className="text-sm text-red-600">
                  This appointment will be at the requesting hospital only.
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
                <p className="text-sm text-blue-800 font-medium mb-1">
                  Hospital: {selectedRequest.hospital_name}
                </p>
                <p className="text-sm text-blue-700 mb-1">
                  Address: {selectedRequest.hospital_address}
                </p>
                <p className="text-sm text-blue-700">
                  Blood Type Needed: {selectedRequest.blood_type}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Select Date and Time *
                </label>
                <input
                  type="datetime-local"
                  value={selectedDateTime}
                  onChange={(e) => setSelectedDateTime(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Please select a future date and time for your donation
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => {
                    setShowAppointmentModal(false);
                    setSelectedRequest(null);
                    setSelectedDateTime('');
                  }}
                  variant="outline"
                  className="flex-1"
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleScheduleAppointment}
                  disabled={!selectedDateTime || isLoading}
                  className="flex-1 text-black"
                  variant="outline"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Scheduling...
                    </>
                  ) : (
                    `Confirm Appointment`
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectionModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Reject Request</CardTitle>
              <CardDescription>
                Are you sure you want to reject this blood request from {selectedRequest.hospital_name}?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Reason for rejection (optional)
                </label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Provide a reason for rejecting this request (e.g., unavailable, health reasons, etc.)..."
                  className="min-h-20 resize-vertical"
                  rows={4}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setShowRejectionModal(false);
                    setSelectedRequest(null);
                    setRejectionReason('');
                  }}
                  variant="outline"
                  className="flex-1"
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleRejectRequest}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-black"
                  disabled={isLoading}
                  variant="outline"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    'Confirm Rejection'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reschedule Modal */}
      {showRescheduleModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Reschedule Appointment</CardTitle>
              <CardDescription>
                Reschedule your donation at {selectedRequest.hospital_name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-green-50 rounded-md border border-green-200">
                <p className="text-sm text-green-800">
                  Current appointment: {selectedRequest.user_response?.appointment && 
                    new Date(selectedRequest.user_response.appointment.appointment_date).toLocaleString()
                  }
                </p>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  New Date and Time *
                </label>
                <input
                  type="datetime-local"
                  value={selectedDateTime}
                  onChange={(e) => setSelectedDateTime(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setShowRescheduleModal(false);
                    setSelectedRequest(null);
                    setSelectedDateTime('');
                  }}
                  variant="outline"
                  className="flex-1"
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleRescheduleAppointment}
                  disabled={!selectedDateTime || isLoading}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Rescheduling...
                    </>
                  ) : (
                    'Reschedule'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}