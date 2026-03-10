# orchestrator_api_final_corrected.py - WITH CORRECT COLUMN NAMES
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import sys
import pandas as pd
import numpy as np
import joblib
import mysql.connector
from typing import Dict, Any, List
from datetime import datetime, timedelta
import logging
import re
from scipy.sparse import hstack, csr_matrix

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Setup paths ---
base_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(base_dir, ".."))
sys.path.append(project_root)

# --- Database Configuration ---
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': '',
    'database': 'manpower_db',
    'port': 3306,
    'autocommit': True
}

# =============================================================================
# LOAD YOUR TRAINED ML MODELS FROM .joblib FILES
# =============================================================================

print("\n" + "="*70)
print("🧠 LOADING YOUR TRAINED ML MODELS")
print("="*70)

# 1. Load Eligibility Model
print("\n📊 Loading Eligibility Model...")
try:
    eligibility_path = os.path.join(project_root, "loan-eligibility-predictor", "models", "loan_eligibility_model.joblib")
    eligibility_data = joblib.load(eligibility_path)
    ELIGIBILITY_MODEL = eligibility_data['model']
    ELIGIBILITY_SCALER = eligibility_data['scaler']
    ELIGIBILITY_FEATURES = eligibility_data.get('feature_names', [
        'membership_months', 'is_active', 'contribution_count', 
        'avg_contribution', 'total_contributed', 'completion_rate',
        'loan_count', 'avg_loan_amount', 'repayment_rate', 'avg_outstanding'
    ])
    print(f"✅ Eligibility Model loaded: {type(ELIGIBILITY_MODEL).__name__}")
    print(f"   Features: {len(ELIGIBILITY_FEATURES)}")
except Exception as e:
    print(f"❌ Eligibility Model failed: {e}")
    ELIGIBILITY_MODEL = None
    ELIGIBILITY_SCALER = None
    ELIGIBILITY_FEATURES = []

# 2. Load Risk Model
print("\n📊 Loading Risk Model...")
try:
    risk_path = os.path.join(project_root, "loan-risk-predictor", "models", "risk_predictor.joblib")
    risk_data = joblib.load(risk_path)
    RISK_MODEL = risk_data['model']
    RISK_SCALER = risk_data['scaler']
    RISK_FEATURES = risk_data.get('feature_columns', [
        'membership_months', 'is_active', 'loan_count', 'avg_loan_amount', 
        'max_loan_amount', 'avg_interest_rate', 'avg_outstanding', 
        'repayment_rate', 'has_loan_history', 'loan_to_capacity_ratio'
    ])
    print(f"✅ Risk Model loaded: {type(RISK_MODEL).__name__}")
    print(f"   Features: {len(RISK_FEATURES)}")
except Exception as e:
    print(f"❌ Risk Model failed: {e}")
    RISK_MODEL = None
    RISK_SCALER = None
    RISK_FEATURES = []

# 3. Load Sentiment Model
print("\n📊 Loading Sentiment Model...")
try:
    sentiment_path = os.path.join(project_root, "sentiment-analyzer", "models", "sentiment_analyzer.joblib")
    sentiment_data = joblib.load(sentiment_path)
    SENTIMENT_MODEL = sentiment_data['model']
    SENTIMENT_VECTORIZER = sentiment_data['vectorizer']
    SENTIMENT_SIA = sentiment_data.get('sia')
    SENTIMENT_CHANNELS = sentiment_data.get('channel_names', ['Email', 'Meeting', 'Mobile App', 'SMS', 'WhatsApp'])
    print(f"✅ Sentiment Model loaded: {type(SENTIMENT_MODEL).__name__}")
    print(f"   Vectorizer features: {len(SENTIMENT_VECTORIZER.get_feature_names_out())}")
except Exception as e:
    print(f"❌ Sentiment Model failed: {e}")
    SENTIMENT_MODEL = None
    SENTIMENT_VECTORIZER = None
    SENTIMENT_CHANNELS = []

# Check all models loaded
ML_MODELS_READY = all([ELIGIBILITY_MODEL, RISK_MODEL, SENTIMENT_MODEL])
if ML_MODELS_READY:
    print("\n🎯 ALL MODELS LOADED SUCCESSFULLY!")
else:
    print(f"\n⚠️  Some models failed to load. Will use fallback rules.")
    print(f"   Eligibility: {'✅' if ELIGIBILITY_MODEL else '❌'}")
    print(f"   Risk: {'✅' if RISK_MODEL else '❌'}")
    print(f"   Sentiment: {'✅' if SENTIMENT_MODEL else '❌'}")

print("="*70)

# =============================================================================
# DATABASE FETCHER - WITH CORRECT COLUMN NAMES (SNAKE_CASE)
# =============================================================================

