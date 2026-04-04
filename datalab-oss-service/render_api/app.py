from __future__ import annotations

import os
import shutil
import tempfile
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool

from render_api.extract_service import extract_candidate

MAX_FILE_SIZE_BYTES = int(os.getenv("DATALAB_OSS_MAX_FILE_SIZE_BYTES", str(50 * 1024 * 1024)))
DATALAB_OSS_SHARED_SECRET = str(os.getenv("DATALAB_OSS_SHARED_SECRET", "")).strip()

app = FastAPI(title="Datalab OSS Extractor", version="1.0.0")


@app.get("/health")
def health_check():
    return {
        "ok": True,
        "service": "datalab-oss-extractor",
        "markerCli": bool(shutil.which(str(os.getenv("MARKER_CLI", "marker_single")).strip() or "marker_single")),
        "chandraCli": bool(shutil.which(str(os.getenv("CHANDRA_CLI", "chandra")).strip() or "chandra")),
    }


@app.post("/extract")
async def extract_endpoint(
    file: UploadFile = File(...),
    contentType: str | None = Form(default=None),
    profile: str | None = Form(default=None),
    maxPages: int | None = Form(default=None),
    x_datalab_oss_shared_secret: str | None = Header(default=None, alias="x-datalab-oss-shared-secret"),
):
    if DATALAB_OSS_SHARED_SECRET and x_datalab_oss_shared_secret != DATALAB_OSS_SHARED_SECRET:
        raise HTTPException(status_code=401, detail="Invalid shared secret.")

    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing file name.")

    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(payload) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds configured size limit.")

    suffix = Path(file.filename).suffix or ""
    tmp_name = f"{uuid4().hex}{suffix}"
    tmp_path = Path(tempfile.gettempdir()) / tmp_name
    tmp_path.write_bytes(payload)

    detected_content_type = contentType or file.content_type

    try:
        candidate = await run_in_threadpool(
            extract_candidate,
            tmp_path,
            file.filename,
            detected_content_type,
            profile,
            maxPages,
        )
        if not str(candidate.get("text", "")).strip():
            raise HTTPException(status_code=422, detail="Could not extract readable text from this file.")
        return candidate
    except HTTPException:
        raise
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {error}") from error
    finally:
        tmp_path.unlink(missing_ok=True)
