import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { supabase } from '../config/supabase.js';
import { findUserById } from '../lib/userStore.js';

const router = Router();

interface MessageRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

async function resolveSender(user: NonNullable<AuthRequest['user']>) {
  const { data: byId, error: idError } = await supabase
    .from('users')
    .select('id, email, full_name, role, section, year_level, teaching_year_levels, teaching_sections')
    .eq('id', user.id)
    .maybeSingle();
  if (idError) throw idError;
  if (byId) return byId;

  // A stale JWT may contain an old ID while the account still exists by email.
  const { data: byEmail, error: emailError } = await supabase
    .from('users')
    .select('id, email, full_name, role, section, year_level, teaching_year_levels, teaching_sections')
    .eq('email', user.email)
    .maybeSingle();
  if (emailError) throw emailError;
  if (byEmail) return byEmail;

  const localUser = findUserById(user.id);
  if (!localUser) return null;

  const { data: syncedUser, error: syncError } = await supabase
    .from('users')
    .insert({
      id: localUser.id,
      email: localUser.email,
      full_name: localUser.full_name,
      role: localUser.role,
      xp_total: localUser.xp_total || 0,
      streak_days: localUser.streak_days || 0,
    })
    .select('id, email, full_name, role, section, year_level, teaching_year_levels, teaching_sections')
    .single();
  if (syncError && syncError.code !== '23505') throw syncError;
  return syncedUser || { id: localUser.id, email: localUser.email, full_name: localUser.full_name, role: localUser.role };
}

function isStudentAllowedToContact(student: any, instructor: any) {
  const studentSection = String(student.section || '').trim().toLowerCase();
  const studentYear = Number(student.year_level);
  const teachingSections = (Array.isArray(instructor.teaching_sections) && instructor.teaching_sections.length
    ? instructor.teaching_sections
    : [instructor.section]
  ).map((s: any) => String(s || '').trim().toLowerCase()).filter(Boolean);
  const teachingYears = Array.isArray(instructor.teaching_year_levels)
    ? instructor.teaching_year_levels.map(Number)
    : [];

  return Boolean(
    studentSection &&
    teachingSections.includes(studentSection) &&
    Number.isInteger(studentYear) &&
    teachingYears.includes(studentYear)
  );
}

// Symmetric check: works regardless of which side (student or instructor) is calling.
function canContact(a: any, b: any): boolean {
  if (a.role === 'student' && b.role === 'instructor') return isStudentAllowedToContact(a, b);
  if (a.role === 'instructor' && b.role === 'student') return isStudentAllowedToContact(b, a);
  return false;
}

/**
 * GET /api/messages/contacts
 * Returns a list of users the caller can message:
 *   - students see instructors
 *   - instructors see students
 * Each contact also includes last_message and unread_count for the current user.
 */
router.get('/contacts', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const me = req.user;
    if (!me) return res.status(401).json({ error: 'Unauthorized' });

    const sender = await resolveSender(me);
    if (!sender) return res.status(401).json({ error: 'Your account is not available in the application database. Please sign in again.' });

    const targetRole = me.role === 'instructor' ? 'student' : 'instructor';

    const { data: contacts, error: cErr } = await supabase
      .from('users')
      .select('id, email, full_name, role, avatar_url, section, year_level, teaching_year_levels, teaching_sections')
      .eq('role', targetRole);
    if (cErr) throw cErr;

    const permittedContacts = contacts.filter((contact: any) => canContact(sender, contact));

    if (permittedContacts.length === 0) return res.json([]);

    const contactIds = permittedContacts.map((c: any) => c.id);

    // Fetch messages I sent to any contact, and messages any contact sent to me.
    // Two simple queries are far more reliable than a nested .or(and(...)) filter,
    // which PostgREST mis-parses when combined with .in.(uuid1,uuid2,...).
    const [sentRes, recvRes] = await Promise.all([
      supabase
        .from('messages')
        .select('id, sender_id, recipient_id, body, read_at, created_at')
        .eq('sender_id', sender.id)
        .in('recipient_id', contactIds)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('messages')
        .select('id, sender_id, recipient_id, body, read_at, created_at')
        .eq('recipient_id', sender.id)
        .in('sender_id', contactIds)
        .order('created_at', { ascending: false })
        .limit(500),
    ]);

    if (sentRes.error) throw sentRes.error;
    if (recvRes.error) throw recvRes.error;

    const msgs: MessageRow[] = [
      ...((sentRes.data ?? []) as MessageRow[]),
      ...((recvRes.data ?? []) as MessageRow[]),
    ].sort((a, b) => b.created_at.localeCompare(a.created_at));

    const lastByContact = new Map<string, MessageRow>();
    const unreadByContact = new Map<string, number>();

    for (const m of msgs) {
      const otherId = m.sender_id === sender.id ? m.recipient_id : m.sender_id;
      if (!lastByContact.has(otherId)) lastByContact.set(otherId, m);
      if (m.recipient_id === sender.id && m.read_at == null) {
        unreadByContact.set(otherId, (unreadByContact.get(otherId) ?? 0) + 1);
      }
    }

    const enriched = permittedContacts
      .map((c: any) => ({
        id: c.id,
        email: c.email,
        full_name: c.full_name,
        role: c.role,
        avatar_url: c.avatar_url ?? null,
        last_message: lastByContact.get(c.id) ?? null,
        unread_count: unreadByContact.get(c.id) ?? 0,
      }))
      .sort((a: any, b: any) => {
        const at = a.last_message?.created_at ?? '';
        const bt = b.last_message?.created_at ?? '';
        return bt.localeCompare(at);
      });

    res.json(enriched);
  } catch (err: any) {
    console.error('Error loading contacts:', err);
    res.status(500).json({ error: err?.message || 'Failed to load contacts' });
  }
});