class DatabaseFetcher:
    def __init__(self, config=DB_CONFIG):
        self.config = config
        self.connection = None
    
    def connect(self):
        """Create single database connection"""
        try:
            if not self.connection or not self.connection.is_connected():
                self.connection = mysql.connector.connect(**self.config)
            return self.connection
        except Exception as e:
            logger.error(f"Database connection failed: {e}")
            return None
    
    def fetch_member_data(self, member_id: str) -> Dict:
        """Fetch all member data using CORRECT column names (snake_case)"""
        conn = self.connect()
        if not conn:
            return self._get_empty_data()
        
        try:
            cursor = conn.cursor(dictionary=True)
            
            # ✅ CORRECT: Using your actual column names (snake_case)
            cursor.execute("""
                SELECT 
                    id,
                    first_name,         -- CORRECT: snake_case
                    last_name,          -- CORRECT: snake_case  
                    email,
                    phone_number,
                    role,
                    status,
                    join_date,          -- CORRECT: snake_case
                    DATEDIFF(NOW(), join_date) as membership_days
                FROM members 
                WHERE id = %s
            """, (member_id,))
            member = cursor.fetchone()
            
            if not member:
                logger.warning(f"Member {member_id} not found in database")
                return self._get_empty_data()
            
            # ✅ DEBUG: Log what we found
            logger.info(f"🔍 Found member: {member.get('first_name')} {member.get('last_name')}")
            logger.info(f"   Join date: {member.get('join_date')}")
            logger.info(f"   Membership days: {member.get('membership_days')}")
            logger.info(f"   Status: {member.get('status')}")
            
            # Check if join_date is valid
            join_date = member.get('join_date')
            membership_days = member.get('membership_days')
            
            if not join_date or join_date == '0000-00-00' or join_date == 'NULL' or membership_days is None:
                logger.warning(f"⚠️ Invalid join date for member {member_id}: {join_date}")
                # Set default to 6 months ago
                member['membership_days'] = 180
                member['membership_months'] = 6.0
                logger.info(f"   Using default: 6 months (180 days)")
            else:
                # Calculate months
                membership_days = membership_days or 0
                if membership_days < 0:
                    logger.warning(f"⚠️ Negative membership days: {membership_days}")
                    membership_days = 180  # Default to 6 months
                
                member['membership_months'] = membership_days / 30.44
                logger.info(f"   Calculated months: {member['membership_months']:.1f}")
            
            # Get contributions
            cursor.execute("""
                SELECT 
                    COUNT(*) as count, 
                    AVG(amount) as avg_amount, 
                    SUM(amount) as total, 
                    AVG(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completion_rate
                FROM contributions 
                WHERE member_id = %s
            """, (member_id,))
            contribs = cursor.fetchone()
            
            # Handle NULL values from contributions
            if contribs:
                contribs = {
                    'count': contribs['count'] or 0,
                    'avg_amount': contribs['avg_amount'] or 0,
                    'total': contribs['total'] or 0,
                    'completion_rate': contribs['completion_rate'] or 0.5
                }
            
            # Get loans
            cursor.execute("""
                SELECT 
                    COUNT(*) as count, 
                    AVG(amount) as avg_amount, 
                    MAX(amount) as max_amount, 
                    AVG(interest_rate) as avg_interest,
                    AVG(outstanding_balance) as avg_outstanding,
                    AVG(CASE WHEN status = 'Repaid' THEN 1 ELSE 0 END) as repayment_rate
                FROM loans 
                WHERE member_id = %s
            """, (member_id,))
            loans = cursor.fetchone()
            
            # Handle NULL values from loans - FIX FOR NoneType error
            if loans:
                loans = {
                    'count': loans['count'] or 0,
                    'avg_amount': loans['avg_amount'] or 0,
                    'max_amount': loans['max_amount'] or 0,
                    'avg_interest': loans['avg_interest'] or 0,
                    'avg_outstanding': loans['avg_outstanding'] or 0,
                    'repayment_rate': loans['repayment_rate'] or 0.5  # Default to 50% if no data
                }
            
            cursor.close()
            
            return {
                'member': member,
                'contributions': contribs if contribs else {'count': 0, 'avg_amount': 0, 'total': 0, 'completion_rate': 0.5},
                'loans': loans if loans else {'count': 0, 'avg_amount': 0, 'max_amount': 0, 'avg_interest': 0,
                                             'avg_outstanding': 0, 'repayment_rate': 0.5},
                'membership_months': member.get('membership_months', 0)
            }
            
        except Exception as e:
            logger.error(f"Error fetching data for {member_id}: {e}")
            return self._get_empty_data()
        finally:
            if conn:
                conn.close()
    
    def _get_empty_data(self):
        """Return empty data structure with correct field names"""
        return {
            'member': {
                'id': '', 
                'first_name': '', 
                'last_name': '', 
                'email': '', 
                'phone_number': '', 
                'role': 'Member', 
                'status': 'Unknown', 
                'join_date': '2023-01-01', 
                'membership_days': 180,
                'membership_months': 6.0
            },
            'contributions': {'count': 0, 'avg_amount': 0, 'total': 0, 'completion_rate': 0.5},
            'loans': {'count': 0, 'avg_amount': 0, 'max_amount': 0, 'avg_interest': 0,
                     'avg_outstanding': 0, 'repayment_rate': 0.5},
            'membership_months': 6.0  # Default to 6 months
        }

# =============================================================================
# ML PREDICTION FUNCTIONS - USING YOUR TRAINED MODELS
# =============================================================================

