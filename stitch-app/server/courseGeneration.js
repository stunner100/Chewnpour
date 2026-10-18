import { formatCourseTitle } from "../src/lib/courseTitle.js";

const stripExtension = (fileName = "") =>
    String(fileName || "Untitled material").replace(
        /\.(pdf|pptx|docx|mp3|m4a|mp4|wav|webm|ogg|aac|flac)$/i,
        "",
    );

export const stripCourseTitle = (fileName = "") =>
    formatCourseTitle(fileName) || stripExtension(fileName);
