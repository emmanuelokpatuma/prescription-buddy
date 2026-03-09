import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useMedication } from '../contexts/MedicationContext';
import { PageLayout } from '../components/layout/PageLayout';
import { MedicationCard } from '../components/medication/MedicationCard';
import { DrugInteractionChecker } from '../components/medication/DrugInteractionChecker';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Skeleton } from '../components/ui/skeleton';
import { format } from 'date-fns';
import notificationService from '../services/notificationService';
import { 
  Plus, 
  Pill, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Volume2,
  CalendarDays,
  TrendingUp,
  Bell
} from 'lucide-react';
import { toast } from 'sonner';

const DashboardPage = () => {
  const { user } = useAuth();
  const { schedule, stats, fetchSchedule, fetchStats, fetchMedications, medications, speakReminder, loading } = useMedication();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    fetchSchedule();
    fetchStats();
    fetchMedications();
    
    // Check notification permission
    setNotificationsEnabled(notificationService.isSupported());
    
    // Update time every minute
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, [fetchSchedule, fetchStats, fetchMedications]);

  // Schedule browser notifications when medications change
  useEffect(() => {
    if (medications.length > 0 && notificationsEnabled) {
      notificationService.scheduleAllReminders(medications);
    }
  }, [medications, notificationsEnabled]);

  const enableNotifications = async () => {
    const granted = await notificationService.requestPermission();
    setNotificationsEnabled(granted);
    if (granted) {
      toast.success('Browser notifications enabled!');
      // Schedule reminders for today
      if (medications.length > 0) {
        const count = notificationService.scheduleAllReminders(medications);
        toast.info(`${count} reminder(s) scheduled for today`);
      }
    } else {
      toast.error('Notification permission denied');
    }
  };

  const today = format(new Date(), 'yyyy-MM-dd');
  const displayDate = format(new Date(), 'EEEE, MMMM d, yyyy');

  // Group medications by period
  const groupedMeds = {
    morning: schedule?.medications?.filter(m => m.period === 'morning') || [],
    afternoon: schedule?.medications?.filter(m => m.period === 'afternoon') || [],
    evening: schedule?.medications?.filter(m => m.period === 'evening') || [],
  };

  const handleReadAll = () => {
    const pending = schedule?.medications?.filter(m => m.status === 'pending');
    if (pending?.length) {
      pending.forEach((med, index) => {
        setTimeout(() => {
          speakReminder(med.name, med.dosage);
        }, index * 3000);
      });
      toast.info('Reading all pending medications...');
    } else {
      toast.info('No pending medications to read');
    }
  };

  const periodConfig = {
    morning: { 
      label: 'Morning', 
      icon: '🌅', 
      bg: 'bg-blue-50', 
      border: 'border-blue-200',
      text: 'text-blue-700' 
    },
    afternoon: { 
      label: 'Afternoon', 
      icon: '☀️', 
      bg: 'bg-amber-50', 
      border: 'border-amber-200',
      text: 'text-amber-700' 
    },
    evening: { 
      label: 'Evening', 
      icon: '🌙', 
      bg: 'bg-purple-50', 
      border: 'border-purple-200',
      text: 'text-purple-700' 
    },
  };

  if (loading && !schedule) {
    return (
      <PageLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
          <Skeleton className="h-64" />
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
              Hello, {user?.name?.split(' ')[0]} 👋
            </h1>
            <p className="text-lg text-muted-foreground mt-1">
              <CalendarDays className="w-4 h-4 inline mr-2" />
              {displayDate}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!notificationsEnabled && (
              <Button
                variant="outline"
                size="lg"
                onClick={enableNotifications}
                className="h-12"
                data-testid="enable-notifications-btn"
              >
                <Bell className="w-5 h-5 mr-2" />
                Enable Alerts
              </Button>
            )}
            <Button
              variant="outline"
              size="lg"
              onClick={handleReadAll}
              className="h-12"
              data-testid="read-all-btn"
            >
              <Volume2 className="w-5 h-5 mr-2" />
              Read Aloud
            </Button>
            <Link to="/medications/add">
              <Button size="lg" className="h-12" data-testid="add-medication-btn">
                <Plus className="w-5 h-5 mr-2" />
                Add Medication
              </Button>
            </Link>
          </div>
        </div>

        {/* Browser Notifications Banner */}
        {!notificationsEnabled && (
          <Card className="p-4 bg-primary/5 border-primary/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-semibold">Enable Browser Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Get reminded when it's time to take your medication
                  </p>
                </div>
              </div>
              <Button onClick={enableNotifications} data-testid="enable-notifications-banner-btn">
                Enable
              </Button>
            </div>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-5 bg-white hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                <Pill className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.total_medications || 0}</p>
                <p className="text-sm text-muted-foreground">Medications</p>
              </div>
            </div>
          </Card>

          <Card className="p-5 bg-white hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.taken_today || 0}</p>
                <p className="text-sm text-muted-foreground">Taken Today</p>
              </div>
            </div>
          </Card>

          <Card className="p-5 bg-white hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.missed_today || 0}</p>
                <p className="text-sm text-muted-foreground">Missed Today</p>
              </div>
            </div>
          </Card>

          <Card className="p-5 bg-white hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.low_stock_count || 0}</p>
                <p className="text-sm text-muted-foreground">Low Stock</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Adherence Progress */}
        {stats && schedule?.stats?.total > 0 && (
          <Card className="p-6 bg-white">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-lg">Today's Progress</h3>
              </div>
              <Badge variant="outline" className="text-base px-3 py-1">
                {schedule.stats.adherence_rate}%
              </Badge>
            </div>
            <Progress value={schedule.stats.adherence_rate} className="h-3" />
            <p className="text-sm text-muted-foreground mt-2">
              {schedule.stats.taken} of {schedule.stats.total} doses taken
            </p>
          </Card>
        )}

        {/* Drug Interactions Warning */}
        {medications.length >= 2 && (
          <DrugInteractionChecker compact={true} showTitle={true} />
        )}

        {/* Today's Schedule */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Today's Schedule</h2>
            <Link to="/history">
              <Button variant="ghost" className="text-muted-foreground">
                View History →
              </Button>
            </Link>
          </div>

          {schedule?.medications?.length === 0 ? (
            <Card className="p-12 text-center bg-white">
              <Pill className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Medications Scheduled</h3>
              <p className="text-muted-foreground mb-6">
                Add your first medication to start tracking your health.
              </p>
              <Link to="/medications/add">
                <Button size="lg" data-testid="add-first-medication-btn">
                  <Plus className="w-5 h-5 mr-2" />
                  Add Your First Medication
                </Button>
              </Link>
            </Card>
          ) : (
            <div className="space-y-8">
              {Object.entries(periodConfig).map(([period, config]) => {
                const meds = groupedMeds[period];
                if (meds.length === 0) return null;

                return (
                  <div key={period} className="space-y-4">
                    <div className={`flex items-center gap-3 px-4 py-2 rounded-lg ${config.bg} ${config.border} border`}>
                      <span className="text-2xl">{config.icon}</span>
                      <h3 className={`text-lg font-bold ${config.text}`}>
                        {config.label}
                      </h3>
                      <Badge variant="outline" className={config.text}>
                        {meds.length} medication{meds.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <div className="space-y-3 pl-2">
                      {meds.map((med) => (
                        <MedicationCard key={`${med.medication_id}-${med.time}`} medication={med} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
};

export default DashboardPage;
