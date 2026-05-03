module.exports = {
  reactStrictMode: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    // Pages 라우터는 full-stream.js → /api/pipeline/full-stream 만 노출된다.
    // README·클라이언트 계약 경로와 맞춘다.
    return [
      { source: '/api/pipeline/full/stream', destination: '/api/pipeline/full-stream' },
    ];
  },
};
