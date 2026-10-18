import { getPool } from "./db.js";
import { compactCourseCode, listPublishedPastPapers } from "./pastPapers.js";

// Public, signed-out view of the past question library: paper details only
// (course, title, year, institution). Opening or practising a paper still
// needs a ChewnPour account. Feeds /past-questions pages and the sitemap.
const SITE_URL = "https://www.chewnpour.com";
const STATIC_PATHS = ["/", "/signup", "/past-questions", "/terms", "/privacy"];

export const courseCodeSlug = (courseCode) => compactCourseCode(courseCode).toLowerCase();

const escapeXml = (value) =>
    String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const listPublicPastPaperCourses = async () => {
    const result = await getPool().query(
        `SELECT institution, course_code,
                MAX(course_title) AS course_title,
                COUNT(*)::int AS paper_count,
                MAX(year)::int AS latest_year
         FROM past_papers
         WHERE status = 'published'
         GROUP BY institution, course_code
         ORDER BY institution ASC, course_code ASC`,
    );
    return result.rows.map((row) => ({
        institution: row.institution,
        courseCode: row.course_code,
        courseTitle: row.course_title || "",
        slug: courseCodeSlug(row.course_code),
        paperCount: Number(row.paper_count || 0),
        latestYear: Number(row.latest_year || 0),
    }));
};

export const getPublicPastPapersForCourse = async (slug) => {
    const code = compactCourseCode(slug);
    if (!/^[A-Z0-9]{2,20}$/.test(code)) return { papers: [] };
    const { papers } = await listPublishedPastPapers({ courseCode: code });
    // Public pages never link to files; drop file details.
    return {
        papers: papers.map(({ id, institution, courseCode, courseTitle, year, semester, level, canPractice }) => ({
            id, institution, courseCode, courseTitle, year, semester, level, canPractice,
        })),
    };
};

export const buildSitemapXml = (courses) => {
    const urls = [
        ...STATIC_PATHS,
        ...[...new Set(courses.map((course) => course.slug))].map((slug) => `/past-questions/${encodeURIComponent(slug)}`),
    ];
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
        .map((url) => `  <url><loc>${escapeXml(`${SITE_URL}${url === "/" ? "" : url}`)}</loc></url>`)
        .join("\n")}\n</urlset>\n`;
};

// GET /api/public/past-questions           → course index
// GET /api/public/past-questions/:slug     → papers for one course code
// GET /api/sitemap                         → sitemap.xml (rewritten from /sitemap.xml)
export const handlePublicPastPapersRequest = async (req, res) => {
    const pathname = String(req.url || "").split("?")[0].replace(/\/+$/, "");
    const method = String(req.method || "GET").toUpperCase();
    try {
        if (method !== "GET") {
            res.statusCode = 405;
            res.setHeader("Allow", "GET");
            return res.end();
        }
        if (pathname === "/api/sitemap") {
            const xml = buildSitemapXml(await listPublicPastPaperCourses());
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/xml; charset=utf-8");
            res.setHeader("Cache-Control", "public, max-age=3600");
            return res.end(xml);
        }
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "public, max-age=300");
        if (pathname === "/api/public/past-questions") {
            res.statusCode = 200;
            return res.end(JSON.stringify({ courses: await listPublicPastPaperCourses() }));
        }
        const match = /^\/api\/public\/past-questions\/([^/]+)$/.exec(pathname);
        if (match) {
            res.statusCode = 200;
            return res.end(JSON.stringify(await getPublicPastPapersForCourse(decodeURIComponent(match[1]))));
        }
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: "Not found" }));
    } catch (error) {
        console.error("[api/public]", error);
        res.statusCode = 500;
        res.setHeader("Cache-Control", "no-store");
        return res.end(JSON.stringify({ error: "Could not load past questions" }));
    }
};
