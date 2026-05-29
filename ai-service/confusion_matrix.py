"""
Confusion Matrix Module for SafeCity+ AI Performance Evaluation
Tracks detection accuracy and calculates precision/recall/F1 metrics
"""

import numpy as np
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass, field
from collections import defaultdict
import json
from datetime import datetime

@dataclass
class DetectionPrediction:
    """Single detection prediction"""
    class_name: str
    confidence: float
    bbox: List[float]
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())

@dataclass  
class GroundTruthLabel:
    """Ground truth label for validation"""
    class_name: str
    bbox: List[float]
    image_id: str = ""
    labeled_by: str = "auto"  # 'auto', 'admin', 'responder'
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())

class ConfusionMatrixTracker:
    """
    Tracks AI detection performance using confusion matrix
    
    For object detection, we track:
    - True Positives (TP): Correct class + IoU > 0.5
    - False Positives (FP): Wrong class or IoU < 0.5
    - False Negatives (FN): Missed ground truth objects
    - True Negatives (TN): Background correctly classified (not typically used)
    """
    
    def __init__(self, class_names: List[str], iou_threshold: float = 0.5):
        self.class_names = class_names
        self.iou_threshold = iou_threshold
        self.num_classes = len(class_names)
        
        # Confusion matrix: rows = actual, cols = predicted
        self.matrix = np.zeros((self.num_classes, self.num_classes), dtype=np.int32)
        
        # Per-class statistics
        self.tp = defaultdict(int)  # True Positives
        self.fp = defaultdict(int)  # False Positives  
        self.fn = defaultdict(int)  # False Negatives
        
        # History for analysis
        self.detection_history: List[Dict] = []
        self.max_history = 1000
        
        # Performance metrics cache
        self.metrics_cache = {}
        
    def calculate_iou(self, bbox1: List[float], bbox2: List[float]) -> float:
        """Calculate Intersection over Union (IoU) between two bounding boxes"""
        x1_min, y1_min, x1_max, y1_max = bbox1
        x2_min, y2_min, x2_max, y2_max = bbox2
        
        # Calculate intersection
        x_min = max(x1_min, x2_min)
        y_min = max(y1_min, y2_min)
        x_max = min(x1_max, x2_max)
        y_max = min(y1_max, y2_max)
        
        if x_max < x_min or y_max < y_min:
            return 0.0
        
        intersection = (x_max - x_min) * (y_max - y_min)
        
        # Calculate union
        area1 = (x1_max - x1_min) * (y1_max - y1_min)
        area2 = (x2_max - x2_min) * (y2_max - y2_min)
        union = area1 + area2 - intersection
        
        if union == 0:
            return 0.0
        
        return intersection / union
    
    def match_detections_to_ground_truth(
        self, 
        predictions: List[DetectionPrediction],
        ground_truths: List[GroundTruthLabel]
    ) -> Tuple[List[Tuple], List[DetectionPrediction], List[GroundTruthLabel]]:
        """
        Match predictions to ground truth using IoU
        Returns: (matches, unmatched_predictions, unmatched_ground_truths)
        """
        matches = []  # (pred_idx, gt_idx, iou)
        used_gt = set()
        used_pred = set()
        
        # Sort predictions by confidence (highest first)
        sorted_preds = sorted(enumerate(predictions), key=lambda x: x[1].confidence, reverse=True)
        
        for pred_idx, pred in sorted_preds:
            if pred_idx in used_pred:
                continue
            
            best_iou = 0
            best_gt_idx = -1
            
            for gt_idx, gt in enumerate(ground_truths):
                if gt_idx in used_gt:
                    continue
                
                iou = self.calculate_iou(pred.bbox, gt.bbox)
                if iou > best_iou and iou >= self.iou_threshold:
                    best_iou = iou
                    best_gt_idx = gt_idx
            
            if best_gt_idx >= 0:
                matches.append((pred_idx, best_gt_idx, best_iou))
                used_gt.add(best_gt_idx)
                used_pred.add(pred_idx)
        
        unmatched_preds = [predictions[i] for i in range(len(predictions)) if i not in used_pred]
        unmatched_gts = [ground_truths[i] for i in range(len(ground_truths)) if i not in used_gt]
        
        return matches, unmatched_preds, unmatched_gts
    
    def update(
        self, 
        predictions: List[DetectionPrediction],
        ground_truths: List[GroundTruthLabel],
        image_id: str = ""
    ):
        """Update confusion matrix with new detection results"""
        matches, unmatched_preds, unmatched_gts = self.match_detections_to_ground_truth(
            predictions, ground_truths
        )
        
        # Process matches (TP or misclassification)
        for pred_idx, gt_idx, iou in matches:
            pred = predictions[pred_idx]
            gt = ground_truths[gt_idx]
            
            pred_class_idx = self.class_names.index(pred.class_name) if pred.class_name in self.class_names else -1
            gt_class_idx = self.class_names.index(gt.class_name) if gt.class_name in self.class_names else -1
            
            if pred_class_idx >= 0 and gt_class_idx >= 0:
                self.matrix[gt_class_idx][pred_class_idx] += 1
                
                if pred.class_name == gt.class_name:
                    self.tp[gt.class_name] += 1  # True Positive
                else:
                    self.fp[pred.class_name] += 1  # False Positive (wrong class)
                    self.fn[gt.class_name] += 1    # False Negative (missed this class)
        
        # Unmatched predictions are False Positives
        for pred in unmatched_preds:
            if pred.class_name in self.class_names:
                self.fp[pred.class_name] += 1
        
        # Unmatched ground truths are False Negatives
        for gt in unmatched_gts:
            if gt.class_name in self.class_names:
                self.fn[gt.class_name] += 1
        
        # Add to history
        self.detection_history.append({
            'image_id': image_id,
            'timestamp': datetime.now().isoformat(),
            'predictions': len(predictions),
            'ground_truths': len(ground_truths),
            'matches': len(matches),
            'true_positives': sum(1 for p, g, i in matches 
                                 if predictions[p].class_name == ground_truths[g].class_name)
        })
        
        # Trim history
        if len(self.detection_history) > self.max_history:
            self.detection_history = self.detection_history[-self.max_history:]
        
        # Clear metrics cache
        self.metrics_cache = {}
    
    def calculate_metrics(self, class_name: Optional[str] = None) -> Dict:
        """Calculate precision, recall, F1 for a class or all classes"""
        if class_name:
            tp = self.tp[class_name]
            fp = self.fp[class_name]
            fn = self.fn[class_name]
            
            precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
            recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
            f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
            
            return {
                'class': class_name,
                'true_positives': tp,
                'false_positives': fp,
                'false_negatives': fn,
                'precision': round(precision, 4),
                'recall': round(recall, 4),
                'f1_score': round(f1, 4),
                'total_predictions': tp + fp,
                'total_ground_truths': tp + fn
            }
        else:
            # Calculate metrics for all classes
            all_tp = sum(self.tp.values())
            all_fp = sum(self.fp.values())
            all_fn = sum(self.fn.values())
            
            micro_precision = all_tp / (all_tp + all_fp) if (all_tp + all_fp) > 0 else 0.0
            micro_recall = all_tp / (all_tp + all_fn) if (all_tp + all_fn) > 0 else 0.0
            micro_f1 = 2 * (micro_precision * micro_recall) / (micro_precision + micro_recall) if (micro_precision + micro_recall) > 0 else 0.0
            
            # Per-class metrics
            per_class = [self.calculate_metrics(c) for c in self.class_names]
            
            return {
                'overall': {
                    'true_positives': all_tp,
                    'false_positives': all_fp,
                    'false_negatives': all_fn,
                    'micro_precision': round(micro_precision, 4),
                    'micro_recall': round(micro_recall, 4),
                    'micro_f1': round(micro_f1, 4)
                },
                'per_class': per_class,
                'confusion_matrix': self.matrix.tolist(),
                'class_names': self.class_names
            }
    
    def get_confusion_matrix_visual(self) -> Dict:
        """Get confusion matrix formatted for visualization"""
        metrics = self.calculate_metrics()
        
        return {
            'matrix': self.matrix.tolist(),
            'class_names': self.class_names,
            'total_samples': int(np.sum(self.matrix)),
            'metrics': metrics['overall'],
            'per_class_metrics': metrics['per_class']
        }
    
    def reset(self):
        """Reset all statistics"""
        self.matrix = np.zeros((self.num_classes, self.num_classes), dtype=np.int32)
        self.tp = defaultdict(int)
        self.fp = defaultdict(int)
        self.fn = defaultdict(int)
        self.detection_history = []
        self.metrics_cache = {}
    
    def export_to_json(self, filepath: str):
        """Export confusion matrix data to JSON"""
        data = {
            'class_names': self.class_names,
            'iou_threshold': self.iou_threshold,
            'confusion_matrix': self.matrix.tolist(),
            'true_positives': dict(self.tp),
            'false_positives': dict(self.fp),
            'false_negatives': dict(self.fn),
            'metrics': self.calculate_metrics(),
            'history': self.detection_history[-100:],  # Last 100 entries
            'exported_at': datetime.now().isoformat()
        }
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)


