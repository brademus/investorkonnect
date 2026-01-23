/**
 * Refresh All Embeddings Function
 * 
 * Batch generates embeddings for all profiles of a given role
 * Admin function - requires authentication
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
    const roleFilter = body.role; // "investor" or "agent" or undefined for all
    
    console.log('[refreshAllEmbeddings] Starting refresh for role:', roleFilter || 'all');
    
    // Get all profiles
    const allProfiles = await base44.asServiceRole.entities.Profile.filter({});
    
    // Filter by role if specified
    let profiles = allProfiles;
    if (roleFilter) {
      profiles = allProfiles.filter(p => 
        p.user_role === roleFilter || p.user_type === roleFilter || p.role === roleFilter
      );
    }
    
    console.log('[refreshAllEmbeddings] Processing', profiles.length, 'profiles');
    
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const profile of profiles) {
      try {
        const role = profile.user_role || profile.user_type || profile.role;
        if (!role || (role !== 'investor' && role !== 'agent')) {
          skipped++;
          continue;
        }
        
        const text = buildProfileText(profile, role);
        const textHash = await sha256(text);
        
        // Check if embedding exists and is current
        const existing = await base44.asServiceRole.entities.ProfileVector.filter({ 
          profile_id: profile.id 
        });
        const pv = existing[0];
        
        if (pv?.text_hash === textHash && Array.isArray(pv.embedding) && pv.embedding.length > 0) {
          skipped++;
          continue;
        }
        
        // Generate embedding
        const { model, vector } = await embedText({ text });
        
        const region = profile.target_state || profile.primary_state || null;
        const payload = {
          profile_id: profile.id,
          role,
          region,
          text_hash: textHash,
          model,
          embedding: vector,
          updated_at: new Date().toISOString(),
        };
        
        if (pv) {
          await base44.asServiceRole.entities.ProfileVector.update(pv.id, payload);
          updated++;
        } else {
          await base44.asServiceRole.entities.ProfileVector.create(payload);
          created++;
        }
        
        console.log('[refreshAllEmbeddings] Processed:', profile.id, 'Role:', role);
        
      } catch (err) {
        console.error('[refreshAllEmbeddings] Error processing profile:', profile.id, err);
        errors++;
      }
    }
    
    console.log('[refreshAllEmbeddings] Complete:', {
      created,
      updated,
      skipped,
      errors
    });
    
    return Response.json({ 
      ok: true, 
      created, 
      updated, 
      skipped,
      errors,
      total: profiles.length
    });
    
  } catch (error) {
    console.error('[refreshAllEmbeddings] Error:', error);
    return Response.json({ 
      error: error.message || 'Failed to refresh embeddings' 
    }, { status: 500 });
  }
});