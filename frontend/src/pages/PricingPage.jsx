import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PageLayout } from '../components/layout/PageLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import axios from 'axios';
import { 
  Check, 
  Crown,
  MessageSquare,
  Mail,
  Users,
  FileText,
  Zap,
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PricingPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [checkingSubscription, setCheckingSubscription] = useState(true);

  useEffect(() => {
    const checkSubscription = async () => {
      if (!user) {
        setCheckingSubscription(false);
        return;
      }
      
      try {
        const response = await axios.get(`${API_URL}/subscription/status`);
        setSubscription(response.data);
      } catch (error) {
        console.error('Failed to check subscription:', error);
      } finally {
        setCheckingSubscription(false);
      }
    };

    checkSubscription();
  }, [user]);

  const handleSubscribe = async () => {
    if (!user) {
      navigate('/register');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/subscription/checkout`, {
        plan_id: 'plus',
        origin_url: window.location.origin
      });
      
      // Redirect to Stripe Checkout
      window.location.href = response.data.checkout_url;
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to start checkout';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const freeFeatures = [
    'Unlimited medications',
    'Daily schedule & reminders',
    'Browser push notifications',
    'Voice reminders',
    'Drug interaction warnings',
    'Medication history',
    'Emergency list',
    '1 caregiver link'
  ];

  const plusFeatures = [
    'Everything in Free',
    'SMS reminders (50/month)',
    'Email weekly reports',
    'Unlimited caregiver links',
    'PDF export',
    'Priority support'
  ];

  return (
    <PageLayout>
      <div className="max-w-5xl mx-auto space-y-8 page-enter">
        {/* Header */}
        <div className="text-center">
          <Badge variant="outline" className="mb-4 px-4 py-1.5">
            Simple Pricing
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-foreground">
            Choose Your Plan
          </h1>
          <p className="text-lg text-muted-foreground mt-4 max-w-2xl mx-auto">
            Start free and upgrade when you need more features. No hidden fees.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 mt-12">
          {/* Free Plan */}
          <Card className="p-8 bg-white border-2 border-border relative">
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold">Free</h3>
                <p className="text-muted-foreground mt-1">Perfect for getting started</p>
              </div>
              
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-extrabold">$0</span>
                <span className="text-muted-foreground">/month</span>
              </div>

              <Separator />

              <ul className="space-y-3">
                {freeFeatures.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {user ? (
                <Button 
                  variant="outline" 
                  className="w-full h-14 text-lg"
                  disabled
                >
                  Current Plan
                </Button>
              ) : (
                <Link to="/register" className="block">
                  <Button variant="outline" className="w-full h-14 text-lg">
                    Get Started Free
                  </Button>
                </Link>
              )}
            </div>
          </Card>

          {/* Plus Plan */}
          <Card className="p-8 bg-gradient-to-br from-primary/5 to-purple-500/5 border-2 border-primary relative overflow-hidden">
            <div className="absolute top-4 right-4">
              <Badge className="bg-primary text-white">
                <Crown className="w-3 h-3 mr-1" />
                Popular
              </Badge>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold flex items-center gap-2">
                  Plus
                  <Zap className="w-5 h-5 text-amber-500" />
                </h3>
                <p className="text-muted-foreground mt-1">For serious medication management</p>
              </div>
              
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-extrabold text-primary">$2.99</span>
                <span className="text-muted-foreground">/month</span>
              </div>

              <Separator />

              <ul className="space-y-3">
                {plusFeatures.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="font-medium">{feature}</span>
                  </li>
                ))}
              </ul>

              {subscription?.is_subscribed ? (
                <Button 
                  className="w-full h-14 text-lg"
                  disabled
                >
                  <Crown className="w-5 h-5 mr-2" />
                  Current Plan
                </Button>
              ) : (
                <Button 
                  className="w-full h-14 text-lg"
                  onClick={handleSubscribe}
                  disabled={loading || checkingSubscription}
                  data-testid="subscribe-btn"
                >
                  {loading ? 'Processing...' : (
                    <>
                      Upgrade to Plus
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </Card>
        </div>

        {/* Feature Comparison */}
        <Card className="p-8 bg-white mt-12">
          <h2 className="text-2xl font-bold mb-6 text-center">Plus Features in Detail</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center p-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-bold">SMS Reminders</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Get text message reminders for your medications
              </p>
            </div>
            <div className="text-center p-4">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center mx-auto mb-3">
                <Mail className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-bold">Email Reports</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Receive weekly adherence reports via email
              </p>
            </div>
            <div className="text-center p-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="font-bold">Unlimited Caregivers</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Link unlimited family members to monitor
              </p>
            </div>
            <div className="text-center p-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="font-bold">PDF Export</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Download medication lists for doctors
              </p>
            </div>
          </div>
        </Card>

        {/* FAQ */}
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            Questions? Contact us anytime. Cancel your subscription anytime.
          </p>
        </div>
      </div>
    </PageLayout>
  );
};

export default PricingPage;