class SimpleConfusionTracker:
    """
    Simplified binary confusion matrix for Alert vs No-Alert classification
    Tracks whether the AI correctly identified emergencies
    """
    
    def __init__(self):
        self.tp = 0  # Correctly identified emergency
        self.tn = 0  # Correctly identified normal scene
        self.fp = 0  # False alarm (said emergency, but wasn't)
        self.fn = 0  # Missed emergency (said normal, but was emergency)
        self.total_analyzed = 0
        self.history = []
        
    def update(self, predicted_alert: bool, actual_alert: bool, confidence: float = 0.0):
        """Update binary confusion matrix"""
        if predicted_alert and actual_alert:
            self.tp += 1
        elif not predicted_alert and not actual_alert:
            self.tn += 1
        elif predicted_alert and not actual_alert:
            self.fp += 1  # False alarm
        else:
            self.fn += 1  # Missed emergency
        
        self.total_analyzed += 1
        
        # Add to history
        self.history.append({
            'timestamp': datetime.now().isoformat(),
            'predicted': predicted_alert,
            'actual': actual_alert,
            'confidence': confidence,
            'correct': predicted_alert == actual_alert
        })
        
        # Keep only last 500 entries
        if len(self.history) > 500:
            self.history = self.history[-500:]
    
    def calculate_metrics(self) -> Dict:
        """Calculate binary classification metrics"""
        total = self.tp + self.tn + self.fp + self.fn
        
        accuracy = (self.tp + self.tn) / total if total > 0 else 0.0
        precision = self.tp / (self.tp + self.fp) if (self.tp + self.fp) > 0 else 0.0
        recall = self.tp / (self.tp + self.fn) if (self.tp + self.fn) > 0 else 0.0
        specificity = self.tn / (self.tn + self.fp) if (self.tn + self.fp) > 0 else 0.0
        f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
        
        # False alarm rate
        far = self.fp / (self.fp + self.tn) if (self.fp + self.tn) > 0 else 0.0
        
        return {
            'true_positives': self.tp,
            'true_negatives': self.tn,
            'false_positives': self.fp,
            'false_negatives': self.fn,
            'total': total,
            'accuracy': round(accuracy, 4),
            'precision': round(precision, 4),
            'recall': round(recall, 4),
            'specificity': round(specificity, 4),
            'f1_score': round(f1, 4),
            'false_alarm_rate': round(far, 4),
            'detection_rate': round(recall, 4)  # Same as recall
        }
    
    def get_recent_accuracy(self, n: int = 50) -> float:
        """Get accuracy over last n predictions"""
        if not self.history or n <= 0:
            return 0.0
        
        recent = self.history[-n:]
        correct = sum(1 for h in recent if h['correct'])
        return round(correct / len(recent), 4)
    
    def reset(self):
        """Reset all counters"""
        self.tp = self.tn = self.fp = self.fn = 0
        self.total_analyzed = 0
        self.history = []


# Global trackers for SafeCity+
# Object detection confusion matrix (multi-class)
OBJECT_CLASSES = [
    'person', 'car', 'truck', 'bus', 'motorcycle', 'bicycle',
    'fire', 'smoke', 'accident', 'weapon', 'crowd'
]

object_detection_tracker = ConfusionMatrixTracker(OBJECT_CLASSES, iou_threshold=0.5)

# Binary alert classification tracker
alert_classification_tracker = SimpleConfusionTracker()


def get_performance_report() -> Dict:
    """Get complete AI performance report"""
    return {
        'object_detection': object_detection_tracker.calculate_metrics(),
        'alert_classification': alert_classification_tracker.calculate_metrics(),
        'recent_alert_accuracy': alert_classification_tracker.get_recent_accuracy(50),
        'timestamp': datetime.now().isoformat()
    }
