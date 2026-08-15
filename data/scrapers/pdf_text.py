"""Extração de texto PDF com Poppler e fallback portátil em pdfplumber."""

from __future__ import annotations

import shutil
import subprocess


def extract_pdf_text(pdf_path: str, *, layout: bool = False) -> str:
    pdftotext = shutil.which("pdftotext")
    if pdftotext:
        command = [pdftotext]
        if layout:
            command.append("-layout")
        command.extend(["-enc", "UTF-8", pdf_path, "-"])
        result = subprocess.run(
            command,
            capture_output=True,
            encoding="utf-8",
            errors="replace",
            check=True,
        )
        return result.stdout

    try:
        import pdfplumber
    except ImportError as error:
        raise RuntimeError(
            "Instale Poppler (pdftotext) ou o pacote Python pdfplumber."
        ) from error

    pages: list[str] = []
    with pdfplumber.open(pdf_path) as document:
        for page in document.pages:
            pages.append(page.extract_text(layout=layout) or "")
    return "\n\f\n".join(pages)
