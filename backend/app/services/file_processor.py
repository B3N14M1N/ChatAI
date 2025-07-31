import csv
from fastapi import UploadFile
from io import StringIO, BytesIO
from PyPDF2 import PdfReader
from docx import Document

async def extract_text_from_file(upload_file: UploadFile) -> str:
    """
    Extract text content from various file types.
    Supported: txt, md, csv, pdf, docx. Fallback to raw decode.
    """
    filename = upload_file.filename.lower()
    content = await upload_file.read()
    # Text and markdown
    if filename.endswith('.txt') or filename.endswith('.md'):
        return content.decode('utf-8', errors='ignore')
    # CSV files: convert to comma-separated text
    if filename.endswith('.csv'):
        decoded = content.decode('utf-8', errors='ignore')
        reader = csv.reader(StringIO(decoded))
        text = ''
        for row in reader:
            text += ', '.join(row) + '\n'
        return text
    # PDF files
    if filename.endswith('.pdf'):
        reader = PdfReader(BytesIO(content))
        text = ''
        for page in reader.pages:
            text += page.extract_text() or ''
        return text
    # Word documents
    if filename.endswith('.docx'):
        doc = Document(BytesIO(content))
        return '\n'.join(p.text for p in doc.paragraphs)
    # Fallback: raw text
    try:
        return content.decode('utf-8', errors='ignore')
    except Exception:
        return ''
