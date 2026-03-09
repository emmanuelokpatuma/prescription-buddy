import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { 
  Pill, 
  Bell, 
  Users, 
  Volume2, 
  Calendar, 
  Shield,
  ArrowRight,
  Check,
  Clock,
  Heart
} from 'lucide-react';

const features = [
  {
    icon: Bell,
    title: 'Smart Reminders',
    description: 'Never miss a dose with timely notifications and voice alerts',
    color: 'text-blue-600 bg-blue-100',
  },
  {
    icon: Volume2,
    title: 'Voice Alerts',
    description: 'Hear your medication reminders spoken aloud for accessibility',
    color: 'text-purple-600 bg-purple-100',
  },
  {
    icon: Users,
    title: 'Caregiver Dashboard',
    description: 'Family members can monitor and receive alerts for missed doses',
    color: 'text-emerald-600 bg-emerald-100',
  },
  {
    icon: Calendar,
    title: 'Daily Schedule',
    description: 'View all medications organized by time with color-coded periods',
    color: 'text-amber-600 bg-amber-100',
  },
  {
    icon: Pill,
    title: 'Visual Recognition',
    description: 'Identify pills easily with customizable colors and shapes',
    color: 'text-red-600 bg-red-100',
  },
  {
    icon: Shield,
    title: 'Refill Alerts',
    description: 'Get notified when medication supplies are running low',
    color: 'text-indigo-600 bg-indigo-100',
  },
];

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2 text-xl font-bold text-primary">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <Pill className="w-6 h-6 text-white" />
              </div>
              <span>Vitality</span>
            </Link>
            <div className="flex items-center gap-3">
              <Link to="/login">
                <Button variant="ghost" className="font-semibold" data-testid="login-btn">
                  Login
                </Button>
              </Link>
              <Link to="/register">
                <Button className="font-semibold" data-testid="register-btn">
                  Get Started
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-20 sm:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <Badge variant="outline" className="px-4 py-1.5 text-sm font-medium">
                <Heart className="w-4 h-4 mr-2 text-red-500" />
                Designed for Accessibility
              </Badge>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground">
                Never Miss a{' '}
                <span className="text-primary">Medication</span>{' '}
                Again
              </h1>
              
              <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-xl">
                Vitality helps you and your loved ones manage medications with smart reminders, 
                voice alerts, and caregiver monitoring. Built for elderly users and those with disabilities.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/register">
                  <Button size="lg" className="w-full sm:w-auto btn-large" data-testid="hero-cta">
                    Start Free Today
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <Link to="/login">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto h-16 px-8 text-lg">
                    I Have an Account
                  </Button>
                </Link>
              </div>

              <div className="flex items-center gap-6 pt-4">
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-emerald-500" />
                  <span className="text-sm text-muted-foreground">Free to use</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-emerald-500" />
                  <span className="text-sm text-muted-foreground">No credit card</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-emerald-500" />
                  <span className="text-sm text-muted-foreground">Voice enabled</span>
                </div>
              </div>
            </div>

            {/* Hero Image / Illustration */}
            <div className="relative hidden lg:block">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-3xl blur-3xl" />
              <img 
                src="https://images.unsplash.com/photo-1758691030817-a6271a533c42?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NjZ8MHwxfHNlYXJjaHwxfHxoYXBweSUyMGVsZGVybHklMjB1c2luZyUyMHRhYmxldHxlbnwwfHx8fDE3NzMwNDQ0NDB8MA&ixlib=rb-4.1.0&q=85"
                alt="Elderly person using tablet"
                className="relative rounded-3xl shadow-2xl w-full object-cover aspect-[4/3]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 px-4 py-1.5">
              Features
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Everything You Need to Stay Healthy
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Simple, accessible, and powerful features designed for everyone.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className="p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-border"
              >
                <div className={`w-12 h-12 rounded-xl ${feature.color} flex items-center justify-center mb-4`}>
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 px-4 py-1.5">
              How It Works
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              Simple as 1-2-3
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '1', title: 'Add Medications', desc: 'Enter your medications with dosage and schedule' },
              { step: '2', title: 'Get Reminders', desc: 'Receive timely notifications and voice alerts' },
              { step: '3', title: 'Track & Monitor', desc: 'Log doses and let caregivers stay informed' },
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 rounded-full bg-primary text-white text-2xl font-bold flex items-center justify-center mx-auto mb-6">
                  {item.step}
                </div>
                <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">
            Start Managing Your Medications Today
          </h2>
          <p className="text-lg text-white/80 mb-8 max-w-2xl mx-auto">
            Join thousands of users who trust Vitality to keep them healthy and on track.
          </p>
          <Link to="/register">
            <Button size="lg" variant="secondary" className="btn-large bg-white text-primary hover:bg-white/90">
              Get Started Free
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Pill className="w-5 h-5 text-primary" />
              <span className="font-semibold">Vitality</span>
              <span className="text-sm">© 2024</span>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              This app does not replace medical advice. Always follow your doctor's instructions.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