def predict_eligibility_with_model(member_data: Dict) -> Dict:
    """Use your trained eligibility model"""
    if not ELIGIBILITY_MODEL:
        return {'amount': 25000, 'confidence': 0.6, 'source': 'rules_fallback'}
    
    try:
        # Prepare features in EXACT same order as training
        features = []
        
        # 1. membership_months
        membership_months = member_data['membership_months']
        features.append(membership_months)
        
        # 2. is_active
        features.append(1 if member_data['member']['status'] == 'Active' else 0)
        
        # 3. contribution_count
        features.append(float(member_data['contributions']['count']))
        
        # 4. avg_contribution
        features.append(float(member_data['contributions']['avg_amount'] or 0))
        
        # 5. total_contributed
        features.append(float(member_data['contributions']['total'] or 0))
        
        # 6. completion_rate
        features.append(float(member_data['contributions']['completion_rate'] or 0.5))
        
        # 7. loan_count
        features.append(float(member_data['loans']['count']))
        
        # 8. avg_loan_amount
        features.append(float(member_data['loans']['avg_amount'] or 0))
        
        # 9. repayment_rate
        features.append(float(member_data['loans']['repayment_rate'] or 0.5))
        
        # 10. avg_outstanding
        features.append(float(member_data['loans']['avg_outstanding'] or 0))
        
        # Convert to numpy array
        X = np.array([features])
        
        # Scale and predict
        X_scaled = ELIGIBILITY_SCALER.transform(X)
        prediction = ELIGIBILITY_MODEL.predict(X_scaled)[0]
        
        # Apply realistic limits (from your training: 5,000 - 150,000)
        prediction = max(5000, min(prediction, 150000))
        
        # ✅ BOOST for very new members
        if membership_months < 3:
            prediction = max(10000, prediction)  # Minimum 10,000 for new members
            logger.info(f"✅ Boosted eligibility for new member ({membership_months:.1f} months)")
        
        # Calculate confidence based on data quality
        confidence = min(0.95, 0.7 + (membership_months / 100))
        
        return {
            'amount': float(prediction),
            'confidence': float(confidence),
            'source': 'ml_model',
            'features_used': len(features)
        }
        
    except Exception as e:
        logger.error(f"Eligibility model prediction failed: {e}")
        # Fallback to rules
        return predict_eligibility_with_rules(member_data)

def predict_eligibility_with_rules(member_data: Dict) -> Dict:
    """Rule-based fallback"""
    membership_months = member_data['membership_months']
    status = member_data['member']['status']
    total_savings = member_data['contributions']['total']
    
    # Base eligibility
    if status != 'Active':
        amount = 0
    elif membership_months < 3:
        amount = min(15000, total_savings * 0.8)  # More generous for new members
    elif membership_months < 6:
        amount = min(30000, total_savings * 1.0)
    elif membership_months < 12:
        amount = min(60000, total_savings * 1.5)
    elif membership_months < 24:
        amount = min(120000, total_savings * 2.0)
    else:
        amount = min(150000, total_savings * 2.5)
    
    # Apply loan history adjustment
    repayment_rate = member_data['loans']['repayment_rate']
    if repayment_rate > 0.8:
        amount *= 1.2
    elif repayment_rate < 0.3:
        amount *= 0.7
    
    amount = max(5000, min(amount, 150000))
    
    return {
        'amount': float(amount),
        'confidence': 0.65,
        'source': 'rules',
        'reason': f"Based on {membership_months:.0f} months membership"
    }

def predict_risk_with_model(member_data: Dict) -> Dict:
    """Use your trained risk model"""
    if not RISK_MODEL:
        return {'probability': 0.3, 'level': 'MEDIUM', 'confidence': 0.6, 'source': 'rules_fallback'}
    
    try:
        # Prepare features in EXACT same order
        features = []
        
        # 1. membership_months
        membership_months = member_data['membership_months']
        features.append(membership_months)
        
        # 2. is_active
        features.append(1 if member_data['member']['status'] == 'Active' else 0)
        
        # 3. loan_count
        features.append(float(member_data['loans']['count']))
        
        # 4. avg_loan_amount
        features.append(float(member_data['loans']['avg_amount'] or 0))
        
        # 5. max_loan_amount
        features.append(float(member_data['loans']['max_amount'] or 0))
        
        # 6. avg_interest_rate
        features.append(float(member_data['loans']['avg_interest'] or 0))
        
        # 7. avg_outstanding
        features.append(float(member_data['loans']['avg_outstanding'] or 0))
        
        # 8. repayment_rate
        features.append(float(member_data['loans']['repayment_rate'] or 0.5))
        
        # 9. has_loan_history
        features.append(1 if member_data['loans']['count'] > 0 else 0)
        
        # 10. loan_to_capacity_ratio
        avg_loan = float(member_data['loans']['avg_amount'] or 1)
        total_contrib = float(member_data['contributions']['total'] or 1)
        capacity_ratio = avg_loan / total_contrib if total_contrib > 0 else 0
        features.append(capacity_ratio)
        
        # Convert to numpy array
        X = np.array([features])
        
        # Scale and predict
        X_scaled = RISK_SCALER.transform(X)
        probability = RISK_MODEL.predict_proba(X_scaled)[0][1]
        
        # ✅ ADJUST for new members (be more optimistic)
        if membership_months < 3:
            probability = probability * 0.7  # Reduce risk for new members
            logger.info(f"✅ Adjusted risk for new member ({membership_months:.1f} months)")
        
        # Convert to risk level (using thresholds from your risk model)
        if probability < 0.15:
            level = "VERY LOW"
        elif probability < 0.30:
            level = "LOW"
        elif probability < 0.50:
            level = "MEDIUM"
        elif probability < 0.70:
            level = "HIGH"
        else:
            level = "VERY HIGH"
        
        # Get confidence from model
        confidence = max(RISK_MODEL.predict_proba(X_scaled)[0])
        
        return {
            'probability': float(probability),
            'level': level,
            'confidence': float(confidence),
            'source': 'ml_model',
            'features_used': len(features)
        }
        
    except Exception as e:
        logger.error(f"Risk model prediction failed: {e}")
        return predict_risk_with_rules(member_data)

