import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PageLayout } from '../components/layout/PageLayout';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Skeleton } from '../components/ui/skeleton';
import { Progress } from '../components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
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
import axios from 'axios';
import { format } from 'date-fns';
import { 
  Users, 
  UserPlus, 
  Mail, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Trash2,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CaregiverDashboard = () => {
  const { user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [patientSchedules, setPatientSchedules] = useState({});
  const [loading, setLoading] = useState(true);
  const [linkEmail, setLinkEmail] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [unlinkId, setUnlinkId] = useState(null);

  const today = format(new Date(), 'yyyy-MM-dd');

  const fetchPatients = async () => {
    try {
      const response = await axios.get(`${API_URL}/caregivers/patients`);
      setPatients(response.data);
      
      // Fetch schedules for each patient
      const schedules = {};
      for (const patient of response.data) {
        try {
          const scheduleRes = await axios.get(
            `${API_URL}/caregivers/patient/${patient.patient_id}/schedule/${today}`
          );
          schedules[patient.patient_id] = scheduleRes.data;
        } catch (e) {
          console.error(`Failed to fetch schedule for ${patient.patient_name}`);
        }
      }
      setPatientSchedules(schedules);
    } catch (error) {
      console.error('Failed to fetch patients:', error);
      toast.error('Failed to load patients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'caregiver') {
      fetchPatients();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleLinkPatient = async (e) => {
    e.preventDefault();
    
    if (!linkEmail) {
      toast.error('Please enter patient email');
      return;
    }

    setLinking(true);
    try {
      await axios.post(`${API_URL}/caregivers/link`, {
        patient_email: linkEmail
      });
      toast.success('Patient linked successfully!');
      setLinkEmail('');
      setLinkDialogOpen(false);
      fetchPatients();
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to link patient';
      toast.error(message);
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async () => {
    if (!unlinkId) return;
    
    try {
      await axios.delete(`${API_URL}/caregivers/unlink/${unlinkId}`);
      toast.success('Patient unlinked');
      setPatients(patients.filter(p => p.link_id !== unlinkId));
    } catch (error) {
      toast.error('Failed to unlink patient');
    } finally {
      setUnlinkId(null);
    }
  };

  if (user?.role !== 'caregiver') {
    return (
      <PageLayout>
        <Card className="p-12 text-center bg-white">
          <Users className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Caregiver Access Only</h3>
          <p className="text-muted-foreground">
            This dashboard is for caregivers. Register as a caregiver to access this feature.
          </p>
        </Card>
      </PageLayout>
    );
  }

  if (loading) {
    return (
      <PageLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-48" />
          <div className="grid gap-4">
            {[1, 2].map(i => <Skeleton key={i} className="h-48" />)}
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="space-y-8 page-enter">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground">
              Family Dashboard
            </h1>
            <p className="text-lg text-muted-foreground mt-1">
              Monitor your loved ones' medication adherence
            </p>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              size="lg" 
              onClick={fetchPatients}
              className="h-12"
              data-testid="refresh-btn"
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              Refresh
            </Button>
            <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
              <DialogTrigger asChild>
                <Button size="lg" className="h-12" data-testid="link-patient-btn">
                  <UserPlus className="w-5 h-5 mr-2" />
                  Link Patient
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleLinkPatient}>
                  <DialogHeader>
                    <DialogTitle>Link a Patient</DialogTitle>
                    <DialogDescription>
                      Enter the email address of the patient you want to monitor. 
                      They must be registered as a patient first.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <Label htmlFor="patient-email" className="text-base font-semibold">
                      Patient Email
                    </Label>
                    <div className="flex items-center gap-2 mt-2">
                      <Mail className="w-5 h-5 text-muted-foreground" />
                      <Input
                        id="patient-email"
                        type="email"
                        placeholder="patient@example.com"
                        value={linkEmail}
                        onChange={(e) => setLinkEmail(e.target.value)}
                        className="h-12"
                        data-testid="patient-email-input"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setLinkDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={linking} data-testid="confirm-link-btn">
                      {linking ? 'Linking...' : 'Link Patient'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Patients List */}
        {patients.length === 0 ? (
          <Card className="p-12 text-center bg-white">
            <Users className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Patients Linked</h3>
            <p className="text-muted-foreground mb-6">
              Link a patient to start monitoring their medications.
            </p>
            <Button onClick={() => setLinkDialogOpen(true)} data-testid="link-first-patient-btn">
              <UserPlus className="w-5 h-5 mr-2" />
              Link Your First Patient
            </Button>
          </Card>
        ) : (
          <div className="space-y-6">
            {patients.map((patient) => {
              const schedule = patientSchedules[patient.patient_id];
              const adherenceRate = schedule?.stats?.adherence_rate || 0;
              const totalMeds = schedule?.stats?.total || 0;
              const takenMeds = schedule?.stats?.taken || 0;

              return (
                <Card 
                  key={patient.link_id} 
                  className="p-6 bg-white"
                  data-testid={`patient-card-${patient.patient_id}`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                    {/* Patient Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xl font-bold text-primary">
                            {patient.patient_name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <h3 className="text-xl font-bold">{patient.patient_name}</h3>
                          <p className="text-muted-foreground">{patient.patient_email}</p>
                        </div>
                        <Badge variant="outline" className="ml-auto">
                          {patient.status}
                        </Badge>
                      </div>

                      {/* Progress */}
                      {schedule && totalMeds > 0 && (
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Today's Progress</span>
                            <span className="text-sm font-bold">{adherenceRate}%</span>
                          </div>
                          <Progress value={adherenceRate} className="h-2" />
                          <p className="text-sm text-muted-foreground">
                            {takenMeds} of {totalMeds} medications taken
                          </p>
                        </div>
                      )}

                      {/* Today's Medications */}
                      {schedule?.medications && schedule.medications.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                            Today's Schedule
                          </h4>
                          <div className="grid gap-2">
                            {schedule.medications.map((med, idx) => (
                              <div 
                                key={idx}
                                className={`flex items-center justify-between p-3 rounded-lg border ${
                                  med.status === 'taken' ? 'bg-emerald-50 border-emerald-200' :
                                  med.status === 'missed' ? 'bg-red-50 border-red-200' :
                                  'bg-stone-50 border-stone-200'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div 
                                    className="w-8 h-8 rounded-full"
                                    style={{ backgroundColor: med.pill_color }}
                                  />
                                  <div>
                                    <p className="font-medium">{med.name}</p>
                                    <p className="text-sm text-muted-foreground">{med.dosage}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">{med.time}</span>
                                  {med.status === 'taken' && (
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                  )}
                                  {med.status === 'missed' && (
                                    <XCircle className="w-5 h-5 text-red-600" />
                                  )}
                                  {med.status === 'pending' && (
                                    <Clock className="w-5 h-5 text-muted-foreground" />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Missed Alert */}
                      {schedule?.medications?.some(m => m.status === 'missed') && (
                        <div className="flex items-center gap-2 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <AlertCircle className="w-5 h-5 text-red-600" />
                          <span className="text-sm text-red-700 font-medium">
                            {patient.patient_name} has missed medications today
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex lg:flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => setUnlinkId(patient.link_id)}
                        data-testid={`unlink-${patient.patient_id}`}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Unlink
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Unlink Confirmation */}
      <AlertDialog open={!!unlinkId} onOpenChange={() => setUnlinkId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink Patient?</AlertDialogTitle>
            <AlertDialogDescription>
              You will no longer be able to monitor this patient's medication adherence. 
              You can link them again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnlink}
              className="bg-red-500 hover:bg-red-600"
            >
              Unlink
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
};

export default CaregiverDashboard;
