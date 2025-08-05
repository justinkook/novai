import createMDX from '@next/mdx';
import type { NextConfig } from 'next';

const withMDX = createMDX({
  options: {
    remarkPlugins: [require('remark-gfm')],
    rehypePlugins: [require('rehype-highlight')],
  },
});

const nextConfig: NextConfig = {
  transpilePackages: ['@workspace/ui', '@workspace/engine', '@workspace/prompts', '@workspace/rulesets'],
  pageExtensions: ['js', 'jsx', 'mdx', 'ts', 'tsx'],
  experimental: {
    mdxRs: true,
  },
};

export default withMDX(nextConfig);
