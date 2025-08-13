#!/usr/bin/env python3

import sys
import os
import json
from pathlib import Path

# Add the app directory to Python path
sys.path.insert(0, str(Path(__file__).parent / "app"))

from app.services.rag import BookRAG

def debug_rag():
    # First, let's check the raw JSON data
    print("=== Checking raw JSON data ===")
    data_path = Path("app/data/books.json")
    with open(data_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    for item in data:
        if 'fitzgerald' in item.get('author', '').lower():
            print(f"Found in JSON: {item.get('title')} by {item.get('author')}")
    
    # Initialize RAG
    rag = BookRAG(data_path=data_path)
    
    print(f"\nCollection count: {rag.collection.count()}")
    
    # Let's check what's actually stored
    print("\n=== Checking stored metadata ===")
    all_results = rag.collection.get()
    print(f"Total items in collection: {len(all_results.get('metadatas', []))}")
    
    # Print first few items to see the structure
    if all_results.get('metadatas'):
        print("\nFirst 3 items stored:")
        for i, md in enumerate(all_results['metadatas'][:3]):
            print(f"Item {i+1}:")
            print(f"  Title: {md.get('title')}")
            print(f"  Author: {md.get('author')} (type: {type(md.get('author'))})")
            print(f"  All keys: {list(md.keys())}")
    
    # Find books by specific authors
    print("\n=== Looking for Fitzgerald in metadata ===")
    f_scott_books = []
    for md in all_results.get('metadatas', []):
        author = md.get('author')
        if author and 'fitzgerald' in str(author).lower():
            f_scott_books.append(md)
            
    print(f"Books by Fitzgerald found in metadata: {len(f_scott_books)}")
    for book in f_scott_books:
        print(f"- {book.get('title')} by {book.get('author')}")
    
    # Test the author search now that data is properly stored
    print("\n=== Testing F. Scott Fitzgerald recommendation ===")
    
    # Let's manually test the filtering logic
    print("Debug: Testing filtering logic directly")
    all_results = rag.collection.get()
    packed_results = rag._pack_results({"metadatas": [all_results['metadatas']]})
    print(f"Total packed results: {len(packed_results)}")
    
    # Test filtering
    filtered = rag._filter_by_metadata(packed_results, None, None, ["F. Scott Fitzgerald"])
    print(f"Filtered results for F. Scott Fitzgerald: {len(filtered)}")
    for result in filtered:
        print(f"- {result.get('title')} by {result.get('author')}")
    
    # Now test the actual recommend function
    results = rag.recommend(authors=["F. Scott Fitzgerald"], limit=5)
    print(f"Recommend function results count: {len(results)}")
    for result in results:
        print(f"- {result.get('title')} by {result.get('author')}")
    
    # Test other authors too
    print("\n=== Testing J.R.R. Tolkien recommendation ===")
    results = rag.recommend(authors=["J.R.R. Tolkien"], limit=5)
    print(f"Results count: {len(results)}")
    for result in results:
        print(f"- {result.get('title')} by {result.get('author')}")
    
    # Test random search
    print("\n=== Testing random search ===")
    results = rag.recommend(limit=3, random=True)
    print(f"Random results count: {len(results)}")
    for result in results:
        print(f"- {result.get('title')} by {result.get('author')}")


if __name__ == "__main__":
    debug_rag()
