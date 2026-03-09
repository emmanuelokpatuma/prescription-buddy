import { useEffect, useState } from 'react';
import { useMedication } from '../../contexts/MedicationContext';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { AlertTriangle, CheckCircle2, Info, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const severityConfig = {
  high: {
    bg: 'bg-red-50 border-red-200',
    badge: 'bg-red-100 text-red-700',
    icon: AlertTriangle,
    iconColor: 'text-red-600'
  },
  moderate: {
    bg: 'bg-amber-50 border-amber-200',
    badge: 'bg-amber-100 text-amber-700',
    icon: Info,
    iconColor: 'text-amber-600'
  },
  low: {
    bg: 'bg-blue-50 border-blue-200',
    badge: 'bg-blue-100 text-blue-700',
    icon: Info,
    iconColor: 'text-blue-600'
  }
};

export const DrugInteractionChecker = ({ showTitle = true, compact = false }) => {
  const { medications } = useMedication();
  const [interactions, setInteractions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  const checkInteractions = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/interactions/check`);
      setInteractions(response.data.interactions);
      setChecked(true);
      
      if (response.data.interactions.length > 0) {
        toast.warning(`Found ${response.data.interactions.length} potential interaction(s)`);
      } else {
        toast.success('No drug interactions found!');
      }
    } catch (error) {
      console.error('Failed to check interactions:', error);
      toast.error('Failed to check interactions');
    } finally {
      setLoading(false);
    }
  };

  // Auto-check when medications change
  useEffect(() => {
    if (medications.length >= 2) {
      checkInteractions();
    } else {
      setInteractions([]);
      setChecked(false);
    }
  }, [medications.length]);

  if (compact && interactions.length === 0 && !loading) {
    return null;
  }

  if (loading) {
    return (
      <Card className="p-4">
        <Skeleton className="h-6 w-48 mb-3" />
        <Skeleton className="h-20" />
      </Card>
    );
  }

  return (
    <Card className="p-4 sm:p-6 bg-white" data-testid="drug-interaction-checker">
      {showTitle && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-lg">Drug Interactions</h3>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={checkInteractions}
            disabled={loading || medications.length < 2}
            data-testid="check-interactions-btn"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Check
          </Button>
        </div>
      )}

      {medications.length < 2 ? (
        <div className="text-center py-4 text-muted-foreground">
          <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Add at least 2 medications to check for interactions</p>
        </div>
      ) : interactions.length === 0 && checked ? (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          <div>
            <p className="font-semibold text-emerald-700">No Interactions Found</p>
            <p className="text-sm text-emerald-600">
              Your current medications appear to be safe to take together
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {interactions.map((interaction, index) => {
            const config = severityConfig[interaction.severity];
            const Icon = config.icon;
            
            return (
              <div 
                key={index}
                className={`p-4 rounded-lg border ${config.bg}`}
                data-testid={`interaction-${index}`}
              >
                <div className="flex items-start gap-3">
                  <Icon className={`w-5 h-5 mt-0.5 ${config.iconColor}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{interaction.drug1}</span>
                      <span className="text-muted-foreground">+</span>
                      <span className="font-semibold">{interaction.drug2}</span>
                      <Badge className={config.badge}>
                        {interaction.severity.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-sm mt-1 text-muted-foreground">
                      {interaction.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
          
          <p className="text-xs text-muted-foreground mt-4">
            ⚠️ This is general information only. Always consult your doctor or pharmacist 
            about drug interactions.
          </p>
        </div>
      )}
    </Card>
  );
};

export default DrugInteractionChecker;
