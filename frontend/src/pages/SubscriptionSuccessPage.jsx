import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Pill, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SubscriptionSuccessPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState('checking'); // checking, success, failed
  const [attempts, setAttempts] = useState(0);
  const maxAttempts = 5;

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (!sessionId) {
      navigate('/pricing');
      return;
    }

    const checkPaymentStatus = async () => {
      try {
        const response = await axios.get(`${API_URL}/subscription/checkout/status/${sessionId}`);
        
        if (response.data.payment_status === 'paid') {
          setStatus('success');
          return;
        }
        
        if (response.data.status === 'expired') {
          setStatus('failed');
          return;
        }

        // Keep polling if still pending
        if (attempts < maxAttempts) {
          setTimeout(() => {
            setAttempts(prev => prev + 1);
          }, 2000);
        } else {
          setStatus('failed');
        }
      } catch (error) {
        console.error('Failed to check payment status:', error);
        if (attempts >= maxAttempts) {
          setStatus('failed');
        } else {
          setTimeout(() => {
            setAttempts(prev => prev + 1);
          }, 2000);
        }
      }
    };

    checkPaymentStatus();
  }, [sessionId, attempts, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center">
        {status === 'checking' && (
          <>
            <Loader2 className="w-16 h-16 mx-auto text-primary animate-spin mb-6" />
            <h1 className="text-2xl font-bold mb-2">Processing Payment...</h1>
            <p className="text-muted-foreground">
              Please wait while we confirm your subscription.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold mb-2 text-emerald-600">
              Welcome to Vitality Plus!
            </h1>
            <p className="text-muted-foreground mb-6">
              Your subscription is now active. Enjoy all the premium features!
            </p>
            <div className="space-y-3">
              <Link to="/dashboard" className="block">
                <Button className="w-full h-12">
                  Go to Dashboard
                </Button>
              </Link>
              <Link to="/settings" className="block">
                <Button variant="outline" className="w-full h-12">
                  View Subscription
                </Button>
              </Link>
            </div>
          </>
        )}

        {status === 'failed' && (
          <>
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-10 h-10 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold mb-2 text-red-600">
              Payment Failed
            </h1>
            <p className="text-muted-foreground mb-6">
              We couldn't process your payment. Please try again.
            </p>
            <div className="space-y-3">
              <Link to="/pricing" className="block">
                <Button className="w-full h-12">
                  Try Again
                </Button>
              </Link>
              <Link to="/dashboard" className="block">
                <Button variant="outline" className="w-full h-12">
                  Go to Dashboard
                </Button>
              </Link>
            </div>
          </>
        )}

        <div className="mt-8 flex items-center justify-center gap-2 text-muted-foreground">
          <Pill className="w-4 h-4" />
          <span className="text-sm">Vitality Medication Reminder</span>
        </div>
      </Card>
    </div>
  );
};

export default SubscriptionSuccessPage;