/**
 * GET /api/messages/thread/:userId
 * Full conversation between current user and :userId, oldest first.
 */
router.get('/thread/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const me = req.user;
    if (!me) return res.status(401).json({ error: 'Unauthorized' });
    const otherId = req.params.userId;
    const sender = await resolveSender(me);
    if (!sender) return res.status(401).json({ error: 'Your account is not available in the application database. Please sign in again.' });
    if (!otherId || otherId === sender.id) {
      return res.status(400).json({ error: 'Invalid recipient' });
    }

    const { data: threadRecipient, error: threadRecipientError } = await supabase
      .from('users')
      .select('id, role, section, year_level, teaching_year_levels, teaching_sections')
      .eq('id', otherId)
      .maybeSingle();
    if (threadRecipientError) throw threadRecipientError;
    if (!threadRecipient) return res.status(404).json({ error: 'Recipient not found' });
    if (!canContact(sender, threadRecipient)) {
      return res.status(403).json({ error: 'You can only message the students/instructors in your own section and year level.' });
    }

    // Two simple queries are more reliable than nested .or(and(...)) filters.
    const [aRes, bRes] = await Promise.all([
      supabase
        .from('messages')
        .select('id, sender_id, recipient_id, body, read_at, created_at')
        .eq('sender_id', sender.id)
        .eq('recipient_id', otherId)
        .order('created_at', { ascending: true })
        .limit(500),
      supabase
        .from('messages')
        .select('id, sender_id, recipient_id, body, read_at, created_at')
        .eq('sender_id', otherId)
        .eq('recipient_id', sender.id)
        .order('created_at', { ascending: true })
        .limit(500),
    ]);
    if (aRes.error) throw aRes.error;
    if (bRes.error) throw bRes.error;

    const data = [...(aRes.data ?? []), ...(bRes.data ?? [])].sort((a, b) =>
      a.created_at.localeCompare(b.created_at)
    );

    res.json(data);
  } catch (err: any) {
    console.error('Error loading thread:', err);
    res.status(500).json({ error: err?.message || 'Failed to load thread' });
  }
});

/**
 * POST /api/messages
 * Body: { recipientId: string, body: string }
 * Sends a message from the current user to recipientId.
 */
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const me = req.user;
    if (!me) return res.status(401).json({ error: 'Unauthorized' });

    const { recipientId, body } = req.body ?? {};
    if (!recipientId || typeof recipientId !== 'string') {
      return res.status(400).json({ error: 'recipientId is required' });
    }
    if (!body || typeof body !== 'string' || !body.trim()) {
      return res.status(400).json({ error: 'body is required' });
    }
    const sender = await resolveSender(me);
    if (!sender) {
      return res.status(401).json({ error: 'Your account is not available in the application database. Please sign in again.' });
    }

    if (recipientId === sender.id) {
      return res.status(400).json({ error: 'Cannot message yourself' });
    }

    // Verify recipient exists
    const { data: recipient, error: rErr } = await supabase
      .from('users')
      .select('id, role, section, year_level, teaching_year_levels, teaching_sections')
      .eq('id', recipientId)
      .maybeSingle();
    if (rErr) throw rErr;
    if (!recipient) return res.status(404).json({ error: 'Recipient not found' });

    // Restrict cross-role messaging to student <-> instructor within the same section/year level.
    if (!canContact(sender, recipient)) {
      return res.status(403).json({ error: 'You can only message the students/instructors in your own section and year level.' });
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_id: sender.id,
        recipient_id: recipientId,
        body: body.trim(),
      })
      .select('id, sender_id, recipient_id, body, read_at, created_at')
      .single();
    if (error) throw error;

    res.status(201).json(data);
  } catch (err: any) {
    console.error('Error sending message:', err);
    res.status(500).json({ error: err?.message || 'Failed to send message' });
  }
});

/**
 * POST /api/messages/thread/:userId/read
 * Marks all messages from :userId to current user as read.
 */
router.post('/thread/:userId/read', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const me = req.user;
    if (!me) return res.status(401).json({ error: 'Unauthorized' });
    const otherId = req.params.userId;
    if (!otherId) return res.status(400).json({ error: 'Invalid user' });
    const sender = await resolveSender(me);
    if (!sender) return res.status(401).json({ error: 'Your account is not available in the application database. Please sign in again.' });

    const { error } = await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('sender_id', otherId)
      .eq('recipient_id', sender.id)
      .is('read_at', null);
    if (error) throw error;

    res.json({ success: true });
  } catch (err: any) {
    console.error('Error marking thread read:', err);
    res.status(500).json({ error: err?.message || 'Failed to mark thread read' });
  }
});

/**
 * GET /api/messages/unread-count
 * Total unread count for the bell/badge UI.
 */
router.get('/unread-count', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const me = req.user;
    if (!me) return res.status(401).json({ error: 'Unauthorized' });
    const sender = await resolveSender(me);
    if (!sender) return res.status(401).json({ error: 'Your account is not available in the application database. Please sign in again.' });

    const { count, error } = await supabase
      .from('messages')
      .select('id', { head: true, count: 'exact' })
      .eq('recipient_id', sender.id)
      .is('read_at', null);
    if (error) throw error;

    res.json({ count: count ?? 0 });
  } catch (err: any) {
    console.error('Error loading unread count:', err);
    res.status(500).json({ error: err?.message || 'Failed to load unread count' });
  }
});

export default router;
