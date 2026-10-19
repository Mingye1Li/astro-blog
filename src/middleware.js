import { defineMiddleware } from 'astro:middleware';
import { publicPosts } from './lib/public-posts.js';
import { postPath } from './lib/blog.js';
export const onRequest = defineMiddleware(async (context, next) => {
  const legacy = context.url.searchParams.get('post');
  if (['/', '/blog', '/blog/'].includes(context.url.pathname) && legacy && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(legacy)) {
    try {
      const [post] = await publicPosts({id:`eq.${legacy}`,limit:'1'});
      if (post) return new Response(null, {status:302, headers:{Location:postPath(post.slug),'Cache-Control':'no-store'}});
    } catch { /* The page will display its normal service error. */ }
  }
  return next();
});