def predict_risk_with_rules(member_data: Dict) -> Dict:
    """Rule-based risk assessment"""
    status = member_data['member']['status']
    repayment_rate = member_data['loans']['repayment_rate']
    loan_count = member_data['loans']['count']
    avg_outstanding = member_data['loans']['avg_outstanding']
    
    # Base risk score
    risk_score = 0.3  # Start with medium
    
    if status != 'Active':
        risk_score += 0.3
    
    if repayment_rate < 0.3:
        risk_score += 0.3
    elif repayment_rate > 0.8:
        risk_score -= 0.2
    
    if loan_count > 3:
        risk_score += 0.2
    
    if avg_outstanding > 10000:
        risk_score += 0.1
    
    # Clamp to 0-1
    risk_score = max(0.05, min(0.95, risk_score))
    
    # Convert to level
    if risk_score < 0.2:
        level = "VERY LOW"
    elif risk_score < 0.4:
        level = "LOW"
    elif risk_score < 0.6:
        level = "MEDIUM"
    elif risk_score < 0.8:
        level = "HIGH"
    else:
        level = "VERY HIGH"
    
    return {
        'probability': float(risk_score),
        'level': level,
        'confidence': 0.65,
        'source': 'rules'
    }

def predict_sentiment_with_model(loan_purpose: str, channel: str = 'application') -> Dict:
    """Use your trained sentiment model"""
    if not SENTIMENT_MODEL:
        return {'risk': 'MEDIUM', 'confidence': 0.5, 'source': 'rules_fallback'}
    
    try:
        # Preprocess text
        def preprocess_text(text):
            text = str(text).lower()
            text = re.sub(r'[^\w\s]', ' ', text)
            text = re.sub(r'\s+', ' ', text).strip()
            return text if text else "no content"
        
        cleaned_text = preprocess_text(loan_purpose)
        
        # Get VADER scores if available
        if SENTIMENT_SIA:
            vader_scores = SENTIMENT_SIA.polarity_scores(cleaned_text)
        else:
            vader_scores = {'compound': 0, 'pos': 0, 'neg': 0, 'neu': 1}
        
        # Create TF-IDF features
        tfidf_features = SENTIMENT_VECTORIZER.transform([cleaned_text])
        
        # Create additional features (same as training)
        additional_features = []
        
        # 1. Text length
        additional_features.append(len(cleaned_text))
        
        # 2. Word count
        additional_features.append(len(cleaned_text.split()))
        
        # 3. VADER scores
        additional_features.append(vader_scores['compound'])
        additional_features.append(vader_scores['pos'])
        additional_features.append(vader_scores['neg'])
        additional_features.append(vader_scores['neu'])
        
        # 4. Channel encoding
        if SENTIMENT_CHANNELS:
            for ch in sorted(SENTIMENT_CHANNELS):
                if str(channel).strip().lower() == str(ch).strip().lower():
                    additional_features.append(1.0)
                else:
                    additional_features.append(0.0)
        else:
            # Default channels
            default_channels = ['Email', 'Meeting', 'Mobile App', 'SMS', 'WhatsApp']
            for ch in sorted(default_channels):
                if str(channel).strip().lower() == str(ch).strip().lower():
                    additional_features.append(1.0)
                else:
                    additional_features.append(0.0)
        
        # Convert to sparse matrix and combine
        additional_sparse = csr_matrix([additional_features])
        
        # Combine features
        X = hstack([tfidf_features, additional_sparse])
        
        # Ensure correct dimensions
        if X.shape[1] > SENTIMENT_MODEL.n_features_in_:
            X = X[:, :SENTIMENT_MODEL.n_features_in_]
        elif X.shape[1] < SENTIMENT_MODEL.n_features_in_:
            padding = csr_matrix((1, SENTIMENT_MODEL.n_features_in_ - X.shape[1]))
            X = hstack([X, padding])
        
        # Predict
        prediction = SENTIMENT_MODEL.predict(X)[0]
        probabilities = SENTIMENT_MODEL.predict_proba(X)[0]
        confidence = max(probabilities)
        
        return {
            'risk': prediction,
            'confidence': float(confidence),
            'vader_score': vader_scores['compound'],
            'source': 'ml_model'
        }
        
    except Exception as e:
        logger.error(f"Sentiment model prediction failed: {e}")
        return predict_sentiment_with_rules(loan_purpose)

def predict_sentiment_with_rules(loan_purpose: str) -> Dict:
    """Rule-based sentiment analysis"""
    text_lower = loan_purpose.lower()
    
    # Low risk purposes
    low_keywords = ['business', 'investment', 'education', 'farm', 'equipment', 
                   'expansion', 'construction', 'stock', 'inventory', 'agriculture',
                   'development', 'capital', 'machine', 'vehicle']
    
    # High risk purposes  
    high_keywords = ['emergency', 'medical', 'funeral', 'debt', 'wedding', 
                    'personal', 'urgent', 'crisis', 'hospital', 'sickness',
                    'burial', 'loan repayment', 'pay debt']
    
    low_count = sum(1 for word in low_keywords if word in text_lower)
    high_count = sum(1 for word in high_keywords if word in text_lower)
    
    if low_count > high_count:
        risk = 'LOW'
        confidence = min(0.9, 0.5 + (low_count * 0.1))
    elif high_count > low_count:
        risk = 'HIGH'
        confidence = min(0.9, 0.5 + (high_count * 0.1))
    else:
        risk = 'MEDIUM'
        confidence = 0.5
    
    return {
        'risk': risk,
        'confidence': confidence,
        'source': 'rules'
    }

