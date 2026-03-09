import { useState } from 'react';
import { useMedication } from '../../contexts/MedicationContext';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Check, X, Clock, Volume2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const periodColors = {
  morning: 'bg-blue-100 text-blue-700 border-blue-200',
  afternoon: 'bg-amber-100 text-amber-700 border-amber-200',
  evening: 'bg-purple-100 text-purple-700 border-purple-200',
};

const statusColors = {
  taken: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  missed: 'bg-red-100 text-red-700 border-red-300',
  pending: 'bg-stone-100 text-stone-600 border-stone-300',
  skipped: 'bg-amber-100 text-amber-700 border-amber-300',
};

const pillShapeStyles = {
  round: 'rounded-full aspect-square',
  oval: 'rounded-full aspect-[1.5]',
  capsule: 'rounded-full aspect-[2.5]',
  square: 'rounded-md aspect-square',
};

export const MedicationCard = ({ medication, showActions = true }) => {
  const { logMedication, speakReminder } = useMedication();
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleAction = (action) => {
    setConfirmAction(action);
    setShowConfirm(true);
  };

  const confirmMedicationAction = async () => {
    setIsLoading(true);
    try {
      await logMedication(medication.medication_id, medication.time, confirmAction);
      
      const messages = {
        taken: `${medication.name} marked as taken`,
        missed: `${medication.name} marked as missed`,
        skipped: `${medication.name} skipped for now`,
      };
      
      toast.success(messages[confirmAction]);
    } catch (error) {
      toast.error('Failed to update medication status');
    } finally {
      setIsLoading(false);
      setShowConfirm(false);
      setConfirmAction(null);
    }
  };

  const handleVoiceReminder = () => {
    speakReminder(medication.name, medication.dosage);
    toast.info('Playing voice reminder...');
  };

  const isPending = medication.status === 'pending';

  return (
    <>
      <Card 
        className={`p-4 sm:p-6 transition-all duration-200 border-l-4 ${
          medication.status === 'taken' 
            ? 'border-l-emerald-500 bg-emerald-50/50' 
            : medication.status === 'missed'
            ? 'border-l-red-500 bg-red-50/50'
            : medication.status === 'skipped'
            ? 'border-l-amber-500 bg-amber-50/50'
            : 'border-l-primary'
        }`}
        data-testid={`medication-card-${medication.medication_id}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Pill Visual */}
          <div className="flex items-center gap-4">
            <div 
              className={`w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center shadow-md ${pillShapeStyles[medication.pill_shape]}`}
              style={{ backgroundColor: medication.pill_color }}
              data-testid="pill-visual"
            >
              <span className="text-white text-xs font-bold opacity-80">
                {medication.name.charAt(0)}
              </span>
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg sm:text-xl font-bold text-foreground">
                  {medication.name}
                </h3>
                {medication.refill_warning && (
                  <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 text-xs">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Low Stock ({medication.pills_remaining})
                  </Badge>
                )}
              </div>
              <p className="text-base sm:text-lg text-muted-foreground font-medium">
                {medication.dosage}
              </p>
              {medication.instructions && (
                <p className="text-sm text-muted-foreground mt-1">
                  {medication.instructions}
                </p>
              )}
            </div>
          </div>

          {/* Time & Status */}
          <div className="flex flex-col sm:items-end gap-2 sm:ml-auto">
            <div className="flex items-center gap-2">
              <Badge 
                variant="outline" 
                className={`text-sm px-3 py-1 ${periodColors[medication.period]}`}
              >
                <Clock className="w-3 h-3 mr-1" />
                {medication.time}
              </Badge>
              <Badge 
                variant="outline" 
                className={`text-sm px-3 py-1 capitalize ${statusColors[medication.status]}`}
              >
                {medication.status}
              </Badge>
            </div>

            {/* Actions */}
            {showActions && isPending && (
              <div className="flex items-center gap-2 mt-2">
                <Button
                  size="lg"
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold h-12 px-6"
                  onClick={() => handleAction('taken')}
                  data-testid="btn-take-medication"
                >
                  <Check className="w-5 h-5 mr-2" />
                  Take Now
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-amber-300 text-amber-700 hover:bg-amber-50 h-12"
                  onClick={() => handleAction('skipped')}
                  data-testid="btn-skip-medication"
                >
                  <Clock className="w-5 h-5 mr-2" />
                  Skip
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-50 h-12"
                  onClick={() => handleAction('missed')}
                  data-testid="btn-miss-medication"
                >
                  <X className="w-5 h-5 mr-2" />
                  Miss
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-12 w-12"
                  onClick={handleVoiceReminder}
                  data-testid="btn-voice-reminder"
                  title="Voice Reminder"
                >
                  <Volume2 className="w-5 h-5 text-primary" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === 'taken' && 'Confirm Taking Medication'}
              {confirmAction === 'missed' && 'Mark as Missed?'}
              {confirmAction === 'skipped' && 'Skip This Dose?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === 'taken' && (
                <>
                  Did you take <strong>{medication.dosage}</strong> of <strong>{medication.name}</strong>?
                </>
              )}
              {confirmAction === 'missed' && (
                <>
                  This will mark <strong>{medication.name}</strong> as missed. Your caregiver will be notified.
                </>
              )}
              {confirmAction === 'skipped' && (
                <>
                  This will skip the current dose of <strong>{medication.name}</strong>.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmMedicationAction}
              disabled={isLoading}
              className={
                confirmAction === 'taken' 
                  ? 'bg-emerald-500 hover:bg-emerald-600' 
                  : confirmAction === 'missed'
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-amber-500 hover:bg-amber-600'
              }
            >
              {isLoading ? 'Updating...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default MedicationCard;
