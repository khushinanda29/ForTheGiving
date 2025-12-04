// src/components/HospitalUrgencyResponses.tsx
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Calendar, User, Phone, Mail, MapPin, CheckCircle, X, Clock, Loader2, AlertCircle, Users } from "lucide-react";

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

export function HospitalUrgencyResponses() {
  const [responses, setResponses] = useState<UrgencyResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'accepted' | 'rejected'>('all');

  useEffect(() => {
    fetchUrgencyResponses();
  }, []);

  const fetchUrgencyResponses = async () => {
  try {
    setIsLoading(true);
    const token = localStorage.getItem('token');
    const response = await fetch('http://localhost:3001/api/hospitals/urgency-responses', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      setResponses(data.responses || []);
    } else {
      console.error('Failed to fetch urgency responses');
      // Set empty array instead of showing error
      setResponses([]);
    }
  } catch (error) {
    console.error('Error fetching urgency responses:', error);
    // Set empty array on error
    setResponses([]);
  } finally {
    setIsLoading(false);
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
        fetchUrgencyResponses(); // Refresh the list
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to deactivate urgency request');
      }
    } catch (error) {
      console.error('Error deactivating urgency request:', error);
      alert('Failed to deactivate urgency request');
    }
  };

  const getFilteredResponses = () => {
    switch (activeTab) {
      case 'accepted':
        return responses.filter(response => response.response_type === 'accepted');
      case 'rejected':
        return responses.filter(response => response.response_type === 'rejected');
      default:
        return responses;
    }
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

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-[#D72638] animate-spin" />
          <p className="mt-2 text-gray-500">Loading responses...</p>
        </CardContent>
      </Card>
    );
  }

  const filteredResponses = getFilteredResponses();
  const acceptedCount = responses.filter(r => r.response_type === 'accepted').length;
  const rejectedCount = responses.filter(r => r.response_type === 'rejected').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Urgency Request Responses</CardTitle>
        <CardDescription>
          Track donor responses to your urgency requests
        </CardDescription>
        
        {/* Tabs */}
        <div className="flex border-b border-gray-200 mt-4">
          <button
            className={`px-4 py-2 font-medium text-sm ${
              activeTab === 'all'
                ? 'border-b-2 border-blue-500 text-blue-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('all')}
          >
            All Responses ({responses.length})
          </button>
          <button
            className={`px-4 py-2 font-medium text-sm ${
              activeTab === 'accepted'
                ? 'border-b-2 border-green-500 text-green-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('accepted')}
          >
            Accepted ({acceptedCount})
          </button>
          <button
            className={`px-4 py-2 font-medium text-sm ${
              activeTab === 'rejected'
                ? 'border-b-2 border-red-500 text-red-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('rejected')}
          >
            Rejected ({rejectedCount})
          </button>
        </div>
      </CardHeader>
      
      <CardContent>
        {filteredResponses.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No {activeTab} responses found</p>
            <p className="text-sm mt-2">Donor responses will appear here when they respond to your urgency requests.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredResponses.map((response) => (
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
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}