"""
Performance monitoring utilities
"""

import time
import logging
from functools import wraps
from flask import request, g

logger = logging.getLogger(__name__)

def monitor_performance(func):
    """Decorator to monitor function performance"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            result = func(*args, **kwargs)
            execution_time = time.time() - start_time
            
            # Log slow operations
            if execution_time > 1.0:  # More than 1 second
                logger.warning(f"Slow operation: {func.__name__} took {execution_time:.2f}s")
            elif execution_time > 0.5:  # More than 500ms
                logger.info(f"Operation: {func.__name__} took {execution_time:.2f}s")
            
            return result
        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(f"Error in {func.__name__} after {execution_time:.2f}s: {e}")
            raise
    return wrapper

def monitor_request_performance():
    """Monitor request performance"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            
            # Add request info to g for logging
            g.request_start_time = start_time
            g.request_path = request.path
            g.request_method = request.method
            
            try:
                result = func(*args, **kwargs)
                execution_time = time.time() - start_time
                
                # Log request performance
                logger.info(f"Request {request.method} {request.path} completed in {execution_time:.3f}s")
                
                return result
            except Exception as e:
                execution_time = time.time() - start_time
                logger.error(f"Request {request.method} {request.path} failed after {execution_time:.3f}s: {e}")
                raise
        return wrapper
    return decorator

class PerformanceCounter:
    """Simple performance counter for tracking metrics"""
    
    def __init__(self):
        self.counts = {}
        self.times = {}
    
    def increment(self, key):
        """Increment counter"""
        self.counts[key] = self.counts.get(key, 0) + 1
    
    def add_time(self, key, time_taken):
        """Add time measurement"""
        if key not in self.times:
            self.times[key] = []
        self.times[key].append(time_taken)
    
    def get_stats(self):
        """Get performance statistics"""
        stats = {}
        
        # Counter stats
        for key, count in self.counts.items():
            stats[f"{key}_count"] = count
        
        # Time stats
        for key, times in self.times.items():
            if times:
                stats[f"{key}_avg_time"] = sum(times) / len(times)
                stats[f"{key}_max_time"] = max(times)
                stats[f"{key}_min_time"] = min(times)
                stats[f"{key}_total_time"] = sum(times)
        
        return stats

# Global performance counter
perf_counter = PerformanceCounter()
