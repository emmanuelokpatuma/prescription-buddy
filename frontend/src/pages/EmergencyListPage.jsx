import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PageLayout } from '../components/layout/PageLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Separator } from '../components/ui/separator';
import axios from 'axios';
import { format } from 'date-fns';
import { 
  AlertCircle, 
  Pill, 
  Clock, 
  Share2, 
  Printer,
  Download,
  Heart
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const EmergencyListPage = () => {
  const { user } = useAuth();
  const [emergencyData, setEmergencyData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEmergencyList = async () => {
      try {
        const response = await axios.get(`${API_URL}/emergency-list`);
        setEmergencyData(response.data);
      } catch (error) {
        console.error('Failed to fetch emergency list:', error);
        toast.error('Failed to load emergency list');
      } finally {
        setLoading(false);
      }
    };

    fetchEmergencyList();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    if (navigator.share && emergencyData) {
      try {
        const text = `Emergency Medication List for ${emergencyData.user_name}\n\n` +
          emergencyData.medications.map(m => 
            `${m.name} - ${m.dosage} (${m.times.join(', ')})`
          ).join('\n');
        
        await navigator.share({
          title: 'Emergency Medication List',
          text: text,
        });
      } catch (error) {
        if (error.name !== 'AbortError') {
          toast.error('Failed to share');
        }
      }
    } else {
      // Fallback to copy to clipboard
      const text = emergencyData.medications.map(m => 
        `${m.name} - ${m.dosage} (${m.times.join(', ')})`
      ).join('\n');
      
      navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard!');
    }
  };

  if (loading) {
    return (
      <PageLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-64" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="space-y-8 page-enter print:space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground">
              Emergency List
            </h1>
            <p className="text-lg text-muted-foreground mt-1">
              Show this to doctors or emergency services
            </p>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              size="lg" 
              onClick={handleShare}
              className="h-12"
              data-testid="share-btn"
            >
              <Share2 className="w-5 h-5 mr-2" />
              Share
            </Button>
            <Button 
              size="lg" 
              onClick={handlePrint}
              className="h-12"
              data-testid="print-btn"
            >
              <Printer className="w-5 h-5 mr-2" />
              Print
            </Button>
          </div>
        </div>

        {/* Emergency Card */}
        <Card className="p-6 sm:p-8 bg-white border-2 border-red-200 print:border print:shadow-none">
          {/* Emergency Header */}
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-border">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center print:bg-red-50">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <div>
              <Badge className="bg-red-500 text-white mb-2">EMERGENCY INFORMATION</Badge>
              <h2 className="text-2xl font-bold">{emergencyData?.user_name}</h2>
              <p className="text-muted-foreground">
                Generated: {emergencyData ? format(new Date(emergencyData.generated_at), 'PPP p') : ''}
              </p>
            </div>
          </div>

          {/* Medications List */}
          {emergencyData?.medications?.length === 0 ? (
            <div className="text-center py-8">
              <Pill className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No medications on file</p>
            </div>
          ) : (
            <div className="space-y-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Pill className="w-5 h-5 text-primary" />
                Current Medications
              </h3>
              
              <div className="space-y-4">
                {emergencyData?.medications?.map((med, index) => (
                  <div 
                    key={index} 
                    className="p-4 bg-muted/30 rounded-xl print:bg-stone-50"
                    data-testid={`emergency-med-${index}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <h4 className="text-xl font-bold text-foreground">{med.name}</h4>
                        <p className="text-lg text-muted-foreground">{med.dosage}</p>
                      </div>
                      <Badge variant="outline" className="text-base px-4 py-1 w-fit">
                        <Clock className="w-4 h-4 mr-2" />
                        {med.times.join(', ')}
                      </Badge>
                    </div>
                    {med.instructions && (
                      <p className="mt-2 text-muted-foreground italic">
                        {med.instructions}
                      </p>
                    )}
                    <p className="mt-2 text-sm text-muted-foreground">
                      Frequency: {med.frequency.replace(/_/g, ' ')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <Separator className="my-6" />
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg print:bg-amber-50/50">
            <Heart className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold mb-1">Medical Disclaimer</p>
              <p>
                This list is for informational purposes only. Always consult with healthcare 
                professionals for medical advice. Medication dosages and schedules should be 
                verified with prescribing physicians.
              </p>
            </div>
          </div>
        </Card>

        {/* Print Footer */}
        <div className="hidden print:block text-center text-sm text-muted-foreground">
          <p>Generated by Vitality Medication Reminder</p>
          <p>{format(new Date(), 'PPP p')}</p>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            margin: 1cm;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          nav, .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </PageLayout>
  );
};

export default EmergencyListPage;
