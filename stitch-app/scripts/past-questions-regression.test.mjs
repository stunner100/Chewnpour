import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFile(path.join(root, rel), "utf8");

process.env.DATABASE_URL ||= "postgres://user:pass@localhost:5432/unused";

const {
    buildPastPaperListQuery,
    compactCourseCode,
    normalizePastPaperInput,
    practiceFileNameFor,
    isPracticablePastPaperType,
    resolvePastPaperFileType,
    toClientPastPaper,
} = await import("../server/pastPapers.js");
const {
    buildPastQuestionsQuery,
    groupPapersByCourse,
    listPaperYears,
    resolvePracticeOutcome,
} = await import("../src/lib/pastQuestions.js");

// 1. Students only ever see published papers, and filters are parameterised.
{
    const base = buildPastPaperListQuery();
    assert.match(base.text, /status = 'published'/);
    assert.deepEqual(base.values, []);

    const filtered = buildPastPaperListQuery({
        institution: "  University of Ghana ",
        courseCode: "cscd 201",
        year: "2023",
        q: "50%_off'; DROP TABLE past_papers;--",
    });
    assert.match(filtered.text, /status = 'published'/);
    assert.ok(!filtered.text.includes("DROP TABLE"), "search text never reaches SQL");
    assert.equal(filtered.values[0], "University of Ghana");
    assert.equal(filtered.values[1], "CSCD201", "course code compares without spaces");
    assert.equal(filtered.values[2], 2023);
    assert.ok(filtered.values[4].includes("50\\%\\_off"), "LIKE wildcards are escaped");

    const badYear = buildPastPaperListQuery({ year: "abc" });
    assert.ok(!/year =/.test(badYear.text), "non-numeric year is ignored");
    assert.equal(compactCourseCode(" csc  201 "), "CSC201");
}

// 2. Admin metadata validation.
{
    const now = new Date("2026-10-15T00:00:00Z");
    const meta = normalizePastPaperInput(
        { institution: " KNUST ", courseCode: "math 151", year: "2024", semester: " First  semester " },
        { now },
    );
    assert.equal(meta.institution, "KNUST");
    assert.equal(meta.courseCode, "MATH 151");
    assert.equal(meta.year, 2024);
    assert.equal(meta.semester, "First semester");
    assert.equal(meta.status, undefined, "status defaults in SQL, not from input");

    assert.throws(() => normalizePastPaperInput({ courseCode: "X", year: 2020 }, { now }), /Institution/);
    assert.throws(() => normalizePastPaperInput({ institution: "UG", year: 2020 }, { now }), /Course code/);
    assert.throws(() => normalizePastPaperInput({ institution: "UG", courseCode: "X", year: 2028 }, { now }), /Year/);
    assert.throws(() => normalizePastPaperInput({ status: "live" }, { partial: true, now }), /Status/);
    assert.deepEqual(normalizePastPaperInput({ status: "published" }, { partial: true, now }), { status: "published" });
}

// 3. PDF, DOCX, and pictures are accepted; only PDF/DOCX can be practised
//    because the study pipeline does not extract text from images.
{
    assert.equal(resolvePastPaperFileType({ fileName: "paper.PDF" }).fileType, "pdf");
    assert.equal(resolvePastPaperFileType({ fileName: "x", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }).fileType, "docx");
    assert.deepEqual(resolvePastPaperFileType({ fileName: "scan.png" }), { fileType: "png", contentType: "image/png" });
    assert.deepEqual(resolvePastPaperFileType({ fileName: "photo.JPEG" }), { fileType: "jpg", contentType: "image/jpeg" });
    assert.equal(resolvePastPaperFileType({ fileName: "photo", contentType: "image/webp" }).fileType, "webp");
    assert.equal(resolvePastPaperFileType({ fileName: "slides.pptx" }), null);
    assert.equal(resolvePastPaperFileType({ fileName: "anim.gif", contentType: "image/gif" }), null);
    assert.ok(isPracticablePastPaperType("pdf") && isPracticablePastPaperType("docx"));
    assert.ok(!isPracticablePastPaperType("png") && !isPracticablePastPaperType("jpg"));

    const migration = await read("supabase/migrations/20261015120000_past_papers.sql");
    for (const mime of ["image/png", "image/jpeg", "image/webp"]) {
        assert.ok(migration.includes(`'${mime}'`), `bucket allows ${mime}`);
    }
}

