import { useState, useEffect } from "react";
import { Navbar } from "./Navbar";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { UrgencyMeter } from "./UrgencyMeter";
import { Calendar, MapPin, History, Droplet, Clock, Loader2 } from "lucide-react";

interface DonorDashboardProps {
  onLogout: () => void;
}

interface DonorProfile {
  firstName: string;
  lastName: string;
  bloodType: string;
  dateOfBirth: string;
  gender: string;
  phoneNumber: string;
  address: string;
  weight: number;
  height: number;
  // Add other fields as needed
}

export function DonorDashboard({ onLogout }: DonorDashboardProps) {
  const [donorProfile, setDonorProfile] = useState<DonorProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDonorProfile = async () => {
      try {
        setIsLoading(true);
        const userData = localStorage.getItem('user');
        
        if (!userData) {
          throw new Error('No user data found');
        }

        const user = JSON.parse(userData);
        const token = localStorage.getItem('token');

        const response = await fetch(`http://localhost:3001/api/donors/profile?userId=${user.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch donor profile');
        }

        const profileData = await response.json();
        setDonorProfile(profileData);
      } catch (err) {
        console.error('Error fetching donor profile:', err);
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDonorProfile();
  }, []);

  // Calculate next eligible date (56 days from now)
  const nextEligibleDate = new Date();
  nextEligibleDate.setDate(nextEligibleDate.getDate() + 56);

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
                      {donorProfile ? `${donorProfile.firstName} ${donorProfile.lastName}` : 'Loading...'}
                    </CardTitle>
                    <CardDescription>Donor Profile</CardDescription>
                  </div>
                  <Badge className="bg-[#D72638] text-white">Eligible</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-[#333333] opacity-60">Blood Type</p>
                    <div className="flex items-center gap-2">
                      <Droplet className="w-4 h-4 text-[#D72638]" />
                      <span className="text-[#333333]">
                        {donorProfile?.bloodType || 'Not specified'}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-[#333333] opacity-60">Last Donation</p>
                    <p className="text-[#333333]">Jan 15, 2025</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-[#333333] opacity-60">Status</p>
                    <p className="text-[#D72638]">Eligible to donate</p>
                  </div>
                </div>
                
                {/* Additional Profile Info */}
                {donorProfile && (
                  <div className="mt-6 grid grid-cols-2 gap-4 pt-6 border-t border-[#F3F4F6]">
                    <div className="space-y-1">
                      <p className="text-sm text-[#333333] opacity-60">Phone</p>
                      <p className="text-[#333333]">{donorProfile.phoneNumber}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-[#333333] opacity-60">Address</p>
                      <p className="text-[#333333] text-sm">{donorProfile.address}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="pt-6">
                  <Calendar className="w-8 h-8 text-[#D72638] mb-3" />
                  <CardTitle className="mb-2">Schedule a Donation</CardTitle>
                  <CardDescription>Book your next appointment</CardDescription>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="pt-6">
                  <History className="w-8 h-8 text-[#D72638] mb-3" />
                  <CardTitle className="mb-2">Donation History</CardTitle>
                  <CardDescription>View past donations</CardDescription>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="pt-6">
                  <MapPin className="w-8 h-8 text-[#D72638] mb-3" />
                  <CardTitle className="mb-2">Nearby Centers</CardTitle>
                  <CardDescription>Find donation centers</CardDescription>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Recent Donations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { date: "Jan 15, 2025", location: "City Hospital", units: "450ml" },
                    { date: "Oct 20, 2024", location: "Red Cross Center", units: "450ml" },
                    { date: "Aug 5, 2024", location: "Community Clinic", units: "450ml" },
                  ].map((donation, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 border border-[#F3F4F6] rounded"
                    >
                      <div className="flex items-center gap-3">
                        <Droplet className="w-4 h-4 text-[#D72638]" />
                        <div>
                          <p className="text-[#333333]">{donation.location}</p>
                          <p className="text-sm text-[#333333] opacity-60">{donation.date}</p>
                        </div>
                      </div>
                      <Badge variant="outline">{donation.units}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
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
                  <p className="text-[#333333]">12 donations</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[#333333] opacity-60">
                    <Droplet className="w-4 h-4" />
                    <span className="text-sm">Lives impacted</span>
                  </div>
                  <p className="text-[#D72638]">~36 lives saved</p>
                </div>

                {/* Additional Medical Info */}
                {donorProfile && (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[#333333] opacity-60">
                        <Droplet className="w-4 h-4" />
                        <span className="text-sm">Weight</span>
                      </div>
                      <p className="text-[#333333]">{donorProfile.weight} kg</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[#333333] opacity-60">
                        <Droplet className="w-4 h-4" />
                        <span className="text-sm">Height</span>
                      </div>
                      <p className="text-[#333333]">{donorProfile.height} cm</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="bg-[#D72638] text-white">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <CardTitle className="mb-2 text-white">Urgent Request</CardTitle>
                    <CardDescription className="text-white opacity-90">
                      {donorProfile?.bloodType || 'Blood'} needed at City Hospital
                    </CardDescription>
                    <p className="text-sm text-white opacity-75 mt-2">
                      123 Medical Center Drive, Downtown District
                    </p>
                  </div>
                  <UrgencyMeter level={4} size="md" />
                </div>
                <div className="space-y-2">
                  <Button variant="secondary" className="w-full">
                    Respond Now
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full bg-transparent border-white text-white hover:bg-white hover:text-[#D72638]"
                    onClick={() => {
                      const address = encodeURIComponent("123 Medical Center Drive, Downtown District, Metro City");
                      window.open(`https://www.google.com/maps/search/?api=1&query=${address}`, '_blank');
                    }}
                  >
                    <MapPin className="w-4 h-4 mr-2" />
                    View Location
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}