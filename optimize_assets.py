#!/usr/bin/env python3
"""
Asset optimization script for better performance
Minifies CSS and JavaScript files, optimizes images
"""

import os
import re
import gzip
import shutil
from pathlib import Path

def minify_css(css_content):
    """Minify CSS by removing unnecessary whitespace and comments"""
    # Remove comments
    css_content = re.sub(r'/\*.*?\*/', '', css_content, flags=re.DOTALL)
    
    # Remove unnecessary whitespace
    css_content = re.sub(r'\s+', ' ', css_content)
    css_content = re.sub(r';\s*}', '}', css_content)
    css_content = re.sub(r'{\s*', '{', css_content)
    css_content = re.sub(r';\s*', ';', css_content)
    css_content = re.sub(r':\s*', ':', css_content)
    css_content = re.sub(r',\s*', ',', css_content)
    
    # Remove trailing semicolons before closing braces
    css_content = re.sub(r';(\s*})', r'\1', css_content)
    
    return css_content.strip()

def minify_js(js_content):
    """Basic JavaScript minification"""
    # Remove single-line comments (but preserve URLs)
    js_content = re.sub(r'//(?!.*http).*$', '', js_content, flags=re.MULTILINE)
    
    # Remove multi-line comments
    js_content = re.sub(r'/\*.*?\*/', '', js_content, flags=re.DOTALL)
    
    # Remove unnecessary whitespace
    js_content = re.sub(r'\s+', ' ', js_content)
    js_content = re.sub(r';\s*}', '}', js_content)
    js_content = re.sub(r'{\s*', '{', js_content)
    js_content = re.sub(r';\s*', ';', js_content)
    
    return js_content.strip()

def compress_file(file_path):
    """Create gzipped version of file"""
    gz_path = f"{file_path}.gz"
    
    with open(file_path, 'rb') as f_in:
        with gzip.open(gz_path, 'wb') as f_out:
            shutil.copyfileobj(f_in, f_out)
    
    # Get file sizes
    original_size = os.path.getsize(file_path)
    compressed_size = os.path.getsize(gz_path)
    compression_ratio = (1 - compressed_size / original_size) * 100
    
    print(f"Compressed {file_path}: {original_size} -> {compressed_size} bytes ({compression_ratio:.1f}% reduction)")
    
    return gz_path

def optimize_assets():
    """Optimize all static assets"""
    static_dir = Path("static")
    
    if not static_dir.exists():
        print("Static directory not found!")
        return
    
    # Create backup directory
    backup_dir = Path("static_backup")
    if not backup_dir.exists():
        backup_dir.mkdir()
        print("Created backup directory")
    
    # Optimize CSS files
    css_files = list(static_dir.glob("**/*.css"))
    for css_file in css_files:
        print(f"Optimizing CSS: {css_file}")
        
        # Backup original
        backup_file = backup_dir / css_file.name
        shutil.copy2(css_file, backup_file)
        
        # Read and minify
        with open(css_file, 'r', encoding='utf-8') as f:
            css_content = f.read()
        
        minified_css = minify_css(css_content)
        
        # Write minified version
        with open(css_file, 'w', encoding='utf-8') as f:
            f.write(minified_css)
        
        # Create compressed version
        compress_file(str(css_file))
        
        print(f"Minified CSS: {css_file}")
    
    # Optimize JavaScript files
    js_files = list(static_dir.glob("**/*.js"))
    for js_file in js_files:
        print(f"Optimizing JS: {js_file}")
        
        # Backup original
        backup_file = backup_dir / js_file.name
        shutil.copy2(js_file, backup_file)
        
        # Read and minify
        with open(js_file, 'r', encoding='utf-8') as f:
            js_content = f.read()
        
        minified_js = minify_js(js_content)
        
        # Write minified version
        with open(js_file, 'w', encoding='utf-8') as f:
            f.write(minified_js)
        
        # Create compressed version
        compress_file(str(js_file))
        
        print(f"Minified JS: {js_file}")
    
    print("\nAsset optimization complete!")
    print(f"Original files backed up to: {backup_dir}")

if __name__ == "__main__":
    optimize_assets()
