import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PageLayout } from '../components/layout/PageLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import { Badge } from '../components/ui/badge';
import { 
  User, 
  Bell, 
  Volume2, 
  Moon,
  LogOut,
  Shield,
  Smartphone
} from 'lucide-react';
import { toast } from 'sonner';

const SettingsPage = () => {
  const { user, logout } = useAuth();
  const [settings, setSettings] = useState({
    voiceReminders: true,
    browserNotifications: true,
    darkMode: false,
    largeText: false,
  });

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    toast.success('Setting updated');
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        toast.success('Notifications enabled!');
        handleSettingChange('browserNotifications', true);
      } else {
        toast.error('Notification permission denied');
        handleSettingChange('browserNotifications', false);
      }
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

        {/* Notification Settings */}
        <Card className="p-6 bg-white space-y-6">
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-bold">Notifications</h2>
          </div>
          <Separator />
          
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base font-semibold">Browser Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive reminders in your browser
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={settings.browserNotifications}
                onCheckedChange={(checked) => {
                  if (checked) {
                    requestNotificationPermission();
                  } else {
                    handleSettingChange('browserNotifications', false);
                  }
                }}
                data-testid="browser-notifications-switch"
              />
            </div>
          </div>
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
