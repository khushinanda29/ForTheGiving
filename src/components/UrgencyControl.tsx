// src/components/UrgencyControl.tsx
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { UrgencyMeter } from "./UrgencyMeter";
import { AlertCircle, Power, PowerOff, Send } from "lucide-react";
import { Badge } from "./ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface UrgencyControlProps {
  onUrgencyChange?: (level: number, enabled: boolean, message: string, bloodType: string) => void;
}

export function UrgencyControl({ onUrgencyChange }: UrgencyControlProps) {
  const [urgencyLevel, setUrgencyLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [isEnabled, setIsEnabled] = useState(false);
  const [message, setMessage] = useState("Blood urgently needed");
  const [bloodType, setBloodType] = useState<string>("O+");
  const [isSending, setIsSending] = useState(false);
  const [lastAlert, setLastAlert] = useState<{ donorsNotified: number; message: string } | null>(null);

  const handleToggle = () => {
    const newState = !isEnabled;
    setIsEnabled(newState);
    onUrgencyChange?.(urgencyLevel, newState, message, bloodType);
  };

  const handleLevelChange = (level: 1 | 2 | 3 | 4 | 5) => {
    setUrgencyLevel(level);
    // Always notify parent when level changes
    onUrgencyChange?.(level, isEnabled, message, bloodType);
  };

  const handleSendAlert = async () => {
  if (!bloodType) {
    alert("Please select a blood type");
    return;
  }

  try {
    setIsSending(true);
    const token = localStorage.getItem('token');
    
    const response = await fetch('http://localhost:3001/api/hospitals/urgency-request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        bloodType,
        urgencyLevel: urgencyLevel,
        message: message || getDefaultMessage(urgencyLevel, bloodType),
        radiusMiles: 5,
        isActive: true,
        sendNotifications: true // Flag to send email/SMS
      })
    });

    if (response.ok) {
      const result = await response.json();
      setLastAlert({
        donorsNotified: result.donorsNotified,
        message: result.message
      });
      
      setIsEnabled(true);
      onUrgencyChange?.(urgencyLevel, true, message, bloodType);
      
      alert(`✅ Alert sent! ${result.donorsNotified} donors notified within 5 miles.`);
    } else {
      const error = await response.json();
      alert(`❌ Error: ${error.error}`);
    }
  } catch (error) {
    console.error('Error creating urgency request:', error);
    alert('❌ Failed to send alert');
  } finally {
    setIsSending(false);
  }
};

  const getDefaultMessage = (level: number, bloodType: string) => {
    const levelLabels = {
      1: "Low",
      2: "Moderate", 
      3: "Medium",
      4: "High",
      5: "Critical"
    };
    return `${levelLabels[level]} urgency: ${bloodType} blood needed. Please donate if you are eligible.`;
  };

  const handleBloodTypeChange = (type: string) => {
    console.log('🩸 Blood type changed to:', type);
    setBloodType(type);
    // FIXED: Always notify parent when blood type changes, regardless of isEnabled
    onUrgencyChange?.(urgencyLevel, isEnabled, message, type);
  };

  const urgencyLabels = {
    1: "Low",
    2: "Moderate",
    3: "Medium",
    4: "High",
    5: "Critical"
  };

  return (
    <Card className={isEnabled ? "border-[#D72638] border-2" : ""}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-[#D72638]" />
              Urgency Alert System
            </CardTitle>
            <CardDescription>Send urgent blood requests to nearby donors (5-mile radius)</CardDescription>
          </div>
          <Badge 
            variant={isEnabled ? "default" : "outline"}
            className={isEnabled ? "bg-[#D72638] text-white" : ""}
          >
            {isEnabled ? "Active" : "Inactive"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {lastAlert && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-800">
              <Send className="w-4 h-4" />
              <span className="text-sm font-medium">Last Alert Sent</span>
            </div>
            <p className="text-sm text-green-700 mt-1">{lastAlert.message}</p>
          </div>
        )}

        {/* Blood Type Selector */}
        <div className="space-y-2">
          <Label htmlFor="blood-type">Blood Type Needed <span className="text-[#D72638]">*</span></Label>
          <Select value={bloodType} onValueChange={handleBloodTypeChange}>
            <SelectTrigger id="blood-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A+">A+</SelectItem>
              <SelectItem value="A-">A-</SelectItem>
              <SelectItem value="B+">B+</SelectItem>
              <SelectItem value="B-">B-</SelectItem>
              <SelectItem value="AB+">AB+</SelectItem>
              <SelectItem value="AB-">AB-</SelectItem>
              <SelectItem value="O+">O+</SelectItem>
              <SelectItem value="O-">O-</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Urgency Level Selector */}
        <div className="space-y-3">
          <Label>Urgency Level</Label>
          <div className="flex items-center gap-4">
            <UrgencyMeter level={urgencyLevel} size="lg" />
            <div className="flex-1">
              <div className="flex gap-2">
                {([1, 2, 3, 4, 5] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => handleLevelChange(level)}
                    className={`flex-1 py-2 px-3 rounded border-2 transition-all ${
                      urgencyLevel === level
                        ? "border-[#D72638] bg-[#D72638] text-white"
                        : "border-[#F3F4F6] bg-white text-[#333333] hover:border-[#D72638]"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
              <p className="text-sm text-[#333333] opacity-60 mt-2">
                Current: <span className="text-[#D72638]">{urgencyLabels[urgencyLevel]}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Message */}
        <div className="space-y-2">
          <Label htmlFor="urgency-message">Alert Message</Label>
          <Textarea
            id="urgency-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter the blood type and urgency details..."
            className="min-h-20"
          />
        </div>

        {/* Send Alert Button */}
        <Button
          onClick={handleSendAlert}
          disabled={!bloodType || isSending}
          className="w-full bg-[#D72638] hover:bg-[#A61B2B] text-white"
        >
          {isSending ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Sending Alert...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Send Alert to Nearby Donors (5 miles)
            </>
          )}
        </Button>

        {/* Enable/Disable Toggle */}
        <Button
          onClick={handleToggle}
          className={`w-full ${
            isEnabled
              ? "bg-gray-500 hover:bg-gray-600"
              : "bg-gray-400 hover:bg-gray-500"
          } text-white`}
        >
          {isEnabled ? (
            <>
              <PowerOff className="w-4 h-4 mr-2" />
              Disable Alert
            </>
          ) : (
            <>
              <Power className="w-4 h-4 mr-2" />
              Enable Alert (No Broadcast)
            </>
          )}
        </Button>

        {isEnabled && (
          <div className="p-4 bg-[#D72638] bg-opacity-10 border border-[#D72638] rounded-lg">
            <p className="text-sm text-[#D72638]">
              Alert is active and will broadcast to eligible donors within 5 miles when sent
            </p>
          </div>
        )}

        {/* Information */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm text-blue-800">
            <p className="font-medium">📡 Alert Radius: 5 miles</p>
            <p className="mt-1 text-xs">
              This alert will be sent to all eligible {bloodType || "selected blood type"} donors 
              within 5 miles of your hospital. They will see your request in their donor dashboard.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}