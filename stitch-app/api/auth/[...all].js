import { toNodeHandler } from "better-auth/node";
import { auth } from "../../server/auth.js";

// Vercel Node serverless catch-all for Better Auth.
export default toNodeHandler(auth);
