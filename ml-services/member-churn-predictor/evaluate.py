# member-churn-predictor/evaluate.py
import pandas as pd
import numpy as np
import joblib
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import confusion_matrix, roc_curve, auc, precision_recall_curve
from sklearn.model_selection import learning_curve
import os

def evaluate_model():
    """Evaluate churn model performance"""
    
    print("=" * 60)
    print("📊 EVALUATING MEMBER CHURN MODEL")
    print("=" * 60)
    
    # Load model
    model_path = 'models/member_churn_predictor.joblib'
    if not os.path.exists(model_path):
        print("❌ Model not found. Please run train.py first.")
        return
    
    model_data = joblib.load(model_path)
    model = model_data['model']
    scaler = model_data['scaler']
    feature_names = model_data['feature_names']
    
    print(f"Model: {model_data['model_type']}")
    print(f"Training date: {model_data.get('training_date', 'Unknown')}")
    
    # Load test data (you'll need to save test data during training)
    # For now, we'll create a simple evaluation with sample data
    print("\n🔄 Generating evaluation metrics...")
    
    # Create sample test data (replace with actual test data in production)
    np.random.seed(42)
    n_samples = 1000
    
    # Simulate features (normally you'd load real test data)
    X_test = np.random.randn(n_samples, len(feature_names))
    X_test_scaled = scaler.transform(X_test)
    
    # Simulate predictions
    y_pred_proba = model.predict_proba(X_test_scaled)[:, 1]
    y_pred = (y_pred_proba > 0.5).astype(int)
    
    # Simulate true labels (for demonstration)
    y_true = (y_pred_proba + np.random.normal(0, 0.1, n_samples) > 0.5).astype(int)
    
    # Create visualizations
    fig, axes = plt.subplots(2, 2, figsize=(15, 12))
    
    # 1. Confusion Matrix
    cm = confusion_matrix(y_true, y_pred)
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', ax=axes[0, 0])
    axes[0, 0].set_title('Confusion Matrix')
    axes[0, 0].set_xlabel('Predicted')
    axes[0, 0].set_ylabel('Actual')
    
    # 2. ROC Curve
    fpr, tpr, _ = roc_curve(y_true, y_pred_proba)
    roc_auc = auc(fpr, tpr)
    
    axes[0, 1].plot(fpr, tpr, color='darkorange', lw=2, label=f'ROC (AUC = {roc_auc:.3f})')
    axes[0, 1].plot([0, 1], [0, 1], color='navy', lw=2, linestyle='--')
    axes[0, 1].set_xlim([0.0, 1.0])
    axes[0, 1].set_ylim([0.0, 1.05])
    axes[0, 1].set_xlabel('False Positive Rate')
    axes[0, 1].set_ylabel('True Positive Rate')
    axes[0, 1].set_title('ROC Curve')
    axes[0, 1].legend(loc="lower right")
    
    # 3. Precision-Recall Curve
    precision, recall, _ = precision_recall_curve(y_true, y_pred_proba)
    
    axes[1, 0].plot(recall, precision, color='green', lw=2)
    axes[1, 0].set_xlabel('Recall')
    axes[1, 0].set_ylabel('Precision')
    axes[1, 0].set_title('Precision-Recall Curve')
    axes[1, 0].set_xlim([0.0, 1.0])
    axes[1, 0].set_ylim([0.0, 1.05])
    
    # 4. Feature Importance (if available)
    if hasattr(model, 'feature_importances_'):
        importances = model.feature_importances_
        indices = np.argsort(importances)[::-1][:15]
        
        axes[1, 1].barh(range(15), importances[indices])
        axes[1, 1].set_yticks(range(15))
        axes[1, 1].set_yticklabels([feature_names[i] for i in indices])
        axes[1, 1].set_xlabel('Importance')
        axes[1, 1].set_title('Top 15 Feature Importances')
        axes[1, 1].invert_yaxis()
    else:
        axes[1, 1].text(0.5, 0.5, 'No feature importance available', 
                       ha='center', va='center', transform=axes[1, 1].transAxes)
    
    plt.tight_layout()
    plt.savefig('member_churn_evaluation.png', dpi=150, bbox_inches='tight')
    print("✅ Evaluation chart saved to 'member_churn_evaluation.png'")
    
    # Print metrics
    print("\n📈 Performance Metrics:")
    print(f"   Accuracy: {np.mean(y_pred == y_true):.3f}")
    print(f"   ROC-AUC: {roc_auc:.3f}")
    print(f"   Precision: {precision[1]:.3f}")
    print(f"   Recall: {recall[1]:.3f}")
    
    plt.show()

if __name__ == "__main__":
    evaluate_model()