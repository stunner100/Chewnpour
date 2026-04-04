from render_api.extract_service import (
    default_profile_for_kind,
    detect_file_kind,
    normalize_requested_profile,
)


def test_detect_file_kind_supports_pdf_office_image_html_epub():
    assert detect_file_kind("lecture.pdf", "application/pdf") == "pdf"
    assert detect_file_kind("slides.pptx", None) == "office"
    assert detect_file_kind("handout.docx", None) == "office"
    assert detect_file_kind("scan.png", "image/png") == "image"
    assert detect_file_kind("page.html", "text/html") == "html"
    assert detect_file_kind("book.epub", None) == "epub"


def test_default_profile_is_marker():
    assert default_profile_for_kind("pdf") == "marker"
    assert default_profile_for_kind("image") == "marker"
    assert default_profile_for_kind("office") == "marker"


def test_profile_normalization_limits_chandra_to_pdf_and_images():
    assert normalize_requested_profile("pdf", "chandra") == "chandra"
    assert normalize_requested_profile("image", "marker_ocr") == "marker_ocr"
    try:
        normalize_requested_profile("office", "chandra")
    except ValueError as error:
        assert "Unsupported extraction profile" in str(error)
    else:
        raise AssertionError("Expected office/chandra profile to be rejected.")
