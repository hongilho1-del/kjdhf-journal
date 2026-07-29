import type { NextConfig } from "next";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const isUserSite = repositoryName.endsWith(".github.io");
const pagesBasePath = process.env.GITHUB_ACTIONS === "true" && !isUserSite && repositoryName
  ? `/${repositoryName}`
  : "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: pagesBasePath,
  assetPrefix: pagesBasePath || undefined,
  env: { NEXT_PUBLIC_BASE_PATH: pagesBasePath },
  images: { unoptimized: true },
};

export default nextConfig;
