import { NextConfig } from 'next';

const config: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL
  },
  reactStrictMode: true,
  swcMinify: true,

  // ? B? qua l?i ESLint khi build production
  eslint: {
    ignoreDuringBuilds: true,
  },

  // ? B? qua l?i TypeScript khi build production
  typescript: {
    ignoreBuildErrors: true,
  },

  // ? B?n c� th? b?t/t?t hi?n th? tr?ng th�i build ? g�c tr�nh duy?t
  devIndicators: {
    buildActivity: false,
  },

  // ? C� th? th�m c?u h�nh kh�c nhu images, redirects, rewrites t?i d�y
};

export default config;
