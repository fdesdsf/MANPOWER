# loan-eligibility-predictor/model.py - FIXED VERSION WITH CONSERVATIVE MULTIPLIERS
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import r2_score, mean_absolute_error
import joblib
import os
from datetime import datetime

class LoanEligibilityPredictor:
    def __init__(self):
        self.model = RandomForestRegressor(
            n_estimators=150,
            random_state=42, 
            max_depth=12,
            min_samples_split=10,
            min_samples_leaf=4,
            max_features=0.7,
            bootstrap=True
        )
        self.scaler = StandardScaler()
        self.is_trained = False
        self.feature_names = [
            'membership_months', 'is_active', 'contribution_count', 
            'avg_contribution', 'total_contributed', 'completion_rate',
            'loan_count', 'avg_loan_amount', 'repayment_rate', 'avg_outstanding'
        ]
        
    def load_data(self):
        """Load data from CSV files - UPDATED PATHS"""
        print("📊 Loading data for loan eligibility prediction...")
        
        try:
            # Updated paths - files are in data/ folder
            members = pd.read_csv('../data/members_ml_training.csv')
            contributions = pd.read_csv('../data/contributions_ml_training.csv')
            loans = pd.read_csv('../data/loans_ml_training.csv')
            
            print(f"✅ Loaded: {len(members):,} members, {len(contributions):,} contributions, {len(loans):,} loans")
            return members, contributions, loans
            
        except FileNotFoundError as e:
            print(f"❌ Error loading data: {e}")
            print("💡 Make sure CSV files are in the 'data/' folder")
            # Let's check what files actually exist
            print("📁 Checking current directory structure...")
            if os.path.exists('data'):
                print("📂 Data folder exists. Files in data folder:")
                try:
                    files = os.listdir('data')
                    for file in files:
                        print(f"   - {file}")
                except:
                    print("   Could not list data folder contents")
            else:
                print("❌ Data folder does not exist")
            raise
    
    def prepare_features(self, members, contributions, loans):
        """Prepare features using ONLY available database columns"""
        print("🔄 Preparing features from database schema...")
        
        # Feature 1: Member tenure (from joinDate)
        members = members.copy()
        members['joinDate'] = pd.to_datetime(members['joinDate'])
        current_date = pd.Timestamp.now()
        members['membership_days'] = (current_date - members['joinDate']).dt.days
        members['membership_months'] = members['membership_days'] / 30
        
        # Feature 2: Member status encoded
        members['is_active'] = (members['status'] == 'Active').astype(int)
        
        # Feature 3: Contribution patterns
        contribution_features = contributions.groupby('member_id').agg({
            'amount': ['count', 'mean', 'sum'],
            'status': lambda x: (x == 'Completed').mean()  # completion rate
        }).round(2)
        
        contribution_features.columns = ['contribution_count', 'avg_contribution', 'total_contributed', 'completion_rate']
        contribution_features = contribution_features.reset_index()
        
        # Feature 4: Loan history
        loan_features = loans.groupby('member_id').agg({
            'amount': ['count', 'mean'],
            'status': lambda x: (x == 'Repaid').mean(),  # repayment rate
            'outstandingBalance': 'mean'
        }).round(2)
        
        loan_features.columns = ['loan_count', 'avg_loan_amount', 'repayment_rate', 'avg_outstanding']
        loan_features = loan_features.reset_index()
        
        # Merge all features
        features_df = members[['id', 'membership_months', 'is_active']].copy()
        features_df = features_df.merge(contribution_features, left_on='id', right_on='member_id', how='left')
        features_df = features_df.merge(loan_features, left_on='id', right_on='member_id', how='left')
        
        # Fill NaN values for members with no contributions/loans
        feature_columns = [
            'membership_months', 'is_active', 
            'contribution_count', 'avg_contribution', 'total_contributed', 'completion_rate',
            'loan_count', 'avg_loan_amount', 'repayment_rate', 'avg_outstanding'
        ]
        
        for col in feature_columns:
            if col in ['repayment_rate', 'completion_rate']:
                features_df[col] = features_df[col].fillna(0.5)  # Neutral for no history
            elif col in ['contribution_count', 'loan_count']:
                features_df[col] = features_df[col].fillna(0)
            else:
                features_df[col] = features_df[col].fillna(0)
        
        # Prepare final feature matrix
        features = features_df[feature_columns].values
        member_ids = features_df['id'].tolist()
        
        print(f"✅ Feature matrix shape: {features.shape}")
        return features, member_ids
    
    def calculate_eligibility_labels(self, members, contributions, loans):
        """Calculate REAL eligibility based on SACCO lending rules"""
        print("🎯 Calculating REAL SACCO eligibility labels...")
        
        labels = []
        
        for _, member in members.iterrows():
            member_id = member['id']
            join_date = pd.to_datetime(member['joinDate'])
            current_date = pd.Timestamp.now()
            months_member = (current_date - join_date).days / 30
            status = member['status']
            
            # 1. Get total savings (completed contributions)
            member_contribs = contributions[
                (contributions['member_id'] == member_id) &
                (contributions['transactionType'] == 'Contribution') &
                (contributions['status'] == 'Completed')
            ]
            total_savings = member_contribs['amount'].sum()
            
            # 2. Get loan repayment history
            member_loans = loans[loans['member_id'] == member_id]
            if len(member_loans) > 0:
                repaid_loans = member_loans[member_loans['status'] == 'Repaid']
                repayment_rate = len(repaid_loans) / len(member_loans)
                
                # Proven capacity from largest repaid loan
                if len(repaid_loans) > 0:
                    max_repaid = repaid_loans['amount'].max()
                    proven_capacity = max_repaid * 1.2  # 20% increase for good history
                else:
                    proven_capacity = 0
            else:
                repayment_rate = 0.5  # Neutral for no history
                proven_capacity = 0
            
            # 3. REAL SACCO ELIGIBILITY RULES (CONSERVATIVE)
            if status != 'Active':
                eligibility = 0  # Inactive members not eligible
            else:
                # Rule A: Savings-based eligibility (0.5x to 2.0x savings) - CONSERVATIVE!
                if months_member >= 36:  # 3+ years
                    savings_multiplier = 2.0
                elif months_member >= 24:  # 2-3 years
                    savings_multiplier = 1.5
                elif months_member >= 12:  # 1-2 years
                    savings_multiplier = 1.2
                elif months_member >= 6:   # 6-12 months
                    savings_multiplier = 0.8
                else:                      # 0-6 months
                    savings_multiplier = 0.5
                
                savings_based = total_savings * savings_multiplier
                
                # Rule B: Take maximum of savings-based or proven capacity
                eligibility = max(savings_based, proven_capacity)
                
                # Rule C: Apply repayment history adjustment
                # Good repayment → increase, poor repayment → decrease
                if repayment_rate > 0.8:
                    eligibility *= 1.2  # +20% for excellent repayment
                elif repayment_rate > 0.6:
                    eligibility *= 1.1  # +10% for good repayment
                elif repayment_rate < 0.3:
                    eligibility *= 0.7  # -30% for poor repayment
                elif repayment_rate < 0.5:
                    eligibility *= 0.8  # -20% for below average
            
            # 4. REAL SACCO LIMITS (5,000 - 150,000 KES) - MORE REALISTIC!
            # New members (less than 6 months) max 30,000
            if months_member < 6:
                eligibility = min(eligibility, 30000)
            
            # Apply absolute limits (MAX 150,000 not 200,000)
            eligibility = max(5000, min(150000, eligibility))
            
            # Round to nearest 1000 for realism
            eligibility = round(eligibility / 1000) * 1000
            
            labels.append(eligibility)
        
        labels_array = np.array(labels)
        
        print(f"\n💰 REAL Eligibility Statistics:")
        print(f"   Minimum: KES {labels_array.min():,.0f}")
        print(f"   Maximum: KES {labels_array.max():,.0f}")
        print(f"   Average: KES {labels_array.mean():,.0f}")
        print(f"   Median:  KES {np.median(labels_array):,.0f}")
        
        # Distribution analysis
        print(f"\n📊 Eligibility Distribution:")
        bins = [0, 20000, 50000, 100000, 150000, np.inf]
        bin_labels = ['0-20k', '20k-50k', '50k-100k', '100k-150k', '150k+']
        
        for i in range(len(bins)-1):
            count = ((labels_array >= bins[i]) & (labels_array < bins[i+1])).sum()
            percentage = count / len(labels_array) * 100
            print(f"   {bin_labels[i]}: {count} members ({percentage:.1f}%)")
        
        return labels_array
    
    def train(self, save_model=True):
        """Train the loan eligibility model"""
        print("🤖 Training Loan Eligibility Predictor...")
        
        # Load and prepare data
        members, contributions, loans = self.load_data()
        X, member_ids = self.prepare_features(members, contributions, loans)
        y = self.calculate_eligibility_labels(members, contributions, loans)
        
        print(f"📊 Feature matrix shape: {X.shape}")
        print(f"📊 Target vector shape: {y.shape}")
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Train model
        self.model.fit(X_train_scaled, y_train)
        
        # Evaluate
        y_pred_train = self.model.predict(X_train_scaled)
        y_pred_test = self.model.predict(X_test_scaled)
        
        train_r2 = r2_score(y_train, y_pred_train)
        test_r2 = r2_score(y_test, y_pred_test)
        train_mae = mean_absolute_error(y_train, y_pred_train)
        test_mae = mean_absolute_error(y_test, y_pred_test)
        
        print(f"✅ Model trained successfully!")
        print(f"📊 Training R² Score: {train_r2:.4f}")
        print(f"📊 Test R² Score: {test_r2:.4f}")
        print(f"📊 Training MAE: KES {train_mae:,.0f}")
        print(f"📊 Test MAE: KES {test_mae:,.0f}")
        
        self.is_trained = True
        
        if save_model:
            self.save_model()
        
        return train_r2, test_r2
    
    def predict(self, member_data, contributions_data, loans_data):
        """Predict loan eligibility for members"""
        if not self.is_trained:
            self.load_model()
        
        # Prepare features for prediction
        features, member_ids = self.prepare_features(member_data, contributions_data, loans_data)
        features_scaled = self.scaler.transform(features)
        
        # Predict
        eligibility_amounts = self.model.predict(features_scaled)
        
        # Apply REAL SACCO business rules (not old fake rules)
        eligibility_amounts = np.clip(eligibility_amounts, 5000, 150000)  # Updated max to 150,000
        
        # Create results
        results = []
        for i, member_id in enumerate(member_ids):
            results.append({
                'member_id': member_id,
                'eligible_amount': round(eligibility_amounts[i], 2),
                'eligible_amount_formatted': f"KES {eligibility_amounts[i]:,.0f}"
            })
        
        return results
    
    def save_model(self):
        """Save the trained model"""
        os.makedirs('models', exist_ok=True)
        joblib.dump({
            'model': self.model,
            'scaler': self.scaler,
            'feature_names': self.feature_names
        }, 'models/loan_eligibility_model.joblib')
        print("💾 Model saved to models/loan_eligibility_model.joblib")
    
    def load_model(self):
        """Load a trained model"""
        try:
            model_data = joblib.load('models/loan_eligibility_model.joblib')
            self.model = model_data['model']
            self.scaler = model_data['scaler']
            self.feature_names = model_data['feature_names']
            self.is_trained = True
            print("📂 Model loaded successfully!")
        except FileNotFoundError:
            print("❌ No saved model found. Please train the model first.")
            raise

if __name__ == "__main__":
    # Train the model when run directly
    predictor = LoanEligibilityPredictor()
    predictor.train()