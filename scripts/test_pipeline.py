#!/usr/bin/env python3
"""
Test script for AACA AI Pipeline
"""
import asyncio
import sys
import os
import argparse
from pathlib import Path
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.services.image_processor import image_processor
from app.services.ocr_service import ocr_service
from app.services.llm_service import llm_service


def print_section(title: str):
    print("\n" + "="*60)
    print(f" {title}")
    print("="*60)


async def test_pipeline(image_path: str, skip_llm: bool = False):
    """Test the processing pipeline"""
    
    print_section("AACA Pipeline Test")
    print(f"Image: {image_path}")
    
    if not Path(image_path).exists():
        print(f"❌ Error: File not found: {image_path}")
        return
    
    with open(image_path, 'rb') as f:
        image_bytes = f.read()
    print(f"✅ Image loaded: {len(image_bytes)} bytes")
    
    # Step 1: Image Preprocessing
    print_section("Step 1: Image Preprocessing")
    try:
        start_time = datetime.now()
        processed_image, metadata = await image_processor.preprocess(
            image_bytes,
            perspective_correction=True
        )
        elapsed = (datetime.now() - start_time).total_seconds()
        
        print(f"✅ Success ({elapsed:.2f}s)")
        print(f"  Shape: {metadata.get('final_shape')}")
    except Exception as e:
        print(f"❌ Failed: {e}")
        return
    
    # Step 2: OCR
    print_section("Step 2: OCR Text Extraction")
    try:
        start_time = datetime.now()
        ocr_result = await ocr_service.extract_text(processed_image)
        elapsed = (datetime.now() - start_time).total_seconds()
        
        print(f"✅ Success ({elapsed:.2f}s)")
        print(f"  Confidence: {ocr_result.get('average_confidence', 0):.2%}")
        print(f"  Text length: {len(ocr_result.get('text', ''))}")
        raw_text = ocr_result.get("text", "")
    except Exception as e:
        print(f"❌ Failed: {e}")
        raw_text = ""
    
    # Step 3: LLM Processing
    if not skip_llm and raw_text:
        print_section("Step 3: LLM Content Processing")
        try:
            from app.core.config import settings
            
            if not (settings.OPENAI_API_KEY or settings.GOOGLE_API_KEY):
                print("⚠️ Skipped - No LLM API key configured")
                return
            
            structured = await llm_service.structure_content(raw_text)
            print(f"✅ Success")
            print(f"  Title: {structured.get('title')}")
            print(f"  Sections: {len(structured.get('sections', []))}")
        except Exception as e:
            print(f"❌ Failed: {e}")
    
    print_section("Pipeline Complete")
    print(f"Text extracted: {len(raw_text)} characters")


def main():
    parser = argparse.ArgumentParser(description="Test AACA AI Pipeline")
    parser.add_argument("image", help="Path to test image")
    parser.add_argument("--skip-llm", action="store_true", help="Skip LLM processing")
    
    args = parser.parse_args()
    asyncio.run(test_pipeline(args.image, args.skip_llm))


if __name__ == "__main__":
    main()
