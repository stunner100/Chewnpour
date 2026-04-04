from fastapi.testclient import TestClient

from render_api.app import app


def test_extract_api_returns_candidate_payload(monkeypatch):
    def fake_extract_candidate(*_args, **_kwargs):
        return {
            "backend": "datalab_oss",
            "kind": "pdf",
            "parser": "marker",
            "text": "Example extracted text",
            "charCount": 22,
            "pageCount": 1,
            "pages": [
                {
                    "index": 0,
                    "text": "Example extracted text",
                    "chars": 22,
                    "tableCount": 0,
                    "formulaCount": 0,
                    "source": "datalab_oss",
                }
            ],
            "warnings": [],
            "metrics": {"tableCount": 0, "formulaCount": 0, "chartCount": 0},
        }

    monkeypatch.setattr("render_api.app.extract_candidate", fake_extract_candidate)

    client = TestClient(app)
    response = client.post(
        "/extract",
        files={"file": ("sample.pdf", b"fake pdf bytes", "application/pdf")},
        data={"contentType": "application/pdf", "profile": "marker"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["backend"] == "datalab_oss"
    assert payload["parser"] == "marker"
    assert payload["pages"][0]["source"] == "datalab_oss"