# =============================================================================
# INTEREST RATE CALCULATOR
# =============================================================================

def calculate_interest_rate(risk_level: str, loan_amount: float, membership_months: float, 
                           repayment_rate: float = 0.5) -> float:
    """Calculate interest rate based on risk and other factors"""
    # Base rate
    base_rate = 8.0
    
    # Risk adjustment
    risk_adjustments = {
        'VERY LOW': -3.0,
        'LOW': -1.5,
        'MEDIUM': 0.0,
        'HIGH': 2.0,
        'VERY HIGH': 4.0
    }
    
    adjustment = risk_adjustments.get(risk_level, 0.0)
    
    # Amount adjustment
    if loan_amount > 50000:
        adjustment += 1.0
    elif loan_amount < 10000:
        adjustment -= 0.5
    
    # Loyalty discount
    if membership_months > 36:
        adjustment -= 1.5
    elif membership_months > 24:
        adjustment -= 1.0
    elif membership_months > 12:
        adjustment -= 0.5
    elif membership_months > 6:
        adjustment -= 0.25  # Small discount for 6+ months
    
    # Repayment history discount
    if repayment_rate > 0.9:
        adjustment -= 1.0
    elif repayment_rate > 0.7:
        adjustment -= 0.5
    
    # Calculate final rate
    final_rate = base_rate + adjustment
    
    # Ensure reasonable bounds (5% - 18%)
    final_rate = max(5.0, min(final_rate, 18.0))
    
    return round(final_rate, 2)

# =============================================================================
# FINAL DECISION MAKER
# =============================================================================

def make_final_decision(eligibility: Dict, risk: Dict, sentiment: Dict, 
                       requested_amount: float, member_data: Dict) -> Dict:
    """Make final loan decision"""
    
    eligible_amount = eligibility['amount']
    risk_level = risk['level']
    risk_probability = risk['probability']
    sentiment_risk = sentiment['risk']
    
    # Build decision factors
    decision_factors = []
    
    # 1. Eligibility check
    if requested_amount > eligible_amount * 1.1:  # 10% buffer
        decision = "REJECT"
        reason = f"Requested amount ({requested_amount:,.0f}) exceeds eligible amount ({eligible_amount:,.0f})"
        confidence = 0.9
        decision_factors.append("Amount exceeds eligibility limit")
        
    # 2. Risk level check
    elif risk_level == "VERY HIGH" and risk_probability > 0.8:
        decision = "REJECT"
        reason = f"Very high risk level ({risk_probability:.0%} default probability)"
        confidence = risk['confidence'] * 0.9
        decision_factors.append("Very high default risk")
        
    elif risk_level == "HIGH":
        decision = "APPROVE WITH CAUTION"
        reason = f"High risk level requires monitoring"
        confidence = risk['confidence']
        decision_factors.append("High risk level")
        
    elif sentiment_risk == "HIGH" and risk_level in ["MEDIUM", "HIGH"]:
        decision = "APPROVE WITH CAUTION"
        reason = f"Concerning loan purpose combined with {risk_level.lower()} risk"
        confidence = (risk['confidence'] + sentiment['confidence']) / 2
        decision_factors.append("Concerning loan purpose")
        
    elif risk_level in ["VERY LOW", "LOW"] and requested_amount <= eligible_amount:
        decision = "APPROVE"
        reason = f"Low risk profile with sufficient eligibility"
        confidence = min(0.98, eligibility['confidence'] * risk['confidence'] * 1.1)
        decision_factors.append("Low risk profile")
        
    else:
        decision = "APPROVE"
        reason = f"Meets standard approval criteria"
        confidence = (eligibility['confidence'] + risk['confidence']) / 2
        decision_factors.append("Standard approval")
    
    # Calculate interest rate
    interest_rate = calculate_interest_rate(
        risk_level, 
        requested_amount, 
        member_data['membership_months'],
        member_data['loans']['repayment_rate']
    )
    
    return {
        'decision': decision,
        'reason': reason,
        'confidence': round(confidence, 3),
        'eligible_amount': eligible_amount,
        'risk_level': risk_level,
        'risk_probability': round(risk_probability, 3),
        'sentiment_risk': sentiment_risk,
        'interest_rate': interest_rate,
        'decision_factors': decision_factors,
        'sources': {
            'eligibility': eligibility['source'],
            'risk': risk['source'],
            'sentiment': sentiment['source']
        }
    }

# =============================================================================
# HELPER FUNCTIONS FOR SPRING BOOT RESPONSE
# =============================================================================

