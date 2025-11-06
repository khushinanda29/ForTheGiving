import { useState } from "react";
import { Navbar } from "./Navbar";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Input } from "./ui/input";
import { UrgencyControl } from "./UrgencyControl";
import { HospitalMapInterface } from "./HospitalMapInterface";
import { Droplet, Users, Clock, Plus, Check, Eye, Search } from "lucide-react";

interface HospitalDashboardProps {
  onLogout: () => void;
}

export function HospitalDashboard({ onLogout }: HospitalDashboardProps) {
  const [bloodTypeNeeded, setBloodTypeNeeded] = useState<string>("");

  const requests = [
    {
      id: 1,
      donorName: "John Smith",
      bloodType: "O+",
      requestDate: "Nov 4, 2025",
      status: "pending",
    },
    {
      id: 2,
      donorName: "Sarah Johnson",
      bloodType: "A+",
      requestDate: "Nov 3, 2025",
      status: "pending",
    },
    {
      id: 3,
      donorName: "Michael Chen",
      bloodType: "B-",
      requestDate: "Nov 2, 2025",
      status: "approved",
    },
    {
      id: 4,
      donorName: "Emily Davis",
      bloodType: "AB+",
      requestDate: "Nov 1, 2025",
      status: "pending",
    },
  ];

  const handleUrgencyChange = (level: number, enabled: boolean, message: string, bloodType: string) => {
    setBloodTypeNeeded(bloodType);
    // Additional logic for broadcasting alert can go here
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6]">
      <Navbar title="Hospital Dashboard" onLogout={onLogout} />

      <div className="max-w-7xl mx-auto p-8">
        {/* Urgency Control and Map */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <UrgencyControl onUrgencyChange={handleUrgencyChange} />
          <HospitalMapInterface 
            hospitalName="City Hospital"
            address="123 Medical Center Drive, Downtown District, Metro City, 10001"
            bloodTypeNeeded={bloodTypeNeeded}
          />
        </div>

        {/* Summary Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#333333] opacity-60 mb-1">Available Blood Units</p>
                  <CardTitle>2,450</CardTitle>
                </div>
                <Droplet className="w-10 h-10 text-[#D72638] opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#333333] opacity-60 mb-1">Pending Requests</p>
                  <CardTitle>12</CardTitle>
                </div>
                <Clock className="w-10 h-10 text-[#D72638] opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#333333] opacity-60 mb-1">Total Donors Registered</p>
                  <CardTitle>8,234</CardTitle>
                </div>
                <Users className="w-10 h-10 text-[#D72638] opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Donor Requests Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Donor Requests</CardTitle>
              <div className="flex gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#333333] opacity-40" />
                  <Input
                    placeholder="Search requests..."
                    className="pl-10 w-64"
                  />
                </div>
                <Button className="bg-[#D72638] hover:bg-[#A61B2B] text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Blood Unit
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Donor Name</TableHead>
                  <TableHead>Blood Type</TableHead>
                  <TableHead>Request Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>{request.donorName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Droplet className="w-4 h-4 text-[#D72638]" />
                        {request.bloodType}
                      </div>
                    </TableCell>
                    <TableCell>{request.requestDate}</TableCell>
                    <TableCell>
                      <Badge
                        variant={request.status === "approved" ? "default" : "outline"}
                        className={
                          request.status === "approved"
                            ? "bg-green-100 text-green-800 border-green-200"
                            : "border-[#D72638] text-[#D72638]"
                        }
                      >
                        {request.status === "approved" ? "Approved" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[#333333] hover:text-[#D72638]"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {request.status === "pending" && (
                          <Button
                            size="sm"
                            className="bg-[#D72638] hover:bg-[#A61B2B] text-white"
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Blood Inventory by Type */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Blood Inventory by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 md:grid-cols-8 gap-4">
              {[
                { type: "A+", units: 320 },
                { type: "A-", units: 145 },
                { type: "B+", units: 280 },
                { type: "B-", units: 95 },
                { type: "AB+", units: 120 },
                { type: "AB-", units: 65 },
                { type: "O+", units: 580 },
                { type: "O-", units: 210 },
              ].map((blood) => (
                <div
                  key={blood.type}
                  className="flex flex-col items-center p-4 border border-[#F3F4F6] rounded-lg hover:border-[#D72638] transition-colors"
                >
                  <Droplet className="w-6 h-6 text-[#D72638] mb-2" />
                  <p className="text-[#333333] mb-1">{blood.type}</p>
                  <p className="text-sm text-[#333333] opacity-60">{blood.units} units</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}