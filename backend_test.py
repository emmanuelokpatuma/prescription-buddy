import requests
import sys
import json
from datetime import datetime

class MedicationAPITester:
    def __init__(self, base_url="https://prescription-buddy-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_result(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        self.test_results.append({
            "test_name": name,
            "status": "PASS" if success else "FAIL",
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        # Add auth token if available
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        # Merge custom headers
        if headers:
            test_headers.update(headers)

        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {method} {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            
            if success:
                print(f"   ✅ PASS - {details}")
                try:
                    response_data = response.json()
                    self.log_result(name, True, f"{details} | Response: {json.dumps(response_data, indent=2)}")
                    return True, response_data
                except:
                    self.log_result(name, True, details)
                    return True, {}
            else:
                error_details = f"Expected {expected_status}, got {response.status_code}"
                try:
                    error_response = response.json()
                    error_details += f" | Error: {error_response}"
                except:
                    error_details += f" | Text: {response.text[:200]}"
                
                print(f"   ❌ FAIL - {error_details}")
                self.log_result(name, False, error_details)
                return False, {}

        except Exception as e:
            error_msg = f"Exception: {str(e)}"
            print(f"   ❌ FAIL - {error_msg}")
            self.log_result(name, False, error_msg)
            return False, {}

    def test_health_endpoint(self):
        """Test health endpoint"""
        success, response = self.run_test("Health Check", "GET", "api/health", 200)
        return success

    def test_user_registration(self):
        """Test user registration"""
        timestamp = datetime.now().strftime('%H%M%S')
        test_user_data = {
            "email": f"test_patient_{timestamp}@example.com",
            "password": "TestPass123!",
            "name": f"Test Patient {timestamp}",
            "role": "patient"
        }
        
        success, response = self.run_test(
            "User Registration (Patient)",
            "POST",
            "api/auth/register",
            200,
            data=test_user_data
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['user_id']
            print(f"   📝 Stored token and user_id for subsequent tests")
        
        return success

    def test_caregiver_registration(self):
        """Test caregiver registration"""
        timestamp = datetime.now().strftime('%H%M%S')
        caregiver_data = {
            "email": f"test_caregiver_{timestamp}@example.com", 
            "password": "TestPass123!",
            "name": f"Test Caregiver {timestamp}",
            "role": "caregiver"
        }
        
        success, response = self.run_test(
            "User Registration (Caregiver)",
            "POST", 
            "api/auth/register",
            200,
            data=caregiver_data
        )
        return success

    def test_user_login(self):
        """Test login with invalid credentials first, then with valid ones"""
        # Test invalid login first
        invalid_data = {
            "email": "invalid@example.com",
            "password": "wrongpassword"
        }
        
        self.run_test(
            "Login (Invalid Credentials)",
            "POST",
            "api/auth/login", 
            401,
            data=invalid_data
        )
        
        # If we have valid credentials from registration
        if self.token:
            print("   ℹ️  Skipping valid login test (already authenticated from registration)")
            return True
        
        return False

    def test_get_current_user(self):
        """Test get current user info"""
        if not self.token:
            print("   ⚠️  Skipping - No auth token available")
            return False
        
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "api/auth/me", 
            200
        )
        return success

    def test_medication_crud(self):
        """Test complete medication CRUD operations"""
        if not self.token:
            print("   ⚠️  Skipping - No auth token available")
            return False

        # CREATE medication
        med_data = {
            "name": "Test Medication",
            "dosage": "1 tablet",
            "frequency": "twice_daily",
            "times": ["08:00", "20:00"],
            "pill_color": "#4F46E5",
            "pill_shape": "round",
            "instructions": "Take with food",
            "refill_reminder": True,
            "total_pills": 30,
            "pills_remaining": 30
        }
        
        success, med_response = self.run_test(
            "Create Medication",
            "POST",
            "api/medications",
            200,
            data=med_data
        )
        
        if not success:
            return False
        
        medication_id = med_response.get('medication_id')
        if not medication_id:
            print("   ❌ No medication_id in response")
            return False

        # READ medications list
        success, _ = self.run_test(
            "Get Medications List",
            "GET", 
            "api/medications",
            200
        )
        
        if not success:
            return False

        # READ specific medication
        success, _ = self.run_test(
            "Get Specific Medication", 
            "GET",
            f"api/medications/{medication_id}",
            200
        )
        
        if not success:
            return False

        # UPDATE medication
        update_data = {
            "dosage": "2 tablets",
            "instructions": "Take with plenty of water"
        }
        
        success, _ = self.run_test(
            "Update Medication",
            "PUT", 
            f"api/medications/{medication_id}",
            200,
            data=update_data
        )
        
        if not success:
            return False

        # DELETE medication
        success, _ = self.run_test(
            "Delete Medication",
            "DELETE",
            f"api/medications/{medication_id}",
            200
        )
        
        return success

    def test_medication_logging(self):
        """Test medication logging functionality"""
        if not self.token:
            print("   ⚠️  Skipping - No auth token available")  
            return False

        # First create a medication to log
        med_data = {
            "name": "Logging Test Med",
            "dosage": "1 pill", 
            "frequency": "daily",
            "times": ["09:00"],
            "pill_color": "#22C55E",
            "pill_shape": "oval"
        }
        
        success, med_response = self.run_test(
            "Create Medication for Logging",
            "POST",
            "api/medications", 
            200,
            data=med_data
        )
        
        if not success:
            return False
            
        medication_id = med_response.get('medication_id')
        
        # Log medication as taken
        log_data = {
            "medication_id": medication_id,
            "scheduled_time": "09:00",
            "status": "taken",
            "notes": "Took with breakfast"
        }
        
        success, _ = self.run_test(
            "Log Medication (Taken)",
            "POST",
            "api/medications/log",
            200,
            data=log_data
        )
        
        return success

    def test_daily_schedule(self):
        """Test daily schedule endpoint"""
        if not self.token:
            print("   ⚠️  Skipping - No auth token available")
            return False
        
        today = datetime.now().strftime('%Y-%m-%d')
        success, _ = self.run_test(
            "Get Daily Schedule",
            "GET",
            f"api/schedule/{today}",
            200
        )
        return success

    def test_medication_history(self):
        """Test medication history endpoints"""
        if not self.token:
            print("   ⚠️  Skipping - No auth token available") 
            return False
        
        today = datetime.now().strftime('%Y-%m-%d')
        
        # Test date-specific history
        success1, _ = self.run_test(
            "Get History by Date",
            "GET", 
            f"api/medications/history/{today}",
            200
        )
        
        # Test general history
        success2, _ = self.run_test(
            "Get All History",
            "GET",
            "api/history",
            200
        )
        
        return success1 and success2

    def test_emergency_list(self):
        """Test emergency list endpoint"""
        if not self.token:
            print("   ⚠️  Skipping - No auth token available")
            return False
        
        success, _ = self.run_test(
            "Get Emergency List", 
            "GET",
            "api/emergency-list",
            200
        )
        return success

    def test_stats_endpoint(self):
        """Test stats endpoint"""
        if not self.token:
            print("   ⚠️  Skipping - No auth token available")
            return False
        
        success, _ = self.run_test(
            "Get User Stats",
            "GET", 
            "api/stats",
            200
        )
        return success

    def test_drug_interactions_api(self):
        """Test drug interactions API - NEW FEATURE"""
        if not self.token:
            print("   ⚠️  Skipping - No auth token available")
            return False

        # First create medications that should have interactions (Warfarin + Aspirin)
        warfarin_data = {
            "name": "Warfarin",
            "dosage": "5mg",
            "frequency": "daily",
            "times": ["08:00"],
            "pill_color": "#EF4444",
            "pill_shape": "round",
            "instructions": "Blood thinner"
        }
        
        aspirin_data = {
            "name": "Aspirin", 
            "dosage": "75mg",
            "frequency": "daily",
            "times": ["20:00"],
            "pill_color": "#FFFFFF",
            "pill_shape": "round",
            "instructions": "Heart protection"
        }
        
        # Create Warfarin
        warfarin_success, _ = self.run_test(
            "Create Warfarin (for interactions)",
            "POST",
            "api/medications",
            200,
            data=warfarin_data
        )
        
        if not warfarin_success:
            return False
        
        # Create Aspirin
        aspirin_success, _ = self.run_test(
            "Create Aspirin (for interactions)",
            "POST", 
            "api/medications",
            200,
            data=aspirin_data
        )
        
        if not aspirin_success:
            return False

        # Test drug interactions check
        success, response = self.run_test(
            "Check Drug Interactions",
            "GET",
            "api/interactions/check",
            200
        )
        
        if success:
            interactions = response.get('interactions', [])
            print(f"   📋 Found {len(interactions)} interaction(s)")
            
            # Check if HIGH severity Warfarin+Aspirin interaction is detected
            warfarin_aspirin_found = False
            for interaction in interactions:
                drug1, drug2 = interaction.get('drug1', '').lower(), interaction.get('drug2', '').lower()
                if (('warfarin' in drug1 and 'aspirin' in drug2) or 
                    ('aspirin' in drug1 and 'warfarin' in drug2)):
                    if interaction.get('severity') == 'high':
                        warfarin_aspirin_found = True
                        print(f"   ✅ Found HIGH severity Warfarin+Aspirin interaction")
                        break
            
            if not warfarin_aspirin_found:
                print(f"   ⚠️  Expected HIGH severity Warfarin+Aspirin interaction not found")
                
        return success

    def test_weekly_progress_api(self):
        """Test weekly progress API - NEW FEATURE"""
        if not self.token:
            print("   ⚠️  Skipping - No auth token available")
            return False
        
        success, response = self.run_test(
            "Get Weekly Progress",
            "GET",
            "api/progress/weekly",
            200
        )
        
        if success:
            # Validate response structure
            required_fields = ['user_name', 'period', 'summary', 'daily_breakdown', 'medications']
            for field in required_fields:
                if field not in response:
                    print(f"   ⚠️  Missing required field: {field}")
                    return False
            
            print(f"   📊 Weekly progress loaded for: {response.get('user_name')}")
            print(f"   📅 Period: {response.get('period', {}).get('start')} to {response.get('period', {}).get('end')}")
            
        return success

    def test_notifications_api(self):
        """Test notifications API - NEW FEATURE (In-app caregiver notifications)"""
        if not self.token:
            print("   ⚠️  Skipping - No auth token available")
            return False
        
        # Test get notifications
        success1, _ = self.run_test(
            "Get Notifications",
            "GET",
            "api/notifications",
            200
        )
        
        # Test get unread count  
        success2, _ = self.run_test(
            "Get Unread Notifications Count",
            "GET",
            "api/notifications/unread-count",
            200
        )
        
        # Test mark all as read
        success3, _ = self.run_test(
            "Mark All Notifications as Read",
            "PUT",
            "api/notifications/read-all",
            200
        )
        
        return success1 and success2 and success3

    def test_specific_user_login(self):
        """Test login with the specific test user mentioned in requirements"""
        login_data = {
            "email": "john.smith@test.com",
            "password": "password123"
        }
        
        success, response = self.run_test(
            "Login Test User (john.smith@test.com)",
            "POST",
            "api/auth/login",
            200,
            data=login_data
        )
        
        if success and 'access_token' in response:
            # Store this token for subsequent tests of specific user's data
            print(f"   👤 Logged in as: {response.get('user', {}).get('name', 'Unknown')}")
        
        return success

    def test_subscription_plans_api(self):
        """Test subscription plans API"""
        success, response = self.run_test(
            "Get Subscription Plans",
            "GET",
            "api/subscription/plans",
            200
        )
        
        if success:
            # Validate response structure
            plans = response.get('plans', {})
            if 'plus' not in plans:
                print("   ❌ Plus plan not found in response")
                return False
            
            plus_plan = plans['plus']
            expected_fields = ['name', 'price', 'currency', 'features', 'sms_limit']
            for field in expected_fields:
                if field not in plus_plan:
                    print(f"   ❌ Missing field in plus plan: {field}")
                    return False
            
            # Check price
            if plus_plan.get('price') != 2.99:
                print(f"   ❌ Incorrect Plus plan price: {plus_plan.get('price')} (expected 2.99)")
                return False
            
            # Check features
            expected_features = [
                "SMS reminders (50/month)",
                "Email weekly reports", 
                "Unlimited caregiver links",
                "PDF export"
            ]
            
            plan_features = plus_plan.get('features', [])
            for feature in expected_features:
                if feature not in plan_features:
                    print(f"   ❌ Missing feature in Plus plan: {feature}")
                    return False
            
            print(f"   ✅ Plus plan validated: ${plus_plan['price']}/month with {len(plan_features)} features")
            
            # Check if Stripe publishable key is present
            if 'stripe_publishable_key' not in response:
                print("   ⚠️  Stripe publishable key not in response")
        
        return success

    def test_subscription_status_api(self):
        """Test subscription status API"""
        if not self.token:
            print("   ⚠️  Skipping - No auth token available")
            return False
        
        success, response = self.run_test(
            "Get Subscription Status",
            "GET",
            "api/subscription/status",
            200
        )
        
        if success:
            # Validate response structure
            required_fields = ['is_subscribed', 'sms_remaining']
            for field in required_fields:
                if field not in response:
                    print(f"   ❌ Missing field in subscription status: {field}")
                    return False
            
            is_subscribed = response.get('is_subscribed', False)
            print(f"   📋 User subscription status: {'Active' if is_subscribed else 'Free'}")
            
            if is_subscribed:
                print(f"   📱 SMS remaining: {response.get('sms_remaining', 0)}")
                print(f"   📅 Plan: {response.get('plan_name', 'Unknown')}")
        
        return success

    def test_subscription_checkout_api(self):
        """Test subscription checkout API"""
        if not self.token:
            print("   ⚠️  Skipping - No auth token available")
            return False
        
        checkout_data = {
            "plan_id": "plus",
            "origin_url": "https://example.com"
        }
        
        success, response = self.run_test(
            "Create Subscription Checkout",
            "POST",
            "api/subscription/checkout",
            200,
            data=checkout_data
        )
        
        if success:
            # Validate response has checkout URL and session ID
            required_fields = ['checkout_url', 'session_id']
            for field in required_fields:
                if field not in response:
                    print(f"   ❌ Missing field in checkout response: {field}")
                    return False
            
            checkout_url = response.get('checkout_url', '')
            session_id = response.get('session_id', '')
            
            # Validate Stripe checkout URL format
            if not checkout_url.startswith('https://checkout.stripe.com'):
                print(f"   ❌ Invalid checkout URL format: {checkout_url}")
                return False
            
            print(f"   ✅ Stripe checkout session created: {session_id}")
            print(f"   🔗 Checkout URL: {checkout_url[:50]}...")
        
        return success

    def test_pdf_export_api(self):
        """Test PDF export API (Premium feature)"""
        if not self.token:
            print("   ⚠️  Skipping - No auth token available")
            return False
        
        # This should fail for free users
        success, response = self.run_test(
            "PDF Export (Should fail for free users)",
            "GET",
            "api/export/pdf",
            403  # Expecting forbidden for non-subscribers
        )
        
        if success:
            print("   ✅ PDF export correctly requires subscription")
        else:
            print("   ⚠️  PDF export test had unexpected result")
        
        return success

    def test_sms_reminder_api(self):
        """Test SMS reminder API (Premium feature - mocked)"""
        if not self.token:
            print("   ⚠️  Skipping - No auth token available")
            return False
        
        # First create a test medication
        med_data = {
            "name": "SMS Test Med",
            "dosage": "1 tablet", 
            "frequency": "daily",
            "times": ["10:00"],
            "pill_color": "#4F46E5",
            "pill_shape": "round"
        }
        
        med_success, med_response = self.run_test(
            "Create Medication for SMS Test",
            "POST",
            "api/medications",
            200,
            data=med_data
        )
        
        if not med_success:
            return False
        
        medication_id = med_response.get('medication_id')
        
        # Try to send SMS (should fail for free users)
        sms_data = {
            "medication_id": medication_id,
            "phone_number": "+1234567890"
        }
        
        success, response = self.run_test(
            "Send SMS Reminder (Should fail for free users)",
            "POST",
            f"api/sms/send-reminder?medication_id={medication_id}&phone_number=+1234567890",
            403
        )
        
        return success

    def test_email_report_api(self):
        """Test email report API (Premium feature - mocked)"""
        if not self.token:
            print("   ⚠️  Skipping - No auth token available")
            return False
        
        # Should fail for free users
        success, response = self.run_test(
            "Send Weekly Email Report (Should fail for free users)",
            "POST",
            "api/email/weekly-report",
            403
        )
        
        return success

    def test_root_endpoint(self):
        """Test root API endpoint"""
        success, _ = self.run_test(
            "Root API Endpoint",
            "GET",
            "api/",
            200
        )
        return success

def main():
    """Run all tests"""
    print("🧪 Starting Medication Reminder API Tests")
    print("="*60)
    
    tester = MedicationAPITester()
    
    # Test sequence
    test_sequence = [
        ("Health Check", tester.test_health_endpoint),
        ("Root Endpoint", tester.test_root_endpoint), 
        ("User Registration (Patient)", tester.test_user_registration),
        ("Caregiver Registration", tester.test_caregiver_registration),
        ("User Login", tester.test_user_login),
        ("Current User Info", tester.test_get_current_user),
        ("Medication CRUD", tester.test_medication_crud),
        ("Medication Logging", tester.test_medication_logging),
        ("Daily Schedule", tester.test_daily_schedule),
        ("Medication History", tester.test_medication_history),
        ("Emergency List", tester.test_emergency_list), 
        ("User Stats", tester.test_stats_endpoint),
        ("Drug Interactions API", tester.test_drug_interactions_api),
        ("Weekly Progress API", tester.test_weekly_progress_api),
        ("Notifications API", tester.test_notifications_api),
        ("Specific Test User Login", tester.test_specific_user_login),
    ]
    
    print(f"Running {len(test_sequence)} test suites...\n")
    
    for test_name, test_func in test_sequence:
        print(f"\n📋 Running: {test_name}")
        print("-" * 40)
        try:
            test_func()
        except Exception as e:
            print(f"   💥 Test suite failed with exception: {e}")
            tester.log_result(test_name, False, f"Exception: {e}")
    
    # Print summary
    print("\n" + "="*60)
    print("📊 TEST SUMMARY")
    print("="*60)
    print(f"Tests Run: {tester.tests_run}")
    print(f"Tests Passed: {tester.tests_passed}")
    print(f"Tests Failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success Rate: {(tester.tests_passed/tester.tests_run*100):.1f}%" if tester.tests_run > 0 else "0.0%")
    
    # Print failed tests
    failed_tests = [r for r in tester.test_results if r['status'] == 'FAIL']
    if failed_tests:
        print(f"\n❌ FAILED TESTS ({len(failed_tests)}):")
        for test in failed_tests:
            print(f"   • {test['test_name']}: {test['details']}")
    
    # Return appropriate exit code
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())