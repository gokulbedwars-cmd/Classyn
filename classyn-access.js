/*
  classyn-access.js
  Tells a page whether the signed-in school owner may use Classyn right now.

  Usage (in Student.html, the teachers page, etc.):

    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="classyn-access.js"></script>
    <script>
      const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      classynAccess(sb).then((a) => {
        if (a.reason === 'signed_out' || a.reason === 'no_school') location.href = 'Register_school.html';
        else if (!a.allowed) location.href = 'Register_school.html'; // or your own paywall page
        // a.reason is 'trial' | 'paid' | 'free' when allowed; a.daysLeft is set for trials
      });
    </script>

  Important: this only controls what the SCREEN shows. Real protection has to come
  from Row Level Security on your data tables (students, teachers, etc.), because
  anyone can edit a web page in their browser.
*/
(function (global) {
  function planKey(sub) {
    const now = Date.now();
    if (!sub) return { key: 'expired' };
    if (sub.is_free && (!sub.free_until || new Date(sub.free_until) > now)) return { key: 'free' };
    if (sub.status === 'active') return { key: 'paid' };
    if (sub.status === 'trial' && new Date(sub.trial_end) > now) {
      return { key: 'trial', daysLeft: Math.ceil((new Date(sub.trial_end) - now) / 864e5) };
    }
    return { key: 'expired' };
  }

  async function classynAccess(sb) {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return { allowed: false, reason: 'signed_out' };

    const { data: school, error } = await sb.from('schools')
      .select('id, name, verified, subscriptions(*)')
      .eq('owner_id', session.user.id)
      .maybeSingle();

    if (error) return { allowed: false, reason: 'error', error: error };
    if (!school) return { allowed: false, reason: 'no_school' };

    const sub = Array.isArray(school.subscriptions) ? school.subscriptions[0] : school.subscriptions;
    const p = planKey(sub);
    return {
      allowed: p.key !== 'expired',
      reason: p.key,            // 'trial' | 'paid' | 'free' | 'expired'
      daysLeft: p.daysLeft,     // only for trials
      verified: school.verified,
      school: school
    };
  }

  global.classynAccess = classynAccess;
})(window);
