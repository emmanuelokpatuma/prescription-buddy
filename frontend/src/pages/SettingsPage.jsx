import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useMedication } from '../contexts/MedicationContext';
import { PageLayout } from '../components/layout/PageLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import notificationService from '../services/notificationService';
import axios from 'axios';
import { 
  User, 
  Bell, 
  Volume2, 
  Moon,
  LogOut,
  Shield,
  Smartphone,
  BellRing,
  Crown,
  FileText,
  MessageSquare,
  Download
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SettingsPage = () => {
  const { user, logout } = useAuth();
  const { medications } = useMedication();
  const [settings, setSettings] = useState({
    voiceReminders: true,
    browserNotifications: notificationService.isSupported(),
    darkMode: false,
    largeText: false,
  });
  const [scheduledCount, setScheduledCount] = useState(0);
  const [subscription, setSubscription] = useState(null);
  const [loadingPdf, setLoadingPdf] = useState(false);

  useEffect(() => {
    setSettings(prev => ({
      ...prev,
      browserNotifications: notificationService.isSupported()
    }));
    setScheduledCount(notificationService.getScheduledCount());
    
    // Fetch subscription status
    const fetchSubscription = async () => {
      try {
        const response = await axios.get(`${API_URL}/subscription/status`);
        setSubscription(response.data);
      } catch (error) {
        console.error('Failed to fetch subscription:', error);
      }
    };
    fetchSubscription();
  }, []);

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    toast.success('Setting updated');
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
  };

  const requestNotificationPermission = async () => {
    const granted = await notificationService.requestPermission();
    if (granted) {
      toast.success('Notifications enabled!');
      handleSettingChange('browserNotifications', true);
      // Schedule reminders
      if (medications.length > 0) {
        const count = notificationService.scheduleAllReminders(medications);
        setScheduledCount(count);
        toast.info(`${count} reminder(s) scheduled`);
      }
    } else {
      toast.error('Notification permission denied');
      handleSettingChange('browserNotifications', false);
    }
  };

  const testNotification = () => {
    notificationService.show('Test Notification', {
      body: 'This is a test notification from Vitality.',
      tag: 'test'
    });
    toast.success('Test notification sent!');
  };

  const downloadPdf = async () => {
    if (!subscription?.is_subscribed) {
      toast.error('PDF export requires Plus subscription');
      return;
    }
    
    setLoadingPdf(true);
    try {
      const response = await axios.get(`${API_URL}/export/pdf`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `medications_${new Date().toISOString().split('T')[0]}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('PDF downloaded!');
    } catch (error) {
      toast.error('Failed to download PDF');
    } finally {
      setLoadingPdf(false);
    }
  };

  const testVoiceReminder = () => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(
        'This is a test voice reminder from Vitality.'
      );
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
      toast.info('Playing test voice reminder...');
    } else {
      toast.error('Voice synthesis not supported in this browser');
    }
  };

  return (
    <PageLayout>
      <div className="max-w-2xl mx-auto space-y-8 page-enter">
        {/* Header */}
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground">
            Settings
          </h1>
          <p className="text-lg text-muted-foreground mt-1">
            Customize your experience
          </p>
        </div>

        {/* Profile Section */}
        <Card className="p-6 bg-white">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold">{user?.name}</h3>
              <p className="text-muted-foreground">{user?.email}</p>
              <Badge variant="outline" className="mt-1 capitalize">
                {user?.role}
              </Badge>
            </div>
          </div>
        </Card>

        {/* Subscription Section */}
        <Card className={`p-6 ${subscription?.is_subscribed ? 'bg-gradient-to-r from-primary/5 to-purple-500/5 border-primary' : 'bg-white'}`}>
          <div className="flex items-center gap-3 mb-4">
            <Crown className={`w-6 h-6 ${subscription?.is_subscribed ? 'text-primary' : 'text-muted-foreground'}`} />
            <h2 className="text-xl font-bold">Subscription</h2>
            {subscription?.is_subscribed && (
              <Badge className="bg-primary text-white">Plus</Badge>
            )}
          </div>
          <Separator className="mb-4" />
          
          {subscription?.is_subscribed ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">Plan</span>
                <span className="text-primary font-bold">{subscription.plan_name}</span>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    SMS Remaining
                  </span>
                  <span className="font-semibold">{subscription.sms_remaining} / 50</span>
                </div>
                <Progress value={(subscription.sms_remaining / 50) * 100} className="h-2" />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button 
                  variant="outline" 
                  className="flex-1 h-12"
                  onClick={downloadPdf}
                  disabled={loadingPdf}
                  data-testid="download-pdf-btn"
                >
                  <FileText className="w-5 h-5 mr-2" />
                  {loadingPdf ? 'Generating...' : 'Download PDF'}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground mt-2">
                Renews on {subscription.subscription_end ? new Date(subscription.subscription_end).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Upgrade to Plus for SMS reminders, email reports, unlimited caregiver links, and PDF export.
              </p>
              <Link to="/pricing">
                <Button className="w-full h-12" data-testid="upgrade-btn">
                  <Crown className="w-5 h-5 mr-2" />
                  Upgrade to Plus - $2.99/month
                </Button>
              </Link>
            </div>
          )}
        </Card>

        {/* Notification Settings */}
        <Card className="p-6 bg-white space-y-6">
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-bold">Notifications</h2>
          </div>
          <Separator />
          
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base font-semibold">Browser Push Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Get reminded when it's time to take your medication
              </p>
              {settings.browserNotifications && scheduledCount > 0 && (
                <Badge variant="outline" className="mt-1 bg-emerald-50 text-emerald-700">
                  <BellRing className="w-3 h-3 mr-1" />
                  {scheduledCount} reminder(s) scheduled
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={settings.browserNotifications}
                onCheckedChange={(checked) => {
                  if (checked) {
                    requestNotificationPermission();
                  } else {
                    notificationService.clearAllReminders();
                    setScheduledCount(0);
                    handleSettingChange('browserNotifications', false);
                  }
                }}
                data-testid="browser-notifications-switch"
              />
            </div>
          </div>

          {settings.browserNotifications && (
            <Button 
              variant="outline" 
              onClick={testNotification}
              className="w-full h-12"
              data-testid="test-notification-btn"
            >
              <Bell className="w-5 h-5 mr-2" />
              Send Test Notification
            </Button>
          )}
        </Card>

        {/* Voice Settings */}
        <Card className="p-6 bg-white space-y-6">
          <div className="flex items-center gap-3">
            <Volume2 className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-bold">Voice Reminders</h2>
          </div>
          <Separator />
          
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base font-semibold">Voice Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Hear your medication reminders spoken aloud
              </p>
            </div>
            <Switch
              checked={settings.voiceReminders}
              onCheckedChange={(checked) => handleSettingChange('voiceReminders', checked)}
              data-testid="voice-reminders-switch"
            />
          </div>

          <Button 
            variant="outline" 
            onClick={testVoiceReminder}
            className="w-full h-12"
            data-testid="test-voice-btn"
          >
            <Volume2 className="w-5 h-5 mr-2" />
            Test Voice Reminder
          </Button>
        </Card>

        {/* Accessibility Settings */}
        <Card className="p-6 bg-white space-y-6">
          <div className="flex items-center gap-3">
            <Smartphone className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-bold">Accessibility</h2>
          </div>
          <Separator />
          
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base font-semibold">Large Text</Label>
              <p className="text-sm text-muted-foreground">
                Increase text size for better readability
              </p>
            </div>
            <Switch
              checked={settings.largeText}
              onCheckedChange={(checked) => handleSettingChange('largeText', checked)}
              data-testid="large-text-switch"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base font-semibold">Dark Mode</Label>
              <p className="text-sm text-muted-foreground">
                Switch to dark theme
              </p>
            </div>
            <Switch
              checked={settings.darkMode}
              onCheckedChange={(checked) => {
                handleSettingChange('darkMode', checked);
                if (checked) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              }}
              data-testid="dark-mode-switch"
            />
          </div>
        </Card>

        {/* Privacy & Security */}
        <Card className="p-6 bg-white space-y-6">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-bold">Privacy & Security</h2>
          </div>
          <Separator />
          
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              Your medication data is stored securely and is only accessible by you and 
              your linked caregivers. We do not share your data with third parties.
            </p>
          </div>

          <Button 
            variant="outline" 
            className="w-full h-12 text-red-600 border-red-200 hover:bg-red-50"
            onClick={handleLogout}
            data-testid="logout-btn"
          >
            <LogOut className="w-5 h-5 mr-2" />
            Sign Out
          </Button>
        </Card>

        {/* Disclaimer */}
        <Card className="p-6 bg-amber-50 border-amber-200">
          <p className="text-sm text-amber-800">
            <strong>Medical Disclaimer:</strong> This app does not replace medical advice. 
            Always follow your doctor's instructions regarding medications. If you have 
            concerns about your medications, consult a healthcare professional.
          </p>
        </Card>
      </div>
    </PageLayout>
  );
};

export default SettingsPage;
