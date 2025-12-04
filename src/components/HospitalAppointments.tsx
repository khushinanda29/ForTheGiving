// src/components/HospitalAppointments.tsx
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Calendar, User, Phone, Mail, MapPin, CheckCircle, XCircle, Clock, Loader2, AlertCircle, Users, X } from "lucide-react";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";

interface Appointment {
  id: number;
  donor_id: number;
  hospital_id: number;
  appointment_date: string;
  status: string;
  blood_type: string;
  donor_arrived: boolean;
  donation_completed: boolean;
  hospital_notes: string;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  first_name: string;
  last_name: string;
  phone_number: string;
  email: string;
  requested_blood_type: string;
  urgency_level: number;
  urgency_request_id: number;
}

interface UrgencyResponse {
  id: number;
  urgency_request_id: number;
  donor_id: number;
  responded_at: string;
  response_type: string;
  rejection_reason: string | null;
  scheduled_appointment_id: number | null;
  first_name: string;
  last_name: string;
  phone_number: string;
  email: string;
  blood_type: string;
  appointment_date: string | null;
  appointment_status: string | null;
  urgency_level: number;
  message: string;
  blood_type_needed: string;
}

export function HospitalAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [responses, setResponses] = useState<UrgencyResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'appointments' | 'responses' | 'scheduled' | 'completed'>('appointments');

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      
      // Fetch appointments and responses in parallel
      const [appointmentsResponse, responsesResponse] = await Promise.all([
        fetch('http://localhost:3001/api/hospitals/appointments', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('http://localhost:3001/api/hospitals/urgency-responses', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (appointmentsResponse.ok) {
        const appointmentsData = await appointmentsResponse.json();
        setAppointments(appointmentsData || []);
      }

      if (responsesResponse.ok) {
        const responsesData = await responsesResponse.json();
        setResponses(responsesData.responses || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setAppointments([]);
      setResponses([]);
    } finally {
      setIsLoading(false);
    }
  };

  const updateAppointmentStatus = async (appointmentId: number, updates: any) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/hospitals/appointments/${appointmentId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        fetchAllData(); // Refresh all data
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to update appointment status');
      }
    } catch (error) {
      console.error('Error updating appointment status:', error);
      alert('Failed to update appointment status');
    }
  };

  const completeAppointment = async (appointmentId: number) => {
    if (!confirm('Mark this donation as completed? This will remove the appointment from the active list.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/hospitals/appointments/${appointmentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        fetchAllData(); // Refresh all data
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to complete appointment');
      }
    } catch (error) {
      console.error('Error completing appointment:', error);
      alert('Failed to complete appointment');
    }
  };

  const deactivateUrgencyRequest = async (urgencyRequestId: number) => {
    if (!confirm('Are you sure you want to deactivate this urgency request? This will stop showing it to donors.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/hospitals/urgency-requests/${urgencyRequestId}/deactivate`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        alert('Urgency request deactivated successfully!');
        fetchAllData(); // Refresh all data
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to deactivate urgency request');
      }
    } catch (error) {
      console.error('Error deactivating urgency request:', error);
      alert('Failed to deactivate urgency request');
    }
  };

  // Filter data based on active tab
  const getFilteredData = () => {
    switch (activeTab) {
      case 'appointments':
        return {
          type: 'appointments',
          data: appointments.filter(apt => apt.status === 'scheduled'),
          title: 'Active Appointments',
          description: 'Manage scheduled donor appointments'
        };
      case 'scheduled':
        return {
          type: 'appointments', 
          data: appointments.filter(apt => apt.status === 'scheduled'),
          title: 'All Scheduled Appointments',
          description: 'View all scheduled appointments'
        };
      case 'completed':
        return {
          type: 'appointments',
          data: appointments.filter(apt => apt.status === 'completed'),
          title: 'Completed Appointments', 
          description: 'Historical completed appointments'
        };
      case 'responses':
        return {
          type: 'responses',
          data: responses,
          title: 'Urgency Request Responses',
          description: 'Donor responses to your urgency requests'
        };
      default:
        return {
          type: 'appointments',
          data: appointments,
          title: 'All Appointments',
          description: 'All appointment types'
        };
    }
  };

  const getStatusBadge = (appointment: Appointment) => {
    if (appointment.status === 'cancelled') {
      return <Badge className="bg-red-100 text-red-800">Cancelled</Badge>;
    }
    
    if (appointment.status === 'completed') {
      return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
    }

    if (appointment.donation_completed) {
      return <Badge className="bg-blue-100 text-blue-800">Donation Complete</Badge>;
    }

    if (appointment.donor_arrived) {
      return <Badge className="bg-green-100 text-green-800">Donor Arrived</Badge>;
    }

    return <Badge className="bg-yellow-100 text-yellow-800">Scheduled</Badge>;
  };

  const getResponseBadge = (response: UrgencyResponse) => {
    if (response.response_type === 'accepted') {
      return <Badge className="bg-green-100 text-green-800">Accepted</Badge>;
    } else if (response.response_type === 'rejected') {
      return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
    }
    return <Badge className="bg-gray-100 text-gray-800">Pending</Badge>;
  };

  const getUrgencyBadge = (level: number) => {
    const colors = {
      1: 'bg-green-100 text-green-800',
      2: 'bg-yellow-100 text-yellow-800', 
      3: 'bg-orange-100 text-orange-800',
      4: 'bg-red-100 text-red-800',
      5: 'bg-purple-100 text-purple-800'
    };
    
    const labels = {
      1: 'Low',
      2: 'Moderate',
      3: 'High', 
      4: 'Severe',
      5: 'Critical'
    };

    return (
      <Badge className={colors[level as keyof typeof colors]}>
        {labels[level as keyof typeof labels]} Urgency
      </Badge>
    );
  };

  const renderAppointmentCard = (appointment: Appointment) => {
  const handleCheckboxChange = async (field: 'donorArrived' | 'donationCompleted', checked: boolean) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/hospitals/appointments/${appointment.id}/quick-status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ [field]: checked })
      });

      if (response.ok) {
        fetchAllData(); // Refresh data
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating checkbox:', error);
      alert('Failed to update status');
    }
  };

  const handleCompleteAppointment = async () => {
    if (!confirm('Mark this appointment as completed? This will check both boxes and move it to completed.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/hospitals/appointments/${appointment.id}/complete`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        fetchAllData(); // Refresh data
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to complete appointment');
      }
    } catch (error) {
      console.error('Error completing appointment:', error);
      alert('Failed to complete appointment');
    }
  };

  const handleFulfillRequest = async (urgencyRequestId: number) => {
    if (!confirm('Mark this urgency request as fulfilled? This will deactivate the request.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/hospitals/urgency-requests/${urgencyRequestId}/fulfill`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        fetchAllData(); // Refresh data
        alert('Urgency request marked as fulfilled!');
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to fulfill request');
      }
    } catch (error) {
      console.error('Error fulfilling request:', error);
      alert('Failed to fulfill request');
    }
  };

  return (
    <div key={appointment.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#D72638] rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">
              {appointment.first_name} {appointment.last_name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="border-[#D72638] text-[#D72638]">
                {appointment.blood_type}
              </Badge>
              {getStatusBadge(appointment)}
              {appointment.urgency_request_id && getUrgencyBadge(appointment.urgency_level)}
            </div>
          </div>
        </div>
        
        <div className="text-right">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="w-4 h-4" />
            <span>{new Date(appointment.appointment_date).toLocaleDateString()}</span>
          </div>
          <div className="text-sm text-gray-500">
            {new Date(appointment.appointment_date).toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-gray-500" />
          <span>{appointment.phone_number || 'Not provided'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-gray-500" />
          <span className="truncate">{appointment.email}</span>
        </div>
      </div>

      {/* Quick Status Checkboxes - Only for scheduled appointments */}
      {appointment.status === 'scheduled' && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
          <h4 className="font-medium text-sm text-blue-800 mb-2">Quick Status Update:</h4>
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <Checkbox
                id={`arrived-${appointment.id}`}
                checked={appointment.donor_arrived}
                onCheckedChange={(checked) => 
                  handleCheckboxChange('donorArrived', checked as boolean)
                }
              />
              <Label htmlFor={`arrived-${appointment.id}`} className="text-sm cursor-pointer">
                Donor Arrived
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id={`donated-${appointment.id}`}
                checked={appointment.donation_completed}
                onCheckedChange={(checked) => 
                  handleCheckboxChange('donationCompleted', checked as boolean)
                }
              />
              <Label htmlFor={`donated-${appointment.id}`} className="text-sm cursor-pointer">
                Blood Donated
              </Label>
            </div>
          </div>
          
          {/* Quick Complete Button */}
          <div className="mt-3">
            <Button
              onClick={handleCompleteAppointment}
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white text-xs"
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              Mark Complete
            </Button>
          </div>
        </div>
      )}

      {/* Fulfill Request Button for Urgency-based Appointments */}
      {appointment.urgency_request_id && appointment.status === 'scheduled' && (
        <div className="mb-3">
          <Button
            onClick={() => handleFulfillRequest(appointment.urgency_request_id)}
            variant="outline"
            size="sm"
            className="text-green-600 border-green-300 hover:bg-green-50"
          >
            <CheckCircle className="w-3 h-3 mr-1" />
            Mark Request Fulfilled
          </Button>
          <p className="text-xs text-gray-500 mt-1">
            This will deactivate the urgency request since the need has been met
          </p>
        </div>
      )}

      {/* Action Buttons for Scheduled Appointments */}
      {appointment.status === 'scheduled' && (
        <div className="flex gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => {
              const notes = prompt('Add notes for this appointment:', appointment.hospital_notes || '');
              if (notes !== null) {
                updateAppointmentStatus(appointment.id, { hospitalNotes: notes });
              }
            }}
          >
            Add Notes
          </Button>
          
          <Button
            onClick={() => completeAppointment(appointment.id)}
            className="bg-[#D72638] hover:bg-[#A61B2B] text-white"
          >
            <X className="w-4 h-4 mr-2" />
            Cancel Appointment
          </Button>
        </div>
      )}

      {/* Cancellation Info */}
      {appointment.status === 'cancelled' && appointment.cancelled_at && (
        <div className="pt-3 border-t text-sm text-red-600">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            <span>Cancelled by {appointment.cancelled_by} on {new Date(appointment.cancelled_at).toLocaleString()}</span>
          </div>
          {appointment.cancellation_reason && (
            <p className="mt-1 text-gray-600">Reason: {appointment.cancellation_reason}</p>
          )}
        </div>
      )}

      {/* Hospital Notes */}
      {appointment.hospital_notes && (
        <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
          <strong>Hospital Notes:</strong> {appointment.hospital_notes}
        </div>
      )}
    </div>
  );
};

  const renderResponseCard = (response: UrgencyResponse) => (
    <div key={response.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#D72638] rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">
              {response.first_name} {response.last_name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="border-[#D72638] text-[#D72638]">
                {response.blood_type}
              </Badge>
              {getResponseBadge(response)}
              {getUrgencyBadge(response.urgency_level)}
            </div>
          </div>
        </div>
        
        <div className="text-right">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="w-4 h-4" />
            <span>{new Date(response.responded_at).toLocaleDateString()}</span>
          </div>
          <div className="text-sm text-gray-500">
            {new Date(response.responded_at).toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Request Details */}
      <div className="mb-3 p-3 bg-gray-50 rounded">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
          <AlertCircle className="w-4 h-4" />
          Urgency Request: {response.message}
        </div>
        <div className="text-sm text-gray-600">
          Blood Type Needed: <strong>{response.blood_type_needed}</strong>
        </div>
      </div>

      {/* Contact Information */}
      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-gray-500" />
          <span>{response.phone_number || 'Not provided'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-gray-500" />
          <span className="truncate">{response.email}</span>
        </div>
      </div>

      {/* Appointment Information for Accepted Responses */}
      {response.response_type === 'accepted' && response.appointment_date && (
        <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded">
          <div className="flex items-center gap-2 text-sm font-medium text-green-700 mb-1">
            <Calendar className="w-4 h-4" />
            Scheduled Appointment
          </div>
          <div className="text-sm text-green-600">
            Date: {new Date(response.appointment_date).toLocaleString()}
          </div>
          {response.appointment_status && (
            <div className="text-sm text-green-600">
              Status: <span className="capitalize">{response.appointment_status}</span>
            </div>
          )}
        </div>
      )}

      {/* Rejection Reason */}
      {response.response_type === 'rejected' && response.rejection_reason && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded">
          <div className="flex items-center gap-2 text-sm font-medium text-red-700 mb-1">
            <X className="w-4 h-4" />
            Rejection Reason
          </div>
          <div className="text-sm text-red-600">
            {response.rejection_reason}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-3 border-t">
        {response.response_type === 'accepted' && (
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              // Navigate to appointments or show appointment details
              alert(`Appointment ID: ${response.scheduled_appointment_id}. This would navigate to appointment details.`);
            }}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            View Appointment
          </Button>
        )}
        
        <Button
          variant="outline"
          className="text-red-600 border-red-300 hover:bg-red-50"
          onClick={() => deactivateUrgencyRequest(response.urgency_request_id)}
        >
          <X className="w-4 h-4 mr-2" />
          Deactivate Request
        </Button>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-[#D72638] animate-spin" />
          <p className="mt-2 text-gray-500">Loading appointments and responses...</p>
        </CardContent>
      </Card>
    );
  }

  const filteredData = getFilteredData();
  const scheduledCount = appointments.filter(apt => apt.status === 'scheduled').length;
  const completedCount = appointments.filter(apt => apt.status === 'completed').length;
  const responsesCount = responses.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appointments & Urgency Responses</CardTitle>
        <CardDescription>
          Manage donor appointments and track responses to urgency requests
        </CardDescription>
        
        {/* Combined Tabs */}
        <div className="flex border-b border-gray-200 mt-4">
          <button
            className={`px-4 py-2 font-medium text-sm ${
              activeTab === 'appointments'
                ? 'border-b-2 border-blue-500 text-blue-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('appointments')}
          >
            Active Appointments ({scheduledCount})
          </button>
          <button
            className={`px-4 py-2 font-medium text-sm ${
              activeTab === 'responses'
                ? 'border-b-2 border-orange-500 text-orange-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('responses')}
          >
            Urgency Responses ({responsesCount})
          </button>
          <button
            className={`px-4 py-2 font-medium text-sm ${
              activeTab === 'scheduled'
                ? 'border-b-2 border-green-500 text-green-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('scheduled')}
          >
            All Scheduled ({scheduledCount})
          </button>
          <button
            className={`px-4 py-2 font-medium text-sm ${
              activeTab === 'completed'
                ? 'border-b-2 border-purple-500 text-purple-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('completed')}
          >
            Completed ({completedCount})
          </button>
        </div>
      </CardHeader>
      
      <CardContent>
        {filteredData.data.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {filteredData.type === 'appointments' ? (
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            ) : (
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            )}
            <p>No {filteredData.title.toLowerCase()} found</p>
            <p className="text-sm mt-2">
              {filteredData.type === 'responses' 
                ? 'Donor responses will appear here when they respond to your urgency requests.'
                : 'Appointments will appear here when donors schedule them.'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredData.type === 'appointments' 
              ? filteredData.data.map(renderAppointmentCard)
              : filteredData.data.map(renderResponseCard)
            }
          </div>
        )}
      </CardContent>
    </Card>
  );
}