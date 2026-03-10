# member-churn-predictor/predict.py
import pandas as pd
import numpy as np
import joblib
from datetime import datetime
import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from features import MemberChurnFeatureEngineer

class MemberChurnPredictor:
    def __init__(self, model_path='models/member_churn_predictor.joblib'):
        """Load trained model"""
        print("🔄 Loading member churn model...")
        
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model not found at {model_path}. Please train first using train.py")
        
        model_data = joblib.load(model_path)
        self.model = model_data['model']
        self.scaler = model_data['scaler']
        self.feature_names = model_data['feature_names']
        print(f"✅ Model loaded: {model_data['model_type']}")
        print(f"   Features: {len(self.feature_names)}")
        
    def predict_member_churn(self, member_features):
        """
        Predict churn probability for a single member
        member_features: dict with keys matching feature_names
        """
        # Create feature vector in correct order
        features = []
        for feature in self.feature_names:
            features.append(member_features.get(feature, 0))
        
        # Scale and predict
        X = np.array([features])
        X_scaled = self.scaler.transform(X)
        
        probability = self.model.predict_proba(X_scaled)[0][1]
        
        # Determine risk level
        if probability < 0.3:
            risk_level = "LOW"
            recommendation = "Member is engaged - no action needed"
        elif probability < 0.6:
            risk_level = "MEDIUM"
            recommendation = "Send engagement message and monitor activity"
        else:
            risk_level = "HIGH"
            recommendation = "Immediate outreach required - possible churn risk"
        
        # Key risk factors
        risk_factors = self._get_risk_factors(member_features)
        
        return {
            'member_id': member_features.get('member_id', 'unknown'),
            'churn_probability': float(probability),
            'risk_level': risk_level,
            'risk_factors': risk_factors,
            'recommendation': recommendation,
            'model_confidence': float(max(self.model.predict_proba(X_scaled)[0]))
        }
    
    def _get_risk_factors(self, member_features):
        """Identify top risk factors"""
        factors = []
        
        if member_features.get('days_since_last_contrib', 0) > 90:
            factors.append(f"No contributions for {member_features['days_since_last_contrib']:.0f} days")
        
        if member_features.get('contrib_count_3m', 0) == 0:
            factors.append("No activity in last 3 months")
        
        if member_features.get('warning_default_history', 0) == 1:
            factors.append("Has defaulted on loans before")
        
        if member_features.get('loan_to_savings_ratio', 0) > 2:
            factors.append(f"High debt ratio: {member_features['loan_to_savings_ratio']:.1f}x savings")
        
        if member_features.get('days_since_last_communication', 0) > 60:
            factors.append(f"No communication for {member_features['days_since_last_communication']:.0f} days")
        
        if member_features.get('activity_trend', 1) < 0.5:
            factors.append("Declining contribution activity")
        
        return factors[:3]  # Top 3 factors
    
    def predict_batch(self, features_df):
        """Predict churn for multiple members"""
        results = []
        
        # Ensure features are in correct order
        X = features_df[self.feature_names].fillna(0)
        X_scaled = self.scaler.transform(X)
        
        probabilities = self.model.predict_proba(X_scaled)[:, 1]
        
        for idx, prob in enumerate(probabilities):
            member_features = features_df.iloc[idx].to_dict()
            
            if prob < 0.3:
                risk_level = "LOW"
            elif prob < 0.6:
                risk_level = "MEDIUM"
            else:
                risk_level = "HIGH"
            
            results.append({
                'member_id': member_features.get('member_id', f'member_{idx}'),
                'churn_probability': float(prob),
                'risk_level': risk_level,
                'risk_factors': self._get_risk_factors(member_features)
            })
        
        return pd.DataFrame(results)

# Example usage
if __name__ == "__main__":
    # Load predictor
    predictor = MemberChurnPredictor()
    
    # Test with sample member data
    sample_member = {
        'member_id': 'test_member_001',
        'membership_days': 500,
        'membership_months': 16.4,
        'total_contributions': 20,
        'total_saved': 50000,
        'days_since_last_contrib': 120,  # 4 months no activity
        'contrib_count_3m': 0,
        'contrib_count_6m': 2,
        'warning_no_contrib_3m': 1,
        'loan_to_savings_ratio': 0.6,
        'days_since_last_communication': 45,
        'activity_trend': 0.3,
        'warning_default_history': 0,
        'total_loans': 2,
        'repaid_loans': 1,
        'repayment_rate': 0.5
    }
    
    result = predictor.predict_member_churn(sample_member)
    
    print("\n" + "=" * 60)
    print("📊 MEMBER CHURN PREDICTION RESULT")
    print("=" * 60)
    print(f"Member ID: {result['member_id']}")
    print(f"Churn Probability: {result['churn_probability']:.1%}")
    print(f"Risk Level: {result['risk_level']}")
    print("\nRisk Factors:")
    for i, factor in enumerate(result['risk_factors'], 1):
        print(f"  {i}. {factor}")
    print(f"\nRecommendation: {result['recommendation']}")
    print(f"Model Confidence: {result['model_confidence']:.1%}")