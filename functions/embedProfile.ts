/**
 * Embed Profile Function
 * 
 * Generates and stores OpenAI embedding for a profile
 * Only re-embeds if profile text has changed (hash comparison)
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { embedText } from './lib/openaiClient.js';
import { buildProfileText } from './lib/text.js';
import { sha256 } from './lib/hash.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Parse request body
    const body = await req.json().catch(() => ({}));
    
    // Get profile ID (from request or current user)
    let profileId = body.profileId;
    if (!profileId) {
      const profiles = await base44.entities.Profile.filter({ user_id: user.id });
      profileId = profiles[0]?.id;
    }
    
    if (!profileId) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }
    
    // Load profile
    const profiles = await base44.entities.Profile.filter({ id: profileId });
    const profile = profiles[0];
    
    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }
    
    // Build text and hash
    const role = profile.user_role || profile.user_type || profile.role;
    const text = buildProfileText(profile, role);
    const textHash = await sha256(text);
    
    console.log('[embedProfile] Profile:', profileId, 'Role:', role);
    console.log('[embedProfile] Text length:', text.length, 'Hash:', textHash.substring(0, 8));
    
    // Check if embedding already exists and is up-to-date
    const existing = await base44.entities.ProfileVector.filter({ profile_id: profileId });
    const pv = existing[0] || null;
    
    if (pv?.text_hash === textHash && Array.isArray(pv.embedding) && pv.embedding.length > 0) {
      console.log('[embedProfile] Skipping - hash unchanged');
      return Response.json({ 
        ok: true, 
        skipped: true, 
        profileVectorId: pv.id,
        reason: 'Text unchanged'
      });
    }
    
    // Generate new embedding
    console.log('[embedProfile] Generating new embedding...');
    const { model, vector } = await embedText({ text });
    
    const region = profile.target_state || profile.primary_state || null;
    const payload = {
      profile_id: profileId,
      role,
      region,
      text_hash: textHash,
      model,
      embedding: vector,
      updated_at: new Date().toISOString(),
    };
    
    // Upsert ProfileVector
    if (pv) {
      console.log('[embedProfile] Updating existing vector');
      const updated = await base44.entities.ProfileVector.update(pv.id, payload);
      return Response.json({ 
        ok: true, 
        id: updated.id, 
        updated: true,
        dimensions: vector.length
      });
    } else {
      console.log('[embedProfile] Creating new vector');
      const created = await base44.entities.ProfileVector.create(payload);
      return Response.json({ 
        ok: true, 
        id: created.id, 
        created: true,
        dimensions: vector.length
      });
    }
    
  } catch (error) {
    console.error('[embedProfile] Error:', error);
    return Response.json({ 
      error: error.message || 'Failed to embed profile' 
    }, { status: 500 });
  }
});