def generate_detailed_explanations_for_spring_boot(member_id, eligibility, risk, sentiment, decision, member_data, loan_amount):
    """Generate detailed explanations in Spring Boot expected format"""
    
    explanations = []
    
    # 1. Eligibility explanation
    eligibility_percent = (loan_amount / eligibility['amount'] * 100) if eligibility['amount'] > 0 else 0
    explanations.append({
        "category": "ELIGIBILITY",
        "decision": f"KES {eligibility['amount']:,.0f}",
        "reason": f"Loan request is {eligibility_percent:.0f}% of eligible amount",
        "key_factor": "Member savings and history",
        "impact": "High"
    })
    
    # 2. Risk explanation
    risk_impact = "Low" if risk['level'] in ["VERY LOW", "LOW"] else "Medium" if risk['level'] == "MEDIUM" else "High"
    explanations.append({
        "category": "RISK ASSESSMENT",
        "decision": risk['level'],
        "reason": f"{risk['probability']:.1%} default probability ({risk['confidence']:.1%} confidence)",
        "key_factor": "Repayment history and loan patterns",
        "impact": risk_impact
    })
    
    # 3. Sentiment explanation
    sentiment_impact = "Low" if sentiment['risk'] == "LOW" else "Medium" if sentiment['risk'] == "MEDIUM" else "High"
    explanations.append({
        "category": "LOAN PURPOSE",
        "decision": sentiment['risk'],
        "reason": f"Purpose analyzed with {sentiment['confidence']:.1%} confidence",
        "key_factor": "Loan purpose sentiment",
        "impact": sentiment_impact
    })
    
    # 4. Interest rate explanation
    membership_months = member_data['membership_months']
    explanations.append({
        "category": "INTEREST RATE",
        "decision": f"{decision['interest_rate']}%",
        "reason": f"Based on {risk['level']} risk level and {membership_months:.1f} months membership",
        "key_factor": "Risk-based pricing",
        "impact": "Standard"
    })
    
    # 5. Final decision explanation
    decision_impact = "Positive" if decision['decision'] == "APPROVE" else "Caution" if "CAUTION" in decision['decision'] else "Negative"
    explanations.append({
        "category": "FINAL DECISION",
        "decision": decision['decision'],
        "reason": decision['reason'],
        "key_factor": "Overall assessment",
        "impact": decision_impact
    })
    
    # Create summary
    summary = {
        "key_recommendation": decision['decision'],
        "primary_reason": decision['reason'],
        "interest_rate_justification": f"{decision['interest_rate']}% based on {risk['level']} risk",
        "confidence_level": "HIGH" if decision['confidence'] > 0.8 else "MEDIUM" if decision['confidence'] > 0.6 else "LOW"
    }
    
    return {
        "member_id": member_id,
        "explanations": explanations,
        "summary": summary
    }

def generate_decision_table_for_spring_boot(decision):
    """Generate decision table in Spring Boot expected format"""
    
    # Interest rate breakdown
    interest_rate_breakdown = [
        {"component": "Base Rate", "value": "8.0%", "reason": "Standard SACCO rate"},
        {"component": "Risk Adjustment", "value": f"Based on {decision['risk_level']}", "reason": "Risk-based pricing"},
        {"component": "Loyalty Discount", "value": "Applied if eligible", "reason": "Member tenure"},
        {"component": "Final Rate", "value": f"{decision['interest_rate']}%", "reason": "Total calculation"}
    ]
    
    # Eligibility factors
    eligibility_factors = [
        {"factor": "Maximum Eligibility", "status": f"KES {decision['eligible_amount']:,.0f}", "impact": "Primary limit"},
        {"factor": "Risk Level", "status": decision['risk_level'], "impact": "Affects approval and rate"},
        {"factor": "Loan Purpose", "status": decision['sentiment_risk'], "impact": "Risk assessment"}
    ]
    
    # Risk assessment
    risk_assessment = [
        {"risk_category": "Default Probability", "level": decision['risk_level'], "score": f"{decision['risk_probability']:.1%}"},
        {"risk_category": "Loan Purpose Risk", "level": decision['sentiment_risk'], "score": "From sentiment analysis"}
    ]
    
    # Recommendations
    recommendations = [
        {"action": "Loan Decision", "status": decision['decision'], "details": decision['reason']},
        {"action": "Interest Rate", "status": f"{decision['interest_rate']}%", "details": "Risk-adjusted rate"},
        {"action": "Monitoring", "status": "Required" if "CAUTION" in decision['decision'] else "Standard", "details": "Based on risk level"}
    ]
    
    return {
        "interest_rate_breakdown": interest_rate_breakdown,
        "eligibility_factors": eligibility_factors,
        "risk_assessment": risk_assessment,
        "recommendations": recommendations,
        "summary": f"Decision: {decision['decision']} at {decision['interest_rate']}% interest"
    }

# =============================================================================
# MAIN PROCESSING FUNCTION - WITH DEBUGGING AND FIX FOR NoneType ERROR
# =============================================================================

