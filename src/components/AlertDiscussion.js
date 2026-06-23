import { useState, useEffect, useCallback } from 'react'

const API_URL = process.env.REACT_APP_API_URL
const MAX_COMMENT_LEN = 600 // mirrors the backend cap

// small relative-time helper, same vocabulary as the rest of the app
function timeAgo(iso)
{
  if (!iso) return ''
  const secs = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// A discussion thread for a single alert. Public read, sign-in to post.
// Admins get a Delete on each comment (soft-delete on the backend).
export default function AlertDiscussion({ alert, firebaseUid, authorName, isAdmin = false, onClose })
{
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState(null)

  // load the thread for whichever alert is open
  const loadComments = useCallback(() =>
  {
    if (!alert) return
    setLoading(true)
    fetch(`${API_URL}/incidents/${alert.id}/comments`)
      .then((res) => res.json())
      .then((data) =>
      {
        setComments(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch((err) =>
      {
        console.error('Failed to load comments:', err)
        setLoading(false)
      })
  }, [alert])

  useEffect(() =>
  {
    loadComments()
  }, [loadComments])

  const postComment = () =>
  {
    const text = body.trim()
    if (!text) return
    if (!firebaseUid)
    {
      setError('Sign in to join the discussion.')
      return
    }

    setPosting(true)
    setError(null)

    fetch(`${API_URL}/incidents/${alert.id}/comments`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: text, firebase_uid: firebaseUid, author_name: authorName || null }),
    })
      .then((res) =>
      {
        if (!res.ok) throw new Error('post failed')
        return res.json()
      })
      .then((created) =>
      {
        // append it locally so it shows up instantly
        setComments((prev) => [...prev, created])
        setBody('')
      })
      .catch((err) =>
      {
        console.error('Failed to post comment:', err)
        setError("Couldn't post. Try again.")
      })
      .finally(() => setPosting(false))
  }

  // admin moderation: soft-delete a comment and drop it from the thread
  const deleteComment = (id) =>
  {
    if (!firebaseUid) return

    fetch(`${API_URL}/admin/comments/${id}/delete?firebase_uid=${firebaseUid}`, { method: 'POST' })
      .then((res) =>
      {
        if (!res.ok) throw new Error('delete failed')
        return res.json()
      })
      .then(() => setComments((prev) => prev.filter((c) => c.id !== id)))
      .catch((err) => console.error('Failed to delete comment:', err))
  }

  if (!alert) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center">
      {/* tap-out backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* panel — bottom sheet on mobile, centered card on desktop */}
      <div className="relative w-full md:max-w-md max-h-[85vh] md:max-h-[80vh] bg-neutral-900 border border-neutral-800 rounded-t-3xl md:rounded-3xl flex flex-col overflow-hidden">

        {/* header */}
        <div className="px-5 pt-4 pb-3 border-b border-neutral-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-neutral-400 text-xs font-medium">Discussion</p>
              <h2 className="text-white font-semibold text-base leading-tight">{alert.title}</h2>
              {alert.location_text && (
                <p className="text-neutral-500 text-xs mt-0.5">{alert.location_text}</p>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Close discussion"
              className="w-8 h-8 rounded-full bg-neutral-800 text-neutral-400 flex items-center justify-center active:bg-neutral-700 shrink-0"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* thread */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
          {loading ? (
            <p className="text-neutral-500 text-sm">Loading…</p>
          ) : comments.length === 0 ? (
            <p className="text-neutral-500 text-sm">No comments yet. Share what you're seeing to help others stay safe.</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="bg-neutral-800 rounded-2xl px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-white text-xs font-semibold">{c.author_name || 'Student'}</span>
                  <span className="text-neutral-500 text-[11px]">{timeAgo(c.created_at)}</span>
                </div>
                <p className="text-neutral-200 text-sm mt-1 whitespace-pre-wrap break-words">{c.body}</p>
                {isAdmin && (
                  <button
                    onClick={() => deleteComment(c.id)}
                    className="text-red-400 text-[11px] mt-1.5 active:text-red-300"
                  >
                    Delete
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* composer */}
        <div className="px-5 py-3 border-t border-neutral-800">
          {firebaseUid ? (
            <div>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, MAX_COMMENT_LEN))}
                placeholder="Share an update…"
                rows={2}
                className="w-full bg-neutral-800 text-white text-sm rounded-2xl px-3 py-2 outline-none resize-none placeholder-neutral-500"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-neutral-600 text-[11px]">{body.length}/{MAX_COMMENT_LEN}</span>
                <button
                  onClick={postComment}
                  disabled={posting || !body.trim()}
                  className="bg-white text-black text-sm font-semibold rounded-full px-4 py-1.5 disabled:opacity-40 active:bg-neutral-200"
                >
                  {posting ? 'Posting…' : 'Post'}
                </button>
              </div>
              {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
            </div>
          ) : (
            <p className="text-neutral-500 text-sm">Sign in to join the discussion.</p>
          )}
        </div>
      </div>
    </div>
  )
}