import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/",
        destination: "/doc/welcome-doc",
        permanent: false,
      },
    ];
  },
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