def process_loan_request(member_id: str, loan_amount: float, loan_purpose: str) -> Dict:
    """Main function to process loan request"""
    logger.info(f"🚀 Processing loan request for member {member_id}")
    
    # Fetch data
    fetcher = DatabaseFetcher()
    member_data = fetcher.fetch_member_data(member_id)
    
    # ✅ EXTENSIVE DEBUGGING - WITH FIX FOR NoneType
    logger.info(f"📊 MEMBER DATA FOR {member_id}:")
    logger.info(f"   - Membership months: {member_data['membership_months']:.1f}")
    logger.info(f"   - Status: {member_data['member']['status']}")
    logger.info(f"   - Contributions: {member_data['contributions']['count']} (Total: {member_data['contributions']['total']})")
    
    # ✅ FIXED: Safely format repayment_rate to handle None values
    repayment_rate = member_data['loans']['repayment_rate'] or 0
    logger.info(f"   - Loans: {member_data['loans']['count']} (Repayment rate: {repayment_rate:.1%})")
    
    logger.info(f"   - Join date: {member_data['member'].get('join_date', 'Not found')}")
    
    # Make predictions
    logger.info(f"🤖 Making ML predictions...")
    eligibility = predict_eligibility_with_model(member_data)
    risk = predict_risk_with_model(member_data)
    sentiment = predict_sentiment_with_model(loan_purpose)
    
    logger.info(f"📈 Prediction results:")
    logger.info(f"   - Eligibility: KES {eligibility['amount']:,.0f} ({eligibility['confidence']:.1%} confidence)")
    logger.info(f"   - Risk: {risk['level']} ({risk['probability']:.1%} probability)")
    logger.info(f"   - Sentiment: {sentiment['risk']} ({sentiment['confidence']:.1%} confidence)")
    
    # Make final decision
    decision = make_final_decision(eligibility, risk, sentiment, loan_amount, member_data)
    
    logger.info(f"🎯 Final decision: {decision['decision']} ({decision['confidence']:.1%} confidence)")
    logger.info(f"   Interest rate: {decision['interest_rate']}%")
    
    # ✅ CRITICAL: Create FLAT response that matches Spring Boot's mapping
    response = {
        # ✅ MUST HAVE: These exact field names for Spring Boot mapping
        'member_id': member_id,
        'final_recommendation': decision['decision'],
        'final_confidence': decision['confidence'],
        'decision_reasoning': decision['reason'],
        
        # ✅ ELIGIBILITY - exact field names
        'eligibility_amount': eligibility['amount'],
        'eligibility_confidence': eligibility['confidence'],
        
        # ✅ RISK - exact field names
        'loan_risk': risk['level'],
        'risk_probability': risk['probability'],
        'risk_confidence': risk['confidence'],
        
        # ✅ SENTIMENT - exact field names
        'sentiment_risk': sentiment['risk'],
        'sentiment_confidence': sentiment['confidence'],
        
        # ✅ MEMBER INFO - exact field names
        'member_status': member_data['member']['status'],
        'member_role': member_data['member']['role'],
        'membership_months': round(member_data['membership_months'], 1),
        
        # ✅ LOAN INFO - exact field names
        'loan_amount_requested': loan_amount,
        'loan_reason': loan_purpose,
        
        # ✅ SOURCE INFO
        'data_source': f"{eligibility['source']}/{risk['source']}/{sentiment['source']}",
        
        # ✅ ADDITIONAL FIELDS
        'interest_rate': decision['interest_rate'],
        
        # ✅ METADATA
        'ml_orchestrator_version': '4.0-columns-fixed',
        'processed_at': datetime.now().isoformat(),
        
        # ✅ COMPREHENSIVE EXPLANATIONS (Spring Boot expects these)
        'detailed_explanations': generate_detailed_explanations_for_spring_boot(
            member_id, eligibility, risk, sentiment, decision, member_data, loan_amount
        ),
        
        # ✅ DECISION TABLE (Spring Boot expects this)
        'decision_table': generate_decision_table_for_spring_boot(decision),
        
        # ✅ HTML TABLE
        'html_decision_table': f"<div><h3>Loan Decision</h3><p>Recommendation: {decision['decision']}</p><p>Interest Rate: {decision['interest_rate']}%</p><p>Eligibility: KES {eligibility['amount']:,.0f}</p><p>Risk Level: {risk['level']}</p></div>"
    }
    
    # Log the response structure for debugging
    logger.info(f"✅ Response prepared with {len(response)} fields")
    logger.info(f"   Key fields: final_recommendation={response.get('final_recommendation')}, loan_risk={response.get('loan_risk')}")
    logger.info(f"   Eligibility: KES {response.get('eligibility_amount'):,.0f}")
    logger.info(f"   Membership: {response.get('membership_months')} months")
    
    return response

# =============================================================================
# FLASK APP
# =============================================================================

app = Flask(__name__)
CORS(app)

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'models_loaded': {
            'eligibility': ELIGIBILITY_MODEL is not None,
            'risk': RISK_MODEL is not None,
            'sentiment': SENTIMENT_MODEL is not None
        },
        'ml_models_ready': ML_MODELS_READY,
        'database': 'configured',
        'api_version': '4.0-columns-fixed',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/v1/loan_decision', methods=['POST'])