// 4. Practice copy name feeds the course title; client payload hides storage.
{
    const row = {
        id: "p1", institution: "UG", course_code: "CSCD 201", course_title: "Data Structures",
        year: 2023, semester: "First semester", level: "200", file_type: "pdf", file_size: "1024",
        storage_bucket: "past-papers", storage_path: "p1/x.pdf", status: "published",
    };
    assert.equal(practiceFileNameFor(row), "CSCD 201 - Data Structures - 2023 - First semester - past paper.pdf");
    const client = toClientPastPaper(row);
    assert.equal(client.courseCode, "CSCD 201");
    assert.equal(client.fileSize, 1024);
    assert.equal(client.canPractice, true);
    assert.equal(toClientPastPaper({ ...row, file_type: "jpg" }).canPractice, false);
    assert.ok(!("storagePath" in client) && !("status" in client), "students do not see storage or status");
    assert.equal(toClientPastPaper(row, { admin: true }).status, "published");
}

// 5. Client helpers: query string, grouping, year facet, practice outcome.
{
    assert.equal(buildPastQuestionsQuery(), "/api/past-questions");
    assert.equal(buildPastQuestionsQuery({ institution: "UG", q: "csc" }), "/api/past-questions?institution=UG&q=csc");

    const papers = [
        { id: "a", institution: "UG", courseCode: "CSC 201", courseTitle: "", year: 2021, semester: "First" },
        { id: "b", institution: "UG", courseCode: "CSC 201", courseTitle: "DS", year: 2023, semester: "First" },
        { id: "c", institution: "KNUST", courseCode: "MATH 151", year: 2023, semester: "" },
    ];
    const groups = groupPapersByCourse(papers);
    assert.deepEqual(groups.map((g) => g.courseCode), ["MATH 151", "CSC 201"]);
    assert.deepEqual(groups[1].papers.map((p) => p.id), ["b", "a"], "newest first");
    assert.equal(groups[1].courseTitle, "DS");
    assert.deepEqual(groupPapersByCourse(papers, { year: "2021" }).map((g) => g.papers.length), [1]);
    assert.deepEqual(listPaperYears(papers), [2023, 2021]);

    assert.deepEqual(resolvePracticeOutcome({ upload: { courseId: "c 1" } }), {
        kind: "ready",
        href: "/dashboard/exam?courseId=c%201&start=1",
    });
    assert.equal(resolvePracticeOutcome({ upload: { id: "u", status: "extracting" }, processing: true }).kind, "processing");
    const failed = resolvePracticeOutcome({ upload: { status: "error", errorMessage: "No text" } });
    assert.equal(failed.kind, "error");
    assert.equal(failed.message, "No text");
}

// 6. Wiring: migration, routes, admin gate, nav, and the placeholder is gone.
{
    const migration = await read("supabase/migrations/20261015120000_past_papers.sql");
    assert.match(migration, /CREATE TABLE IF NOT EXISTS "past_papers"/);
    assert.match(migration, /REVOKE ALL ON TABLE "past_papers" FROM anon, authenticated/);
    assert.match(migration, /uploads_user_past_paper_unique/);
    assert.match(migration, /'past-papers',\s*'past-papers',\s*FALSE/);

    const router = await read("api/router.js");
    assert.match(router, /pathname\.startsWith\("\/api\/past-questions\/"\)/);
    const adminHttp = await read("server/adminHttp.js");
    const gateIndex = adminHttp.indexOf("await requireAdminUser(req)");
    const pastIndex = adminHttp.indexOf("handleAdminPastPapersRequest(req, res, user)");
    assert.ok(gateIndex > 0 && pastIndex > gateIndex, "admin paper routes sit behind requireAdminUser");

    const app = await read("src/App.jsx");
    assert.ok(app.includes('<Route path="/dashboard/past-questions" element={withSuspense(<PastQuestions />)} />'));
    assert.ok(!app.includes("PastQuestionsComingSoon"));
    await assert.rejects(read("src/pages/PastQuestionsComingSoon.jsx"), "placeholder page is removed");

    for (const navFile of ["src/components/app-sidebar.jsx", "src/components/MobileBottomNav.jsx", "src/components/CommandPalette.jsx"]) {
        assert.ok((await read(navFile)).includes("/dashboard/past-questions"), `${navFile} links to past questions`);
    }
    assert.ok((await read("src/lib/admin/constants.js")).includes("'past-papers'"));
}

console.log("past-questions regression checks passed");
