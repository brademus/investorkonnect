import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

// DEBUG ENDPOINT - Check if Base44 recognizes your session
Deno.serve(async (req) => {
  let user = null;
  
  try {
    const base44 = createClientFromRequest(req);
    const isAuth = await base44.auth.isAuthenticated();
    
    if (isAuth) {
      user = await base44.auth.me();
    }
  } catch (e) {
    console.log('Auth check failed:', e.message);
  }

  return Response.json({
    ok: true,
    user: user ? { email: user.email, id: user.id } : null,
    ts: Date.now()
  }, {
    headers: { 'Content-Type': 'application/json' }
  });
});