def loan_decision():
    """Main API endpoint - HANDLES BOTH FORMATS"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # DEBUG: Log what we're receiving
        logger.info(f"📥 Received request from Spring Boot")
        logger.info(f"   Data keys: {list(data.keys())}")
        
        # ---------- EXTRACT MEMBER ID ----------
        member_id = None
        
        # Option 1: Direct memberId field (new format)
        if 'memberId' in data:
            member_id = data.get('memberId')
            logger.info(f"✅ Found memberId in root: {member_id}")
        
        # Option 2: Nested memberProfile (Spring Boot format)
        elif 'memberProfile' in data and isinstance(data['memberProfile'], dict):
            member_profile = data['memberProfile']
            member_id = member_profile.get('id') or member_profile.get('memberId')
            logger.info(f"✅ Found memberProfile with id: {member_id}")
        
        # Option 3: Check other possible fields
        if not member_id:
            for key in ['member_id', 'id', 'memberUUID', 'memberUuid']:
                if key in data:
                    member_id = data.get(key)
                    logger.info(f"✅ Found member ID in field '{key}': {member_id}")
                    break
        
        # ---------- EXTRACT LOAN AMOUNT ----------
        loan_amount = 0
        
        # Try multiple field names
        amount_fields = ['loanAmount', 'loan_amount', 'amount', 'requestedAmount']
        for field in amount_fields:
            if field in data:
                try:
                    loan_amount = float(data[field])
                    logger.info(f"✅ Found loan amount in '{field}': {loan_amount}")
                    break
                except (ValueError, TypeError):
                    continue
        
        # ---------- EXTRACT LOAN PURPOSE ----------
        loan_purpose = 'General purpose'
        
        # Try multiple field names
        purpose_fields = ['loanPurpose', 'loan_purpose', 'purpose', 'reason', 'loanReason']
        for field in purpose_fields:
            if field in data:
                loan_purpose = data[field]
                logger.info(f"✅ Found loan purpose in '{field}': {loan_purpose[:50]}...")
                break
        
        # ---------- VALIDATION ----------
        if not member_id:
            return jsonify({
                'error': 'Member ID is required',
                'received_fields': list(data.keys()),
                'suggested_format': {
                    'memberId': 'string OR',
                    'memberProfile': {'id': 'string', 'status': 'string', 'role': 'string', 'joinDate': 'string'}
                }
            }), 400
        
        if loan_amount <= 0:
            return jsonify({
                'error': 'Valid loanAmount is required',
                'received_loan_amount': data.get('loanAmount', 'Not found')
            }), 400
        
        # ---------- PROCESS REQUEST ----------
        logger.info(f"🎯 Processing loan request for member: {member_id}")
        result = process_loan_request(member_id, loan_amount, loan_purpose)
        
        # Add response metadata
        result['api_version'] = '4.0-columns-fixed'
        result['request_format_received'] = list(data.keys())
        
        return jsonify(result)
        
    except ValueError as e:
        logger.error(f"Value error: {e}")
        return jsonify({'error': f'Invalid input: {str(e)}'}), 400
    except Exception as e:
        logger.error(f"API error: {e}")
        logger.error(f"Full traceback:", exc_info=True)
        return jsonify({'error': f'Processing error: {str(e)}'}), 500

@app.route('/api/v1/test_decision', methods=['GET'])
def test_decision():
    """Test endpoint with sample data"""
    try:
        # Test with sample data
        result = process_loan_request(
            member_id='test_member_001',
            loan_amount=25000,
            loan_purpose='Business expansion and equipment purchase'
        )
        
        # Override member_id in response for test
        result['member_id'] = 'test_member_001 (Sample Data)'
        
        return jsonify({
            'test': 'successful',
            'sample_data_used': True,
            'decision': result
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/v1/test_db_connection', methods=['GET'])
def test_db_connection():
    """Test database connection"""
    try:
        fetcher = DatabaseFetcher()
        conn = fetcher.connect()
        
        if conn and conn.is_connected():
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) as member_count FROM members")
            count = cursor.fetchone()[0]
            cursor.close()
            conn.close()
            
            return jsonify({
                'status': 'connected',
                'member_count': count,
                'database': DB_CONFIG['database']
            })
        else:
            return jsonify({'status': 'failed', 'error': 'Could not connect'})
            
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)})

@app.route('/api/v1/debug/member/<member_id>', methods=['GET'])
def debug_member(member_id):
    """Debug endpoint to check member data"""
    try:
        fetcher = DatabaseFetcher()
        member_data = fetcher.fetch_member_data(member_id)
        
        return jsonify({
            'member_id': member_id,
            'member_data': member_data['member'],
            'contributions': member_data['contributions'],
            'loans': member_data['loans'],
            'membership_months': member_data['membership_months']
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("\n" + "="*70)
    print("🚀 LOAN ORCHESTRATOR API READY! - COLUMNS FIXED")
    print("="*70)
    print(f"📊 Eligibility Model: {'✅' if ELIGIBILITY_MODEL else '❌'}")
    print(f"📊 Risk Model: {'✅' if RISK_MODEL else '❌'}")
    print(f"📊 Sentiment Model: {'✅' if SENTIMENT_MODEL else '❌'}")
    print("="*70)
    print("📡 API Running on http://localhost:5000")
    print("\n📋 ENDPOINTS:")
    print("  GET  /health                    - Health check")
    print("  POST /api/v1/loan_decision      - Main loan decision endpoint")
    print("  GET  /api/v1/test_decision      - Test with sample data")
    print("  GET  /api/v1/debug/member/<id>  - Debug member data")
    print("\n🎯 KEY FIXES IN THIS VERSION:")
    print("  1. ✅ CORRECT column names (snake_case: first_name, join_date)")
    print("  2. ✅ Better handling of missing/invalid join dates")
    print("  3. ✅ More generous eligibility for new members")
    print("  4. ✅ Better risk adjustment for new members")
    print("  5. ✅ FIXED NoneType formatting error for repayment_rate")
    print("  6. ✅ Extensive debugging logs")
    print("="*70)
    
    app.run(host='0.0.0.0', port=5000, debug=True)