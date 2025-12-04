// src/components/DonorEligibility.tsx
import { useState, useEffect } from "react";
import { Navbar } from "./Navbar";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";
import { CheckCircle2, XCircle, Clock, Phone, Loader2 } from "lucide-react";

interface DonorEligibilityProps {
  onComplete: () => void;
  onLogout: () => void;
}

interface UserProfile {
  gender?: string;
}

interface IneligibilityReason {
  question: string;
  answer: string;
  expectedAnswer: string;
  explanation: string;
}

export function DonorEligibility({ onComplete, onLogout }: DonorEligibilityProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResult, setShowResult] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ineligibilityReasons, setIneligibilityReasons] = useState<IneligibilityReason[]>([]);
  const [isIneligible, setIsIneligible] = useState(false);

  // Fetch user profile to get gender
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        
        if (!token) {
          throw new Error('No authentication token found');
        }

        const response = await fetch('http://localhost:3001/api/donors/profile', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const profileData = await response.json();
          setUserProfile(profileData);
        } else {
          console.error('Failed to fetch user profile');
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfile();
  }, []);

  // Base questions for all donors
  const baseQuestions = [
    {
      id: "recent-donation",
      question: "Have you donated blood in the last 56 days?",
      eligibleAnswer: "no",
      explanation: "Donors must wait at least 56 days between whole blood donations to allow recovery."
    },
    {
      id: "feeling-ill",
      question: "Are you currently feeling ill, have a fever, or experiencing cold or flu symptoms?",
      eligibleAnswer: "no",
      explanation: "Donating while ill can affect both donor recovery and blood product safety."
    },
    {
      id: "medication",
      question: "Have you taken any blood-thinning medication (aspirin, warfarin, etc.) in the last 48 hours?",
      eligibleAnswer: "no",
      explanation: "Blood-thinning medications can increase bleeding risk during donation."
    },
    {
      id: "weight",
      question: "Do you meet the minimum weight requirement (110 lbs / 50 kg)?",
      eligibleAnswer: "yes",
      explanation: "Minimum weight ensures donor safety and adequate blood volume for collection."
    },
    {
      id: "recent-surgery",
      question: "Have you had any surgery or medical procedure in the last 6 months?",
      eligibleAnswer: "no",
      explanation: "Recent surgery may require recovery time before donation is safe."
    },
    {
      id: "dental-work",
      question: "Have you had dental work (extraction, root canal, surgery) in the last 72 hours?",
      eligibleAnswer: "no",
      explanation: "Certain dental procedures require waiting periods to prevent infection risk."
    },
  ];

  // Pregnancy-related questions for female donors
  const pregnancyQuestions = [
    {
      id: "pregnancy",
      question: "Are you currently pregnant or have been pregnant in the last 6 months?",
      eligibleAnswer: "no",
      explanation: "Pregnancy and recent pregnancy require waiting periods for donor safety."
    },
    {
      id: "breastfeeding",
      question: "Are you currently breastfeeding?",
      eligibleAnswer: "no",
      explanation: "While breastfeeding donors may be eligible, we recommend consulting healthcare providers."
    },
  ];

  // Combine questions based on gender
  const allQuestions = [
    ...baseQuestions,
    ...(userProfile?.gender?.toLowerCase() === 'female' ? pregnancyQuestions : [])
  ];

  const progress = (Object.keys(answers).length / allQuestions.length) * 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if all answers are eligible
    const isEligible = allQuestions.every(question => 
      answers[question.id] === question.eligibleAnswer
    );

    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Authentication required');
      }

      if (isEligible) {
        // Update eligibility status to 'eligible'
        const response = await fetch('http://localhost:3001/api/donors/eligibility-status', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            eligibilityStatus: 'eligible'
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update eligibility status');
        }

        setShowResult(true);
        setTimeout(() => {
          onComplete();
        }, 2000);
      } else {
        // User is ineligible - collect reasons and show ineligibility screen
        const reasons: IneligibilityReason[] = allQuestions
          .filter(question => answers[question.id] !== question.eligibleAnswer)
          .map(question => ({
            question: question.question,
            answer: answers[question.id],
            expectedAnswer: question.eligibleAnswer,
            explanation: question.explanation
          }));

        // Update status to 'ineligible' permanently
        const response = await fetch('http://localhost:3001/api/donors/eligibility-status', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            eligibilityStatus: 'ineligible',
            ineligibilityReasons: reasons
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update eligibility status');
        }

        setIneligibilityReasons(reasons);
        setIsIneligible(true);
      }
    } catch (error) {
      console.error('Error updating eligibility status:', error);
      alert(`An error occurred while processing your eligibility: ${error.message}\n\nPlease try again or contact support:\nPhone: 1-800-256-6343\nEmail: info@forthegiving.org`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const allAnswered = Object.keys(answers).length === allQuestions.length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-[#D72638] animate-spin" />
          <p className="text-[#333333]">Loading eligibility questions...</p>
        </div>
      </div>
    );
  }

  if (isIneligible) {
    return (
      <div className="min-h-screen bg-[#F3F4F6]">
        <Navbar title="Eligibility Results" onLogout={onLogout} />
        
        <div className="max-w-4xl mx-auto p-8">
          <Card className="border-2 border-red-200">
            <CardHeader className="text-center bg-red-50">
              <div className="flex justify-center mb-4">
                <XCircle className="w-16 h-16 text-red-600" />
              </div>
              <CardTitle className="text-2xl text-red-700">
                Unable to Continue with Donation
              </CardTitle>
              <CardDescription className="text-lg text-red-600">
                Based on your responses, you are not eligible to donate blood at this time.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="pt-6">
              {/* Reasons for Ineligibility */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Reasons for Ineligibility:
                </h3>
                <div className="space-y-4">
                  {ineligibilityReasons.map((reason, index) => (
                    <div key={index} className="bg-red-50 p-4 rounded-lg border border-red-200">
                      <div className="flex items-start gap-3">
                        <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-gray-900">{reason.question}</p>
                          <p className="text-sm text-gray-700 mt-1">
                            Your answer: <span className="font-semibold">{reason.answer}</span> 
                            (Required: <span className="font-semibold">{reason.expectedAnswer}</span>)
                          </p>
                          <p className="text-sm text-gray-600 mt-2">
                            <span className="font-medium">Reason:</span> {reason.explanation}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Next Steps */}
              <div className="bg-blue-50 p-6 rounded-lg border border-blue-200 mb-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  What You Can Do Next
                </h3>
                <div className="space-y-3 text-blue-800">
                  <p>
                    <strong>Wait for eligibility:</strong> Many temporary restrictions (like recent travel, 
                    illness, or medications) have waiting periods. You may become eligible after a certain time.
                  </p>
                  <p>
                    <strong>Contact our team:</strong> If you believe there's been an error or you'd like to 
                    discuss your specific situation, our support team can review your case.
                  </p>
                  <p>
                    <strong>Review guidelines:</strong> Eligibility criteria are based on national blood 
                    donation guidelines to ensure donor and recipient safety.
                  </p>
                </div>
              </div>

              {/* Contact Information */}
              <div className="bg-green-50 p-6 rounded-lg border border-green-200">
                <h3 className="text-lg font-semibold text-green-900 mb-3 flex items-center gap-2">
                  <Phone className="w-5 h-5" />
                  Contact Our Support Team
                </h3>
                <div className="grid md:grid-cols-2 gap-4 text-green-800">
                  <div>
                    <p className="font-medium">Phone Support</p>
                    <p className="text-sm">1-800-BLOOD-HELP (1-800-256-6343)</p>
                    <p className="text-xs text-green-600">Mon-Fri: 8AM-8PM EST</p>
                  </div>
                  <div>
                    <p className="font-medium">Email Support</p>
                    <p className="text-sm">info@forthegiving.org</p>
                    <p className="text-xs text-green-600">Response within 24 hours</p>
                  </div>
                </div>
                <div className="mt-4 p-4 bg-white rounded border">
                  <p className="text-sm text-gray-700">
                    <strong>Note:</strong> Your eligibility status has been set to 'ineligible' 
                    in our system. Only our support team can review and update this status after discussing 
                    your specific situation.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 mt-8">
                <Button
                  onClick={() => window.location.reload()}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Review Questions Again
                </Button>
                <Button
                  onClick={onLogout}
                  variant="outline"
                  className="flex-1"
                >
                  Return to Login
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3F4F6]">
      <Navbar title="Eligibility Checklist" onLogout={onLogout} />

      <div className="max-w-3xl mx-auto p-8">
        {!showResult ? (
          <Card>
            <CardHeader>
              <CardTitle>Donor Eligibility Checklist</CardTitle>
              <CardDescription>
                Please answer these questions truthfully to confirm your eligibility before donating blood.
                {userProfile?.gender?.toLowerCase() === 'female' && (
                  <span className="text-[#D72638] font-medium block mt-2">
                    Additional pregnancy-related questions are included for female donors.
                  </span>
                )}
              </CardDescription>
              <Progress value={progress} className="mt-4" />
              <div className="flex justify-between text-sm text-[#333333] opacity-60 mt-2">
                <span>Questions answered: {Object.keys(answers).length} of {allQuestions.length}</span>
                <span>{Math.round(progress)}% complete</span>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {allQuestions.map((q, index) => (
                  <div 
                    key={q.id} 
                    className="space-y-3 pb-6 border-b border-[#F3F4F6] last:border-0"
                  >
                    <Label className="text-[#333333] text-base">
                      {index + 1}. {q.question}
                    </Label>
                    <RadioGroup
                      value={answers[q.id] || ''}
                      onValueChange={(value) =>
                        setAnswers({ ...answers, [q.id]: value })
                      }
                      className="space-y-2"
                    >
                      <div className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50">
                        <RadioGroupItem value="yes" id={`${q.id}-yes`} />
                        <Label htmlFor={`${q.id}-yes`} className="cursor-pointer flex-1">
                          Yes
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50">
                        <RadioGroupItem value="no" id={`${q.id}-no`} />
                        <Label htmlFor={`${q.id}-no`} className="cursor-pointer flex-1">
                          No
                        </Label>
                      </div>
                    </RadioGroup>
                    
                    {/* Special notes for certain questions */}
                    {q.id === "weight" && (
                      <p className="text-sm text-[#333333] opacity-60 mt-2">
                        Minimum weight requirement ensures donor safety during blood collection.
                      </p>
                    )}
                    {q.id === "pregnancy" && (
                      <p className="text-sm text-[#333333] opacity-60 mt-2">
                        For the safety of both mother and baby, pregnant individuals are not eligible to donate.
                      </p>
                    )}
                    {q.id === "breastfeeding" && (
                      <p className="text-sm text-[#333333] opacity-60 mt-2">
                        Breastfeeding donors are usually eligible, but we recommend consulting with your healthcare provider.
                      </p>
                    )}
                  </div>
                ))}

                <div className="pt-4">
                  <Button
                    type="submit"
                    disabled={!allAnswered || isSubmitting}
                    className="w-full bg-[#D72638] hover:bg-[#A61B2B] text-white disabled:opacity-50 text-lg py-6"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : allAnswered ? (
                      'Submit Eligibility Check'
                    ) : (
                      'Please Answer All Questions'
                    )}
                  </Button>
                  
                  {!allAnswered && (
                    <p className="text-center text-sm text-[#333333] opacity-60 mt-2">
                      {allQuestions.length - Object.keys(answers).length} question(s) remaining
                    </p>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <CheckCircle2 className="w-20 h-20 text-[#D72638] mb-4" />
              <CardTitle className="mb-2 text-2xl">You are eligible to donate!</CardTitle>
              <CardDescription className="text-lg text-center">
                Thank you for completing the eligibility questionnaire.
                <br />
                Proceeding to your dashboard...
              </CardDescription>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}