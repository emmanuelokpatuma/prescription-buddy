import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMedication } from '../contexts/MedicationContext';
import { PageLayout } from '../components/layout/PageLayout';
import { PillSelector } from '../components/medication/PillSelector';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card } from '../components/ui/card';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { ArrowLeft, Plus, X, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AddMedicationPage = () => {
  const navigate = useNavigate();
  const { createMedication, medications, fetchMedications } = useMedication();
  const [loading, setLoading] = useState(false);
  const [interactionWarning, setInteractionWarning] = useState(null);
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    dosage: '',
    frequency: 'daily',
    times: ['08:00'],
    pill_color: '#4F46E5',
    pill_shape: 'round',
    instructions: '',
    refill_reminder: true,
    total_pills: 30,
    pills_remaining: 30,
  });

  useEffect(() => {
    fetchMedications();
  }, [fetchMedications]);

  // Check for interactions when medication name changes
  useEffect(() => {
    const checkInteractions = async () => {
      if (formData.name.length < 3 || medications.length === 0) {
        setInteractionWarning(null);
        return;
      }
      
      try {
        const response = await axios.post(
          `${API_URL}/interactions/check-new?medication_name=${encodeURIComponent(formData.name)}`
        );
        if (response.data.interactions_found > 0) {
          setInteractionWarning(response.data);
        } else {
          setInteractionWarning(null);
        }
      } catch (error) {
        // Silently fail - interaction check is optional
      }
    };

    const debounce = setTimeout(checkInteractions, 500);
    return () => clearTimeout(debounce);
  }, [formData.name, medications]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addTime = () => {
    setFormData(prev => ({
      ...prev,
      times: [...prev.times, '12:00']
    }));
  };

  const removeTime = (index) => {
    setFormData(prev => ({
      ...prev,
      times: prev.times.filter((_, i) => i !== index)
    }));
  };

  const updateTime = (index, value) => {
    setFormData(prev => ({
      ...prev,
      times: prev.times.map((t, i) => i === index ? value : t)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.dosage) {
      toast.error('Please fill in medication name and dosage');
      return;
    }

    if (formData.times.length === 0) {
      toast.error('Please add at least one time');
      return;
    }

    // If there are interactions, show warning dialog first
    if (interactionWarning && interactionWarning.interactions_found > 0) {
      setShowWarningDialog(true);
      return;
    }

    await saveMedication();
  };

  const saveMedication = async () => {
    setLoading(true);
    try {
      await createMedication(formData);
      toast.success('Medication added successfully!');
      navigate('/medications');
    } catch (error) {
      toast.error('Failed to add medication');
    } finally {
      setLoading(false);
      setShowWarningDialog(false);
    }
  };

  return (
    <PageLayout>
      <div className="max-w-2xl mx-auto space-y-6 page-enter">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/medications">
            <Button variant="ghost" size="icon" className="h-10 w-10">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
              Add Medication
            </h1>
            <p className="text-muted-foreground">
              Enter your medication details
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <Card className="p-6 bg-white space-y-5">
            <h2 className="text-lg font-bold">Medication Details</h2>
            
            <div className="space-y-2">
              <Label htmlFor="name" className="text-base font-semibold">
                Medication Name *
              </Label>
              <Input
                id="name"
                placeholder="e.g., Metformin, Paracetamol"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="h-12 text-lg"
                data-testid="medication-name-input"
              />
              
              {/* Interaction Warning */}
              {interactionWarning && interactionWarning.interactions_found > 0 && (
                <div className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-800">
                        Potential Drug Interaction Detected
                      </p>
                      <div className="mt-2 space-y-2">
                        {interactionWarning.interactions.map((interaction, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm">
                            <Badge className={
                              interaction.severity === 'high' ? 'bg-red-100 text-red-700' :
                              interaction.severity === 'moderate' ? 'bg-amber-100 text-amber-700' :
                              'bg-blue-100 text-blue-700'
                            }>
                              {interaction.severity.toUpperCase()}
                            </Badge>
                            <span className="text-amber-800">
                              {interaction.drug1} + {interaction.drug2}: {interaction.description}
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-amber-600 mt-2">
                        Consult your doctor before taking these medications together.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="dosage" className="text-base font-semibold">
                Dosage *
              </Label>
              <Input
                id="dosage"
                placeholder="e.g., 1 tablet, 500mg, 2 capsules"
                value={formData.dosage}
                onChange={(e) => handleChange('dosage', e.target.value)}
                className="h-12 text-lg"
                data-testid="medication-dosage-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructions" className="text-base font-semibold">
                Instructions (optional)
              </Label>
              <Textarea
                id="instructions"
                placeholder="e.g., Take with food, Avoid alcohol"
                value={formData.instructions}
                onChange={(e) => handleChange('instructions', e.target.value)}
                className="min-h-[100px] text-lg"
                data-testid="medication-instructions-input"
              />
            </div>
          </Card>

          {/* Schedule */}
          <Card className="p-6 bg-white space-y-5">
            <h2 className="text-lg font-bold">Schedule</h2>

            <div className="space-y-2">
              <Label className="text-base font-semibold">Frequency</Label>
              <Select
                value={formData.frequency}
                onValueChange={(value) => handleChange('frequency', value)}
              >
                <SelectTrigger className="h-12 text-lg" data-testid="frequency-select">
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Once Daily</SelectItem>
                  <SelectItem value="twice_daily">Twice Daily</SelectItem>
                  <SelectItem value="three_times_daily">3 Times Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-semibold">Times</Label>
              {formData.times.map((time, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="time"
                      value={time}
                      onChange={(e) => updateTime(index, e.target.value)}
                      className="h-12 text-lg pl-12"
                      data-testid={`time-input-${index}`}
                    />
                  </div>
                  {formData.times.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeTime(index)}
                      className="h-12 w-12 text-red-500"
                      data-testid={`remove-time-${index}`}
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={addTime}
                className="w-full h-12"
                data-testid="add-time-btn"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Another Time
              </Button>
            </div>
          </Card>

          {/* Pill Appearance */}
          <Card className="p-6 bg-white space-y-5">
            <h2 className="text-lg font-bold">Pill Appearance</h2>
            <PillSelector
              selectedColor={formData.pill_color}
              selectedShape={formData.pill_shape}
              onColorChange={(color) => handleChange('pill_color', color)}
              onShapeChange={(shape) => handleChange('pill_shape', shape)}
            />
          </Card>

          {/* Refill Settings */}
          <Card className="p-6 bg-white space-y-5">
            <h2 className="text-lg font-bold">Refill Tracking</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="total_pills" className="text-base font-semibold">
                  Total Pills
                </Label>
                <Input
                  id="total_pills"
                  type="number"
                  min="1"
                  value={formData.total_pills}
                  onChange={(e) => handleChange('total_pills', parseInt(e.target.value) || 30)}
                  className="h-12 text-lg"
                  data-testid="total-pills-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pills_remaining" className="text-base font-semibold">
                  Pills Remaining
                </Label>
                <Input
                  id="pills_remaining"
                  type="number"
                  min="0"
                  value={formData.pills_remaining}
                  onChange={(e) => handleChange('pills_remaining', parseInt(e.target.value) || 0)}
                  className="h-12 text-lg"
                  data-testid="pills-remaining-input"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="font-semibold">Refill Reminder</p>
                <p className="text-sm text-muted-foreground">
                  Get notified when pills are running low
                </p>
              </div>
              <Switch
                checked={formData.refill_reminder}
                onCheckedChange={(checked) => handleChange('refill_reminder', checked)}
                data-testid="refill-reminder-switch"
              />
            </div>
          </Card>

          {/* Submit */}
          <div className="flex gap-4">
            <Link to="/medications" className="flex-1">
              <Button type="button" variant="outline" className="w-full h-14 text-lg">
                Cancel
              </Button>
            </Link>
            <Button 
              type="submit" 
              className="flex-1 h-14 text-lg"
              disabled={loading}
              data-testid="save-medication-btn"
            >
              {loading ? 'Saving...' : 'Save Medication'}
            </Button>
          </div>
        </form>
      </div>

      {/* Interaction Warning Dialog */}
      <AlertDialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              Drug Interaction Warning
            </AlertDialogTitle>
            <AlertDialogDescription>
              <p className="mb-4">
                Adding <strong>{formData.name}</strong> may cause interactions with your current medications:
              </p>
              <div className="space-y-2">
                {interactionWarning?.interactions?.map((interaction, idx) => (
                  <div key={idx} className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Badge className={
                        interaction.severity === 'high' ? 'bg-red-100 text-red-700' :
                        interaction.severity === 'moderate' ? 'bg-amber-100 text-amber-700' :
                        'bg-blue-100 text-blue-700'
                      }>
                        {interaction.severity.toUpperCase()}
                      </Badge>
                      <span className="font-medium">
                        {interaction.drug1} + {interaction.drug2}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {interaction.description}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Do you still want to add this medication? Please consult your doctor if unsure.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={saveMedication}
              className="bg-amber-500 hover:bg-amber-600"
            >
              Add Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
};

export default AddMedicationPage;
