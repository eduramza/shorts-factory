import path from "node:path";
const config = {
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  transpilePackages: [
    "@clipforge/edl",
    "@clipforge/composition",
    "@clipforge/core",
  ],
  serverExternalPackages: ["better-sqlite3"],
  outputFileTracingRoot: path.resolve("../.."),
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};
export default config;
