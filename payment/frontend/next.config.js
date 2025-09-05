/** @type {import('next').NextConfig} */
const nextConfig = {
  // ? B?t ch? d? nghi�m ng?t c?a React d? ph�t hi?n l?i s?m
  reactStrictMode: true,

  // ? B? qua l?i ESLint khi build production
  eslint: {
    ignoreDuringBuilds: true,
  },

  // ? B? qua l?i TypeScript khi build production (n?u c?n)
  typescript: {
    ignoreBuildErrors: true,
  },

  // ? Cho ph�p hi?n th? ?nh t? c�c domain b�n ngo�i (bao g?m backend b?n)
  images: {
    domains: [
      "decorandmore.vn",
      "storage.googleapis.com",
      "lh3.googleusercontent.com",
      "anotherdomain.com",
      "example.com",
      "via.placeholder.com",
      "source.unsplash.com",
      "i.ibb.co",
      "localhost",
      'antimatter.vn',
    ],
  },

  // ? Vi?t l?i du?ng d?n (rewrites) n?u b?n mu?n mapping route
  async rewrites() {
    return [
      {
        source: "/project-details/:slug",
        destination: "/frontend/src/modules/client/pages/Projectdetails",
      },
    ];
  },
};
const serverUrl = process.env.NEXT_PUBLIC_API_URL;

if (!serverUrl?.startsWith("http")) {
  throw new Error("NEXT_PUBLIC_SERVER_URL must start with http:// or https://");
}

// Add rewrites dynamically
nextConfig.rewrites = async () => {
  return [
    {
      source: "/uploads/:path*",
      destination: `${serverUrl}/uploads/:path*`,
    },
    {
      source: "/imageapi/:path*",
      destination: `${serverUrl}/imageapi/:path*`,
    },
  ];
};
module.exports = nextConfig;
